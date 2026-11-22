import { useEffect, useRef, useState } from "react";
import type { AppMeta } from "../api";
import type { Actions, Tfn } from "../contract";
import { fmtTime, type Lang } from "../i18n";
import type { ChannelKind, Conversation, Database, StaffRole } from "../types";
import { Badge, Btn, Card, ChannelIcon, Empty, Icon, ProgressBar, ScoreRing, SectionLabel } from "../ui";

interface Props {
  db: Database;
  t: Tfn;
  lang: Lang;
  actions: Actions;
  activeId: string | null;
  meta: AppMeta | null;
  role: StaffRole;
}

const statusTone = {
  "ai-handling": "glass",
  "ready-for-handoff": "warn",
  "with-employee": "good",
  closed: "neutral",
} as const;

const SLOT_ORDER = ["product", "quantity", "variant", "personalization", "city", "timeline", "budget", "payment", "confirm"] as const;

const intentTone = {
  wholesale: "pearl",
  custom: "glass",
  complaint: "alert",
  retail: "neutral",
  unqualified: "neutral",
} as const;

export default function Inbox({ db, t, lang, actions, activeId, meta, role }: Props) {
  /* Simulating an inbound customer message stays with managers. */
  const canSimulate = role === "manager";
  const [filter, setFilter] = useState<"all" | ChannelKind>("all");
  const [selected, setSelected] = useState<string | null>(activeId ?? db.conversations[0]?.id ?? null);
  const [author, setAuthor] = useState<"customer" | "employee">("employee");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (activeId) setSelected(activeId);
  }, [activeId]);

  const list = db.conversations
    .filter((c) => filter === "all" || c.channel === filter)
    .sort((a, b) => {
      const rank = (s: string) => (s === "ready-for-handoff" ? 0 : s === "ai-handling" ? 1 : 2);
      return rank(a.status) - rank(b.status) || +new Date(b.lastAt) - +new Date(a.lastAt);
    });

  const conv = db.conversations.find((c) => c.id === selected) ?? list[0] ?? null;
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conv?.id, conv?.messages.length]);

  async function submit() {
    if (!conv || !text.trim() || busy) return;
    setBusy(true);
    const value = text.trim();
    setText("");
    await actions.send(conv.id, value, canSimulate ? author : "employee");
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>{t("nav.inbox")}</SectionLabel>
          <h1 className="mt-1 font-display text-[28px] leading-tight tracking-tight sm:text-[32px]">{t("inbox.title")}</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink-3">{t("inbox.subtitle")}</p>
        </div>
        {canSimulate && (
          <Btn variant="brass" onClick={() => setShowNew(true)}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            {t("inbox.newEnquiry")}
          </Btn>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[286px_minmax(0,1fr)] xl:grid-cols-[286px_minmax(0,1fr)_312px]">
        {/* conversation list */}
        <Card className="flex max-h-[70vh] flex-col overflow-hidden lg:max-h-[calc(100vh-13rem)]">
          <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-line p-2">
            {(["all", "website", "whatsapp", "instagram", "facebook", "tiktok"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                  filter === f ? "bg-ink text-bone" : "text-ink-3 hover:bg-bone-2"
                }`}
              >
                {f !== "all" && <ChannelIcon channel={f} className="h-3 w-3" />}
                {f === "all" ? t("common.all") : t(`inbox.channel.${f}`)}
              </button>
            ))}
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto">
            {list.length === 0 && <div className="p-3"><Empty>{t("inbox.empty")}</Empty></div>}
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full border-b border-line px-3 py-2.5 text-start transition-colors ${
                  c.id === conv?.id ? "bg-brass-soft/60" : "hover:bg-bone/70"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-medium">{c.customerName}</span>
                  {c.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />}
                  <span className="ms-auto shrink-0 text-[10px] text-ink-3/70">{fmtTime(c.lastAt, lang)}</span>
                </div>
                <div className="mt-0.5 line-clamp-1 text-[11px] text-ink-3">
                  {c.messages[c.messages.length - 1]?.text}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-ink-3/70"><ChannelIcon channel={c.channel} className="h-3 w-3" /></span>
                  <span className="text-[10px] text-ink-3/80">{t(`status.${c.status}`)}</span>
                  <span className="ms-auto text-[10px] tabular-nums text-ink-3/60">{c.qualification.score}%</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* thread */}
        <Card className="flex min-h-[520px] flex-col overflow-hidden lg:h-[calc(100vh-13rem)]">
          {!conv ? (
            <div className="grid flex-1 place-items-center p-6"><Empty>{t("inbox.empty")}</Empty></div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-bone-2 font-display text-[13px] text-ink-3">
                  {conv.customerName.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">{conv.customerName}</span>
                    <Badge tone={statusTone[conv.status]}>{t(`status.${conv.status}`)}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-ink-3">
                    <span className="uppercase tracking-[0.1em]">{t(`inbox.channel.${conv.channel}`)}</span>
                    <span>·</span>
                    <span dir="ltr">{conv.phone}</span>
                    {conv.assignedTo && (
                      <>
                        <span>·</span>
                        <span>
                          {t("inbox.assignedTo")}:{" "}
                          {lang === "ar"
                            ? db.employees.find((e) => e.id === conv.assignedTo)?.nameAr
                            : db.employees.find((e) => e.id === conv.assignedTo)?.nameEn}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="scroll-thin flex-1 space-y-3 overflow-y-auto bg-bone/40 px-3 py-4 sm:px-4">
                {conv.messages.map((m) => {
                  const mine = m.from !== "customer";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] sm:max-w-[76%] ${mine ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-lg px-3 py-2 text-[12.5px] leading-relaxed shadow-[0_1px_1px_rgba(0,0,0,0.03)] ${
                            m.from === "customer"
                              ? "border border-line bg-card text-ink"
                              : m.from === "employee"
                                ? "bg-ink text-bone/90"
                                : "border border-glass/20 bg-glass-soft text-glass"
                          }`}
                        >
                          {m.text}
                        </div>
                        <div className={`mt-1 flex items-center gap-1 px-0.5 text-[9.5px] uppercase tracking-[0.1em] text-ink-3/70 ${mine ? "justify-end" : "justify-start"}`}>
                          {m.from === "ai" ? (
                            <>
                              <Icon name="sparkle" className="h-2.5 w-2.5" /> {t("common.ai")}
                              {m.agent ? ` · ${t(`agent.${m.agent}`)}` : ""}
                            </>
                          ) : m.from === "employee" ? t("inbox.replyAsEmployee") : t("inbox.replyAsCustomer")}
                          <span>·</span>
                          {fmtTime(m.at, lang)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="border-t border-line bg-card p-2.5">
                <div className="mb-2 flex items-center gap-1.5">
                  <div className={`flex rounded-md border border-line-2 p-0.5 ${canSimulate ? "" : "hidden"}`}>
                    {(["employee", "customer"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => setAuthor(a)}
                        className={`rounded px-2 py-0.5 text-[10.5px] font-medium ${
                          author === a ? "bg-ink text-bone" : "text-ink-3"
                        }`}
                      >
                        {a === "employee" ? t("inbox.replyAsEmployee") : t("inbox.replyAsCustomer")}
                      </button>
                    ))}
                  </div>
                  <span className="line-clamp-1 text-[10px] text-ink-3/80">
                    {author === "customer" ? t("inbox.customerMode") : ""}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submit();
                      }
                    }}
                    rows={2}
                    placeholder={t("inbox.composer")}
                    className="scroll-thin min-h-[42px] flex-1 resize-none rounded-lg border border-line bg-bone/50 px-3 py-2 text-[12.5px] outline-none placeholder:text-ink-3/60 focus:border-brass"
                  />
                  <Btn onClick={submit} disabled={busy || !text.trim()} className="h-[42px]">
                    <Icon name="send" className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </Btn>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* qualification panel */}
        <div className="space-y-3 xl:block">
          {conv && <QualificationPanel conv={conv} db={db} t={t} lang={lang} actions={actions} meta={meta} />}
        </div>
      </div>

      {showNew && <NewEnquiryDialog onClose={() => setShowNew(false)} actions={actions} t={t} lang={lang} />}
    </div>
  );
}

