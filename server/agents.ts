import type { Conversation, Message, OrderState, OrderSlotState, Qualification } from "../src/types";
import {
  CATEGORY_LABELS,
  CITY_LABELS,
  aiMode,
  arNumber,
  arQuantity,
  extractBudget,
  normaliseDigits,
  extractCity,
  extractInterests,
  extractQuantity,
  extractTimeline,
  llm,
  norm,
  qualify,
} from "./ai";
import { getDb, logActivity, nowIso, uid } from "./store";

/* ------------------------------------------------------------------ */
/* The order desk: five agents, nine details, one order sheet.         */
/* Each agent owns a stage. A stage is done only when the customer     */
/* has answered the question, so nothing reaches a salesperson missing. */
/* ------------------------------------------------------------------ */

export type SlotKey =
  | "product"
  | "quantity"
  | "variant"
  | "personalization"
  | "city"
  | "timeline"
  | "budget"
  | "payment"
  | "confirm";

type SlotDef = {
  key: SlotKey;
  labelEn: string;
  labelAr: string;
  questionEn: string;
  questionAr: string;
  critical?: boolean;
  extract: (text: string, conv: Conversation) => string | null;
};

/* A critical line is asked until answered; a soft one is asked twice and then
   flagged for the specialist so the conversation can still move forward. */
const maxAsks = (slot: SlotDef) => (slot.critical ? 4 : 2);

const VARIANT_WORDS: [string, string[]][] = [
  ["clear", ["clear glass", "transparent", "clear", "شفاف"]],
  ["amber", ["amber", "عنبري", "امبر"]],
  ["smoke", ["smoke", "smoked", "دخاني"]],
  ["blue", ["blue", "ازرق", "أزرق"]],
  ["green", ["green", "اخضر", "أخضر"]],
  ["gold", ["gold", "golden", "ذهبي"]],
  ["silver", ["silver", "فضي"]],
  ["rose gold", ["rose gold", "روز جولد"]],
  ["walnut", ["walnut", "جوز"]],
  ["black", ["black", "اسود", "أسود"]],
  ["white", ["white", "ابيض", "أبيض"]],
  ["navy", ["navy", "كحلي"]],
  ["natural wood", ["natural wood", "طبيعي", "خشب طبيعي"]],
  ["small", ["small", "صغير"]],
  ["medium", ["medium", "متوسط"]],
  ["large", ["large", "كبير", "كبيره"]],
];

const VALUE_LABELS: Record<string, [string, string]> = {
  clear: ["clear glass", "زجاج شفاف"],
  amber: ["amber glass", "زجاج عنبري"],
  smoke: ["smoked glass", "زجاج دخاني"],
  blue: ["blue glass", "زجاج أزرق"],
  green: ["green glass", "زجاج أخضر"],
  gold: ["gold finish", "لمسة ذهبية"],
  silver: ["silver finish", "لمسة فضية"],
  "rose gold": ["rose-gold finish", "لمسة روز جولد"],
  walnut: ["walnut inlay", "صدف على جوز"],
  black: ["black inlay", "صدف على أسود"],
  white: ["white inlay", "صدف على أبيض"],
  navy: ["navy inlay", "صدف على كحلي"],
  "natural wood": ["natural wood", "خشب طبيعي"],
  small: ["small size", "مقاس صغير"],
  medium: ["medium size", "مقاس متوسط"],
  large: ["large size", "مقاس كبير"],
  none: ["no personalisation", "بدون تخصيص"],
  engraved: ["name engraved", "نقش الاسم"],
  logo: ["logo engraved", "نقش الشعار"],
  "gift wrap": ["gift wrap", "تغليف هدية"],
  yes: ["confirmed by the customer", "مؤكد من العميل"],
  urgent: ["urgent", "عاجل"],
  "this week": ["this week", "الأسبوع ده"],
  "next week": ["next week", "الأسبوع الجاي"],
  "next month": ["next month", "الشهر الجاي"],
  "wedding date": ["wedding date", "تاريخ الفرح"],
  "fixed date": ["a fixed date", "تاريخ محدد"],
  cod: ["cash on delivery", "الدفع عند الاستلام"],
  instapay: ["InstaPay", "إنستاباي"],
  transfer: ["bank transfer", "تحويل بنكي"],
  card: ["card", "بطاقة"],
  deposit: ["deposit", "مقدم"],
};

