import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ChannelKind, Conversation, Database, OrderStatus, SessionUser, TaskStatus } from "../src/types";
import {
  authenticate,
  changeOwnPassword,
  clearFailures,
  createSession,
  demoMode,
  initAuth,
  createStaff,
  destroySession,
  listStaff,
  recordFailure,
  SESSION_COOKIE,
  sessionMaxAge,
  sessionUser,
  setStaffActive,
  setStaffPassword,
  StaffError,
  tooManyAttempts,
} from "./auth";
import { aiMode, analyseSales, auditTeam, digest, qualify, runCommand } from "./ai";
import { deriveOrder, handleCustomerMessage } from "./agents";
import { ORDER_STATUSES, ordersCsv, syncOrders } from "./orders";
import { orderConfirmationHtml } from "./print";
import { processProductPhoto } from "./image";
import { couponMessage, normalisePhone } from "../src/coupons";
import { dataFile } from "./paths";
import { shareToken, verifyShareToken } from "./share";
import { initStore, logActivity, nowIso, persist, uid } from "./store";
import { flushWrites, usingPostgres } from "./storage";

let db: Database;

/* Recompute qualification once at boot so the seeded conversations are consistent. */
function boot() {
  for (const c of db.conversations) {
    c.order = deriveOrder(c);
    c.qualification = qualify(c);
    if (c.status === "ai-handling" && c.order.missing.length === 0) c.status = "ready-for-handoff";
    /* an incomplete order sheet cannot sit in the handoff queue */
    if (c.status === "ready-for-handoff" && c.order.missing.length > 0) c.status = "ai-handling";
  }
  syncOrders(db);
}

/* Any change that can complete an order sheet also writes it to the orders book. */
function commit() {
  syncOrders(db);
  persist();
}

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

type ApiEnv = { Variables: { user: SessionUser } };

const app = new Hono<ApiEnv>();

const meta = () => ({
  aiMode,
  whatsapp: Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID),
  generatedAt: nowIso(),
});

/* Reachable without a session: the probe, the sign-in pair, and Meta's webhook
   (which authenticates itself with the verify token). */
const PUBLIC_API = new Set([
  "/api/health",
  "/api/auth/config",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/whatsapp/webhook",
]);

app.use("*", async (c, next) => {
  await next();
  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "same-origin");
  c.header("x-frame-options", "SAMEORIGIN");
});

/* Catalog photos are public marketing assets: the storefront shows them and
   WhatsApp has to fetch them by URL to deliver a product picture. */
const isPublicMedia = (path: string) => /^\/api\/media\/[a-z0-9_-]+\.jpg$/i.test(path);

app.use("/api/*", async (c, next) => {
  if (PUBLIC_API.has(c.req.path) || isPublicMedia(c.req.path)) return next();
  /* A customer confirmation opened with a valid signed token skips the session;
     the print handler verifies the token itself. */
  const sharedPrint = /^\/api\/orders\/[^/]+\/print$/.test(c.req.path) && Boolean(c.req.query("token"));
  if (sharedPrint) return next();
  const user = sessionUser(getCookie(c, SESSION_COOKIE));
  if (!user) return c.json({ error: "sign in required" }, 401);
  c.set("user", user);
  return next();
});

app.onError((err, c) => {
  if (err instanceof SyntaxError) return c.json({ error: "malformed JSON body" }, 400);
  console.error("unhandled request error", err);
  return c.json({ error: "internal error" }, 500);
});

/* Changing the site or the orders book is a manager action. */
function managerOnly(c: Context<ApiEnv>) {
  if (c.get("user").role === "manager") return null;
  return c.json({ error: "managers only" }, 403);
}

/* Sign-in throttling keys on the socket address. Forwarded headers are only
   trusted when a reverse proxy is explicitly declared, since any client can
   send them. */
function clientKey(c: Context<ApiEnv>) {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  const server = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return server?.incoming?.socket?.remoteAddress || "local";
}

function isSecureRequest(c: Context<ApiEnv>) {
  return process.env.NODE_ENV === "production" || c.req.header("x-forwarded-proto") === "https";
}

