import type { Analysis, Audit, Conversation, Database, Product, Qualification } from "../src/types";
import { getDb, logActivity, persist, uid, nowIso } from "./store";

/* ------------------------------------------------------------------ */
/* Optional LLM layer (Freebuff / any OpenAI-compatible endpoint)      */
/* ------------------------------------------------------------------ */

const AI_BASE = (process.env.AI_BASE_URL || "https://freebuff.com/api/v1/paid").replace(/\/+$/, "");
const AI_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

export const aiMode: "llm" | "rules" = AI_KEY ? "llm" : "rules";

export async function llm(system: string, user: string, maxTokens = 600): Promise<string | null> {
  if (!AI_KEY) return null;
  try {
    const res = await fetch(`${AI_BASE}/chat/completions`, {
      method: "POST",
      /* A hanging provider must not hang a customer's WhatsApp webhook. */
      signal: AbortSignal.timeout(20_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${AI_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.4,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function llmJson<T>(system: string, user: string): Promise<T | null> {
  const raw = await llm(`${system}\nReply with JSON only. No markdown fences, no commentary.`, user);
  if (!raw) return null;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) return null;
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Language helpers                                                    */
/* ------------------------------------------------------------------ */

const AR_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

/* Egyptian customers often type Arabic-Indic digits (٢، ٥، ٠); every parser
   works on ASCII, so they are folded before matching. */
const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

export function normaliseDigits(input: string): string {
  return input.replace(ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf));
}

export function norm(input: string): string {
  return normaliseDigits(input)
    .toLowerCase()
    .replace(AR_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\w\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_HINTS: [string, string[]][] = [
  ["arabian coffee sets", ["arabian coffee", "قهوه عربي", "قهوة عربي", "دله"]],
  ["backgammon", ["backgammon", "سيجه", "سيجا"]],
  ["chess board", ["chess", "شطرنج"]],
  ["tea sets", ["tea set", "teaset", "شاي"]],
  ["coffee sets", ["coffee", "قهوه", "بن"]],
  ["perfume oil bottles", ["perfume oil", "perfume", "برفان", "عطر", "عطور", "زجاجات عطر", "زجاجه عطر"]],
  ["perfume oil diffusers", ["diffuser", "موزع", "موزعات", "دفيوزر"]],
  ["fish tanks", ["aquarium", "fish tank", "حوض", "احواض", "سمك"]],
  ["plant pots", ["plant pot", "planter", "اصيص", "اصص", "نبات", "زرع"]],
  ["incense burners", ["incense", "bakhoor", "بخور", "مبخر", "مباخر"]],
  ["glass models", ["glass model", "مجسم", "مجسمات", "تمثال"]],
  ["chandeliers", ["chandelier", "نجفه", "نجف", "ثريا", "ثريات"]],
  ["vases", ["vase", "فازه", "فازات", "مزهرية", "مزهرى", "مزهريات"]],
  ["candlestick holders", ["candlestick", "candle", "شمعدان", "شمعدانات", "شمعه"]],
  ["pendants", ["pendant", "معلق", "معلقات"]],
  ["table lamps", ["lamp", "اباجوره", "اباجورات", "لمبه"]],
  ["cups with coasters", ["cup and coaster", "cups", "فنجان", "فناجين", "اكواب", "كوبايات", "كوب"]],
  ["coasters", ["coaster", "كوستر", "قاعده", "قواعد"]],
  ["trays", ["tray", "صينيه", "صواني"]],
  ["jewelry boxes", ["jewelry", "jewel", "مجوهرات", "علبه", "علب"]],
  ["tables", ["table", "طاوله", "طاولات", "ترابيزه", "ترابيزات", "منضده"]],
];

const CITIES: [string, string[]][] = [
  ["Cairo", ["cairo", "القاهره", "قاهره"]],
  ["New Cairo", ["new cairo", "tagamoa", "التجمع", "القاهره الجديده"]],
  ["Giza", ["giza", "الجيزه", "جيزه"]],
  ["Maadi", ["maadi", "المعادي"]],
  ["Zamalek", ["zamalek", "الزمالك"]],
  ["Heliopolis", ["heliopolis", "مصر الجديده", "هليوبوليس"]],
  ["6th of October", ["6th of october", "october city", "اكتوبر", "٦ اكتوبر"]],
  ["Sheikh Zayed", ["sheikh zayed", "الشيخ زايد"]],
  ["Alexandria", ["alexandria", "الاسكندريه", "اسكندريه"]],
  ["North Coast", ["north coast", "الساحل", "العلمين", "ساحل"]],
  ["Mansoura", ["mansoura", "المنصوره"]],
  ["Tanta", ["tanta", "طنطا"]],
  ["Hurghada", ["hurghada", "الغردقه"]],
  ["Sharm El Sheikh", ["sharm", "شرم"]],
  ["Luxor", ["luxor", "الاقصر"]],
];

export function extractInterests(text: string): string[] {
  const t = norm(text);
  const found: string[] = [];
  for (const [category, hints] of CATEGORY_HINTS) {
    if (hints.some((h) => t.includes(norm(h)))) found.push(category);
  }
  const specific = new Set(["arabian coffee sets", "backgammon", "chess board"]);
  const hasSpecific = found.some((c) => specific.has(c));
  const list = found.filter((c) => !(hasSpecific && (c === "coffee sets" || c === "tables")));
  return list.slice(0, 3);
}

export const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  "tea sets": { en: "tea sets", ar: "أطقم الشاي" },
  "coffee sets": { en: "coffee sets", ar: "أطقم القهوة" },
  "arabian coffee sets": { en: "Arabian coffee sets", ar: "أطقم القهوة العربي" },
  "perfume oil bottles": { en: "perfume oil bottles", ar: "زجاجات العطر" },
  "perfume oil diffusers": { en: "diffusers", ar: "موزعات العطر" },
  "fish tanks": { en: "aquariums", ar: "أحواض السمك" },
  "plant pots": { en: "plant pots", ar: "أصص النبات" },
  "incense burners": { en: "incense burners", ar: "المباخر" },
  "glass models": { en: "glass models", ar: "المجسمات الزجاجية" },
  chandeliers: { en: "chandeliers", ar: "النجف" },
  vases: { en: "vases", ar: "الفازات" },
  "candlestick holders": { en: "candlestick holders", ar: "الشمعدانات" },
  pendants: { en: "pendant lights", ar: "المعلقات" },
  tables: { en: "tables", ar: "الطاولات" },
  trays: { en: "trays", ar: "الصواني" },
  "cups with coasters": { en: "cups and coasters", ar: "الأكواب والقواعد" },
  coasters: { en: "coasters", ar: "القواعد" },
  backgammon: { en: "backgammon boards", ar: "طاولات السيجة" },
  "chess board": { en: "chess boards", ar: "رقاع الشطرنج" },
  "jewelry boxes": { en: "jewelry boxes", ar: "علب المجوهرات" },
  "table lamps": { en: "table lamps", ar: "الأباجورات" },
};

/* Display names, kept next to the extractors so any summary reads in the
   customer's language instead of leaking the canonical English value. */
export const CITY_LABELS: Record<string, string> = {
  Cairo: "القاهرة",
  "New Cairo": "القاهرة الجديدة",
  Giza: "الجيزة",
  Maadi: "المعادي",
  Zamalek: "الزمالك",
  Heliopolis: "مصر الجديدة",
  "6th of October": "٦ أكتوبر",
  "Sheikh Zayed": "الشيخ زايد",
  Alexandria: "الإسكندرية",
  "North Coast": "الساحل الشمالي",
  Mansoura: "المنصورة",
  Tanta: "طنطا",
  Hurghada: "الغردقة",
  "Sharm El Sheikh": "شرم الشيخ",
  Luxor: "الأقصر",
};

/* The names used when a detail is still outstanding, in both languages. */
const MISSING_LABELS: Record<string, { en: string; ar: string }> = {
  interest: { en: "the piece", ar: "القطعة" },
  quantity: { en: "quantity", ar: "الكمية" },
  city: { en: "city", ar: "المدينة" },
  timeline: { en: "date", ar: "الميعاد" },
  budget: { en: "budget", ar: "الميزانية" },
};

export const TIMELINE_LABELS: Record<string, string> = {
  urgent: "عاجل",
  "this week": "الأسبوع ده",
  "next week": "الأسبوع الجاي",
  "next month": "الشهر الجاي",
  "wedding date": "تاريخ الفرح",
  "fixed date": "تاريخ محدد",
};

/* Egyptian customers read Arabic digits, and Arabic counts change form with the
   number: one piece, two pieces, 3–10 pieces, then the singular again. */
export const arNumber = (n: number | string) => Number(n).toLocaleString("ar-EG");

export const arQuantity = (n: number | string) => {
  const value = Number(n);
  if (value === 1) return "قطعة واحدة";
  if (value === 2) return "قطعتين";
  if (value >= 3 && value <= 10) return `${arNumber(value)} قطع`;
  return `${arNumber(value)} قطعة`;
};

export function extractQuantity(text: string): number | null {
  const t = norm(text);
  /* Arabic dual form carries "two" inside the noun: قطعتين / حبتين */
  if (/(قطعتين|حبتين|طقمين)/.test(t)) return 2;
  const patterns = [
    /(\d{1,4})\s*(?:x\s*)?(?:pcs|pieces?|units?|sets?|bottles?|glasses|cups|trays|boards?|قطع|قطعه|اطقم|طقم|زجاجه|كوب|صينيه|حبه)/i,
    /(\d{1,4})\s+(?:[a-z\u0600-\u06FF]+\s+){0,3}(?:bottles?|pieces?|pcs|units?|sets?|glasses|cups|trays|boards?|vases?|chandeliers?|فاز|قطع|اطقم|طقم|زجاج|كوب|صيني|نجف)/i,
    /(?:qty|quantity|كميه)\D{0,6}(\d{1,4})/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n > 0 && n < 10_000) return n;
    }
  }
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    واحد: 1, واحده: 1, اتنين: 2, اثنين: 2, تلاته: 3, ثلاثه: 3, اربعه: 4, خمسه: 5, سته: 6, سبعه: 7, تمانيه: 8, تسعه: 9, عشره: 10,
  };
  const wordMatch = t.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|واحد|واحده|اتنين|اثنين|تلاته|ثلاثه|اربع|اربعه|خمسه|سته|سبعه|تمان|تمانيه|تسعه|عشره)\b\s+(?:[a-z\u0600-\u06FF]+\s+){0,2}(chandeliers?|vases?|sets?|trays?|boards?|bottles?|cups?|pieces?|pcs|units?|فاز|اطقم|طقم|صواني|صيني|كوب|زجاج|قطع|قطعه)/,
  );
  if (wordMatch) return words[wordMatch[1]] ?? null;
  return null;
}

export function extractBudget(text: string): number | null {
  const t = normaliseDigits(text).toLowerCase().replace(/,/g, "");
  const m = t.match(/(\d{2,7})\s*(?:egp|le\b|جنيه|ج\.?م|pounds?|جنية)/i);
  return m ? Number(m[1]) : null;
}

export function extractCity(text: string): string | null {
  const t = norm(text);
  for (const [city, aliases] of CITIES) {
    if (
      aliases.some((a) => {
        const n = norm(a);
        return t.includes(n) || (n.startsWith("ال") && n.length > 4 && t.includes(n.slice(2)));
      })
    )
      return city;
  }
  return null;
}

export function extractTimeline(text: string): string | null {
  const t = norm(text);
  if (/(urgent|asap|today|tomorrow|عاجل|بسرعه|النهارده|بكره)/.test(t)) return "urgent";
  if (/(wedding|فرح|جواز|زفاف)/.test(t)) return "wedding date";
  if (/(this week|الاسبوع ده|هذا الاسبوع)/.test(t)) return "this week";
  if (/(next week|الاسبوع الجاي|الاسبوع القادم)/.test(t)) return "next week";
  if (/(next month|الشهر الجاي|الشهر القادم)/.test(t)) return "next month";
  if (/(before the \d+|\d{1,2}(st|nd|rd|th)\b)/.test(t)) return "fixed date";
  return null;
}

function extractIntent(qty: number | null, text: string, interests: string[]): string {
  const t = norm(text);
  if (/(broken|damaged|late|refund|complaint|مكسور|متأخر|شكوى|مرتجع)/.test(t)) return "complaint";
  if (/(custom|bespoke|made to order|make to size|خاص|علي المقاس|تصميم خاص)/.test(t)) return "custom";
  if (qty !== null && qty >= 20) return "wholesale";
  if (/(wholesale|bulk|reseller|my shop|my store|gift shop|جمله|تاجر|محل هدايا|بزنس)/.test(t)) return "wholesale";
  if (interests.length > 0) return "retail";
  return "unqualified";
}

/* ------------------------------------------------------------------ */
/* Qualification + customer replies                                    */
/* ------------------------------------------------------------------ */

const MISSING_ORDER: ("interest" | "quantity" | "city" | "timeline" | "budget")[] = [
  "interest",
  "quantity",
  "city",
  "timeline",
  "budget",
];

export function qualify(conv: Conversation): Qualification {
  const customerText = conv.messages
    .filter((m) => m.from === "customer")
    .map((m) => m.text)
    .join(" \n ");

  const interests = extractInterests(customerText);
  const quantity = extractQuantity(customerText);
  const budgetEgp = extractBudget(customerText);
  const city = extractCity(customerText);
  const timeline = extractTimeline(customerText);
  const intent = extractIntent(quantity, customerText, interests);

  const ar = conv.lang === "ar";
  const missing: string[] = [];
  if (interests.length === 0) missing.push("interest");
  if (quantity === null) missing.push("quantity");
  if (city === null) missing.push("city");

  const weighted =
    (interests.length ? 30 : 0) + (quantity !== null ? 25 : 0) + (city !== null ? 20 : 0) +
    (timeline ? 15 : 0) + (budgetEgp !== null ? 10 : 0);

  const summaryEn = [
    intent !== "unqualified" ? intent.charAt(0).toUpperCase() + intent.slice(1) + " enquiry" : "New enquiry",
    interests.length ? interests.map((i) => CATEGORY_LABELS[i]?.en ?? i).join(", ") : null,
    quantity !== null ? `${quantity} pcs` : null,
    city,
    timeline,
    budgetEgp !== null ? `budget EGP ${budgetEgp.toLocaleString("en-US")}` : null,
  ].filter(Boolean).join(" · ");

  const summaryAr = [
    intent === "wholesale" ? "استفسار جملة" : intent === "custom" ? "طلب مخصص" : intent === "complaint" ? "شكوى" : "استفسار جديد",
    interests.length ? interests.map((i) => CATEGORY_LABELS[i]?.ar ?? i).join("، ") : null,
    quantity !== null ? arQuantity(quantity) : null,
    city ? (CITY_LABELS[city] ?? city) : null,
    timeline ? (TIMELINE_LABELS[timeline] ?? timeline) : null,
    budgetEgp !== null ? `ميزانية ${arNumber(budgetEgp)} ج.م` : null,
  ].filter(Boolean).join(" · ");

  /* The order agents own the detail checklist: a conversation cannot be complete
     while an order detail is still unasked or unanswered. */
  const pending = conv.order?.missing.length ?? 0;

  return {
    intent,
    interests,
    quantity,
    budgetEgp,
    city,
    timeline,
    missing,
    score: Math.min(weighted, pending > 0 ? 80 : 100),
    summaryEn:
      summaryEn +
      (missing.length
        ? ` — missing: ${missing.map((m) => MISSING_LABELS[m]?.en ?? m).join(", ")}`
        : pending > 0
          ? ` — ${pending} order details still being checked`
          : " — complete"),
    summaryAr:
      summaryAr +
      (missing.length
        ? ` — ناقص: ${missing.map((m) => MISSING_LABELS[m]?.ar ?? m).join("، ")}`
        : pending > 0
          ? ` — ${pending} تفاصيل طلب قيد التأكيد`
          : " — مكتمل"),
  };
}

/* ------------------------------------------------------------------ */
/* Sales analysis                                                      */
/* ------------------------------------------------------------------ */

export function ruleAnalysis(db: Database): Analysis {
  const generatedBy = aiMode === "llm" ? "ai" : "rules";

  /* A brand-new business has no channel figures yet; say what to enter instead
     of inventing a headline from nothing. */
  if (db.channels.length === 0) {
    return {
      generatedBy,
      headlineEn:
        "No channel figures yet. Add this month's revenue and orders per channel and the analysis starts from real numbers.",
      headlineAr:
        "لا توجد أرقام قنوات بعد. أضف إيراد وطلبات هذا الشهر لكل قناة ليبدأ التحليل من أرقام حقيقية.",
      wins: [
        {
          en: "The desk is already recording every enquiry, order and coupon, so the first month of figures will be complete.",
          ar: "المكتب يسجّل بالفعل كل استفسار وطلب وكوبون، فأول شهر أرقام سيكون كاملًا.",
        },
      ],
      risks: [
        {
          en: "With no channel figures there is nothing to compare, so a dropping channel would go unnoticed.",
          ar: "بدون أرقام القنوات لا يوجد ما يُقارن، فتراجع أي قناة سيمر دون ملاحظة.",
        },
      ],
      actions: [
        {
          en: "Add this month's revenue, orders and sessions for the website, WhatsApp, Instagram, Facebook and TikTok.",
          ar: "أضف إيراد وطلبات وزيارات هذا الشهر للموقع وواتساب وإنستجرام وفيسبوك وتيك توك.",
        },
      ],
    };
  }

  const totalRevenue = db.channels.reduce((s, c) => s + c.revenueEgp, 0);
  const totalOrders = db.channels.reduce((s, c) => s + c.orders, 0);
  const sorted = [...db.channels].sort((a, b) => b.revenueEgp - a.revenueEgp);
  const best = sorted[0];
  const fastest = [...db.channels].sort((a, b) => b.changePct - a.changePct)[0];
  const worst = [...db.channels].sort((a, b) => a.changePct - b.changePct)[0];
  const weakConv =
    [...db.channels]
      .filter((c) => c.sessions > 1000)
      .sort((a, b) => a.orders / a.sessions - b.orders / b.sessions)[0] ??
    [...db.channels].filter((c) => c.sessions > 0).sort((a, b) => a.orders / a.sessions - b.orders / b.sessions)[0] ??
    sorted[sorted.length - 1];
  /* Never recommend shifting spend from a channel into itself: if the channel
     with the most returns is also the fastest grower, the money has to come
     from somewhere else. */
  const highReturns =
    [...db.channels].filter((c) => c.nameEn !== fastest.nameEn).sort((a, b) => b.returns - a.returns)[0] ??
    sorted[sorted.length - 1];
  const blendedAov = Math.round(totalRevenue / Math.max(1, totalOrders));
  const bestShare = totalRevenue > 0 ? Math.round((best.revenueEgp / totalRevenue) * 100) : 0;
  const convRate = (weakConv.orders / Math.max(1, weakConv.sessions)) * 100;
  const fmt = (n: number) => n.toLocaleString("en-US");

  return {
    generatedBy,
    headlineEn: `${fmt(totalRevenue)} EGP across ${totalOrders} orders this month. ${best.nameEn} carries ${bestShare}% of revenue, while ${worst.nameEn} is ${worst.changePct < 0 ? `down ${Math.abs(worst.changePct)}%` : `up ${worst.changePct}%`}.`,
    headlineAr: `${fmt(totalRevenue)} ج.م من ${totalOrders} طلب هذا الشهر. ${best.nameAr} تمثل ${bestShare}٪ من الإيراد، بينما ${worst.nameAr} ${worst.changePct < 0 ? `تراجعت ${Math.abs(worst.changePct)}٪` : `نمت ${worst.changePct}٪`}.`,
    wins: [
      {
        en: `${best.nameEn} is your engine: ${fmt(best.revenueEgp)} EGP from ${best.orders} orders at a ${fmt(blendedAov)} EGP average.`,
        ar: `${best.nameAr} هي المحرك: ${fmt(best.revenueEgp)} ج.م من ${best.orders} طلب بمتوسط ${fmt(blendedAov)} ج.م.`,
      },
      {
        en: `${fastest.nameEn} grew ${fastest.changePct}% — the strongest momentum of any channel.`,
        ar: `${fastest.nameAr} نمت ${fastest.changePct}٪ — أقوى زخم بين القنوات.`,
      },
    ],
    risks: [
      {
        en: `${weakConv.nameEn} converts only ${convRate.toFixed(1)}% of ${fmt(weakConv.sessions)} visits — traffic is arriving without buying.`,
        ar: `${weakConv.nameAr} تحوّل ${convRate.toFixed(1)}٪ فقط من ${fmt(weakConv.sessions)} زيارة — الزيارات تأتي ولا تشتري.`,
      },
      {
        en: `${highReturns.nameEn} recorded ${highReturns.returns} returns, the highest of any channel, and is ${highReturns.changePct < 0 ? `down ${Math.abs(highReturns.changePct)}%` : "flat"}.`,
        ar: `${highReturns.nameAr} سجلت ${highReturns.returns} مرتجعات، الأعلى بين القنوات، وهي ${highReturns.changePct < 0 ? `بانخفاض ${Math.abs(highReturns.changePct)}٪` : "مستقرة"}.`,
      },
    ],
    actions: [
      {
        en: `Move 25% of ${highReturns.nameEn} ad spend into ${fastest.nameEn} for two weeks and watch cost per order.`,
        ar: `حوّل ٢٥٪ من ميزانية إعلانات ${highReturns.nameAr} إلى ${fastest.nameAr} لأسبوعين وراقب تكلفة الطلب.`,
      },
      {
        en: `Have the catalog owner audit ${weakConv.nameEn} listings: dimensions, lead time and shipping cost on every SKU.`,
        ar: `كلّف مسؤول الكتالوج بمراجعة قوائم ${weakConv.nameAr}: الأبعاد ومدة التنفيذ والشحن لكل منتج.`,
      },
      {
        en: "Push the pearl backgammon and chess boards into Instagram — highest ticket, strongest gifting demand.",
        ar: "روّج طاولات السيجة والشطرنج الصدف على إنستجرام — أعلى سعر وأقوى طلب للمناسبات.",
      },
    ],
  };
}

export async function analyseSales(db: Database): Promise<Analysis> {
  const fallback = ruleAnalysis(db);
  if (aiMode !== "llm") return fallback;
  const payload = db.channels.map((c) => ({
    channel: c.nameEn, revenue: c.revenueEgp, orders: c.orders, sessions: c.sessions,
    returns: c.returns, adSpend: c.adSpendEgp, changePct: c.changePct,
  }));
  const out = await llmJson<Analysis>(
    'You are a retail analyst for Cairo Art, an Egyptian handcrafted glassware and mother-of-pearl manufacturer. Give sharp, numeric, actionable feedback. Fields: headlineEn, headlineAr, wins[{en,ar}], risks[{en,ar}], actions[{en,ar}]. Two wins, two risks, three actions. No invented numbers.',
    JSON.stringify(payload),
  );
  if (!out || !out.headlineEn || !out.wins?.length) return fallback;
  return { ...out, generatedBy: "ai" };
}

/* ------------------------------------------------------------------ */
/* Team audit                                                          */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;

export function ruleAudit(db: Database): Audit {
  const now = Date.now();
  const flags: Audit["flags"] = [];
  for (const t of db.tasks) {
    if (t.status === "done") continue;
    const due = new Date(t.dueAt).getTime();
    const staleDays = Math.floor((now - new Date(t.updatedAt).getTime()) / DAY);
    const emp = db.employees.find((e) => e.id === t.employeeId);
    if (due < now) {
      flags.push({
        employeeId: t.employeeId,
        severity: "high",
        en: `${emp?.nameEn ?? "Unassigned"} — "${t.titleEn}" is ${Math.ceil((now - due) / DAY)} day(s) overdue.`,
        ar: `${emp?.nameAr ?? "غير مسند"} — "${t.titleAr}" متأخرة ${Math.ceil((now - due) / DAY)} يوم.`,
      });
    } else if (staleDays >= 3) {
      flags.push({
        employeeId: t.employeeId,
        severity: "medium",
        en: `${emp?.nameEn ?? "Unassigned"} — "${t.titleEn}" has not moved in ${staleDays} days.`,
        ar: `${emp?.nameAr ?? "غير مسند"} — "${t.titleAr}" بلا تحديث منذ ${staleDays} يوم.`,
      });
    }
  }
  for (const c of db.conversations) {
    if (c.status === "ready-for-handoff" && now - new Date(c.lastAt).getTime() > DAY) {
      flags.push({
        employeeId: null,
        severity: "high",
        en: `Qualified enquiry from ${c.customerName} is still waiting for a salesperson.`,
        ar: `استفسار مؤهل من ${c.customerName} ما زال بانتظار مندوب مبيعات.`,
      });
    }
  }
  const high = flags.filter((f) => f.severity === "high").length;
  return {
    generatedBy: aiMode === "llm" ? "ai" : "rules",
    headlineEn: high
      ? `${high} critical item(s) need attention before end of day.`
      : "The team is on track — nothing critical outstanding.",
    headlineAr: high
      ? `${high} بند حرج يحتاج متابعة قبل نهاية اليوم.`
      : "الفريق منتظم — لا يوجد ما هو حرج.",
    flags: flags.slice(0, 8),
  };
}

export async function auditTeam(db: Database): Promise<Audit> {
  const fallback = ruleAudit(db);
  if (aiMode !== "llm") return fallback;
  const payload = db.tasks.map((t) => ({
    employee: db.employees.find((e) => e.id === t.employeeId)?.nameEn,
    task: t.titleEn, status: t.status, dueAt: t.dueAt, updatedAt: t.updatedAt,
  }));
  const out = await llmJson<Audit>(
    "You audit work for Cairo Art's operations team. Flag real risks only, using the supplied dates. Fields: headlineEn, headlineAr, flags[{employeeId(null), en, ar, severity('high'|'medium')}].",
    JSON.stringify({ today: new Date().toISOString(), tasks: payload }),
  );
  if (!out || !out.headlineEn) return fallback;
  return { ...out, generatedBy: "ai" };
}

/* ------------------------------------------------------------------ */
/* Digest                                                              */
/* ------------------------------------------------------------------ */

export async function digest(db: Database) {
  const analysis = ruleAnalysis(db);
  const audit = ruleAudit(db);
  const waiting = db.conversations.filter((c) => c.status === "ready-for-handoff").length;
  const live = db.conversations.filter((c) => c.status === "ai-handling").length;

  return {
    generatedBy: aiMode,
    headlineEn: `${live} conversations are being qualified, ${waiting} await a salesperson, and ${audit.flags.filter((f) => f.severity === "high").length} operational items are critical.`,
    headlineAr: `${live} محادثة قيد التأهيل، ${waiting} بانتظار مندوب مبيعات، و${audit.flags.filter((f) => f.severity === "high").length} بند تشغيلي حرج.`,
    bulletsEn: [analysis.headlineEn, ...analysis.actions.slice(0, 2).map((a) => a.en)],
    bulletsAr: [analysis.headlineAr, ...analysis.actions.slice(0, 2).map((a) => a.ar)],
  };
}

/* ------------------------------------------------------------------ */
/* Product + command engine                                            */
/* ------------------------------------------------------------------ */

const SINGULAR_AR: Record<string, string> = {
  "tea sets": "طقم شاي",
  "coffee sets": "طقم قهوة",
  "arabian coffee sets": "طقم قهوة عربي",
  "perfume oil bottles": "زجاجة عطر",
  "perfume oil diffusers": "موزع عطر",
  "fish tanks": "حوض سمك",
  "plant pots": "أصيص",
  "incense burners": "مبخر",
  "glass models": "مجسم",
  chandeliers: "نجفة",
  vases: "فازة",
  "candlestick holders": "شمعدان",
  pendants: "معلق",
  tables: "طاولة",
  trays: "صينية",
  "cups with coasters": "طقم أكواب",
  coasters: "قاعدة",
  backgammon: "طاولة سيجة",
  "chess board": "رقعة شطرنج",
  "jewelry boxes": "علبة مجوهرات",
  "table lamps": "أباجورة",
};

function skuFor(db: Database, material: "glass" | "mother-of-pearl", category: string) {
  const prefix = material === "glass" ? "GLS" : "MOP";
  const cat = category.split(" ")[0].slice(0, 3).toUpperCase();
  const n = db.products.filter((p) => p.sku.startsWith(`${prefix}-${cat}`)).length + 1;
  return `${prefix}-${cat}-${String(n).padStart(2, "0")}`;
}

export function draftProduct(brief: string, db: Database): Product {
  /* A command typed in Arabic uses Arabic-Indic digits; fold them before any
     number is read, or the price and stock silently fall back to defaults. */
  const briefAscii = normaliseDigits(brief);
  const t = norm(briefAscii);
  const material: "glass" | "mother-of-pearl" = /(pearl|صدف)/.test(t) ? "mother-of-pearl" : "glass";
  const category = extractInterests(briefAscii)[0] || (material === "glass" ? "vases" : "trays");
  const priceMatch = briefAscii.replace(/,/g, "").match(/(\d{2,7})/);
  const priceEgp = priceMatch ? Number(priceMatch[1]) : material === "glass" ? 750 : 2_400;
  const stockMatch = briefAscii.match(/stock\s*(\d{1,4})/i) || briefAscii.match(/(?:مخزون|كمية)\D{0,6}(\d{1,4})/);
  const stock = stockMatch ? Number(stockMatch[1]) : 10;
  const isArabic = hasArabic(brief);
  const cleaned = briefAscii
    .replace(/add|create|upload|new product|product|draft|اضف|أضف|ارفع|منتج جديد/gi, " ")
    .replace(/(\d{2,7})\s*(egp|le\b|جنيه|ج\.?م)/gi, " ")
    .replace(/stock\s*\d+/gi, " ")
    .replace(/(?:مخزون|كمية)\s*\d+/g, " ")
    .replace(/[|,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const name = cleaned || (isArabic ? "قطعة جديدة" : "New piece");
  const nameEn = isArabic ? name : name.replace(/\b\w/g, (c) => c.toUpperCase());
  const nameAr = isArabic
    ? name
    : `${SINGULAR_AR[category] ?? CATEGORY_LABELS[category]?.ar ?? category} ${material === "glass" ? "زجاج" : "صدف"}`;

  return {
    id: uid("prd"),
    sku: skuFor(db, material, category),
    nameEn,
    nameAr,
    material,
    category,
    priceEgp,
    stock,
    status: "draft",
    descriptionEn: `Handcrafted ${material === "glass" ? "glass" : "mother-of-pearl"} ${category.replace(/s$/, "")} from the Cairo Art workshop.`,
    descriptionAr: `${category} مصنوعة يدويًا من ${material === "glass" ? "الزجاج" : "الصدف"} في ورشة Cairo Art.`,
    createdAt: nowIso(),
  };
}

export function runCommand(command: string, db: Database): { ok: boolean; replyEn: string; replyAr: string } {
  const raw = command.trim();
  const t = norm(raw);

  /* Add/create is checked first so "add glass vase … stock 20" is not read as a stock command. */
  if (/^(add|create|upload|new product|اضف|أضف|ارفع|ضيف)/.test(raw) && !/(task|مهمة)/.test(t)) {
    const product = draftProduct(raw, db);
    db.products.unshift(product);
    persist();
    logActivity("ai", `Drafted a new product: ${product.nameEn} (${product.sku}).`, `تم إنشاء مسودة منتج: ${product.nameAr} (${product.sku}).`);
    return {
      ok: true,
      replyEn: `Drafted ${product.nameEn} — ${product.sku}, ${product.material === "glass" ? "glass" : "mother-of-pearl"}, ${product.priceEgp.toLocaleString("en-US")} EGP, stock ${product.stock}. It is a draft: say "publish ${product.sku}" when the photos are ready.`,
      replyAr: `تم إنشاء مسودة ${product.nameAr} — ${product.sku}، ${product.material === "glass" ? "زجاج" : "صدف"}، ${product.priceEgp.toLocaleString("en-US")} ج.م، مخزون ${product.stock}. اكتب "انشر ${product.sku}" بعد تجهيز الصور.`,
    };
  }

  const STOP = new Set([
    "glass", "pearl", "add", "create", "upload", "product", "publish", "hide", "set", "change",
    "price", "stock", "the", "and", "for", "with", "pcs", "egp", "new", "mother", "units",
    "جنيه", "سعر", "اضف", "اضافه", "منتج", "منتجات", "انشر", "اخفي", "مخزون", "قطعه", "جديد", "زجاج", "صدف",
  ]);

  const findProduct = () => {
    const bySku = db.products.find((p) => t.includes(p.sku.toLowerCase()));
    if (bySku) return bySku;
    const words = t.split(" ").filter((w) => w.length > 2 && !STOP.has(w));
    let best: Product | null = null;
    let bestScore = 0;
    for (const p of db.products) {
      const hay = norm(`${p.nameEn} ${p.nameAr} ${p.category}`);
      const score = words.reduce((s, w) => (hay.includes(w) ? s + 1 : s), 0);
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    return bestScore >= 1 ? best : null;
  };

  /* publish / unpublish */
  const publish = t.match(/(?:publish|activate|enlist|list)\s+(.+)|(?:انشر|فعّل|فعل)\s+(.+)/);
  if (publish && !/(unpublish|إيقاف|ايقاف|اخف)/.test(t)) {
    const product = findProduct();
    if (!product) return notFound(raw);
    product.status = "published";
    persist();
    logActivity("ai", `Published ${product.nameEn} to the website.`, `تم نشر ${product.nameAr} على الموقع.`);
    return {
      ok: true,
      replyEn: `${product.nameEn} (${product.sku}) is now live on cairoart.com and the WhatsApp catalog.`,
      replyAr: `${product.nameAr} (${product.sku}) منشور الآن على الموقع وكتالوج واتساب.`,
    };
  }

  if (/(unpublish|hide|deactivate|ايقاف|إيقاف|اخفاء)/.test(t)) {
    const product = findProduct();
    if (!product) return notFound(raw);
    product.status = "draft";
    persist();
    logActivity("ai", `Hid ${product.nameEn} from the website.`, `تم إخفاء ${product.nameAr} من الموقع.`, "warn");
    return {
      ok: true,
      replyEn: `${product.nameEn} (${product.sku}) is now a draft and no longer visible to customers.`,
      replyAr: `${product.nameAr} (${product.sku}) أصبحت مسودة ولم تعد ظاهرة للعملاء.`,
    };
  }

  /* price */
  const priceCmd = raw.match(/(?:price|سعر).*?(\d{3,7})/i) || raw.match(/(\d{3,7})\s*(?:egp|جنيه|ج\.?م)/i);
  if (priceCmd && /(price|سعر|set|غير|حدد)/.test(t)) {
    const product = findProduct();
    if (!product) return notFound(raw);
    const value = Number(priceCmd[1]);
    const old = product.priceEgp;
    product.priceEgp = value;
    persist();
    logActivity("ai", `Repriced ${product.nameEn} from ${old} to ${value} EGP.`, `تم تغيير سعر ${product.nameAr} من ${old} إلى ${value} ج.م.`);
    return {
      ok: true,
      replyEn: `${product.nameEn} is now ${value.toLocaleString("en-US")} EGP (was ${old.toLocaleString("en-US")}). Channels updated.`,
      replyAr: `سعر ${product.nameAr} أصبح ${value.toLocaleString("en-US")} ج.م (كان ${old.toLocaleString("en-US")}). تم تحديث القنوات.`,
    };
  }

  /* stock — the SKU is stripped first, because its own digits would otherwise
     be read as the quantity ("stock GLS-VAS-02 35"). */
  const stockBody = normaliseDigits(raw).replace(/\b[A-Z]{2,4}-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/gi, " ");
  const stockNumbers = [...stockBody.matchAll(/(\d{1,4})/g)].map((m) => Number(m[1]));
  const stockValue = /(?:stock|مخزون|كمية)/i.test(stockBody) ? stockNumbers.at(-1) : undefined;
  if (stockValue !== undefined) {
    const product = findProduct();
    if (!product) return notFound(raw);
    product.stock = stockValue;
    persist();
    logActivity("ai", `Stock for ${product.nameEn} set to ${product.stock}.`, `تم تعيين مخزون ${product.nameAr} إلى ${product.stock}.`);
    return {
      ok: true,
      replyEn: `Stock for ${product.nameEn} is now ${product.stock} units.`,
      replyAr: `مخزون ${product.nameAr} أصبح ${product.stock} قطعة.`,
    };
  }

  /* task */
  if (/(task|مهمة|كلف|كلّف)/.test(t)) {
    const emp = db.employees.find((e) => t.includes(norm(e.nameEn).split(" ")[0]) || t.includes(norm(e.nameAr).split(" ")[0]));
    const body = raw.replace(/^.*?(?:task|مهمة)\s*(?:for|لـ|ل|الى|إلى)?/i, "").replace(/^(?:for|ل)\s*/i, "").trim();
    const employee = emp || db.employees[1];
    db.tasks.unshift({
      id: uid("tsk"),
      employeeId: employee.id,
      titleEn: body || "New task from the command desk",
      titleAr: body || "مهمة جديدة من مكتب الأوامر",
      kind: "listing",
      status: "todo",
      priority: "normal",
      dueAt: new Date(Date.now() + 2 * DAY).toISOString(),
      updatedAt: nowIso(),
    });
    persist();
    logActivity("ai", `Assigned a new task to ${employee.nameEn}.`, `تم إسناد مهمة جديدة إلى ${employee.nameAr}.`);
    return {
      ok: true,
      replyEn: `Task created for ${employee.nameEn}, due in two days. It appears in the team board now.`,
      replyAr: `تم إنشاء مهمة لـ ${employee.nameAr} تستحق بعد يومين، وظهرت في لوحة الفريق.`,
    };
  }

  /* add product (default) */
  if (/(add|create|upload|new|اضف|أضف|ارفع|منتج)/.test(t)) {
    const product = draftProduct(raw, db);
    db.products.unshift(product);
    persist();
    logActivity("ai", `Drafted a new product: ${product.nameEn} (${product.sku}).`, `تم إنشاء مسودة منتج: ${product.nameAr} (${product.sku}).`);
    return {
      ok: true,
      replyEn: `Drafted ${product.nameEn} — ${product.sku}, ${product.material === "glass" ? "glass" : "mother-of-pearl"}, ${product.priceEgp.toLocaleString("en-US")} EGP, stock ${product.stock}. It is a draft: say "publish ${product.sku}" when the photos are ready.`,
      replyAr: `تم إنشاء مسودة ${product.nameAr} — ${product.sku}، ${product.material === "glass" ? "زجاج" : "صدف"}، ${product.priceEgp.toLocaleString("en-US")} ج.م، مخزون ${product.stock}. اكتب "انشر ${product.sku}" بعد تجهيز الصور.`,
    };
  }

  return {
    ok: false,
    replyEn: 'I can add products ("add glass vase, 1200 EGP, stock 20"), publish or hide a SKU, change a price, set stock, or create a task ("create task for Mona: call the Noon buyer").',
    replyAr: 'أستطيع إضافة منتج ("أضف فازة زجاج ١٢٠٠ جنيه مخزون ٢٠")، نشر أو إخفاء منتج، تغيير سعر، تعيين مخزون، أو إنشاء مهمة ("أنشئ مهمة لمنى: اتصال بمشتري نون").',
  };
}

function notFound(raw: string) {
  return {
    ok: false,
    replyEn: `I could not match a product to "${raw}". Try the SKU, e.g. "publish GLS-TEA-01".`,
    replyAr: `لم أجد منتجًا مطابقًا لـ "${raw}". جرّب كود المنتج، مثال: "انشر GLS-TEA-01".`,
  };
}

export { getDb } from "./store";
