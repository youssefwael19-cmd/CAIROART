import { fmtDate, fmtEgp, makeT } from "../src/i18n";
import type { Database, OrderRecord } from "../src/types";
import { slotLabel } from "./agents";

/* ------------------------------------------------------------------ */
/* A standalone, print-ready confirmation sheet. Staff open it, print  */
/* it to PDF (or send the link) so the customer sees exactly what the  */
/* agents captured, in their language.                                 */
/* ------------------------------------------------------------------ */

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const COPY = {
  en: {
    tag: "Hand-blown glass & mother-of-pearl · Cairo",
    doc: "Order confirmation",
    sheet: "Order sheet",
    budgetLine: (v: string) =>
      `Budget on file: ${v}. Final price, payment schedule and delivery date are confirmed by the Cairo Art specialist.`,
    noBudget: "Budget: to be agreed with the specialist.",
    flagged: "The specialist will still confirm",
    footer:
      "Prepared by the Cairo Art AI desk with the customer from the details above. Our team confirms final pricing and delivery before production.",
    site: "cairoart.com",
    print: "Print / Save as PDF",
    back: "Back to the orders board",
    langOther: "عربي",
  },
  ar: {
    tag: "زجاج منفوخ باليد وصدف · القاهرة",
    doc: "تأكيد طلب",
    sheet: "ورقة الطلب",
    budgetLine: (v: string) =>
      `الميزانية المسجلة: ${v}. السعر النهائي وخطة الدفع وميعاد التسليم يؤكدها مختص Cairo Art.`,
    noBudget: "الميزانية: تُحدد مع المختص.",
    flagged: "سيؤكدها المختص",
    footer:
      "أُعدّت هذه الورقة بواسطة مكتب Cairo Art الذكي مع العميل من التفاصيل أعلاه. ويؤكد فريقنا السعر النهائي والتسليم قبل بدء التصنيع.",
    site: "cairoart.com",
    print: "طباعة / حفظ PDF",
    back: "العودة إلى الطلبات",
    langOther: "English",
  },
} as const;

