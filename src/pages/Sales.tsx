import { useEffect } from "react";
import type { Actions, Tfn } from "../contract";
import { fmtEgp, type Lang } from "../i18n";
import type { Analysis, Database } from "../types";
import { Badge, Btn, Card, Icon, ProgressBar, SectionLabel, Stat } from "../ui";

interface Props {
  db: Database;
  t: Tfn;
  lang: Lang;
  actions: Actions;
  analysis: Analysis | null;
}

export default function Sales({ db, t, lang, actions, analysis }: Props) {
  useEffect(() => {
    if (!analysis) void actions.loadSales();
  }, [analysis, actions]);

  const revenue = db.channels.reduce((s, c) => s + c.revenueEgp, 0);
  const orders = db.channels.reduce((s, c) => s + c.orders, 0);
  const sessions = db.channels.reduce((s, c) => s + c.sessions, 0);
  const spend = db.channels.reduce((s, c) => s + c.adSpendEgp, 0);
  const maxRevenue = Math.max(...db.channels.map((c) => c.revenueEgp));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>{t("nav.sales")}</SectionLabel>
          <h1 className="mt-1 font-display text-[28px] leading-tight tracking-tight sm:text-[32px]">{t("sales.title")}</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink-3">{t("sales.subtitle")}</p>
          <p className="mt-1 max-w-2xl text-[11px] text-ink-3/70">{t("sales.sample")}</p>
        </div>
        <Btn variant="outline" onClick={() => void actions.loadSales()}>
          <Icon name="refresh" className="h-3.5 w-3.5" />
          {t("sales.analyse")}
        </Btn>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("sales.revenue")} value={fmtEgp(revenue, lang)} hint={`${orders} ${t("common.orders")}`} />
        <Stat label={t("sales.aov")} value={fmtEgp(revenue / orders, lang)} hint={`${sessions.toLocaleString("en-US")} ${t("sales.sessions")}`} />
        <Stat label={t("sales.conversion")} value={`${((orders / sessions) * 100).toFixed(1)}%`} accent="glass" hint={`${fmtEgp(spend, lang)} ${t("sales.adSpend").toLowerCase()}`} />
        <Stat
          label={t("sales.returns")}
          value={db.channels.reduce((s, c) => s + c.returns, 0)}
          accent={db.channels.reduce((s, c) => s + c.returns, 0) > 10 ? "alert" : "ink"}
          hint={`${((db.channels.reduce((s, c) => s + c.returns, 0) / orders) * 100).toFixed(1)}% ${t("sales.ofOrders")}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="overflow-hidden">
          <div className="px-4 pt-4">
            <SectionLabel>{t("sales.channel")}</SectionLabel>
          </div>
          <div className="mt-2">
            <div className="hidden grid-cols-[1.6fr_repeat(4,minmax(0,0.8fr))] gap-2 border-t border-line px-4 py-1.5 text-[9.5px] uppercase tracking-[0.1em] text-ink-3/70 sm:grid">
              <span>{t("sales.channel")}</span>
              <span className="text-end">{t("sales.revenue")}</span>
              <span className="text-end">{t("common.orders")}</span>
              <span className="text-end">{t("sales.conversion")}</span>
              <span className="text-end">{t("sales.returns")}</span>
            </div>
            {db.channels.map((c) => {
              const conv = (c.orders / c.sessions) * 100;
              return (
                <div key={c.id} className="border-t border-line px-4 py-2.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[1.6fr_repeat(4,minmax(0,0.8fr))]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-medium">{lang === "ar" ? c.nameAr : c.nameEn}</span>
                        <span className={`shrink-0 text-[10px] ${c.changePct >= 0 ? "text-good" : "text-alert"}`}>
                          {c.changePct >= 0 ? "+" : ""}
                          {c.changePct}%
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge tone="neutral">{c.kind}</Badge>
                        <span className="text-[10px] text-ink-3/70">{Math.round((c.revenueEgp / revenue) * 100)}% {t("sales.share")}</span>
                      </div>
                    </div>
                    <div className="whitespace-nowrap text-end font-display text-[12px] tabular-nums sm:text-[12.5px]">{fmtEgp(c.revenueEgp, lang)}</div>
                    <div className="hidden text-end text-[12px] tabular-nums text-ink/80 sm:block">{c.orders}</div>
                    <div className={`hidden text-end text-[12px] tabular-nums sm:block ${conv >= 1.5 ? "text-good" : "text-alert"}`}>{conv.toFixed(1)}%</div>
                    <div className={`hidden text-end text-[12px] tabular-nums sm:block ${c.returns > 4 ? "text-alert" : "text-ink/80"}`}>{c.returns}</div>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={(c.revenueEgp / maxRevenue) * 100} tone={c.changePct >= 0 ? "brass" : "alert"} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="flex flex-col p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brass-2">
            <Icon name="sparkle" className="h-3.5 w-3.5" />
            {t("sales.headline")}
          </div>
          {!analysis ? (
            <div className="mt-4 flex items-center gap-2 text-[12px] text-ink-3">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-brass" />
              {t("common.loading")}
            </div>
          ) : (
            <>
              <p className="mt-2.5 font-display text-[16px] leading-snug text-ink">
                {lang === "ar" ? analysis.headlineAr : analysis.headlineEn}
              </p>

              <div className="mt-4 space-y-3">
                <FeedbackBlock icon="check" title={t("sales.wins")} items={analysis.wins.map((w) => (lang === "ar" ? w.ar : w.en))} tone="good" />
                <FeedbackBlock icon="alert" title={t("sales.risks")} items={analysis.risks.map((w) => (lang === "ar" ? w.ar : w.en))} tone="alert" />
                <FeedbackBlock icon="arrow" title={t("sales.actions")} items={analysis.actions.map((w) => (lang === "ar" ? w.ar : w.en))} tone="brass" />
              </div>

              <div className="mt-auto pt-3 text-[9.5px] uppercase tracking-[0.14em] text-ink-3/70">
                {t("common.generatedBy")} {analysis.generatedBy === "ai" ? t("common.llm") : t("common.rules")}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function FeedbackBlock({
  icon,
  title,
  items,
  tone,
}: {
  icon: string;
  title: string;
  items: string[];
  tone: "good" | "alert" | "brass";
}) {
  const color = tone === "good" ? "text-good bg-good-soft" : tone === "alert" ? "text-alert bg-alert-soft" : "text-brass-2 bg-brass-soft";
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className={`grid h-4 w-4 place-items-center rounded ${color}`}>
          <Icon name={icon} className="h-2.5 w-2.5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">{title}</span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-1.5 text-[11.5px] leading-snug text-ink/85">
            <span className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-line-2" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
