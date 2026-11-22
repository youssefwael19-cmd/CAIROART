import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

/* Runs only when a Postgres URL is supplied:
     TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5433/cairo_art npm test
   The tables are cleared first, so point it at a scratch database. */

const url = process.env.TEST_DATABASE_URL;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cairo-art-pg-"));
process.env.DATA_DIR = dir;
process.env.SEED_DEMO = "1";
delete process.env.SQLITE_PATH;
delete process.env.DEMO_ACCOUNTS;
if (url) process.env.DATABASE_URL = url;

test("postgres keeps records, staff and sessions", { skip: url ? false : "TEST_DATABASE_URL is not set" }, async () => {
  const { initSchema, closePool, flushWrites, readRecords, usingPostgres } = await import("../server/storage");
  assert.equal(usingPostgres, true, "DATABASE_URL switches the app to Postgres");

  await initSchema();
  const { Pool } = await import("pg");
  const sql = new Pool({ connectionString: url });
  await sql.query("DELETE FROM records; DELETE FROM staff; DELETE FROM sessions;");

  const { initStore, getDb, persist } = await import("../server/store");
  const db = await initStore();
  await flushWrites();
  assert.ok(db.products.length > 0, "SEED_DEMO seeds an empty database");

  const count = async (collection: string) =>
    Number((await sql.query("SELECT count(*) FROM records WHERE collection = $1", [collection])).rows[0].count);

  assert.equal(await count("products"), db.products.length, "the seed is written through the queue");

  db.products.unshift({
    id: "prd_pg_test",
    sku: "GLS-PGT-01",
    nameEn: "Postgres test vase",
    nameAr: "فازة اختبار",
    material: "glass",
    category: "vases",
    priceEgp: 100,
    stock: 1,
    status: "draft",
    descriptionEn: "test",
    descriptionAr: "اختبار",
    createdAt: new Date().toISOString(),
  });
  persist();
  await flushWrites();

  const stored = await sql.query("SELECT data FROM records WHERE collection = 'products' AND id = 'prd_pg_test'");
  assert.equal(stored.rows[0].data.sku, "GLS-PGT-01", "jsonb round-trips the record");

  const before = await count("products");
  persist();
  persist();
  await flushWrites();
  assert.equal(await count("products"), before, "repeated writes are idempotent");

  const { initAuth, listStaff, createSession } = await import("../server/auth");
  await initAuth();
  const staff = listStaff();
  assert.equal(staff.length, 1, "a fresh database gets one manager");
  assert.equal(staff[0].mustChangePassword, true);
  assert.ok(fs.existsSync(path.join(dir, "initial-manager-password.txt")), "the one-time password is written to the data volume");

  const staffRows = await sql.query("SELECT count(*) FROM staff");
  assert.equal(Number(staffRows.rows[0].count), 1, "the manager is stored in Postgres");

  const token = createSession(staff[0].id);
  await flushWrites();
  const sessions = await sql.query("SELECT user_id FROM sessions WHERE token = $1", [token]);
  assert.equal(sessions.rowCount, 1, "a session survives in Postgres");

  const loaded = await readRecords();
  assert.ok(loaded.some((row) => row.id === "prd_pg_test"), "records read back from Postgres");

  await sql.end();
  await closePool();
  assert.equal(getDb().products.length, db.products.length);
});

after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});