app.get("/api/health", (c) => c.json({ ok: true, storage: usingPostgres ? "postgres" : "sqlite", ...meta() }));

/* Lets the sign-in screen know whether this build offers demo accounts. */
app.get("/api/auth/config", (c) => c.json({ demo: demoMode() }));

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as { email?: string; password?: string });
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!email || !password) return c.json({ error: "email and password are required" }, 400);

  const key = clientKey(c);
  if (tooManyAttempts(key)) return c.json({ error: "too many attempts — try again in a few minutes" }, 429);

  const user = authenticate(email, password);
  if (!user) {
    recordFailure(key);
    return c.json({ error: "email or password is incorrect" }, 401);
  }

  clearFailures(key);
  logActivity(
    "access",
    `${user.nameEn} signed in.`,
    `${user.nameAr} سجّل الدخول.`,
    "neutral",
    "access",
  );
  const token = createSession(user.id);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: isSecureRequest(c),
    maxAge: sessionMaxAge(),
  });
  return c.json({ db, meta: meta(), user });
});

app.post("/api/auth/logout", (c) => {
  destroySession(getCookie(c, SESSION_COOKIE));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.post("/api/auth/password", async (c) => {
  const body = await c.req
    .json<{ currentPassword?: string; newPassword?: string }>()
    .catch(() => ({}) as { currentPassword?: string; newPassword?: string });
  try {
    const user = changeOwnPassword(
      c.get("user").id,
      String(body.currentPassword ?? ""),
      String(body.newPassword ?? ""),
      getCookie(c, SESSION_COOKIE),
    );
    logActivity(
      "access",
      `${user.nameEn} changed their password.`,
      `${user.nameAr} غيّر كلمة المرور.`,
      "neutral",
      "access",
    );
    return c.json({ ok: true, user });
  } catch (err) {
    if (err instanceof StaffError) return c.json({ error: err.message }, 400);
    throw err;
  }
});

app.get("/api/state", (c) => {
  syncOrders(db);
  return c.json({ db, meta: meta(), user: c.get("user") });
});

/* ---------------- staff administration ---------------- */

app.get("/api/staff", (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  return c.json({ staff: listStaff() });
});

app.post("/api/staff/create", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{
    nameEn?: string;
    nameAr?: string;
    email?: string;
    role?: "manager" | "agent";
    employeeId?: string | null;
    password?: string;
  }>();
  try {
    const user = createStaff({
      nameEn: String(body.nameEn ?? ""),
      nameAr: String(body.nameAr ?? ""),
      email: String(body.email ?? ""),
      role: body.role === "manager" ? "manager" : "agent",
      employeeId: db.employees.some((e) => e.id === body.employeeId) ? (body.employeeId as string) : null,
      password: String(body.password ?? ""),
    });
    logActivity(
      "access",
      `${user.nameEn} was added as ${user.role}.`,
      `تمت إضافة ${user.nameAr} بدور ${user.role === "manager" ? "مدير" : "موظف"}.`,
      "good",
      "access",
    );
    return c.json({ staff: listStaff(), user });
  } catch (err) {
    if (err instanceof StaffError) return c.json({ error: err.message }, 400);
    throw err;
  }
});

app.post("/api/staff/active", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ id?: string; active?: boolean }>();
  try {
    const user = setStaffActive(String(body.id ?? ""), Boolean(body.active), c.get("user").id);
    logActivity(
      "access",
      `${user.nameEn} was ${user.active ? "reactivated" : "deactivated"}.`,
      `تم ${user.active ? "تفعيل" : "إيقاف"} حساب ${user.nameAr}.`,
      user.active ? "good" : "warn",
      "access",
    );
    return c.json({ staff: listStaff(), user });
  } catch (err) {
    if (err instanceof StaffError) return c.json({ error: err.message }, 400);
    throw err;
  }
});