const paymentOf = (text: string): string | null => {
  const t = norm(text);
  if (/(cash on delivery|cod|عند الاستلام|الاستلام)/.test(t)) return "cod";
  if (/(instapay|انستاباي|إنستاباي)/.test(t)) return "instapay";
  if (/(transfer|bank|تحويل|بنك)/.test(t)) return "transfer";
  if (/(card|visa|mastercard|فيزا|بطاقه|بطاقة)/.test(t)) return "card";
  if (/(deposit|advance|مقدم|عربون)/.test(t)) return "deposit";
  return null;
};

const variantOf = (text: string): string | null => {
  const size = normaliseDigits(text).match(/(\d{2,3})\s*(?:cm|سم)/i);
  if (size) return `cm:${size[1]}`;
  const t = norm(text);
  for (const [canonical, hints] of VARIANT_WORDS) {
    if (hints.some((h) => t.includes(norm(h)))) return canonical;
  }
  return null;
};

const personalizationOf = (text: string): string | null => {
  const t = norm(text);
  if (/(no personali|no engraving|no name|plain|بدون نقش|بدون اسم|بدون كتابه|مش عايز نقش)/.test(t)) return "none";
  if (/(logo|لوجو|شعار)/.test(t)) return "logo";
  if (/(engrav|initials|my name|his name|her name|نقش|اسم|احرف|حروف)/.test(t)) return "engraved";
  if (/(gift wrap|wrapped|تغليف|هديه)/.test(t)) return "gift wrap";
  return null;
};

const confirmOf = (text: string): string | null => {
  const t = norm(text);
  if (/(yes|yep|confirm|confirmed|correct|looks good|that s right|تمام|ماشي|موافق|مؤكد|اكد|أكد|ايوه|أيوه|صح)/.test(t)) return "yes";
  return null;
};

