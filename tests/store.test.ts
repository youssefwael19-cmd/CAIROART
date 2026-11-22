import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cairo-art-store-"));
/* Keep the test away from the workspace data directory entirely. */
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "test.sqlite");

const { sqlite } = await import("../server/sqlite");
const { getDb, persist } = await import("../server/store");

const rows = (collection?: string) => {
  const query = collection
    ? sqlite().prepare("SELECT COUNT(*) AS c FROM records WHERE collection = ?").get(collection)
    : sqlite().prepare("SELECT COUNT(*) AS c FROM records").get();
  return (query as { c: number }).c;
};

test("the store seeds on first boot and writes every record to SQLite", () => {
  const db = getDb();
  assert.ok(db.products.length > 0, "seed data is present");
  assert.equal(rows("products"), db.products.length);

  db.products.unshift({
    id: "prd_test",
    sku: "GLS-TST-01",
    nameEn: "Test vase",
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

  assert.equal(rows("products"), db.products.length);
  const stored = sqlite().prepare("SELECT data FROM records WHERE collection = 'products' AND id = 'prd_test'").get() as { data: string };
  assert.equal(JSON.parse(stored.data).sku, "GLS-TST-01");
});

test("repeated writes are idempotent", () => {
  const before = rows();
  persist();
  persist();
  assert.equal(rows(), before);
});

test("all app collections are represented", () => {
  const db = getDb();
  for (const collection of ["products", "conversations", "orders", "channels", "employees", "tasks", "activity"] as const) {
    assert.equal(rows(collection), db[collection].length, `${collection} is persisted`);
  }
});

after(() => {
  try {
    sqlite().close();
  } catch {
    /* already closed */
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
