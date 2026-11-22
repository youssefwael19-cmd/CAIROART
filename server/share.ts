import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataFile } from "./paths";

/* Links sent to customers are signed and time-limited, so the confirmation
   page can open without a staff session and cannot be guessed. */

const SECRET_FILE = dataFile("share-secret.txt");
const DAY_MS = 86_400_000;

let cached: string | null = null;

function secret() {
  if (cached) return cached;
  const fromEnv = process.env.SHARE_SECRET;
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }
  try {
    const stored = fs.readFileSync(SECRET_FILE, "utf8").trim();
    if (stored) {
      cached = stored;
      return cached;
    }
  } catch {
    /* first run */
  }
  const generated = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  cached = generated;
  return cached;
}

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export function shareToken(orderId: string, ttlMs = 7 * DAY_MS) {
  const expires = Date.now() + ttlMs;
  return `${expires}.${sign(`${orderId}.${expires}`)}`;
}

export function verifyShareToken(orderId: string, token: string | undefined) {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || !signature) return false;
  if (expires <= Date.now()) return false;

  const expected = sign(`${orderId}.${expires}`);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}
