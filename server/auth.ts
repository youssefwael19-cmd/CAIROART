import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DEMO_STAFF } from "../src/staff";
import type { SessionUser, StaffRole } from "../src/types";
import { DATA_DIR, dataFile } from "./paths";
import { sqlite } from "./sqlite";
import {
  dropExpiredSessions,
  queueWrite,
  readSessions,
  readStaff,
  usingPostgres,
  writeSessions,
  writeStaff,
  type SessionRow,
  type StaffRow,
} from "./storage";

const STAFF_FILE = dataFile("staff.json");
const SESSIONS_FILE = dataFile("sessions.json");
const INITIAL_PASSWORD_FILE = dataFile("initial-manager-password.txt");

export const SESSION_COOKIE = "ca_session";
const SESSION_MS = 8 * 60 * 60 * 1000;

const MAX_FAILURES = 8;
const LOCK_MS = 10 * 60 * 1000;

export interface StoredUser extends SessionUser {
  passwordHash: string;
}

interface Session {
  userId: string;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const failures = new Map<string, { count: number; until: number }>();

let cache: StoredUser[] | null = null;
let sessionsLoaded = false;

/* Demo accounts exist only when explicitly switched on for local work.
   Without the flag the app seeds one manager with a random password that must
   be changed at first sign-in. */
export function demoMode() {
  return process.env.DEMO_ACCOUNTS === "1";
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(16), (b) => chars[b % chars.length]).join("");
}

/* Accounts live in the database, never in the JSON the browser receives. */
function loadUsers(): StoredUser[] {
  if (cache) return cache;
  if (usingPostgres) throw new Error("[auth] initAuth() must finish before staff are read on Postgres");

  const rows = sqlite().prepare("SELECT data FROM staff").all() as { data: string }[];
  if (rows.length > 0) {
    cache = rows.map((row) => JSON.parse(row.data) as StoredUser);
    return cache;
  }

  /* One-time import of the pre-SQLite staff file. */
  if (!usingPostgres && fs.existsSync(STAFF_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STAFF_FILE, "utf8")) as StoredUser[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        cache = parsed;
        saveUsers(cache);
        fs.renameSync(STAFF_FILE, `${STAFF_FILE}.imported`);
        console.log("[auth] Imported data/staff.json into SQLite.");
        return cache;
      }
    } catch {
      /* fall through to a fresh roster */
    }
  }

  cache = seedUsers();
  saveUsers(cache);
  return cache;
}

