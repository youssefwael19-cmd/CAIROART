/* Live acceptance run against the running app (API on 8787 by default).
   Drives every screen's endpoint with demo accounts, records what the
   bilingual order agents actually reply, and writes artifacts/qa-report.md.

   Run:  node scripts/qa-live.mjs
*/

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.QA_BASE || "http://127.0.0.1:8787";
const ART = path.resolve("artifacts");
fs.mkdirSync(ART, { recursive: true });

const results = [];
const report = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const icon = ok ? "PASS" : "FAIL";
  console.log(`${icon}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function section(title, body) {
  report.push(`\n## ${title}\n\n${body}`);
}

async function signIn(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  const cookie = (res.headers.getSetCookie?.() ?? [])[0]?.split(";")[0] ?? "";
  return { status: res.status, body, cookie, setCookie: (res.headers.getSetCookie?.() ?? [])[0] ?? "" };
}

function client(cookie) {
  return async (method, url, payload, rawHeaders = {}) => {
    const headers = { cookie, ...rawHeaders };
    let body;
    if (payload instanceof FormData) body = payload;
    else if (payload !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(payload);
    }
    const res = await fetch(`${BASE}${url}`, { method, headers, body });
    const bytes = Buffer.from(await res.arrayBuffer());
    const text = bytes.toString("utf8");
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
    return { status: res.status, json, text, bytes, res };
  };
}

const money = (n) => Number(n).toLocaleString("en-US");

/* ---------------------------------------------------------------- */
/* A realistic customer photo: glass carafe on a warm studio wall.   */
/* ---------------------------------------------------------------- */
async function makeCustomerPhoto() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200">
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d8cbb8"/><stop offset="1" stop-color="#b9a993"/>
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#eef3f4" stop-opacity="0.95"/>
        <stop offset="0.5" stop-color="#c8d6d9" stop-opacity="0.72"/>
        <stop offset="1" stop-color="#9fb3b7" stop-opacity="0.9"/>
      </linearGradient>
      <radialGradient id="shine" cx="0.35" cy="0.3" r="0.5">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1000" height="1200" fill="url(#wall)"/>
    <ellipse cx="520" cy="1040" rx="230" ry="46" fill="#8f8069" opacity="0.45"/>
    <path d="M440 300 h120 a30 30 0 0 1 30 30 v60 c0 40 60 70 60 150 v420 a60 60 0 0 1 -60 60 h-190 a60 60 0 0 1 -60 -60 v-420 c0 -80 60 -110 60 -150 v-60 a30 30 0 0 1 30 -30 z"
          fill="url(#glass)" stroke="#7f9296" stroke-width="3"/>
    <path d="M455 350 h90 v900 h-90 z" fill="url(#shine)" opacity="0.75"/>
    <rect x="430" y="700" width="220" height="10" rx="5" fill="#ffffff" opacity="0.55"/>
    <rect x="430" y="760" width="220" height="10" rx="5" fill="#ffffff" opacity="0.35"/>
  </svg>`;
  const before = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
  fs.writeFileSync(path.join(ART, "photo-before.jpg"), before);
  return before;
}

/* ---------------------------------------------------------------- */

const transcript = [];
async function turn(api, convId, text) {
  const res = await api("POST", "/api/inbox/message", { conversationId: convId, text });
  if (res.status !== 200) return { status: res.status, reply: null, conv: null };
  const conv = res.json.db.conversations.find((c) => c.id === convId);
  const last = conv.messages[conv.messages.length - 1];
  const reply = last?.from === "ai" ? last.text : null;
  const filled = Object.entries(conv.order.slots)
    .filter(([, v]) => v.value)
    .map(([k, v]) => `${k}=${v.value}`);
  const entry = { customer: text, reply, slots: filled, agent: conv.order.agent, status: conv.status };
  transcript.push(entry);
  return { status: res.status, reply, conv, ...entry };
}

function showTurn(label, t) {
  report.push(
    `\n**${label}**\n\n> ${t.customer}\n\n${t.reply ? t.reply.replace(/\n/g, "\n> ") : "_(no reply — a person has the conversation)_"}\n\n\`sheet: ${t.slots.join(" · ") || "empty"} · agent: ${t.agent} · ${t.status}\``,
  );
}