app.post("/api/staff/password", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ id?: string; password?: string }>();
  try {
    const user = setStaffPassword(String(body.id ?? ""), String(body.password ?? ""), c.get("user").id);
    logActivity(
      "access",
      `Password reset for ${user.nameEn}.`,
      `تمت إعادة تعيين كلمة مرور ${user.nameAr}.`,
      "neutral",
      "access",
    );
    return c.json({ staff: listStaff(), user });
  } catch (err) {
    if (err instanceof StaffError) return c.json({ error: err.message }, 400);
    throw err;
  }
});

/* A workshop profile is the person orders and tasks are assigned to. It is
   separate from a sign-in account: not everyone at the bench needs the app. */
app.post("/api/employees/create", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ nameEn?: string; nameAr?: string; roleEn?: string; roleAr?: string }>();
  const nameEn = String(body.nameEn ?? "").trim();
  const nameAr = String(body.nameAr ?? "").trim();
  if (!nameEn || !nameAr) return c.json({ error: "English and Arabic names are required" }, 400);

  const employee = {
    id: uid("emp"),
    nameEn,
    nameAr,
    roleEn: String(body.roleEn ?? "").trim() || "Team member",
    roleAr: String(body.roleAr ?? "").trim() || "عضو الفريق",
    online: false,
  };
  db.employees.push(employee);
  logActivity(
    "access",
    `${employee.nameEn} joined the team as ${employee.roleEn}.`,
    `انضم ${employee.nameAr} إلى الفريق بدور ${employee.roleAr}.`,
    "good",
    "access",
  );
  commit();
  return c.json({ db, meta: meta(), employee });
});

/* ---------------- orders book ---------------- */

app.get("/api/orders/export.csv", (c) => {
  syncOrders(db);
  const lang = c.req.query("lang") === "ar" ? "ar" : "en";
  const csv = ordersCsv(db, lang);
  return c.body(csv, 200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="cairo-art-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
  });
});

app.get("/api/orders/:id/print", (c) => {
  syncOrders(db);
  const order = db.orders.find((o) => o.id === c.req.param("id"));
  if (!order) return c.text("order not found", 404);

  /* Staff open it with their session; customers open it with a signed,
     expiring token the team generated for them. */
  const token = c.req.query("token");
  const shared = verifyShareToken(order.id, token);
  if (!shared && !sessionUser(getCookie(c, SESSION_COOKIE))) {
    return c.text("this confirmation link has expired — ask the Cairo Art team for a new one", 401);
  }

  const lang = c.req.query("lang") === "ar" ? "ar" : "en";
  return c.html(orderConfirmationHtml(db, order, lang, shared ? token : undefined));
});

/* Creates a seven-day customer link for one order confirmation. */
app.post("/api/orders/:id/share", (c) => {
  syncOrders(db);
  const order = db.orders.find((o) => o.id === c.req.param("id"));
  if (!order) return c.json({ error: "order not found" }, 404);

  const lang = c.req.query("lang") === "ar" ? "ar" : "en";
  const token = shareToken(order.id);
  const proto = c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol.replace(":", "");
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? new URL(c.req.url).host;
  return c.json({
    url: `${proto}://${host}/api/orders/${order.id}/print?lang=${lang}&token=${encodeURIComponent(token)}`,
    expiresInDays: 7,
  });
});

app.post("/api/orders/update", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ id?: string; status?: OrderStatus; assignedTo?: string | null }>();
  const order = db.orders.find((o) => o.id === body.id);
  if (!order) return c.json({ error: "order not found" }, 404);

  if (body.status) {
    if (!ORDER_STATUSES.includes(body.status)) return c.json({ error: "unknown order status" }, 400);
    order.status = body.status;
  }
  if (body.assignedTo !== undefined) {
    order.assignedTo = db.employees.some((e) => e.id === body.assignedTo) ? body.assignedTo : null;
  }
  order.updatedAt = nowIso();
  logActivity(
    "employee",
    `${order.ref} (${order.customerName}) is now ${order.status}.`,
    `${order.ref} (${order.customerName}) أصبح ${order.status}.`,
  );
  persist();
  return c.json({ db, meta: meta() });
});