function QualificationPanel({
  conv,
  db,
  t,
  lang,
  actions,
  meta,
}: {
  conv: Conversation;
  db: Database;
  t: Tfn;
  lang: Lang;
  actions: Actions;
  meta: AppMeta | null;
}) {
  const q = conv.qualification;
  const employees = [...db.employees].sort((a, b) => Number(b.online) - Number(a.online));
  const [assignee, setAssignee] = useState(employees[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const ready = q.missing.length === 0;

  const note =
    conv.channel === "whatsapp"
      ? {
          ok: Boolean(meta?.whatsapp),
          title: meta?.whatsapp ? t("inbox.waConnected") : t("common.demo"),
          body: meta?.whatsapp ? "graph.facebook.com/v20.0" : t("inbox.waSimulated"),
        }
      : conv.channel === "instagram" || conv.channel === "facebook"
        ? { ok: false, title: t("channel.meta"), body: t("inbox.metaSimulated") }
        : conv.channel === "tiktok"
          ? { ok: false, title: t("common.demo"), body: t("inbox.tiktokSimulated") }
          : {
              ok: true,
              title: t("common.live"),
              body: lang === "ar" ? "استفسارات الموقع تصل إلى نفس المكتب." : "Website enquiries post to this same desk.",
            };

  async function hand() {
    if (!assignee) return;
    setBusy(true);
    await actions.handoff(conv.id, assignee);
    setBusy(false);
  }

  return (
    <>
      <Card className="p-4">
        <SectionLabel>{t("inbox.qualification")}</SectionLabel>
        <div className="mt-3 flex items-center gap-3">
          <ScoreRing score={q.score} />
          <div className="min-w-0">
            <Badge tone={intentTone[q.intent as keyof typeof intentTone] ?? "neutral"}>
              {t(`inbox.intent.${q.intent}`)}
            </Badge>
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink-3">
              {lang === "ar" ? q.summaryAr : q.summaryEn}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={q.score} />
        </div>

      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>{t("inbox.orderDetails")}</SectionLabel>
          <Badge tone={conv.status === "with-employee" ? "good" : "glass"}>
            {conv.status === "with-employee" ? t("inbox.aiPaused") : t(`agent.${conv.order?.agent ?? "intake"}`)}
          </Badge>
        </div>
        {conv.status === "with-employee" && (
          <p className="mt-1.5 text-[10.5px] leading-snug text-ink-3">{t("inbox.aiPausedNote")}</p>
        )}
        <div className="mt-2">
          {SLOT_ORDER.map((k) => {
            const slot = conv.order?.slots[k];
            const skipped = conv.order?.skipped.includes(k) ?? false;
            const shown = slot ? (lang === "ar" ? slot.labelAr : slot.labelEn) : null;
            return (
              <div key={k} className="flex items-baseline justify-between gap-3 border-t border-line py-1.5 text-[11.5px]">
                <span className="text-ink-3">{t(`inbox.slot.${k}`)}</span>
                <span className={`text-end ${shown ? "text-ink/90" : skipped ? "text-alert" : "text-ink-3/50"}`}>
                  {shown ?? (skipped ? t("inbox.toConfirm") : t("inbox.waiting"))}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-ink-3/70">{t("inbox.agentChecks")}</p>
      </Card>

      <Card className="p-4">
        {ready && (
          <div className="mb-3 rounded-md border border-brass/25 bg-brass-soft/60 px-2.5 py-2 text-[11px] leading-snug text-brass-2">
            {t("inbox.ready")}
          </div>
        )}
        <SectionLabel>{t("inbox.handoff")}</SectionLabel>
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-bone/40 px-2.5 py-2 text-[12px] outline-none focus:border-brass"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {lang === "ar" ? e.nameAr : e.nameEn} — {lang === "ar" ? e.roleAr : e.roleEn}
            </option>
          ))}
        </select>
        <Btn onClick={hand} disabled={busy || conv.status === "with-employee"} variant={ready ? "brass" : "outline"} className="mt-2 w-full">
          <Icon name="arrow" className="h-3.5 w-3.5 rtl:rotate-180" />
          {t("inbox.handoff")}
        </Btn>
      </Card>

      <div
        className={`rounded-lg border px-3 py-2.5 text-[11px] leading-snug ${
          note.ok ? "border-good/20 bg-good-soft text-good" : "border-line bg-bone-2/70 text-ink-3"
        }`}
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Icon name={note.ok ? "check" : "whatsapp"} className="h-3 w-3" />
          {note.title}
        </div>
        <div className="mt-1">{note.body}</div>
      </div>
    </>
  );
}

function NewEnquiryDialog({
  onClose,
  actions,
  t,
  lang,
}: {
  onClose: () => void;
  actions: Actions;
  t: Tfn;
  lang: Lang;
}) {
  const [channel, setChannel] = useState<ChannelKind>("website");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!text.trim() || busy) return;
    setBusy(true);
    await actions.newEnquiry({ channel, name: name.trim(), text: text.trim(), lang });
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <SectionLabel>{t("inbox.newEnquiry")}</SectionLabel>
              <h3 className="mt-1 font-display text-[19px]">{t("inbox.new.title")}</h3>
            </div>
            <button onClick={onClose} className="text-ink-3 hover:text-ink"><Icon name="close" className="h-4 w-4" /></button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex gap-1">
              {(["website", "whatsapp", "instagram", "facebook", "tiktok"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`flex-1 rounded-md border px-1.5 py-1.5 text-[11px] ${
                    channel === c ? "border-ink bg-ink text-bone" : "border-line-2 text-ink-3"
                  }`}
                >
                  {t(`inbox.channel.${c}`)}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("inbox.new.name")}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === "ar" ? "مثال: سارة" : "e.g. Sara"}
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("inbox.new.text")}</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder={lang === "ar" ? "عايزة طقم قهوة عربي، التوصيل للمعادي" : "I need an Arabic coffee set, delivery to Maadi"}
                className="mt-1 w-full resize-none rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" onClick={onClose}>{t("common.none")}</Btn>
            <Btn onClick={create} disabled={busy || !text.trim()}>
              <Icon name="sparkle" className="h-3.5 w-3.5" />
              {t("inbox.new.create")}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
