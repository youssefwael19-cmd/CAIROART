import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cairo-art-auth-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_PATH = path.join(dir, "test.sqlite");
delete process.env.DEMO_ACCOUNTS;

const { ensureStaffSeed, listStaff, authenticate } = await import("../server/auth");
const { sqlite } = await import("../server/sqlite");

/* seeding is triggered explicitly, exactly as the server does at boot */
ensureStaffSeed();

test("a fresh install seeds one manager and no agents", () => {
  const staff = listStaff();
  assert.equal(staff.length, 1);
  assert.equal(staff[0].role, "manager");
  assert.equal(staff[0].mustChangePassword, true);
  assert.equal(staff[0].active, true);
});

test("the one-time password is on disk at boot and works once", () => {
  const file = path.join(dir, "initial-manager-password.txt");
  assert.ok(fs.existsSync(file), "the password file is written when staff are seeded");

  const [email, password] = fs.readFileSync(file, "utf8").trim().split("\n");
  assert.match(email, /@cairoart\.net$/);
  assert.ok(password.length >= 12);

  const user = authenticate(email, password);
  assert.ok(user, "the generated password authenticates");
  assert.equal(user?.mustChangePassword, true);
  assert.equal(authenticate(email, "wrong-password"), null);
});

test("no demo accounts exist without the flag", () => {
  assert.equal(listStaff().some((account) => account.email === "yasmine@cairoart.net"), false);
});

after(() => {
  try {
    sqlite().close();
  } catch {
    /* already closed */
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
