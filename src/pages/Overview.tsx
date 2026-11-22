import { useState } from "react";
import type { Digest } from "../App";
import type { Tfn } from "../contract";
import { fmtDate, fmtEgp, fmtTime, type Lang } from "../i18n";
import { activityKind, type ActivityKind, type Database } from "../types";
import { Badge, Btn, Card, ChannelIcon, Empty, Icon, ProgressBar, ScoreRing, SectionLabel, Stat } from "../ui";

interface Props {
  db: Database;
  t: Tfn;
  lang: Lang;
  digest: Digest | null;
  onRefreshDigest: () => void;
  onOpenConversation: (id: string) => void;
}

const statusTone = {
  "ai-handling": "glass",
  "ready-for-handoff": "warn",
  "with-employee": "neutral",
  closed: "neutral",
} as const;

export default function Overview({ db, t, lang, digest, onRefreshDigest, onOpenConversation }: Props) {
  const [feed, setFeed] = useState<"all" | ActivityKind>("all");
  const feedItems = db.activity.filter((a) => feed === "all" || activityKind(a) === feed).slice(0, 7);
  const revenue = db.channels.reduce((s, c) => s + c.revenueEgp, 0);
  const orders = db.channels.reduce((s, c) => s + c.orders, 0);
  const live = db.conversations.filter((c) => c.status === "ai-handling").length;
  const waiting = db.conversations.filter((c) => c.status === "ready-for-handoff").length;
  const offTrack = db.tasks.filter((x) => x.status !== "done" && new Date(x.dueAt).getTime() < Date.now()).length;
  const maxRevenue = Math.max(...db.channels.map((c) => c.revenueEgp));

  const queue = [...db.conversations]
    .filter((c) => c.status !== "closed")
    .sort((a, b) => {
      const rank = (s: string) => (s === "ready-for-handoff" ? 0 : s === "ai-handling" ? 1 : 2);
      return rank(a.status) - rank(b.status) || +new Date(b.lastAt) - +new Date(a.lastAt);
    })
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>{fmtDate(new Date().toISOString(), lang)} · {t("common.today")}</SectionLabel>
          <h1 className="mt-1 font-display text-[28px] leading-tight tracking-tight sm:text-[32px]">{t("overview.title")}</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink-3">{t("overview.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="glass">{formater(lang, live)} {t("overview.kpi.live")}</Badge>
          <Badge tone={waiting ? "warn" : "neutral"}>{waiting} {t("overview.kpi.handoff")}</Badge>
        </div>
      </div>

      <Card className="overflow-hidden border-ink bg-ink text-bone/80">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">
              <Icon name="sparkle" className="h-3.5 w-3.5" />
              {t("overview.briefing")}
            </div>
            <p className="mt-2.5 font-display text-[18px] leading-snug text-bone sm:text-[20px]">
              {digest ? (lang === "ar" ? digest.headlineAr : digest.headlineEn) : "…"}
            </p>
            <ul className="mt-3 space-y-1.5">
              {(digest ? (lang === "ar" ? digest.bulletsAr : digest.bulletsEn) : []).map((b, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-bone/60">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brass" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-bone/35">
              {t("common.generatedBy")} {digest?.generatedBy === "llm" ? t("common.llm") : t("common.rules")}
            </div>
          </div>
          <Btn variant="outline" size="sm" onClick={onRefreshDigest} className="shrink-0 border-bone/20 text-bone/80 hover:border-brass hover:text-brass">
            <Icon name="refresh" className="h-3.5 w-3.5" />
            {t("overview.regenerate")}
          </Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("overview.kpi.live")} value={live} hint={`${db.conversations.length} ${lang === "ar" ? "محادثة هذا الأسبوع" : "conversations this week"}`} accent="glass" />
        <Stat label={t("overview.kpi.handoff")} value={waiting} hint={waiting ? t("overview.queue") : t("overview.queueEmpty")} accent={waiting ? "brass" : "ink"} />
        <Stat label={t("overview.kpi.revenue")} value={fmtEgp(revenue, lang)} hint={`${orders} ${t("common.orders")} · ${t("sales.aov")} ${fmtEgp(revenue / orders, lang)}`} />
        <Stat label={t("overview.kpi.risk")} value={offTrack} hint={`${db.tasks.length} ${t("team.tasks")}`} accent={offTrack ? "alert" : "ink"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between px-4 pt-4">
              <SectionLabel>{t("overview.queue")}</SectionLabel>
              <button onClick={() => onOpenConversation(queue[0]?.id ?? "")} className="inline-flex items-center gap-1 text-[11.5px] text-ink-3 hover:text-brass-2">
                {t("overview.viewAll")} <Icon name="arrow" className="h-3 w-3 rtl:rotate-180" />
              </button>
            </div>
            <div className="mt-2">
              {queue.length === 0 && <div className="p-4"><Empty>{t("overview.queueEmpty")}</Empty></div>}
              {queue.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onOpenConversation(c.id)}
                  className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-start transition-colors hover:bg-bone/70"
                >
                  <ScoreRing score={c.qualification.score} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium">{c.customerName}</span>
                      <span className="text-ink-3/70"><ChannelIcon channel={c.channel} className="h-3.5 w-3.5" /></span>
                      <span className="text-[10.5px] text-ink-3/70">{fmtTime(c.lastAt, lang)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-ink-3">
                      {lang === "ar" ? c.qualification.summaryAr : c.qualification.summaryEn}
                    </div>
                  </div>
                  <Badge tone={statusTone[c.status]}>{t(`status.${c.status}`)}</Badge>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <SectionLabel>{t("overview.channels")}</SectionLabel>
              <span className="text-[11px] text-ink-3">{fmtEgp(revenue, lang)}</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {db.channels.map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12px] text-ink/90">{lang === "ar" ? c.nameAr : c.nameEn}</span>
                    <span className={`text-[10.5px] ${c.changePct >= 0 ? "text-good" : "text-alert"}`}>
                      {c.changePct >= 0 ? "+" : ""}
                      {c.changePct}%
                    </span>
                  </div>
                  <span className="font-display text-[12px] tabular-nums text-ink-3">{fmtEgp(c.revenueEgp, lang)}</span>
                  <div className="col-span-2">
                    <ProgressBar value={(c.revenueEgp / maxRevenue) * 100} tone={c.changePct >= 0 ? "brass" : "alert"} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
            <SectionLabel>{t("overview.activity")}</SectionLabel>
            <div className="flex rounded-md border border-line-2 bg-card p-0.5">
              {(["all", "ai", "team", "access"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setFeed(option)}
                  className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                    feed === option ? "bg-ink text-bone" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {option === "all" ? t("common.all") : t(`activity.${option}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex-1">
            {feedItems.length === 0 && (
              <div className="px-4 py-6 text-center text-[11.5px] text-ink-3">{t("activity.empty")}</div>
            )}
            {feedItems.map((a) => {
              const kind = activityKind(a);
              return (
                <div key={a.id} className="flex gap-2.5 border-t border-line px-4 py-2.5">
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                      kind === "ai"
                        ? "bg-brass-soft text-brass-2"
                        : kind === "access"
                          ? "bg-pearl-soft text-pearl"
                          : "bg-bone-2 text-ink-3"
                    }`}
                  >
                    <Icon name={kind === "ai" ? "sparkle" : kind === "access" ? "lock" : "team"} className="h-3 w-3" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11.5px] leading-snug text-ink/85">{lang === "ar" ? a.textAr : a.textEn}</div>
                    <div className="mt-0.5 text-[10px] text-ink-3/70">
                      {kind === "ai" ? t("common.ai") : t(`activity.${kind}`)} · {fmtTime(a.at, lang)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function formater(lang: Lang, n: number) {
  return lang === "ar" ? `${n}` : `${n}`;
}