/* ---------------- customer desk ---------------- */

app.post("/api/inbox/message", async (c) => {
  const body = await c.req.json<{ conversationId?: string; text?: string; author?: "customer" | "employee" }>();
  const conv = db.conversations.find((x) => x.id === body.conversationId);
  if (!conv || !body.text?.trim()) return c.json({ error: "conversation and text are required" }, 400);

  const text = body.text.trim();
  const author = body.author === "employee" ? "employee" : "customer";
  /* Writing in the customer's voice is a simulation tool, not a staff tool. */
  if (author === "customer" && c.get("user").role !== "manager") {
    return c.json({ error: "posting as the customer is a manager action" }, 403);
  }
  const ar = conv.lang === "ar";

  conv.messages.push({ id: uid("msg"), from: author, text, at: nowIso(), lang: conv.lang });
  conv.lastAt = nowIso();

  if (author === "employee") {
    conv.status = "with-employee";
    conv.unread = false;
    conv.order = deriveOrder(conv);
    const employee = c.get("user").employeeId;
    if (!conv.assignedTo && employee) conv.assignedTo = employee;
    if (WHATSAPP_TOKEN && WHATSAPP_PHONE_ID && conv.channel === "whatsapp") {
      void sendWhatsApp(conv.phone, text);
    }
    commit();
    return c.json({ db, meta: meta() });
  }

  conv.unread = true;
  const result = await handleCustomerMessage(conv);
  conv.qualification = result.qualification;
  conv.order = result.order;
  if (result.reply) conv.messages.push(result.reply);
  conv.lastAt = nowIso();
  if (WHATSAPP_TOKEN && WHATSAPP_PHONE_ID && conv.channel === "whatsapp" && result.reply) {
    const origin = new URL(c.req.url).origin;
    void sendWhatsApp(
      conv.phone,
      result.reply.text,
      result.reply.imageUrl ? `${origin}${result.reply.imageUrl}` : null,
    );
  }
  /* Both languages are always written: the feed is read in either language, and
     an empty string shows as a blank row. */
  logActivity(
    "ai",
    `AI qualified ${conv.customerName} (${conv.qualification.score}% complete).`,
    `الذكاء الاصطناعي حدّث تأهيل ${conv.customerName} (${conv.qualification.score}٪ مكتمل).`,
  );
  commit();
  return c.json({ db, meta: meta() });
});

app.post("/api/inbox/handoff", async (c) => {
  const body = await c.req.json<{ conversationId?: string; employeeId?: string }>();
  const conv = db.conversations.find((x) => x.id === body.conversationId);
  const emp = db.employees.find((e) => e.id === body.employeeId);
  if (!conv || !emp) return c.json({ error: "conversation and employee are required" }, 400);

  conv.status = "with-employee";
  conv.assignedTo = emp.id;
  conv.unread = false;
  conv.order = deriveOrder(conv);
  conv.messages.push({
    id: uid("msg"),
    from: "ai",
    text:
      conv.lang === "ar"
        ? `تم تحويلك إلى ${emp.nameAr} — مختص المبيعات المسؤول عن طلبك.`
        : `You're now with ${emp.nameEn}, the sales specialist handling your order.`,
    at: nowIso(),
    lang: conv.lang,
  });
  conv.lastAt = nowIso();

  db.tasks.unshift({
    id: uid("tsk"),
    employeeId: emp.id,
    titleEn: `Continue ${conv.customerName}'s enquiry — ${conv.qualification.interests[0] ?? "general"} (${conv.qualification.score}% qualified)`,
    titleAr: `متابعة استفسار ${conv.customerName} — ${conv.qualification.interests[0] ?? "عام"} (${conv.qualification.score}٪ مؤهل)`,
    kind: "enquiry",
    status: "todo",
    priority: "high",
    dueAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
    updatedAt: nowIso(),
  });
  logActivity(
    "ai",
    `${conv.customerName} handed to ${emp.nameEn} with a full briefing.`,
    `تم تحويل ${conv.customerName} إلى ${emp.nameAr} مع ملخص كامل.`,
    "good",
  );
  commit();
  return c.json({ db, meta: meta() });
});