const SLOTS: SlotDef[] = [
  {
    key: "product",
    labelEn: "The piece",
    labelAr: "القطعة",
    critical: true,
    questionEn: "Which piece are you after — something from the hand-blown glass line, or the mother-of-pearl collection?",
    questionAr: "تحب تشوف إيه — قطعة من خط الزجاج المنفوخ، ولا من مجموعة الصدف؟",
    extract: (text) => extractInterests(text)[0] ?? null,
  },
  {
    key: "quantity",
    labelEn: "Quantity",
    labelAr: "الكمية",
    critical: true,
    questionEn: "How many pieces do you need? One piece, a set, or a wholesale quantity for a shop?",
    questionAr: "الكمية قد إيه؟ قطعة واحدة، طقم، ولا كمية جملة لمحل؟",
    extract: (text) => {
      const n = extractQuantity(text);
      return n === null ? null : String(n);
    },
  },
  {
    key: "variant",
    labelEn: "Finish / size",
    labelAr: "اللون / المقاس",
    questionEn:
      "Which finish and size? Glass comes in clear, amber, smoke, blue or green; pearl inlay sits on walnut, black or navy — and I can take an exact size in cm.",
    questionAr:
      "اللون والمقاس؟ الزجاج عندنا شفاف أو عنبري أو دخاني أو أزرق أو أخضر، والصدف على جوز أو أسود أو كحلي — وأقدر آخذ المقاس بالسنتيمتر.",
    extract: variantOf,
  },
  {
    key: "personalization",
    labelEn: "Personalisation",
    labelAr: "التخصيص",
    questionEn: "Would you like it personalised — a name, initials or your shop's logo? A plain 'no' is completely fine.",
    questionAr: "تحب نخصصها — اسم، حروف، أو شعار محلك؟ ولو مش عايز، قول \"بدون\" وعادي جدًا.",
    extract: personalizationOf,
  },
  {
    key: "city",
    labelEn: "Delivery city",
    labelAr: "مدينة التوصيل",
    critical: true,
    questionEn: "Which city and area should we deliver to?",
    questionAr: "التوصيل لمين وإيه؟ أنهي مدينة ومنطقة؟",
    extract: (text) => extractCity(text),
  },
  {
    key: "timeline",
    labelEn: "Needed by",
    labelAr: "ميعاد الاستلام",
    questionEn: "When do you need it in hand? Made-to-order pieces such as chandeliers and inlay tables take four to six weeks.",
    questionAr: "محتاجه يوصلك إمتى؟ قطع مثل النجف والطاولات المطعمة صدف تاخد من ٤ لـ ٦ أسابيع.",
    extract: (text) => extractTimeline(text),
  },
  {
    key: "budget",
    labelEn: "Budget",
    labelAr: "الميزانية",
    questionEn: "And the budget — per piece or for the whole order — so the specialist prices it correctly?",
    questionAr: "والميزانية — للقطعة ولا للطلب كله — عشان المختص يسعّر صح؟",
    extract: (text) => {
      const n = extractBudget(text);
      return n === null ? null : String(n);
    },
  },
  {
    key: "payment",
    labelEn: "Payment",
    labelAr: "الدفع",
    questionEn: "How would you like to pay — cash on delivery, InstaPay, or a bank transfer?",
    questionAr: "الدفع إزاي — عند الاستلام، إنستاباي، ولا تحويل بنكي؟",
    extract: paymentOf,
  },
  {
    key: "confirm",
    labelEn: "Customer confirmed",
    labelAr: "تأكيد العميل",
    questionEn: "I have the full order sheet — shall I lock these details and pass you to a Cairo Art specialist?",
    questionAr: "الطلب كامل عندي — أثبّت التفاصيل وأحوّلك لمختص من Cairo Art؟",
    extract: confirmOf,
  },
];

export const AGENTS = [
  { key: "intake", slots: ["product", "quantity"], labelEn: "Intake agent", labelAr: "وكيل الاستقبال", step: 1 },
  { key: "spec", slots: ["variant", "personalization"], labelEn: "Specification agent", labelAr: "وكيل المواصفات", step: 2 },
  { key: "delivery", slots: ["city", "timeline"], labelEn: "Delivery agent", labelAr: "وكيل التوصيل", step: 3 },
  { key: "pricing", slots: ["budget"], labelEn: "Pricing agent", labelAr: "وكيل التسعير", step: 4 },
  { key: "closing", slots: ["payment", "confirm"], labelEn: "Closing agent", labelAr: "وكيل إغلاق الطلب", step: 5 },
] as const;

export const SLOT_KEYS: SlotKey[] = SLOTS.map((s) => s.key);

export function slotLabel(key: string, lang: "en" | "ar"): string {
  const slot = SLOTS.find((s) => s.key === key);
  return slot ? (lang === "ar" ? slot.labelAr : slot.labelEn) : key;
}

const agentFor = (slot: SlotKey) => AGENTS.find((a) => (a.slots as readonly string[]).includes(slot)) ?? AGENTS[0];

const customerText = (conv: Conversation) =>
  conv.messages.filter((m) => m.from === "customer").map((m) => m.text).join(" \n ");

export function displaySlot(slot: SlotKey, value: string | null, lang: "en" | "ar"): string {
  if (!value) return "—";
  if (slot === "product") return CATEGORY_LABELS[value]?.[lang] ?? value;
  if (slot === "city") return lang === "ar" ? (CITY_LABELS[value] ?? value) : value;
  if (slot === "quantity") return lang === "ar" ? arQuantity(value) : `${value} pcs`;
  if (slot === "budget") return lang === "ar" ? `${arNumber(value)} ج.م` : `${Number(value).toLocaleString("en-US")} EGP`;
  if (value.startsWith("cm:")) return lang === "ar" ? `${value.slice(3)} سم` : `${value.slice(3)} cm`;
  return VALUE_LABELS[value]?.[lang === "ar" ? 1 : 0] ?? value;
}

