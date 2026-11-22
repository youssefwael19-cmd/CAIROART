import fs from "node:fs";
import path from "node:path";
import type { Activity, Database } from "../src/types";
import { dataFile } from "./paths";
import { seedDatabase } from "./seed";
import { sqlite } from "./sqlite";
import {
  initSchema,
  queueWrite,
  readRecords,
  usingPostgres,
  writeRecords,
  type RecordRow,
} from "./storage";

const LEGACY_DB_FILE = dataFile("db.json");
const BACKUP_DIR = dataFile("backups");
const BACKUP_KEEP = 14;

const COLLECTIONS = [
  "products",
  "conversations",
  "orders",
  "channels",
  "employees",
  "tasks",
  "activity",
  "groups",
] as const;

type Collection = (typeof COLLECTIONS)[number];

let cache: Database | null = null;
/* What is actually in the database, so a write only touches changed rows. */
let written = new Map<Collection, Map<string, string>>();
let backedUpOn = "";

function emptyDatabase(): Database {
  return {
    products: [],
    conversations: [],
    orders: [],
    channels: [],
    employees: [],
    tasks: [],
    activity: [],
    groups: [],
  };
}

/* Sample customers, orders and sales figures belong in a local sandbox, never
   in a real business database. They load when SEED_DEMO=1, or by default on a
   local SQLite file outside production; a deployed database starts empty. */
export function showcaseData() {
  if (process.env.SEED_DEMO === "1") return true;
  if (process.env.SEED_DEMO === "0") return false;
  return !usingPostgres && process.env.NODE_ENV !== "production";
}

function snapshot(db: Database) {
  const next = new Map<Collection, Map<string, string>>();
  for (const collection of COLLECTIONS) {
    const rows = (db[collection] ?? []) as { id: string }[];
    next.set(collection, new Map(rows.map((row) => [row.id, JSON.stringify(row)])));
  }
  return next;
}

function loadFromRows(rows: RecordRow[]) {
  const db = emptyDatabase();
  for (const row of rows) {
    if (!(COLLECTIONS as readonly string[]).includes(row.collection)) continue;
    const list = db[row.collection as Collection] as { id: string }[];
    try {
      list.push(JSON.parse(row.data));
    } catch {
      console.error(`[store] Skipping unreadable ${row.collection} record ${row.id}`);
    }
  }
  return db;
}

function pruneBackups(extension: string) {
  const pattern = new RegExp(`^cairo-art-\\d{4}-\\d{2}-\\d{2}\\.${extension}$`);
  const backups = fs.readdirSync(BACKUP_DIR).filter((name) => pattern.test(name)).sort();
  for (const stale of backups.slice(0, Math.max(0, backups.length - BACKUP_KEEP))) {
    fs.unlinkSync(path.join(BACKUP_DIR, stale));
  }
}

/* One snapshot per day, so a bad write or a mistaken delete is recoverable. */
function backupDaily() {
  const today = new Date().toISOString().slice(0, 10);
  if (backedUpOn === today) return;
  backedUpOn = today;
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if (usingPostgres) {
      /* Postgres keeps its own backups; this is a plain JSON copy on the data
         volume that a person can read without a database client. */
      const target = path.join(BACKUP_DIR, `cairo-art-${today}.json`);
      if (!fs.existsSync(target)) fs.writeFileSync(target, JSON.stringify(cache, null, 1), { mode: 0o600 });
      pruneBackups("json");
      return;
    }
    const file = sqlite().name;
    if (!file || file === ":memory:") return;
    const target = path.join(BACKUP_DIR, `cairo-art-${today}.sqlite`);
    if (!fs.existsSync(target)) {
      /* VACUUM INTO is a consistent copy while the app keeps running. */
      sqlite().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    }
    pruneBackups("sqlite");
  } catch (err) {
    console.error("[store] daily backup skipped", err);
  }
}

/* Loads everything once at boot. Postgres is read asynchronously here; the rest
   of the app keeps working on the in-memory copy. */
export async function initStore(): Promise<Database> {
  if (cache) return cache;
  if (!usingPostgres) return getDb();

  await initSchema();
  const rows = await readRecords();
  if (rows.length > 0) {
    cache = loadFromRows(rows);
    written = snapshot(cache);
    return cache;
  }

  cache = showcaseData() ? seedDatabase() : emptyDatabase();
  persist();
  return cache;
}

export function getDb(): Database {
  if (cache) return cache;
  if (usingPostgres) {
    throw new Error("initStore() must finish before the database is used on Postgres");
  }

  const rows = sqlite()
    .prepare("SELECT collection, id, data FROM records")
    .all() as RecordRow[];

  if (rows.length > 0) {
    cache = loadFromRows(rows);
    written = new Map();
    for (const collection of COLLECTIONS) written.set(collection, new Map());
    for (const row of rows) {
      if (!(COLLECTIONS as readonly string[]).includes(row.collection)) continue;
      written.get(row.collection as Collection)!.set(row.id, row.data);
    }
    return cache;
  }

  /* First boot after the JSON-file era: import it once, then keep the original
     beside it as evidence for the team. */
  if (fs.existsSync(LEGACY_DB_FILE)) {
    try {
      const imported = JSON.parse(fs.readFileSync(LEGACY_DB_FILE, "utf8")) as Database;
      imported.orders ??= [];
      cache = { ...emptyDatabase(), ...imported };
      persist();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.renameSync(LEGACY_DB_FILE, `${LEGACY_DB_FILE}.imported-${stamp}`);
      console.log(`[store] Imported the existing db.json into SQLite (original kept as ${path.basename(LEGACY_DB_FILE)}.imported-${stamp}).`);
      return cache;
    } catch (err) {
      console.error("[store] Could not import db.json, starting from seed data", err);
    }
  }

  cache = showcaseData() ? seedDatabase() : emptyDatabase();
  persist();
  return cache;
}

export function persist() {
  if (!cache) return;

  const next = snapshot(cache);
  const upserts: RecordRow[] = [];
  const deletes: RecordRow[] = [];
  for (const collection of COLLECTIONS) {
    const before = written.get(collection) ?? new Map<string, string>();
    const after = next.get(collection) ?? new Map<string, string>();
    for (const [id, data] of after) {
      if (before.get(id) !== data) upserts.push({ collection, id, data });
    }
    for (const id of before.keys()) {
      if (!after.has(id)) deletes.push({ collection, id, data: "" });
    }
  }
  if (upserts.length === 0 && deletes.length === 0) return;

  if (usingPostgres) {
    /* The snapshot advances only once the write lands, so a transient database
       failure is retried by the next change rather than dropped. */
    queueWrite("records", async () => {
      await writeRecords(upserts, deletes);
      written = next;
      backupDaily();
    });
    return;
  }

  const db = sqlite();
  const upsert = db.prepare(
    "INSERT INTO records(collection, id, data) VALUES(?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data",
  );
  const remove = db.prepare("DELETE FROM records WHERE collection = ? AND id = ?");

  db.transaction(() => {
    for (const row of upserts) upsert.run(row.collection, row.id, row.data);
    for (const row of deletes) remove.run(row.collection, row.id);
  })();

  written = next;
  backupDaily();
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function logActivity(actor: string, textEn: string, textAr: string, tone: Activity["tone"] = "neutral", kind?: Activity["kind"]) {
  const db = getDb();
  db.activity.unshift({
    id: uid("act"),
    at: nowIso(),
    actor,
    kind: kind ?? (actor === "ai" ? "ai" : "team"),
    textEn,
    textAr,
    tone,
  });
  db.activity = db.activity.slice(0, 60);
  persist();
}
