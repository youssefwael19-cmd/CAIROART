import type { Database, OrderRecord, OrderStatus } from "../src/types";
import { displaySlot, SLOT_KEYS, slotLabel } from "./agents";
import { nowIso, uid } from "./store";

/* ------------------------------------------------------------------ */
/* The orders book. Once an agent closes the order sheet, it is copied */
/* here so it survives handover, status changes and a page reload.     */
/* ------------------------------------------------------------------ */

const nextRef = (db: Database) => {
  const year = new Date().getFullYear();
  const highest = db.orders.reduce((max, order) => {
    const n = Number(order.ref.split("-").pop());
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 1000);
  return `CA-${year}-${highest + 1}`;
};

const slotValue = (value: string | null | undefined, lang: "en" | "ar") =>
  value ? displaySlot("product", value, lang) : "";

/* Every complete, customer-confirmed sheet becomes (or refreshes) an order.
   A delivered or cancelled order is history and is never rewritten. */
export function syncOrders(db: Database) {
  db.orders ??= [];
  for (const conv of db.conversations) {
    const order = conv.order;
    if (!order || order.missing.length > 0) continue;
    if (!order.slots.confirm?.value) continue;

    const lines = SLOT_KEYS.filter((key) => order.slots[key]?.value).map((key) => ({
      key,
      labelEn: slotLabel(key, "en"),
      labelAr: slotLabel(key, "ar"),
      valueEn: displaySlot(key, order.slots[key].value, "en"),
      valueAr: displaySlot(key, order.slots[key].value, "ar"),
    }));

    const quantity = Number(order.slots.quantity?.value);
    const budget = Number(order.slots.budget?.value);

    const fields = {
      customerName: conv.customerName,
      phone: conv.phone,
      channel: conv.channel,
      lang: conv.lang,
      productEn: slotValue(order.slots.product?.value, "en"),
      productAr: slotValue(order.slots.product?.value, "ar"),
      quantity: Number.isFinite(quantity) ? quantity : null,
      budgetEgp: Number.isFinite(budget) ? budget : null,
      city: order.slots.city?.value ?? null,
      lines,
      openDetails: [...order.skipped],
      agent: order.agent,
      updatedAt: nowIso(),
    };

    const existing = db.orders.find((o) => o.conversationId === conv.id);
    if (existing) {
      if (existing.status === "delivered" || existing.status === "cancelled") continue;
      Object.assign(existing, fields);
    } else {
      db.orders.unshift({
        id: uid("ord"),
        ref: nextRef(db),
        conversationId: conv.id,
        status: "new",
        assignedTo: conv.assignedTo,
        confirmedAt: conv.lastAt,
        ...fields,
      });
    }
  }
}

const STATUS_LABEL: Record<OrderStatus, [string, string]> = {
  new: ["New", "جديد"],
  production: ["In production", "قيد التصنيع"],
  shipped: ["Shipped", "تم الشحن"],
  delivered: ["Delivered", "تم التسليم"],
  cancelled: ["Cancelled", "ملغي"],
};

const CHANNEL_LABEL: Record<string, [string, string]> = {
  website: ["Website", "الموقع"],
  whatsapp: ["WhatsApp", "واتساب"],
  instagram: ["Instagram", "إنستجرام"],
  facebook: ["Facebook", "فيسبوك"],
  tiktok: ["TikTok", "تيك توك"],
};

/* Quoted cells are still evaluated by Excel, so anything that could start a
   formula is prefixed with an apostrophe before quoting. */
const cell = (value: string | number | null | undefined) => {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export function ordersCsv(db: Database, lang: "en" | "ar"): string {
  const ar = lang === "ar";
  const header = ar
    ? ["المرجع", "تاريخ التأكيد", "العميل", "الهاتف", "القناة", "القطعة", "الكمية", "الميزانية (ج.م)", "المدينة", "الحالة", "المسؤول", "تفاصيل للمختص", "ورقة الطلب"]
    : ["Ref", "Confirmed", "Customer", "Phone", "Channel", "Piece", "Qty", "Budget (EGP)", "City", "Status", "Owner", "Open details", "Order sheet"];

  const rows = [...db.orders]
    .sort((a, b) => +new Date(b.confirmedAt) - +new Date(a.confirmedAt))
    .map((order) => {
      const owner = db.employees.find((e) => e.id === order.assignedTo);
      const open = order.openDetails.map((key) => slotLabel(key, lang)).join(", ");
      const sheet = order.lines
        .map((line) => `${ar ? line.labelAr : line.labelEn}: ${ar ? line.valueAr : line.valueEn}`)
        .join(" | ");
      return [
        order.ref,
        order.confirmedAt.slice(0, 10),
        order.customerName,
        order.phone,
        (CHANNEL_LABEL[order.channel] ?? [order.channel, order.channel])[ar ? 1 : 0],
        ar ? order.productAr : order.productEn,
        order.quantity,
        order.budgetEgp,
        order.city,
        STATUS_LABEL[order.status][ar ? 1 : 0],
        owner ? (ar ? owner.nameAr : owner.nameEn) : "",
        open,
        sheet,
      ].map(cell);
    });

  return `\uFEFF${[header.map(cell), ...rows].map((row) => row.join(",")).join("\r\n")}`;
}

export const ORDER_STATUSES: OrderStatus[] = ["new", "production", "shipped", "delivered", "cancelled"];