/* Re-read every customer message so a detail mentioned late still lands in
   its slot, then keep the ask counters so a silent customer never stalls us. */
export function deriveOrder(conv: Conversation): OrderState {
  const text = customerText(conv);
  const previous = conv.order;
  const slots: Record<string, OrderSlotState> = {};

  const lastCustomer = conv.messages.filter((m) => m.from === "customer").at(-1)?.text ?? "";

  for (const slot of SLOTS) {
    /* Confirmation is a decision, not a detail: a bare "yes" only counts once
       the recap question has actually been put to the customer. */
    const value =
      slot.key === "confirm"
        ? confirmDecision(lastCustomer, previous?.slots.confirm?.asked ?? 0) ?? previous?.slots.confirm?.value ?? null
        : (text ? slot.extract(text, conv) : null) ?? previous?.slots[slot.key]?.value ?? null;
    slots[slot.key] = {
      value,
      asked: previous?.slots[slot.key]?.asked ?? 0,
      labelEn: value ? displaySlot(slot.key, value, "en") : undefined,
      labelAr: value ? displaySlot(slot.key, value, "ar") : undefined,
    };
  }

  const missing = SLOTS.filter((s) => !slots[s.key].value && slots[s.key].asked < maxAsks(s)).map((s) => s.key);
  const skipped = SLOTS.filter((s) => !slots[s.key].value && slots[s.key].asked >= maxAsks(s)).map((s) => s.key);
  const next = missing[0];

  return {
    agent: next ? agentFor(next).key : "closing",
    slots,
    missing,
    skipped,
    turns: previous?.turns ?? 0,
    paused: conv.status === "with-employee" || Boolean(conv.assignedTo),
  };
}

const EXPLICIT_CONFIRM = /(confirm|confirmed|lock (it|the order)|go ahead|أكد|اكد|مؤكد|ثبت الطلب|ثبّت الطلب|تمام كده)/;

function confirmDecision(lastMessage: string, timesAsked: number): string | null {
  if (!lastMessage) return null;
  if (EXPLICIT_CONFIRM.test(norm(lastMessage))) return "yes";
  return timesAsked > 0 && confirmOf(lastMessage) === "yes" ? "yes" : null;
}

const wantsHuman = (text: string) =>
  /(talk to (a )?(human|person|someone|agent)|speak to (a )?(human|someone)|real person|مندوب|موظف حقيقي|اتكلم مع حد|أكلم حد|اكلم حد)/.test(norm(text));

function ack(conv: Conversation, filled: SlotKey[], order: OrderState): string {
  if (filled.length === 0) return "";
  const ar = conv.lang === "ar";
  const parts = filled.slice(-3).map((k) => displaySlot(k, order.slots[k].value, conv.lang));
  return ar ? `تمام، سجلت: ${parts.join("، ")}. ` : `Noted: ${parts.join(", ")}. `;
}

function recap(conv: Conversation, order: OrderState): string {
  const ar = conv.lang === "ar";
  const rows = SLOTS.filter((s) => order.slots[s.key].value).map(
    (s) => `${ar ? s.labelAr : s.labelEn}: ${displaySlot(s.key, order.slots[s.key].value, conv.lang)}`,
  );
  return rows.join("\n");
}

/* ------------------------------------------------------------------ */
/* LLM voice for the desk                                             */
/* ------------------------------------------------------------------ */

/* Facts the desk may state without a salesperson. Everything else is referred
   to the team, so the assistant never invents a price, discount or date. */
