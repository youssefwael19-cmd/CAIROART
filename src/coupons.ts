import type { CustomerGroup } from "./types";

/* One shape for every number we keep: plus sign, then digits only. The WhatsApp
   API strips the plus itself, and duplicates compare on digits. */
export function normalisePhone(raw: string) {
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  return digits ? `+${digits}` : "";
}

/* The one message a group's numbers receive. Both languages are included so a
   mixed list does not need to be split by language. */
export function couponMessage(group: Pick<CustomerGroup, "discountPct" | "couponCode">, contactName: string) {
  const name = contactName.trim();
  return [
    `Cairo Art — hello ${name || "there"}!`,
    `Your ${group.discountPct}% discount coupon is ${group.couponCode}.`,
    "Use it at checkout on cairoart.net — valid for 30 days.",
    "",
    `كايرو آرت — أهلًا ${name || "بك"}!`,
    `كوبون خصمك ${group.discountPct}٪ هو ${group.couponCode}.`,
    "استخدمه عند الشراء من cairoart.net — صالح لمدة ٣٠ يومًا.",
  ].join("\n");
}
