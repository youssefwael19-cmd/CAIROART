import { useState } from "react";
import { api } from "../api";
import type { Actions, Tfn } from "../contract";
import { fmtDate, fmtEgp, type Lang } from "../i18n";
import type { Database, OrderRecord, OrderStatus, StaffRole } from "../types";
import { Badge, Btn, Card, ChannelIcon, Empty, Icon, SectionLabel, Stat } from "../ui";

interface Props {
  db: Database;
  t: Tfn;
  lang: Lang;
  actions: Actions;
  role: StaffRole;
}

const STATUSES: OrderStatus[] = ["new", "production", "shipped", "delivered", "cancelled"];

const statusTone = {
  new: "warn",
  production: "glass",
  shipped: "pearl",
  delivered: "good",
  cancelled: "neutral",
} as const;

export default function Orders({ db, t, lang, actions, role }: Props) {
  const canManage = role === "manager";
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const orders = [...db.orders].sort((a, b) => +new Date(b.confirmedAt) - +new Date(a.confirmedAt));
  const q = query.trim().toLowerCase();
  const list = orders.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      (!q || [o.ref, o.customerName, o.productEn, o.productAr, o.phone].some((v) => v.toLowerCase().includes(q))),
  );

  const open = orders.find((o) => o.id === openId) ?? null;
  const waiting = orders.filter((o) => o.status === "new").length;
  const active = orders.filter((o) => o.status === "production" || o.status === "shipped").length;
  const budget = orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + (o.budgetEgp ?? 0), 0);
  const flagged = orders.filter((o) => o.openDetails.length > 0).length;

  async function update(id: string, patch: { status?: OrderStatus; assignedTo?: string | null }) {
    setBusy(true);
    await actions.updateOrder(id, patch);
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>{t("nav.orders")}</SectionLabel>
          <h1 className="mt-1 font-display text-[28px] leading-tight tracking-tight sm:text-[32px]">{t("orders.title")}</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink-3">{t("orders.subtitle")}</p>
          {!canManage && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-line-2 bg-card px-2 py-1 text-[10.5px] text-ink-3">
              <Icon name="lock" className="h-3 w-3" />
              {t("auth.ordersHint")}
            </p>
          )}
        </div>
        <a
          href={api.ordersCsvUrl(lang)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-bone transition-colors hover:bg-ink-2"
        >
          <Icon name="arrow" className="h-3.5 w-3.5 rotate-90" />
          {t("orders.export")}
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("orders.total")} value={orders.length} hint={flagged ? `${flagged} ${t("orders.flaggedHint")}` : t("orders.allSheets")} />
        <Stat label={t("orders.newCount")} value={waiting} accent={waiting ? "brass" : "ink"} hint={t("order.status.new")} />
        <Stat label={t("orders.active")} value={active} accent="glass" hint={t("order.status.production")} />
        <Stat label={t("orders.budgetTotal")} value={fmtEgp(budget, lang)} hint={t("orders.budget")} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="scroll-thin flex gap-1 overflow-x-auto">
            {(["all", ...STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                  filter === s ? "bg-ink text-bone" : "text-ink-3 hover:bg-bone-2"
                }`}
              >
                {s === "all" ? t("common.all") : t(`order.status.${s}`)}
              </button>
            ))}
          </div>
          <div className="ms-auto flex items-center gap-1.5 rounded-lg border border-line bg-bone/40 px-2.5 py-1.5">
            <Icon name="search" className="h-3.5 w-3.5 text-ink-3/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("orders.search")}
              className="w-48 bg-transparent text-[12px] outline-none placeholder:text-ink-3/60 sm:w-60"
            />
          </div>
        </div>

        {list.length === 0 ? (
          <div className="p-4">
            <Empty>{t("orders.empty")}</Empty>
          </div>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead className="bg-bone-2/50 text-[10px] uppercase tracking-[0.12em] text-ink-3">
                <tr>
                  <th className="px-3 py-2 text-start font-semibold">{t("orders.ref")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("orders.customer")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("orders.piece")}</th>
                  <th className="px-3 py-2 text-end font-semibold">{t("orders.qty")}</th>
                  <th className="px-3 py-2 text-end font-semibold">{t("orders.budget")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("orders.city")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("orders.confirmed")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("orders.status")}</th>
                  <th className="px-3 py-2 text-end font-semibold">{t("orders.details")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const owner = db.employees.find((e) => e.id === o.assignedTo);
                  return (
                    <tr key={o.id} className="border-t border-line align-middle transition-colors hover:bg-bone/60">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium tabular-nums">{o.ref}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-ink-3/70">
                            <ChannelIcon channel={o.channel} className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[12.5px] text-ink/90">{o.customerName}</div>
                            <div className="truncate text-[10.5px] text-ink-3/70" dir="ltr">
                              {owner ? (lang === "ar" ? owner.nameAr : owner.nameEn) : t("orders.unassigned")}
                            </div>
                          </div>
                          {o.openDetails.length > 0 && (
                            <Badge tone="alert" className="ms-1">
                              {o.openDetails.length}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="max-w-[190px] truncate">{lang === "ar" ? o.productAr : o.productEn}</div>
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums">{o.quantity ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-end tabular-nums">
                        {o.budgetEgp ? fmtEgp(o.budgetEgp, lang) : "—"}
                      </td>
                      <td className="px-3 py-2.5">{o.city ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-3">{fmtDate(o.confirmedAt, lang)}</td>
                      <td className="px-3 py-2.5">
                        <select
                          value={o.status}
                          onChange={(e) => void update(o.id, { status: e.target.value as OrderStatus })}
                          disabled={busy || !canManage}
                          title={canManage ? undefined : t("auth.managerOnly")}
                          className="rounded-md border border-line-2 bg-card px-1.5 py-1 text-[11px] text-ink outline-none focus:border-brass disabled:opacity-60"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(`order.status.${s}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <button
                          onClick={() => setOpenId(o.id)}
                          className="inline-flex items-center gap-1 text-[11.5px] text-ink-3 hover:text-brass-2"
                        >
                          <Icon name="arrow" className="h-3 w-3 rtl:rotate-180" />
                          {t("orders.details")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <OrderSheetDialog
          order={open}
          db={db}
          t={t}
          lang={lang}
          busy={busy}
          canManage={canManage}
          actions={actions}
          onClose={() => setOpenId(null)}
          onUpdate={(patch) => void update(open.id, patch)}
        />
      )}
    </div>
  );
}

