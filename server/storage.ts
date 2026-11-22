import { Pool } from "pg";

/* One door to durable storage. Locally (and in tests) the app keeps using
   SQLite, which is synchronous and needs none of this. On a hosted deployment
   DATABASE_URL switches the app to Postgres, where every write is queued in
   order and awaited on shutdown. */

export interface RecordRow {
  collection: string;
  id: string;
  data: string;
}

export interface StaffRow {
  id: string;
  email: string;
  data: string;
}

export interface SessionRow {
  token: string;
  user_id: string;
  expires_at: number;
}

const connectionString = process.env.DATABASE_URL?.trim() ?? "";
export const usingPostgres = connectionString.length > 0;

/* A hosted database may hand out a URL ending in ?sslmode=require; an internal
   one usually does not, and asking for TLS there would fail the handshake. */
function wantsSsl(url: string) {
  return /[?&]sslmode=(require|verify-ca|verify-full)/.test(url) || process.env.PGSSL === "1";
}

let pool: Pool | null = null;

function db() {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX || 5),
      ssl: wantsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
      application_name: "cairo-art-ops",
    });
    pool.on("error", (err) => console.error("[db] idle connection failed:", err.message));
  }
  return pool;
}

export async function initSchema() {
  const sql = db();
  await sql.query(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS records_collection ON records(collection);

    CREATE TABLE IF NOT EXISTS staff (
      id    TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      data  JSONB NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS staff_email ON staff(email);

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  `);
}

/* ---------------- reads (only at boot) ---------------- */

export async function readRecords(): Promise<RecordRow[]> {
  const { rows } = await db().query<{ collection: string; id: string; data: unknown }>(
    "SELECT collection, id, data FROM records",
  );
  return rows.map((row) => ({ collection: row.collection, id: row.id, data: JSON.stringify(row.data) }));
}

export async function readStaff(): Promise<StaffRow[]> {
  const { rows } = await db().query<{ id: string; email: string; data: unknown }>("SELECT id, email, data FROM staff");
  return rows.map((row) => ({ id: row.id, email: row.email, data: JSON.stringify(row.data) }));
}

export async function readSessions(now: number): Promise<SessionRow[]> {
  const { rows } = await db().query<{ token: string; user_id: string; expires_at: string }>(
    "SELECT token, user_id, expires_at FROM sessions WHERE expires_at > $1",
    [now],
  );
  return rows.map((row) => ({ token: row.token, user_id: row.user_id, expires_at: Number(row.expires_at) }));
}

export async function dropExpiredSessions(now: number) {
  await db().query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
}

/* ---------------- writes ---------------- */

export async function writeRecords(upserts: RecordRow[], deletes: RecordRow[]) {
  if (upserts.length === 0 && deletes.length === 0) return;
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    for (const row of upserts) {
      await client.query(
        `INSERT INTO records(collection, id, data, updated_at) VALUES($1, $2, $3::jsonb, now())
         ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [row.collection, row.id, row.data],
      );
    }
    for (const row of deletes) {
      await client.query("DELETE FROM records WHERE collection = $1 AND id = $2", [row.collection, row.id]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/* Both of these replace a whole small table, so a missed earlier write heals
   on the next one. */
export async function writeStaff(rows: StaffRow[]) {
  const client = await db().connect();
  const ids = rows.map((row) => row.id);
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(
        `INSERT INTO staff(id, email, data) VALUES($1, $2, $3::jsonb)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, data = EXCLUDED.data`,
        [row.id, row.email, row.data],
      );
    }
    await client.query("DELETE FROM staff WHERE id <> ALL($1::text[])", [ids]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function writeSessions(rows: SessionRow[]) {
  const client = await db().connect();
  const tokens = rows.map((row) => row.token);
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(
        `INSERT INTO sessions(token, user_id, expires_at) VALUES($1, $2, $3)
         ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at`,
        [row.token, row.user_id, row.expires_at],
      );
    }
    await client.query("DELETE FROM sessions WHERE token <> ALL($1::text[])", [tokens]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/* ---------------- ordered write queue ----------------
   Requests never wait for the database. Writes run one after another in the
   order they were made, retry a few times, and the caller only advances its
   "already written" snapshot once the write lands — so a failed write is
   simply retried by the next change instead of being lost. */

let chain: Promise<void> = Promise.resolve();
let pending = 0;

export function queueWrite(label: string, work: () => Promise<void>) {
  pending += 1;
  chain = chain
    .then(async () => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await work();
          return;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (attempt === 3) {
            console.error(`[db] ${label} write failed after 3 attempts — it will be retried by the next change:`, message);
            return;
          }
          console.error(`[db] ${label} write failed (attempt ${attempt}):`, message);
          await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        }
      }
    })
    .finally(() => {
      pending -= 1;
    });
}

export function pendingWrites() {
  return pending;
}

export async function flushWrites() {
  await chain;
}

export async function closePool() {
  await flushWrites();
  if (pool) {
    const closing = pool;
    pool = null;
    await closing.end();
  }
}