function seedUsers(): StoredUser[] {
  if (demoMode()) {
    return DEMO_STAFF.map(({ password, ...user }) => ({
      ...user,
      mustChangePassword: false,
      passwordHash: hashPassword(password),
    }));
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const override = initialPasswordOverride();
  const password = override ?? randomPassword();
  const manager: StoredUser = {
    id: "usr_manager",
    nameEn: "Youssef Wael",
    nameAr: "يوسف وائل",
    email: "youssef@cairoart.net",
    role: "manager",
    employeeId: null,
    active: true,
    mustChangePassword: true,
    passwordHash: hashPassword(password),
  };
  if (override) {
    console.log(
      `[auth] Created the first manager (${manager.email}) from INITIAL_MANAGER_PASSWORD. It must be changed at first sign-in.`,
    );
    return [manager];
  }

  fs.writeFileSync(INITIAL_PASSWORD_FILE, `${manager.email}\n${password}\n`, { mode: 0o600 });
  console.log(
    `[auth] Created the first manager (${manager.email}). A one-time password is in ${INITIAL_PASSWORD_FILE} and must be changed at first sign-in.`,
  );
  return [manager];
}

/* A deploy has no shell to read the generated password file from, so the owner
   may supply the first password through the environment. It is applied once to
   the manager who has never signed in, and that manager still has to choose a
   new password before the desk opens. */
function initialPasswordOverride() {
  const value = process.env.INITIAL_MANAGER_PASSWORD?.trim();
  return value && value.length >= 10 ? value : null;
}

async function applyInitialPasswordOverride(users: StoredUser[]): Promise<StoredUser[]> {
  const value = initialPasswordOverride();
  if (!value) return users;
  const manager = users.find((user) => user.role === "manager" && user.mustChangePassword);
  if (!manager || verifyPassword(value, manager.passwordHash)) return users;
  manager.passwordHash = hashPassword(value);
  await writeStaff(
    users.map((user) => ({ id: user.id, email: user.email.toLowerCase(), data: JSON.stringify(user) })),
  );
  console.log("[auth] Applied INITIAL_MANAGER_PASSWORD to the first manager; it must be changed at first sign-in.");
  return users;
}

function saveUsers(users: StoredUser[]) {
  cache = users;
  if (usingPostgres) {
    /* The whole roster goes every time, so a failed write heals on the next one. */
    const rows: StaffRow[] = users.map((user) => ({
      id: user.id,
      email: user.email.toLowerCase(),
      data: JSON.stringify(user),
    }));
    queueWrite("staff", () => writeStaff(rows));
    return;
  }
  const db = sqlite();
  const upsert = db.prepare(
    "INSERT INTO staff(id, email, data) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, data = excluded.data",
  );
  const remove = db.prepare("DELETE FROM staff WHERE id = ?");
  const ids = new Set(users.map((user) => user.id));

  db.transaction(() => {
    for (const user of users) upsert.run(user.id, user.email.toLowerCase(), JSON.stringify(user));
    for (const row of db.prepare("SELECT id FROM staff").all() as { id: string }[]) {
      if (!ids.has(row.id)) remove.run(row.id);
    }
  })();
}

function publicUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    nameEn: user.nameEn,
    nameAr: user.nameAr,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    active: user.active !== false,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

/* Called at boot so a fresh installation writes its one-time manager password
   before anyone tries to sign in. */
export function ensureStaffSeed() {
  loadUsers();
}

/* Postgres needs its accounts and sessions in memory before the port opens. */
export async function initAuth() {
  if (!usingPostgres) {
    ensureStaffSeed();
    loadSessions();
    return;
  }

  const staffRows = await readStaff();
  cache = staffRows.flatMap((row) => {
    try {
      return [JSON.parse(row.data) as StoredUser];
    } catch {
      console.error("[auth] Skipping unreadable staff record", row.id);
      return [];
    }
  });

  if (cache.length === 0) {
    cache = seedUsers();
    await writeStaff(
      cache.map((user) => ({ id: user.id, email: user.email.toLowerCase(), data: JSON.stringify(user) })),
    );
  } else {
    cache = await applyInitialPasswordOverride(cache);
  }

  const now = Date.now();
  for (const row of await readSessions(now)) {
    sessions.set(row.token, { userId: row.user_id, expiresAt: row.expires_at });
  }
  sessionsLoaded = true;
  await dropExpiredSessions(now);
}

export function authenticate(email: string, password: string): SessionUser | null {
  const user = loadUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.active === false || !verifyPassword(password, user.passwordHash)) return null;
  return publicUser(user);
}

/* Sessions are kept in memory and mirrored to disk so a restart no longer
   signs the whole team out. */
function loadSessions() {
  if (sessionsLoaded) return;
  sessionsLoaded = true;
  /* Postgres sessions are loaded once by initAuth(). */
  if (usingPostgres) return;

  const db = sqlite();
  const now = Date.now();
  const rows = db
    .prepare("SELECT token, user_id, expires_at FROM sessions WHERE expires_at > ?")
    .all(now) as { token: string; user_id: string; expires_at: number }[];

  /* One-time import of the pre-SQLite session file so upgrades do not sign
     everybody out. */
  if (rows.length === 0 && fs.existsSync(SESSIONS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8")) as Record<string, Session>;
      for (const [token, session] of Object.entries(raw)) {
        if (session?.userId && session.expiresAt > now) sessions.set(token, session);
      }
      if (sessions.size > 0) saveSessions();
      fs.renameSync(SESSIONS_FILE, `${SESSIONS_FILE}.imported`);
    } catch {
      /* nothing to import */
    }
  }

  for (const row of rows) sessions.set(row.token, { userId: row.user_id, expiresAt: row.expires_at });
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
}

function saveSessions() {
  if (usingPostgres) {
    const rows: SessionRow[] = [...sessions].map(([token, s]) => ({
      token,
      user_id: s.userId,
      expires_at: s.expiresAt,
    }));
    queueWrite("sessions", () => writeSessions(rows));
    return;
  }
  const db = sqlite();
  const upsert = db.prepare(
    "INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?) ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, expires_at = excluded.expires_at",
  );
  const remove = db.prepare("DELETE FROM sessions WHERE token = ?");
  const tokens = new Set(sessions.keys());

  db.transaction(() => {
    for (const [token, session] of sessions) upsert.run(token, session.userId, session.expiresAt);
    for (const row of db.prepare("SELECT token FROM sessions").all() as { token: string }[]) {
      if (!tokens.has(row.token)) remove.run(row.token);
    }
  })();
}

export function createSession(userId: string): string {
  loadSessions();
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { userId, expiresAt: now + SESSION_MS });
  saveSessions();
  return token;
}