app.post("/api/inbox/new", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ channel?: ChannelKind; name?: string; phone?: string; text?: string; lang?: "en" | "ar" }>();
  if (!body.text?.trim()) return c.json({ error: "text is required" }, 400);
  const lang = body.lang === "ar" ? "ar" : "en";
  const conv: Conversation = {
    id: uid("cnv"),
    channel: body.channel ?? "website",
    customerName: body.name?.trim() || (lang === "ar" ? "عميل الموقع" : "Website visitor"),
    phone: body.phone?.trim() || "—",
    lang,
    status: "ai-handling",
    assignedTo: null,
    unread: true,
    qualification: {
      intent: "unqualified", interests: [], quantity: null, budgetEgp: null, city: null, timeline: null,
      missing: ["interest", "quantity", "city"], score: 0, summaryEn: "Awaiting qualification.", summaryAr: "في انتظار التأهيل.",
    },
    messages: [{ id: uid("msg"), from: "customer", text: body.text.trim(), at: nowIso(), lang }],
    lastAt: nowIso(),
    createdAt: nowIso(),
  };
  db.conversations.unshift(conv);
  const result = await handleCustomerMessage(conv);
  conv.qualification = result.qualification;
  conv.order = result.order;
  if (result.reply) conv.messages.push(result.reply);
  conv.lastAt = nowIso();
  commit();
  return c.json({ db, meta: meta(), conversationId: conv.id });
});

/* ---------------- catalog ---------------- */

const MEDIA_DIR = dataFile("uploads");
fs.mkdirSync(MEDIA_DIR, { recursive: true });

app.get("/api/media/:file", async (c) => {
  const name = c.req.param("file");
  if (!/^[a-z0-9_-]+\.jpg$/i.test(name)) return c.text("not found", 404);
  try {
    const file = await fs.promises.readFile(path.join(MEDIA_DIR, name));
    return c.body(new Uint8Array(file), 200, {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    });
  } catch {
    return c.text("not found", 404);
  }
});

app.post("/api/products/upload", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.parseBody();
  const photo = body.photo as File | string | undefined;
  const nameEn = String(body.nameEn ?? "").trim();
  const nameAr = String(body.nameAr ?? "").trim();
  const priceEgp = Number(body.priceEgp);
  const stock = Number(body.stock ?? 0);
  const material = body.material === "mother-of-pearl" ? "mother-of-pearl" : "glass";
  const category = String(body.category ?? "vases").trim().toLowerCase() || "vases";

  if (!nameEn || !nameAr) return c.json({ error: "English and Arabic names are required" }, 400);
  if (!Number.isFinite(priceEgp) || priceEgp <= 0) return c.json({ error: "a valid price is required" }, 400);
  if (!photo || typeof photo === "string" || typeof photo.arrayBuffer !== "function") {
    return c.json({ error: "a product photo is required" }, 400);
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  if (bytes.length > 15 * 1024 * 1024) return c.json({ error: "the photo is larger than 15 MB" }, 413);

  let finished;
  try {
    finished = await processProductPhoto(bytes);
  } catch {
    return c.json({ error: "that photo could not be processed — try a JPG or PNG" }, 422);
  }

  const id = uid("prd");
  const file = `${id}.jpg`;
  await fs.promises.writeFile(path.join(MEDIA_DIR, file), finished.buffer);

  const prefix = material === "glass" ? "GLS" : "MOP";
  const count = db.products.filter((p) => p.material === material).length + 1;
  const sku = `${prefix}-${category.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "NEW"}-${String(count).padStart(2, "0")}`;

  db.products.unshift({
    id,
    sku,
    nameEn,
    nameAr,
    material,
    category,
    priceEgp: Math.round(priceEgp),
    stock: Number.isFinite(stock) ? Math.max(0, Math.round(stock)) : 0,
    status: "published",
    descriptionEn: `${nameEn} — handcrafted at the Cairo Art workshop.`,
    descriptionAr: `${nameAr} — مصنوعة يدويًا في ورشة Cairo Art.`,
    imageUrl: `/api/media/${file}`,
    createdAt: nowIso(),
  });

  logActivity(
    "ai",
    `${nameEn} uploaded — photo finished on white with the Cairoart.net mark.`,
    `تم رفع ${nameAr} — تم تجهيز الصورة بخلفية بيضاء وعلامة Cairoart.net.`,
    "good",
  );
  persist();
  return c.json({ db, meta: meta(), productId: id, cutout: finished.cutout });
});