const STANDING_FACTS = [
  "Cairo Art is an Egyptian workshop in Cairo making hand-blown glassware and mother-of-pearl pieces.",
  "Made-to-order pieces — chandeliers, inlaid tables, custom sizes — take four to six weeks.",
  "Delivery runs across Egypt; the exact fee and delivery date are confirmed by a specialist.",
  "Payment options: cash on delivery, InstaPay, or bank transfer.",
  "Personalisation: a name or initials engraved, or a shop's logo.",
];

const REPLY_SYSTEM = `You are the Cairo Art sales assistant on WhatsApp. Cairo Art is an Egyptian workshop making hand-blown glassware and mother-of-pearl pieces.

Rules:
- Reply in the conversation language: Egyptian Arabic when the payload language says so, otherwise English.
- Answer the customer's actual last message first — every question, objection, greeting or comment, including ones that are not on the order sheet. Never ignore what they said, never repeat a question they have already answered, and never answer with a scripted-sounding line.
- Use only the facts in the payload (order sheet, catalog, facts). Never invent or estimate a price, discount, stock level, delivery date, lead time or policy. If the answer is not in the facts, say a specialist will confirm it.
- Then ask exactly one question: the one in mustAskThisOneQuestion, reworded to fit naturally. If the customer's message already answers it, do not ask it again — ask the next best question from stillMissing.
- If recapBeforeAsking is present, open with a short recap of the order sheet, then the confirmation question.
- 2 to 4 short sentences, plain WhatsApp text. No bullet lists, no markdown, no headings, no emojis unless the customer used them.`;

/* The scripted question is the floor, not the ceiling: the model gets the same
   sheet the agents built, so its answer can cover anything the customer asked
   while the order still moves forward. A null return keeps the scripted reply. */
async function composeReply(
  conv: Conversation,
  order: OrderState,
  slot: SlotDef,
  question: string,
  scripted: string,
): Promise<string | null> {
  if (aiMode !== "llm") return null;
  const ar = conv.lang === "ar";

  let catalog: string[] = [];
  try {
    catalog = getDb()
      .products.filter((p) => p.status === "published")
      .slice(0, 10)
      .map((p) => `${p.nameEn} / ${p.nameAr} (${p.sku}) — ${Number(p.priceEgp).toLocaleString("en-US")} EGP, ${p.stock} in stock`);
  } catch {
    catalog = [];
  }

  const history = conv.messages
    .slice(-10)
    .map((m) => `${m.from === "customer" ? "Customer" : m.from === "employee" ? "Salesperson" : "Assistant"}: ${m.text}`);
  const sheet = SLOTS.filter((s) => order.slots[s.key].value).map(
    (s) => `${ar ? s.labelAr : s.labelEn}: ${displaySlot(s.key, order.slots[s.key].value, conv.lang)}`,
  );

  const payload: Record<string, unknown> = {
    language: ar ? "Egyptian Arabic" : "English",
    customerName: conv.customerName,
    channel: conv.channel,
    conversation: history,
    orderSheet: sheet,
    stillMissing: order.missing.map((k) => slotLabel(k, conv.lang)),
    mustAskThisOneQuestion: question,
    catalog,
    facts: STANDING_FACTS,
    scriptedReplyToImprove: scripted,
  };
  if (slot.key === "confirm") {
    payload.recapBeforeAsking = sheet.join("\n");
    payload.notYetConfirmed = order.skipped.map((k) => slotLabel(k, conv.lang));
  }

  const reply = await llm(REPLY_SYSTEM, JSON.stringify(payload), 900);
  return reply ? reply.trim() : null;
}

