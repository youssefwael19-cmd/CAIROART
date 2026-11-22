import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { dataFile } from "./paths";

/* SQLite replaces the JSON files: one connection, WAL for concurrent readers,
   and every write wrapped in a transaction. */

const DEFAULT_FILE = dataFile("cairo-art.sqlite");

let handle: Database.Database | null = null;

export function sqliteFile() {
  const override = process.env.SQLITE_PATH;
  if (!override) return DEFAULT_FILE;
  return override === ":memory:" ? override : path.resolve(override);
}

export function sqlite(): Database.Database {
  if (handle) return handle;
  /* A hosted deployment gets its database through DATABASE_URL. Silently
     writing a SQLite file there would lose every change on the next restart. */
  if (process.env.DATABASE_URL) {
    throw new Error("SQLite was opened while DATABASE_URL is set — this deployment must use Postgres");
  }

  const file = sqliteFile();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });

  handle = new Database(file);
  if (file !== ":memory:") {
    handle.pragma("journal_mode = WAL");
    handle.pragma("synchronous = NORMAL");
  }
  handle.pragma("busy_timeout = 5000");
  handle.pragma("foreign_keys = ON");
  migrate(handle);
  return handle;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      data       TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS records_collection ON records(collection);

    CREATE TABLE IF NOT EXISTS staff (
      id    TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      data  TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS staff_email ON staff(email);

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  `);

  const version = db.pragma("user_version", { simple: true }) as number;
  if (version < 1) db.pragma("user_version = 1");
}

/* Runs a write as one atomic unit; a failure leaves the database untouched. */
export function transaction<T>(work: () => T): T {
  return sqlite().transaction(work)();
}