app.post("/api/command", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ command?: string }>();
  if (!body.command?.trim()) return c.json({ error: "command is required" }, 400);
  const result = runCommand(body.command, db);
  return c.json({ ...result, db, meta: meta() });
});

app.post("/api/products/toggle", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ id?: string }>();
  const product = db.products.find((p) => p.id === body.id);
  if (!product) return c.json({ error: "product not found" }, 404);
  product.status = product.status === "published" ? "draft" : "published";
  logActivity(
    "employee",
    `${product.nameEn} is now ${product.status}.`,
    `${product.nameAr} أصبحت ${product.status === "published" ? "منشورة" : "مسودة"}.`,
  );
  persist();
  return c.json({ db, meta: meta() });
});

/* ---------------- customer groups & coupons ---------------- */

app.post("/api/groups/create", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ nameEn?: string; nameAr?: string; discountPct?: number; couponCode?: string }>();
  const nameEn = String(body.nameEn ?? "").trim();
  const nameAr = String(body.nameAr ?? "").trim();
  const discountPct = Math.round(Number(body.discountPct));
  if (!nameEn || !nameAr) return c.json({ error: "a group name in both languages is required" }, 400);
  if (!Number.isFinite(discountPct) || discountPct < 1 || discountPct > 90) {
    return c.json({ error: "the discount must be between 1% and 90%" }, 400);
  }

  const suggested = `CAIRO${discountPct}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const couponCode = (String(body.couponCode ?? "").trim() || suggested).toUpperCase();
  if (!/^[A-Z0-9-]{3,24}$/.test(couponCode)) {
    return c.json({ error: "coupon codes use letters, numbers and dashes (3–24 characters)" }, 400);
  }
  if (db.groups.some((g) => g.couponCode === couponCode)) {
    return c.json({ error: "another group already uses that coupon code" }, 409);
  }

  db.groups.push({
    id: uid("grp"),
    nameEn,
    nameAr,
    discountPct,
    couponCode,
    contacts: [],
    createdAt: nowIso(),
  });
  logActivity(
    "employee",
    `Coupon group “${nameEn}” created — ${discountPct}% off with ${couponCode}.`,
    `تم إنشاء مجموعة “${nameAr}” — خصم ${discountPct}٪ بكوبون ${couponCode}.`,
  );
  persist();
  return c.json({ db, meta: meta() });
});

app.post("/api/groups/contact", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ groupId?: string; name?: string; phone?: string }>();
  const group = db.groups.find((g) => g.id === body.groupId);
  if (!group) return c.json({ error: "group not found" }, 404);

  const name = String(body.name ?? "").trim();
  const phone = normalisePhone(String(body.phone ?? ""));
  const digits = phone.slice(1);
  if (!name) return c.json({ error: "a customer name is required" }, 400);
  if (digits.length < 8 || digits.length > 15) return c.json({ error: "enter a valid WhatsApp number with its country code" }, 400);
  if (group.contacts.some((ct) => ct.phone.replace(/\D/g, "") === digits)) {
    return c.json({ error: "that number is already in this group" }, 409);
  }

  group.contacts.push({ id: uid("ctc"), name, phone, addedAt: nowIso() });
  logActivity(
    "employee",
    `${name} added to “${group.nameEn}” for the ${group.discountPct}% coupon.`,
    `تمت إضافة ${name} إلى “${group.nameAr}” لكوبون خصم ${group.discountPct}٪.`,
  );
  persist();
  return c.json({ db, meta: meta() });
});

app.post("/api/groups/contact/remove", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ groupId?: string; contactId?: string }>();
  const group = db.groups.find((g) => g.id === body.groupId);
  const contact = group?.contacts.find((ct) => ct.id === body.contactId);
  if (!group || !contact) return c.json({ error: "contact not found" }, 404);

  group.contacts = group.contacts.filter((ct) => ct.id !== contact.id);
  logActivity(
    "employee",
    `${contact.name} was removed from “${group.nameEn}”.`,
    `تمت إزالة ${contact.name} من “${group.nameAr}”.`,
  );
  persist();
  return c.json({ db, meta: meta() });
});

/* One click: the group's coupon goes to every number it holds. Without WhatsApp
   credentials the run is recorded as simulated, never reported as delivered. */
app.post("/api/groups/send", async (c) => {
  const denied = managerOnly(c);
  if (denied) return denied;
  const body = await c.req.json<{ groupId?: string }>();
  const group = db.groups.find((g) => g.id === body.groupId);
  if (!group) return c.json({ error: "group not found" }, 404);
  if (group.contacts.length === 0) return c.json({ error: "this group has no numbers yet" }, 400);

  const simulated = !(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID);
  let sent = 0;
  let failed = 0;

  if (simulated) {
    sent = group.contacts.length;
    for (const ct of group.contacts) ct.lastSentAt = nowIso();
  } else {
    for (let i = 0; i < group.contacts.length; i += 10) {
      const chunk = group.contacts.slice(i, i + 10);
      const results = await Promise.all(
        chunk.map(async (ct) => {
          const ok = await sendWhatsApp(ct.phone, couponMessage(group, ct.name));
          if (ok) ct.lastSentAt = nowIso();
          return ok;
        }),
      );
      sent += results.filter(Boolean).length;
      failed += results.filter((ok) => !ok).length;
    }
  }

  group.lastSentAt = nowIso();
  logActivity(
    "employee",
    simulated
      ? `Coupon ${group.couponCode} (${group.discountPct}% off) simulated for ${sent} numbers in “${group.nameEn}” — WhatsApp is not connected.`
      : `Coupon ${group.couponCode} (${group.discountPct}% off) sent to ${sent} numbers in “${group.nameEn}”${failed ? `, ${failed} could not be reached` : ""}.`,
    simulated
      ? `محاكاة إرسال كوبون ${group.couponCode} (خصم ${group.discountPct}٪) إلى ${sent} رقم في “${group.nameAr}” — واتساب غير متصل.`
      : `تم إرسال كوبون ${group.couponCode} (خصم ${group.discountPct}٪) إلى ${sent} رقم في “${group.nameAr}”${failed ? `، وتعذّر الوصول إلى ${failed}` : ""}.`,
    failed ? "warn" : "good",
  );
  persist();
  return c.json({ db, meta: meta(), sent, total: group.contacts.length, failed, simulated });
});

/* ---------------- analysis ---------------- */

app.post("/api/ai/sales", async (c) => c.json({ analysis: await analyseSales(db), meta: meta() }));
app.post("/api/ai/audit", async (c) => c.json({ audit: await auditTeam(db), meta: meta() }));
app.post("/api/ai/digest", async (c) => c.json({ digest: await digest(db), meta: meta() }));

app.post("/api/tasks/status", async (c) => {
  const body = await c.req.json<{ id?: string; status?: TaskStatus }>();
  const task = db.tasks.find((t) => t.id === body.id);
  if (!task || !body.status) return c.json({ error: "task and status are required" }, 400);
  task.status = body.status;
  task.updatedAt = nowIso();
  logActivity("employee", `Task "${task.titleEn}" moved to ${task.status}.`, `المهمة "${task.titleAr}" أصبحت ${task.status}.`);
  persist();
  return c.json({ db, meta: meta() });
});

/* ---------------- whatsapp cloud api ---------------- */

app.get("/api/whatsapp/webhook", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");
  if (!VERIFY_TOKEN) return c.text("webhook not configured", 503);
  if (mode === "subscribe" && token === VERIFY_TOKEN) return c.text(challenge ?? "");
  return c.text("forbidden", 403);
});

app.post("/api/whatsapp/webhook", async (c) => {
  /* Meta signs every delivery with the app secret. Without that check anyone
     could inject customer messages and burn AI credits. */
  if (!APP_SECRET) return c.text("webhook not configured", 503);
  const raw = await c.req.text();
  const signature = c.req.header("x-hub-signature-256") ?? "";
  const expected = `sha256=${crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex")}`;
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    return c.text("invalid signature", 403);
  }

  let payload: {
    entry?: { changes?: { value?: { messages?: { from?: string; text?: { body?: string } }[]; contacts?: { profile?: { name?: string } }[] } }[] }[];
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return c.text("bad payload", 400);
  }
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg?.text?.body || !msg.from) return c.json({ ok: true });

  const phone = `+${msg.from}`;
  let conv = db.conversations.find((x) => x.channel === "whatsapp" && x.phone.replace(/\D/g, "") === msg.from);
  if (!conv) {
    conv = {
      id: uid("cnv"),
      channel: "whatsapp",
      customerName: value?.contacts?.[0]?.profile?.name || phone,
      phone,
      lang: /[\u0600-\u06FF]/.test(msg.text.body) ? "ar" : "en",
      status: "ai-handling",
      assignedTo: null,
      unread: true,
      qualification: {
        intent: "unqualified", interests: [], quantity: null, budgetEgp: null, city: null, timeline: null,
        missing: ["interest", "quantity", "city"], score: 0, summaryEn: "Awaiting qualification.", summaryAr: "في انتظار التأهيل.",
      },
      messages: [],
      lastAt: nowIso(),
      createdAt: nowIso(),
    };
    db.conversations.unshift(conv);
  }
  conv.messages.push({ id: uid("msg"), from: "customer", text: msg.text.body, at: nowIso(), lang: conv.lang });
  const result = await handleCustomerMessage(conv);
  conv.qualification = result.qualification;
  conv.order = result.order;
  if (result.reply) conv.messages.push(result.reply);
  conv.lastAt = nowIso();
  if (result.reply) {
    const origin = new URL(c.req.url).origin;
    void sendWhatsApp(phone, result.reply.text, result.reply.imageUrl ? `${origin}${result.reply.imageUrl}` : null);
  }
  commit();
  return c.json({ ok: true });
});