/* The customer's next message in, one agent question out. */
export async function handleCustomerMessage(
  conv: Conversation,
): Promise<{ reply: Message | null; qualification: Qualification; order: OrderState }> {
  const ar = conv.lang === "ar";
  const before = conv.order;

  if (conv.status === "with-employee" || conv.assignedTo) {
    const order = deriveOrder(conv);
    order.paused = true;
    conv.order = order;
    return { reply: null, qualification: qualify(conv), order };
  }

  const order = deriveOrder(conv);
  order.turns += 1;

  const filled = SLOTS.filter(
    (s) => order.slots[s.key].value && order.slots[s.key].value !== before?.slots[s.key]?.value,
  ).map((s) => s.key);

  const nextKey = order.missing[0];

  const reply = (text: string, agent: string): Message => ({
    id: uid("msg"),
    from: "ai",
    lang: conv.lang,
    text,
    at: nowIso(),
    agent,
  });

  /* the customer asked for a person — stop selling, hand over */
  if (wantsHuman(conv.messages[conv.messages.length - 1]?.text ?? "")) {
    conv.status = "ready-for-handoff";
    conv.order = { ...order, agent: "closing" };
    logActivity("ai", `${conv.customerName} asked for a person — handed over.`, `${conv.customerName} طلب التحدث مع موظف — تم التحويل.`, "good");
    return {
      reply: reply(
        ar
          ? "تمام، بحوّلك لمختص من الفريق حالًا — كل تفاصيل الطلب اللي وصلتني معاه."
          : "Of course — connecting you to a Cairo Art specialist now, with everything you've told me so far.",
        "closing",
      ),
      qualification: qualify(conv),
      order: conv.order,
    };
  }

  if (!nextKey) {
    order.skipped.length &&
      logActivity(
        "ai",
        `${conv.customerName}'s order sheet is complete with ${order.skipped.length} detail(s) left open.`,
        `ورقة طلب ${conv.customerName} مكتملة مع ${order.skipped.length} تفاصيل مفتوحة.`,
        "warn",
      );
    conv.status = "ready-for-handoff";
    conv.order = { ...order, agent: "closing" };
    const sheet = recap(conv, order);
    const open = order.skipped.length
      ? ar
        ? `\n\nمحتاج تأكيد: ${order.skipped.map((k) => SLOTS.find((s) => s.key === k)?.labelAr ?? k).join("، ")} — المختص هيكمّلها معاك.`
        : `\n\nStill to confirm with the specialist: ${order.skipped
            .map((k) => SLOTS.find((s) => s.key === k)?.labelEn ?? k)
            .join(", ")}.`
      : "";
    return {
      reply: reply(
        ar
          ? `الطلب كامل ✅\n\n${sheet}${open}\n\nبحوّلك لمختص من Cairo Art لتأكيد السعر النهائي والدفع والتسليم.`
          : `The order sheet is complete ✅\n\n${sheet}${open}\n\nPassing you to a Cairo Art specialist to confirm the final price, payment and delivery.`,
        "closing",
      ),
      qualification: qualify(conv),
      order: conv.order,
    };
  }

  const slot = SLOTS.find((s) => s.key === nextKey)!;
  const agent = agentFor(nextKey as SlotKey);
  order.agent = agent.key;
  order.slots[nextKey].asked += 1;
  conv.order = order;

  const question = ar ? slot.questionAr : slot.questionEn;
  const lead = ack(conv, filled, order);
  const skippedNote =
    order.skipped.length && nextKey === "confirm"
      ? ar
        ? `\n\nلسه محتاج تأكيد: ${order.skipped.map((k) => SLOTS.find((s) => s.key === k)?.labelAr ?? k).join("، ")}.`
        : `\n\nNot yet confirmed: ${order.skipped.map((k) => SLOTS.find((s) => s.key === k)?.labelEn ?? k).join(", ")}.`
      : "";

  const scripted =
    nextKey === "confirm"
      ? `${lead}${recap(conv, order)}${skippedNote}\n\n${question}`
      : `${lead}${question}`;

  /* The model answers whatever the customer actually asked and then asks the
     sheet's next question; if it is unavailable the scripted text still ships. */
  const body = (await composeReply(conv, order, slot, question, scripted)) ?? scripted;

  return { reply: reply(body, agent.key), qualification: qualify(conv), order };
}