async function main() {
  /* ---------------- sign in ---------------- */
  const manager = await signIn("youssef@cairoart.net", "CairoArt#2026");
  check("manager can sign in", manager.status === 200, `${manager.body.user?.nameEn}`);
  check("manager session cookie is HttpOnly", /HttpOnly/i.test(manager.setCookie));
  const api = client(manager.cookie);
  fs.writeFileSync(path.join(ART, ".qa-cookie"), manager.cookie);

  const bad = await signIn("youssef@cairoart.net", "wrong-password");
  check("wrong password is refused", bad.status === 401);

  const state = await api("GET", "/api/state");
  const db = state.json.db;
  check(
    "seeded workspace loads",
    db.products.length > 0 && db.conversations.length > 0 && db.orders.length > 0,
    `${db.products.length} products · ${db.conversations.length} conversations · ${db.orders.length} orders · ${db.channels.length} channels · ${db.employees.length} team · ${db.tasks.length} tasks`,
  );
  check("every module has its data", ["products", "conversations", "orders", "channels", "employees", "tasks", "activity"].every((k) => Array.isArray(db[k]) && db[k].length > 0));

  /* ---------------- Arabic bot conversation ---------------- */
  const arStart = await api("POST", "/api/inbox/new", {
    channel: "whatsapp",
    name: "منى عبد الرحمن",
    phone: "+201001234567",
    text: "السلام عليكم، عايزة أستفسر عن الفازات",
    lang: "ar",
  });
  check("Arabic enquiry is accepted", arStart.status === 200);
  const arId = arStart.json.conversationId;
  let arConv = arStart.json.db.conversations.find((c) => c.id === arId);
  let firstReply = arConv.messages.filter((m) => m.from === "ai").at(-1);
  check("bot answers the first Arabic message in Arabic", /[\u0600-\u06FF]/.test(firstReply?.text ?? ""));
  check("bot reads the product from the Arabic text", arConv.order.slots.product.value === "vases", String(arConv.order.slots.product.value));

  const arTurns = [];
  for (const msg of [
    "عايزة ٣ قطع",
    "شفاف ومقاس كبير",
    "أيوه عايزة نقش اسم منى",
    "التوصيل في المعادي",
    "عندي فرح آخر الشهر",
    "الميزانية ٣٠٠٠ جنيه",
    "هحول إنستاباي",
    "تمام، أكد الطلب",
  ]) {
    arTurns.push(await turn(api, arId, msg));
  }
  const arSectionStart = report.length;
  showTurn("First Arabic message", { customer: "السلام عليكم، عايزة أستفسر عن الفازات", reply: firstReply?.text, slots: [], agent: "intake", status: "ai-handling" });
  arTurns.forEach((t, i) => t.conv && showTurn(`Arabic turn ${i + 2}`, t));
  const arFinal = arTurns.at(-1).conv;
  check("Arabic order sheet is complete", arFinal.order.missing.length === 0, arFinal.order.missing.join(",") || "none missing");
  check("Arabic conversation is ready for handoff", arFinal.status === "ready-for-handoff");
  check("Arabic order read back all nine details", Object.values(arFinal.order.slots).filter((s) => s.value).length >= 8, `${Object.values(arFinal.order.slots).filter((s) => s.value).length}/9`);
  check("Arabic quantity understood from Arabic-Indic digits", arFinal.order.slots.quantity.value === "3");
  check("Arabic budget understood", arFinal.order.slots.budget.value === "3000");
  check("Arabic payment understood", arFinal.order.slots.payment.value === "instapay");
  check("Arabic personalisation understood", arFinal.order.slots.personalization.value === "engraved");
  check("Arabic city understood", arFinal.order.slots.city.value === "Maadi");
  check("Arabic timeline understood", arFinal.order.slots.timeline.value === "wedding date");
  check("a mid-conversation \"yes\" does not confirm the order", arTurns[2].conv.order.slots.confirm.value === null);
  const arRecap = arFinal.messages.filter((m) => m.from === "ai").at(-1).text;
  check("Arabic recap uses Arabic city names", /المعادي/.test(arRecap) && !/Maadi/.test(arRecap));
  check("Arabic recap uses Arabic digits and correct plurals", /٣ قطع/.test(arRecap) && /٣٬٠٠٠ ج\.م/.test(arRecap), arRecap.split("\n").slice(0, 4).join(" | "));
  check(
    "the Arabic qualification summary is fully Arabic",
    !/[A-Za-z]{3,}/.test(arFinal.qualification.summaryAr),
    arFinal.qualification.summaryAr,
  );
  section("Arabic customer conversation — what the bot actually said", report.splice(arSectionStart).join("\n"));

  /* ---------------- English wholesale conversation ---------------- */
  const enStart = await api("POST", "/api/inbox/new", {
    channel: "instagram",
    name: "Nour El Din",
    phone: "+201112223334",
    text: "Hi! I saw the pearl backgammon on Instagram — do you ship to Alexandria?",
    lang: "en",
  });
  const enId = enStart.json.conversationId;
  const enTurns = [];
  for (const msg of [
    "I need 30 pieces for my gift shop",
    "Walnut with black inlay, medium size",
    "Yes, engrave our shop logo",
    "Alexandria, Sidi Gaber",
    "I need them next week",
    "Budget is 45,000 EGP for the lot",
    "Bank transfer",
    "Yes, confirmed",
  ]) {
    enTurns.push(await turn(api, enId, msg));
  }
  const enSectionStart = report.length;
  enTurns.forEach((t, i) => t.conv && showTurn(`English turn ${i + 1}`, t));
  const enFinal = enTurns.at(-1).conv;
  check("English order sheet is complete", enFinal.order.missing.length === 0, enFinal.order.missing.join(",") || "none missing");
  check("English conversation is ready for handoff", enFinal.status === "ready-for-handoff");
  check("English quantity understood", enFinal.order.slots.quantity.value === "30");
  check("English variant understood", enFinal.order.slots.variant.value === "walnut");
  check("English personalisation understood", enFinal.order.slots.personalization.value === "logo");
  check("English city understood", enFinal.order.slots.city.value === "Alexandria");
  check("English budget understood", enFinal.order.slots.budget.value === "45000");
  check("English qualification recognises a wholesale buyer", enFinal.qualification.intent === "wholesale", enFinal.qualification.intent);
  check("English summary is readable", /Wholesale/.test(enFinal.qualification.summaryEn), enFinal.qualification.summaryEn);
  section("English wholesale conversation — what the bot actually said", report.splice(enSectionStart).join("\n"));

  /* ---------------- other languages of enquiry ---------------- */
  const edge = async (text, lang = "ar") => {
    const res = await api("POST", "/api/inbox/new", { channel: "website", name: "Edge case", phone: "—", text, lang });
    return res.json.db.conversations.find((c) => c.id === res.json.conversationId);
  };

  const arabicDigits = await edge("محتاج ٢٠ قطعة من المباخر للتجارة");
  check("Arabic digits + wholesale recognised", arabicDigits.order.slots.quantity.value === "20" && arabicDigits.qualification.intent === "wholesale", `${arabicDigits.order.slots.quantity.value} · ${arabicDigits.qualification.intent}`);

  const complaint = await edge("النجفة وصلت مكسورة، عايزة أرجّعها");
  check("complaint is detected", complaint.qualification.intent === "complaint");
  check("complaint still gets a helpful question", complaint.messages.at(-1).from === "ai");

  const emoji = await edge("🤔");
  check("a bare emoji does not break the bot", emoji.messages.at(-1).from === "ai");

  const human = await edge("Can I talk to a real person please?", "en");
  check("asking for a human hands over", human.status === "ready-for-handoff" && /specialist/i.test(human.messages.at(-1).text), human.messages.at(-1).text.slice(0, 80));

  const mixed = await edge("عايزة perfume bottles هدية، ٥ قطع");
  check("mixed Arabic/English is understood", mixed.order.slots.product.value === "perfume oil bottles" && mixed.order.slots.quantity.value === "5", `${mixed.order.slots.product.value} · ${mixed.order.slots.quantity.value}`);

  const offTopic = await edge("What is your return policy?");
  check("a policy question is still answered without a crash", offTopic.messages.at(-1).from === "ai");

  /* ---------------- handoff to a person ---------------- */
  const employees = (await api("GET", "/api/state")).json.db.employees;
  const handoff = await api("POST", "/api/inbox/handoff", { conversationId: enId, employeeId: employees[0].id });
  check("handoff assigns the conversation", handoff.status === 200);
  const handed = handoff.json.db.conversations.find((c) => c.id === enId);
  check("handoff message names the specialist", handed.messages.some((m) => m.text.includes(employees[0].nameEn)));
  check("handoff creates a task for the salesperson", handoff.json.db.tasks.some((t) => t.kind === "enquiry" && t.employeeId === employees[0].id));
  check("handoff marks the conversation with-employee", handed.status === "with-employee");

  const paused = await turn(api, enId, "Thanks! One more thing — can you gift wrap it?");
  check("bot stays silent once a person owns the chat", paused.reply === null);

  /* ---------------- product photo pipeline ---------------- */
  const photo = await makeCustomerPhoto();
  const form = new FormData();
  form.set("nameEn", "Pearl Inlay Carafe");
  form.set("nameAr", "قلة صدف");
  form.set("priceEgp", "1850");
  form.set("stock", "12");
  form.set("material", "mother-of-pearl");
  form.set("category", "vases");
  form.set("photo", new Blob([photo], { type: "image/jpeg" }), "carafe.jpg");

  const upload = await api("POST", "/api/products/upload", form);
  check("photo upload succeeds", upload.status === 200, upload.json?.error || "");
  const product = upload.status === 200 ? (await api("GET", "/api/state")).json.db.products.find((p) => p.id === upload.json.productId) : null;
  check("product is created with a SKU and price", Boolean(product?.sku) && product?.priceEgp === 1850, product?.sku);
  check("product is published to the site", product?.status === "published");

  if (product) {
    const media = await api("GET", product.imageUrl);
    const bytes = media.bytes;
    fs.writeFileSync(path.join(ART, "photo-after.jpg"), bytes);
    const meta = await sharp(bytes).metadata();
    check("finished photo is 1200×1200 JPEG", meta.width === 1200 && meta.height === 1200 && meta.format === "jpeg", `${meta.width}×${meta.height} ${meta.format}`);

    const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => {
      const i = (y * info.width + x) * info.channels;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const corners = [px(4, 4), px(info.width - 5, 4), px(4, info.height - 5), px(info.width - 5, info.height - 5)];
    check("background is replaced with clean white", corners.every((c) => c.every((v) => v >= 240)), JSON.stringify(corners));
    check("the product survived the cut-out", upload.json.cutout === true, `cutout=${upload.json.cutout}`);

    /* watermark band: the bottom 200px must contain ink that the plain sheet does not */
    const band = await sharp(bytes).extract({ left: 0, top: 980, width: 1200, height: 180 }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const dark = band.data.reduce((n, v) => n + (v < 150 ? 1 : 0), 0);
    check("Cairoart.net mark is burned into the bottom", dark > 400, `${dark} mark pixels`);
  }

  /* ---------------- catalog and commands ---------------- */
  const cmdProduct = await api("POST", "/api/command", { command: "add glass vase, 1200 EGP, stock 20" });
  check("command desk drafts a product in English", cmdProduct.json.ok && /GLS/.test(cmdProduct.json.replyEn), cmdProduct.json.replyEn);
  const drafted = cmdProduct.json.db.products[0];
  check("drafted product lands in the catalog", drafted.nameEn.length > 0 && drafted.status === "draft");

  const cmdPublish = await api("POST", "/api/command", { command: `publish ${drafted.sku}` });
  check("command desk publishes by SKU", cmdPublish.json.ok && cmdPublish.json.db.products.find((p) => p.id === drafted.id).status === "published");

  const cmdPrice = await api("POST", "/api/command", { command: `price ${drafted.sku} 1350` });
  check("command desk changes a price", cmdPrice.json.ok && cmdPrice.json.db.products.find((p) => p.id === drafted.id).priceEgp === 1350);

  const cmdStock = await api("POST", "/api/command", { command: `stock ${drafted.sku} 35` });
  check("command desk sets stock", cmdStock.json.ok && cmdStock.json.db.products.find((p) => p.id === drafted.id).stock === 35);

  const cmdAr = await api("POST", "/api/command", { command: "أضف طقم قهوة عربي صدف ٢٥٠٠ جنيه مخزون ٨" });
  const arProduct = cmdAr.json.db.products[0];
  check("command desk works in Arabic", cmdAr.json.ok && /[\u0600-\u06FF]/.test(cmdAr.json.replyAr), cmdAr.json.replyAr);
  check("an Arabic command reads Arabic-Indic price and stock", arProduct.priceEgp === 2500 && arProduct.stock === 8, `${arProduct.priceEgp} EGP · stock ${arProduct.stock}`);

  const cmdTask = await api("POST", "/api/command", { command: "create task for Yasmine: call the Noon buyer about the pearl trays" });
  check("command desk creates a task", cmdTask.json.ok && cmdTask.json.db.tasks.some((t) => /Noon/.test(t.titleEn)));

  const cmdUnknown = await api("POST", "/api/command", { command: "do something magical" });
  check("unknown command answers with help instead of failing", cmdUnknown.status === 200 && cmdUnknown.json.ok === false);

  const toggle = await api("POST", "/api/products/toggle", { id: product.id });
  const toggled = toggle.json.db.products.find((p) => p.id === product.id);
  check("product can be hidden from the site", toggle.status === 200 && toggled.status === "draft");
  const toggleBack = await api("POST", "/api/products/toggle", { id: product.id });
  check("product can be published again", toggleBack.json.db.products.find((p) => p.id === product.id).status === "published");

  /* ---------------- orders book ---------------- */
  const order = (await api("GET", "/api/state")).json.db.orders[0];
  const csv = await api("GET", "/api/orders/export.csv?lang=ar");
  check("orders export as Arabic CSV", csv.status === 200 && csv.text.split("\n").length > 3 && /text\/csv/.test(csv.res.headers.get("content-type")));
  const printEn = await api("GET", `/api/orders/${order.id}/print?lang=en`);
  check("printable confirmation renders in English", printEn.status === 200 && /Cairo Art/.test(printEn.text));
  const printAr = await api("GET", `/api/orders/${order.id}/print?lang=ar`);
  check("printable confirmation renders in Arabic with RTL", printAr.status === 200 && /dir="rtl"/.test(printAr.text));

  const share = await api("POST", `/api/orders/${order.id}/share?lang=ar`);
  check("a customer share link is generated", share.status === 200 && share.json.url.includes("token="));
  const sharedPrint = await fetch(share.json.url.replace("http://127.0.0.1:8787", BASE));
  check("the share link opens without a staff session", sharedPrint.status === 200);
  const forged = await fetch(`${BASE}/api/orders/${order.id}/print?token=forged`);
  check("a forged share link is refused", forged.status === 401);

  const update = await api("POST", "/api/orders/update", { id: order.id, status: "production", assignedTo: employees[0].id });
  check("manager can move an order and assign it", update.status === 200 && update.json.db.orders.find((o) => o.id === order.id).status === "production");
  const badStatus = await api("POST", "/api/orders/update", { id: order.id, status: "teleported" });
  check("an invented order status is rejected", badStatus.status === 400);

  const task = update.json.db.tasks[0];
  const taskMove = await api("POST", "/api/tasks/status", { id: task.id, status: "done" });
  check("a task can be completed", taskMove.status === 200 && taskMove.json.db.tasks.find((t) => t.id === task.id).status === "done");

  /* ---------------- analysis ---------------- */
  const sales = await api("POST", "/api/ai/sales");
  check("sales feedback is generated", sales.status === 200 && sales.json.analysis.wins.length >= 2);
  check("sales feedback quotes real channel figures", /EGP/.test(sales.json.analysis.headlineEn), sales.json.analysis.headlineEn.slice(0, 90));
  const audit = await api("POST", "/api/ai/audit");
  check("team audit is generated", audit.status === 200 && Array.isArray(audit.json.audit.flags), `${audit.json.audit.flags.length} flags`);
  const digest = await api("POST", "/api/ai/digest");
  check("daily digest is generated in both languages", digest.status === 200 && /[\u0600-\u06FF]/.test(digest.json.digest.headlineAr));
  section(
    "Sales feedback shown to the boss",
    `**EN** ${sales.json.analysis.headlineEn}\n\n**AR** ${sales.json.analysis.headlineAr}\n\n` +
      sales.json.analysis.risks.map((r) => `- ${r.en}`).join("\n") +
      `\n\n**Actions**\n` +
      sales.json.analysis.actions.map((a) => `1. ${a.en}\n   ${a.ar}`).join("\n"),
  );

  /* ---------------- staff administration ---------------- */
  const staffList = await api("GET", "/api/staff");
  check("staff roster is listed for a manager", staffList.status === 200 && staffList.json.staff.length >= 3);

  const created = await api("POST", "/api/staff/create", {
    nameEn: "Mona Fathy",
    nameAr: "منى فتحي",
    email: "mona@cairoart.net",
    role: "agent",
    employeeId: employees[0].id,
    password: "MonaCairo#2026",
  });
  check("manager can add a staff account", created.status === 200, created.json?.error || "");
  const mona = created.json.staff.find((s) => s.email === "mona@cairoart.net");
  check("a new account is forced to change its password at first sign-in", mona?.mustChangePassword === true);

  const duplicate = await api("POST", "/api/staff/create", {
    nameEn: "Mona Fathy", nameAr: "منى فتحي", email: "mona@cairoart.net", role: "agent", employeeId: null, password: "MonaCairo#2026",
  });
  check("duplicate email is rejected", duplicate.status === 400, duplicate.json?.error);
  const weak = await api("POST", "/api/staff/create", { nameEn: "Weak", nameAr: "ضعيف", email: "weak@cairoart.net", role: "agent", employeeId: null, password: "123" });
  check("short password is rejected", weak.status === 400, weak.json?.error);

  const monaLogin = await signIn("mona@cairoart.net", "MonaCairo#2026");
  check("the new agent can sign in with the temporary password", monaLogin.status === 200 && monaLogin.body.user.mustChangePassword === true);
  const monaApi = client(monaLogin.cookie);
  const monaChange = await monaApi("POST", "/api/auth/password", { currentPassword: "MonaCairo#2026", newPassword: "MonaOwn#2026" });
  check("the agent can set her own password", monaChange.status === 200 && monaChange.json.user.mustChangePassword === false);
  const monaRelogin = await signIn("mona@cairoart.net", "MonaOwn#2026");
  check("the new password works", monaRelogin.status === 200);

  const deactivate = await api("POST", "/api/staff/active", { id: mona.id, active: false });
  check("manager can deactivate an account", deactivate.status === 200 && deactivate.json.staff.find((s) => s.id === mona.id).active === false);
  const monaAfter = await signIn("mona@cairoart.net", "MonaOwn#2026");
  check("a deactivated account cannot sign in", monaAfter.status === 401);
  const monaSessionAfter = await monaApi("GET", "/api/state");
  check("deactivation ends the agent's open session", monaSessionAfter.status === 401);
  const reactivate = await api("POST", "/api/staff/active", { id: mona.id, active: true });
  check("manager can reactivate the account", reactivate.status === 200);
  const reset = await api("POST", "/api/staff/password", { id: mona.id, password: "MonaReset#2026" });
  check("manager can reset a password", reset.status === 200 && reset.json.user.mustChangePassword === true);
  const selfOff = await api("POST", "/api/staff/active", { id: manager.body.user.id, active: false });
  check("a manager cannot lock themselves out", selfOff.status === 400, selfOff.json?.error);

  const accessFeed = (await api("GET", "/api/state")).json.db.activity.filter((a) => a.kind === "access");
  check("access events reach the activity feed", accessFeed.some((a) => /Mona|منى/.test(a.textEn + a.textAr)) && accessFeed.some((a) => /signed in/.test(a.textEn)), `${accessFeed.length} access events`);

  /* ---------------- permissions ---------------- */
  const yasmine = await signIn("yasmine@cairoart.net", "Yasmine#2026");
  check("an agent can sign in", yasmine.status === 200);
  const agentApi = client(yasmine.cookie);
  const agentState = await agentApi("GET", "/api/state");
  check("an agent can read the desk", agentState.status === 200);
  const asCustomer = await agentApi("POST", "/api/inbox/message", { conversationId: arId, text: "hi", author: "customer" });
  check("an agent cannot write as the customer", asCustomer.status === 403);
  const agentUpload = await agentApi("POST", "/api/products/upload", { nameEn: "x" });
  check("an agent cannot upload products", agentUpload.status === 403);
  const agentCommand = await agentApi("POST", "/api/command", { command: "add vase" });
  check("an agent cannot use the command desk", agentCommand.status === 403);
  const agentOrder = await agentApi("POST", "/api/orders/update", { id: order.id, status: "delivered" });
  check("an agent cannot change an order", agentOrder.status === 403);
  const agentStaff = await agentApi("GET", "/api/staff");
  check("an agent cannot read the staff roster", agentStaff.status === 403);

  const agentReply = await agentApi("POST", "/api/inbox/message", { conversationId: arId, text: "أهلاً منى، أنا ياسمين من Cairo Art — هجهز لك الطلب حالًا.", author: "employee" });
  check("an agent can reply to a customer as the team", agentReply.status === 200 && agentReply.json.db.conversations.find((c) => c.id === arId).status === "with-employee");

  /* ---------------- invalid input ---------------- */
  const noSession = await fetch(`${BASE}/api/state`);
  check("the desk is closed without a session", noSession.status === 401);
  const malformed = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
  check("malformed JSON returns 400, not 500", malformed.status === 400);
  const emptyMsg = await api("POST", "/api/inbox/message", { conversationId: arId, text: "   " });
  check("empty customer message is rejected", emptyMsg.status === 400);
  const unknownConv = await api("POST", "/api/inbox/message", { conversationId: "cnv_nope", text: "hello" });
  check("unknown conversation is rejected", unknownConv.status === 400);
  const badMedia = await api("GET", "/api/media/..%2F..%2Fserver%2Fauth.ts");
  check("the media route cannot be walked out of its folder", !/passwordHash|StaffError/.test(badMedia.text), `status ${badMedia.status}`);

  /* ---------------- backups ---------------- */
  /* The app writes one snapshot a day into its own data directory: a SQLite
     copy on the local file store, a JSON copy on Postgres. */
  const dataDir = path.resolve(process.env.DATA_DIR || "data");
  const backupDir = path.join(dataDir, "backups");
  const today = new Date().toISOString().slice(0, 10);
  const backups = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [];
  check(
    "a daily database snapshot exists",
    backups.some((f) => f.includes(today) && /\.(sqlite|json)$/.test(f)),
    backups.join(", ") || `nothing in ${backupDir}`,
  );

  const authFile = path.join(dataDir, "initial-manager-password.txt");
  check("demo mode leaves no one-time password file behind", !fs.existsSync(authFile) || fs.readFileSync(authFile, "utf8").trim().length === 0);

  /* ---------------- report ---------------- */
  const failed = results.filter((r) => !r.ok);
  const header = `# Cairo Art — live acceptance run\n\n${new Date().toISOString()}\n\n**${results.length - failed.length}/${results.length} checks passed.**\n\n${failed.length ? `Failed: ${failed.map((f) => f.name).join(", ")}` : "No failures."}\n`;
  fs.writeFileSync(path.join(ART, "qa-report.md"), `${header}\n${report.join("\n")}\n`);

  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log(failed.map((f) => `- ${f.name} ${f.detail}`).join("\n"));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("QA run crashed", err);
  process.exitCode = 1;
});