async function sendWhatsApp(to: string, text: string, imageUrl?: string | null): Promise<boolean> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${WHATSAPP_TOKEN}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        /* A product photo ships as an image message with the reply as caption. */
        ...(imageUrl
          ? { type: "image", image: { link: imageUrl, caption: text.slice(0, 900) } }
          : { type: "text", text: { body: text } }),
      }),
    });
    if (!res.ok) console.error("whatsapp send failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("whatsapp send failed", err);
    return false;
  }
}

/* Serve the built single-page app when a production build exists. During local
   development Vite serves the same files on port 3000. */
if (fs.existsSync(path.resolve("dist/index.html"))) {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT || process.env.API_PORT || 8787);

/* The database is fully loaded before the port opens, so no request can see a
   half-built store. */
async function start() {
  db = await initStore();
  await initAuth();
  boot();
  persist();

  const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(
      `Cairo Art API on 0.0.0.0:${port} · storage: ${usingPostgres ? "postgres" : "sqlite"} · AI mode: ${aiMode}`,
    );
  });

  /* A platform sends SIGTERM on every deploy and restart: finish queued writes
     before leaving, and never hang the shutdown. */
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      console.log(`[boot] ${signal} received — flushing writes`);
      server.close(() => {
        void flushWrites().finally(() => process.exit(0));
      });
      setTimeout(() => process.exit(0), 8000).unref();
    });
  }
}

start().catch((err) => {
  console.error("[boot] the server could not start:", err);
  process.exit(1);
});