function OrderSheetDialog({
  order,
  db,
  t,
  lang,
  busy,
  canManage,
  actions,
  onClose,
  onUpdate,
}: {
  order: OrderRecord;
  db: Database;
  t: Tfn;
  lang: Lang;
  busy: boolean;
  canManage: boolean;
  actions: Actions;
  onClose: () => void;
  onUpdate: (patch: { status?: OrderStatus; assignedTo?: string | null }) => void;
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      const res = await api.shareOrder(order.id, lang);
      setShareUrl(res.url);
      try {
        await navigator.clipboard.writeText(res.url);
      } catch {
        /* clipboard unavailable — the field below still shows the link */
      }
    } catch (e) {
      actions.toast((e as Error).message, false);
    }
    setSharing(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[86vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionLabel>{order.ref}</SectionLabel>
              <h3 className="mt-1 font-display text-[19px]">{order.customerName}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-ink-3">
                <span className="inline-flex items-center gap-1">
                  <ChannelIcon channel={order.channel} className="h-3 w-3" />
                  {t(`inbox.channel.${order.channel}`)}
                </span>
                <span>·</span>
                <span dir="ltr">{order.phone}</span>
                <span>·</span>
                <span>{fmtDate(order.confirmedAt, lang)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone[order.status]}>{t(`order.status.${order.status}`)}</Badge>
              <button onClick={onClose} className="text-ink-3 hover:text-ink">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <SectionLabel>{t("orders.lines")}</SectionLabel>
            <div className="mt-1.5">
              {order.lines.map((line) => (
                <div key={line.key} className="flex items-baseline justify-between gap-3 border-t border-line py-1.5 text-[11.5px]">
                  <span className="text-ink-3">{lang === "ar" ? line.labelAr : line.labelEn}</span>
                  <span className="text-end text-ink/90">{lang === "ar" ? line.valueAr : line.valueEn}</span>
                </div>
              ))}
            </div>
            {order.openDetails.length > 0 && (
              <div className="mt-2 rounded-md border border-alert/20 bg-alert-soft px-2.5 py-2 text-[11px] leading-snug text-alert">
                {t("orders.openDetails")}:{" "}
                {order.openDetails.map((key) => t(`inbox.slot.${key}`)).join("، ")}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("orders.status")}</span>
              <select
                value={order.status}
                onChange={(e) => onUpdate({ status: e.target.value as OrderStatus })}
                disabled={busy || !canManage}
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-2.5 py-2 text-[12px] outline-none focus:border-brass disabled:opacity-60"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`order.status.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("orders.assign")}</span>
              <select
                value={order.assignedTo ?? ""}
                onChange={(e) => onUpdate({ assignedTo: e.target.value || null })}
                disabled={busy || !canManage}
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-2.5 py-2 text-[12px] outline-none focus:border-brass disabled:opacity-60"
              >
                <option value="">{t("orders.unassigned")}</option>
                {db.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {lang === "ar" ? e.nameAr : e.nameEn}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!canManage && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[10.5px] text-ink-3">
              <Icon name="lock" className="h-3 w-3" />
              {t("auth.ordersHint")}
            </p>
          )}

          {shareUrl && (
            <div className="mt-3 rounded-lg border border-line bg-bone/40 p-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3">{t("orders.shareLink")}</div>
              <input
                readOnly
                value={shareUrl}
                dir="ltr"
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1 w-full bg-transparent font-mono text-[10.5px] outline-none"
              />
              <p className="mt-1 text-[10px] leading-snug text-ink-3">{t("orders.shareNote")}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Btn variant="outline" onClick={() => void share()} disabled={sharing}>
              <Icon name="send" className="h-3.5 w-3.5" />
              {t("orders.share")}
            </Btn>
            <a
              href={api.orderPrintUrl(order.id, lang)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3.5 py-2 text-[12.5px] text-ink hover:border-brass hover:text-brass-2"
            >
              <Icon name="print" className="h-3.5 w-3.5" />
              {t("orders.print")}
            </a>
            <button onClick={onClose} className="rounded-lg border border-line-2 px-3.5 py-2 text-[12.5px] text-ink hover:border-brass hover:text-brass-2">
              {t("orders.close")}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