export function sessionUser(token: string | undefined): SessionUser | null {
  if (!token) return null;
  loadSessions();
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    saveSessions();
    return null;
  }
  const user = loadUsers().find((u) => u.id === session.userId);
  if (!user || user.active === false) {
    sessions.delete(token);
    saveSessions();
    return null;
  }
  return publicUser(user);
}

export function destroySession(token: string | undefined) {
  if (!token) return;
  loadSessions();
  sessions.delete(token);
  saveSessions();
}

function destroyUserSessions(userId: string) {
  loadSessions();
  let changed = false;
  for (const [token, session] of sessions) {
    if (session.userId === userId) {
      sessions.delete(token);
      changed = true;
    }
  }
  if (changed) saveSessions();
}

function destroyOtherSessions(userId: string, keepToken: string | undefined) {
  loadSessions();
  let changed = false;
  for (const [token, session] of sessions) {
    if (session.userId === userId && token !== keepToken) {
      sessions.delete(token);
      changed = true;
    }
  }
  if (changed) saveSessions();
}

/* ---------------- staff administration ---------------- */

export class StaffError extends Error {}

export function listStaff(): SessionUser[] {
  return loadUsers()
    .slice()
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "manager" ? -1 : 1;
      const left = (a.active === false ? 1 : 0) - (b.active === false ? 1 : 0);
      return left !== 0 ? left : a.nameEn.localeCompare(b.nameEn);
    })
    .map(publicUser);
}

function validPassword(password: string) {
  if (password.length < 8) throw new StaffError("the password must be at least 8 characters");
}

export function createStaff(input: {
  nameEn: string;
  nameAr: string;
  email: string;
  role: StaffRole;
  employeeId: string | null;
  password: string;
}): SessionUser {
  const users = loadUsers();
  const email = input.email.trim().toLowerCase();
  const nameEn = input.nameEn.trim();
  const nameAr = input.nameAr.trim();

  if (!nameEn || !nameAr) throw new StaffError("both names are required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StaffError("a valid work email is required");
  if (input.role !== "manager" && input.role !== "agent") throw new StaffError("unknown role");
  validPassword(input.password);
  if (users.some((u) => u.email.toLowerCase() === email)) throw new StaffError("that email already has an account");

  const user: StoredUser = {
    id: `usr_${crypto.randomBytes(4).toString("hex")}`,
    nameEn,
    nameAr,
    email,
    role: input.role,
    employeeId: input.employeeId || null,
    active: true,
    mustChangePassword: true,
    passwordHash: hashPassword(input.password),
  };
  saveUsers([...users, user]);
  return publicUser(user);
}

export function setStaffActive(id: string, active: boolean, actingUserId: string): SessionUser {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) throw new StaffError("account not found");

  if (!active) {
    if (user.id === actingUserId) throw new StaffError("you cannot deactivate your own account");
    const managers = users.filter((u) => u.role === "manager" && u.active !== false);
    if (user.role === "manager" && managers.length <= 1) throw new StaffError("keep at least one active manager");
    destroyUserSessions(user.id);
  }

  user.active = active;
  saveUsers(users);
  return publicUser(user);
}

/* A signed-in staff member rotating their own password. The session they are
   using survives; every other device is signed out. */
export function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  keepToken: string | undefined,
): SessionUser {
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) throw new StaffError("account not found");
  if (!verifyPassword(currentPassword, user.passwordHash)) throw new StaffError("current password is incorrect");
  validPassword(newPassword);
  if (verifyPassword(newPassword, user.passwordHash)) throw new StaffError("the new password must be different");

  user.passwordHash = hashPassword(newPassword);
  user.mustChangePassword = false;
  saveUsers(users);
  destroyOtherSessions(user.id, keepToken);
  return publicUser(user);
}

export function setStaffPassword(id: string, password: string, actingUserId: string): SessionUser {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) throw new StaffError("account not found");
  validPassword(password);

  user.passwordHash = hashPassword(password);
  user.mustChangePassword = true;
  saveUsers(users);
  /* Sign the account out everywhere, except when a manager rotates their own. */
  if (user.id !== actingUserId) destroyUserSessions(user.id);
  return publicUser(user);
}

export function sessionMaxAge() {
  return Math.round(SESSION_MS / 1000);
}

export function tooManyAttempts(key: string) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (entry.until <= Date.now()) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(key: string) {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || entry.until <= now) failures.set(key, { count: 1, until: now + LOCK_MS });
  else entry.count += 1;
}

export function clearFailures(key: string) {
  failures.delete(key);
}