export function orderConfirmationHtml(
  db: Database,
  order: OrderRecord,
  lang: "en" | "ar",
  shareToken?: string,
): string {
  const t = makeT(lang);
  const ar = lang === "ar";
  const copy = COPY[lang];
  const owner = db.employees.find((e) => e.id === order.assignedTo);
  const product = ar ? order.productAr : order.productEn;
  const otherLang = ar ? "en" : "ar";

  const rows = order.lines
    .map(
      (line) => `
        <tr>
          <th>${escapeHtml(ar ? line.labelAr : line.labelEn)}</th>
          <td>${escapeHtml(ar ? line.valueAr : line.valueEn)}</td>
        </tr>`,
    )
    .join("");

  const flagged = order.openDetails.length
    ? `<div class="flag">
         <strong>${escapeHtml(copy.flagged)}:</strong>
         ${order.openDetails.map((key) => escapeHtml(slotLabel(key, lang))).join("، ")}
       </div>`
    : "";

  return `<!doctype html>
<html lang="${lang}" dir="${ar ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(order.ref)} · ${escapeHtml(copy.doc)}</title>
<style>
  :root { --ink: #17130f; --ink-3: #6f6455; --line: #e3d8c6; --bone: #f5f0e6; --brass: #ab7f43; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bone); color: var(--ink);
    font-family: ui-sans-serif, -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans Arabic", sans-serif;
    font-size: 13px; line-height: 1.6; }
  .toolbar { max-width: 760px; margin: 18px auto 10px; display: flex; gap: 8px; align-items: center; padding: 0 16px; }
  .toolbar .spacer { flex: 1; }
  .btn { appearance: none; border: 1px solid var(--line); background: #fff; color: var(--ink);
    border-radius: 8px; padding: 8px 12px; font-size: 12.5px; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn.primary { background: var(--ink); border-color: var(--ink); color: #f5f0e6; }
  .sheet { max-width: 760px; margin: 0 auto 24px; background: #fff; padding: 40px 44px 32px;
    border: 1px solid var(--line); box-shadow: 0 1px 3px rgba(23,19,15,.06); }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
    border-bottom: 1px solid var(--line); padding-bottom: 18px; }
  .brand { display: flex; gap: 12px; align-items: center; }
  .mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 6px;
    border: 1px solid var(--brass); color: var(--brass); font-family: Georgia, "Times New Roman", serif; font-size: 15px; }
  .name { font-family: Georgia, "Times New Roman", serif; font-size: 20px; letter-spacing: .02em; }
  .tag { color: var(--ink-3); font-size: 11px; }
  .meta { text-align: ${ar ? "left" : "right"}; }
  .meta .label { text-transform: uppercase; letter-spacing: .16em; font-size: 9.5px; color: var(--ink-3); }
  .meta .ref { font-family: Georgia, "Times New Roman", serif; font-size: 19px; margin-top: 2px; }
  .meta .date { color: var(--ink-3); font-size: 11.5px; }
  .parties { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 28px; margin: 20px 0 4px; }
  .k { text-transform: uppercase; letter-spacing: .14em; font-size: 9.5px; color: var(--ink-3); }
  .v { font-size: 13px; }
  .v.muted { color: var(--ink-3); font-size: 11.5px; }
  h2 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: 15px;
    text-transform: uppercase; letter-spacing: .14em; color: var(--ink-3); margin: 26px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: ${ar ? "right" : "left"}; padding: 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { width: 42%; color: var(--ink-3); font-weight: 500; font-size: 12px; }
  td { font-size: 12.5px; }
  .note { margin-top: 16px; background: #f8f4ec; border: 1px solid var(--line);
    padding: 10px 12px; font-size: 11.5px; color: #4c4237; }
  .flag { margin-top: 10px; background: #fdf1e7; border: 1px solid #eccfae; color: #8a5a1c;
    padding: 10px 12px; font-size: 11.5px; }
  footer { margin-top: 26px; border-top: 1px solid var(--line); padding-top: 14px;
    color: var(--ink-3); font-size: 10.5px; line-height: 1.7; display: flex; justify-content: space-between; gap: 16px; }
  footer .site { color: var(--brass); }
  @page { size: A4; margin: 14mm; }
  @media print {
    body { background: #fff; font-size: 12px; }
    .no-print { display: none !important; }
    .sheet { max-width: none; margin: 0; border: 0; box-shadow: none; padding: 0; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <a class="btn" href="?lang=${otherLang}${shareToken ? `&token=${encodeURIComponent(shareToken)}` : ""}">${escapeHtml(copy.langOther)}</a>
    <span class="spacer"></span>
    <button class="btn primary" onclick="window.print()">${escapeHtml(copy.print)}</button>
  </div>

  <main class="sheet">
    <header>
      <div class="brand">
        <div class="mark">CA</div>
        <div>
          <div class="name">Cairo Art</div>
          <div class="tag">${escapeHtml(copy.tag)}</div>
        </div>
      </div>
      <div class="meta">
        <div class="label">${escapeHtml(copy.doc)}</div>
        <div class="ref">${escapeHtml(order.ref)}</div>
        <div class="date">${escapeHtml(fmtDate(order.confirmedAt, lang))}</div>
      </div>
    </header>

    <section class="parties">
      <div>
        <div class="k">${escapeHtml(t("orders.customer"))}</div>
        <div class="v">${escapeHtml(order.customerName)}</div>
        <div class="v muted" dir="ltr">${escapeHtml(order.phone)}</div>
      </div>
      <div>
        <div class="k">${escapeHtml(t("orders.channel"))}</div>
        <div class="v">${escapeHtml(t(`inbox.channel.${order.channel}`))}</div>
      </div>
      <div>
        <div class="k">${escapeHtml(t("orders.piece"))}</div>
        <div class="v">${escapeHtml(product || "—")}${order.quantity ? ` · ${order.quantity} ${escapeHtml(t("common.pieces"))}` : ""}</div>
      </div>
      <div>
        <div class="k">${escapeHtml(t("orders.owner"))}</div>
        <div class="v">${escapeHtml(owner ? (ar ? owner.nameAr : owner.nameEn) : t("orders.unassigned"))}</div>
      </div>
    </section>

    <h2>${escapeHtml(copy.sheet)}</h2>
    <table><tbody>${rows}</tbody></table>

    <div class="note">
      ${escapeHtml(order.budgetEgp ? copy.budgetLine(fmtEgp(order.budgetEgp, lang)) : copy.noBudget)}
    </div>
    ${flagged}

    <footer>
      <div>${escapeHtml(copy.footer)}</div>
      <div class="site">${copy.site}</div>
    </footer>
  </main>
</body>
</html>`;
}
