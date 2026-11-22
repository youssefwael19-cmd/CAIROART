import { useState } from "react";
import type { Actions, Tfn } from "../contract";
import { couponMessage } from "../coupons";
import { fmtDate, type Lang } from "../i18n";
import type { CustomerGroup, Database, StaffRole } from "../types";
import { Badge, Btn, Card, Empty, Icon, SectionLabel, Stat } from "../ui";

interface Props {
  db: Database;
  t: Tfn;
  lang: Lang;
  actions: Actions;
  role: StaffRole;
  whatsapp: boolean;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Campaigns({ db, t, lang, actions, role, whatsapp }: Props) {
  const canManage = role === "manager";
  const groups = db.groups ?? [];
  const numbers = groups.reduce((s, g) => s + g.contacts.length, 0);
  const reached = groups.reduce((s, g) => s + g.contacts.filter((c) => c.lastSentAt).length, 0);
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState<CustomerGroup | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>{t("nav.groups")}</SectionLabel>
          <h1 className="mt-1 font-display text-[28px] leading-tight tracking-tight sm:text-[32px]">{t("groups.title")}</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink-3">{t("groups.subtitle")}</p>
        </div>
        {canManage ? (
          <Btn variant="brass" onClick={() => setShowCreate(true)}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            {t("groups.new")}
          </Btn>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line-2 bg-card px-2 py-1 text-[10.5px] text-ink-3">
            <Icon name="lock" className="h-3 w-3" />
            {t("groups.managerOnly")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("groups.groups")} value={groups.length} />
        <Stat label={t("groups.numbers")} value={numbers} hint={whatsapp ? t("inbox.waConnected") : t("common.demo")} />
        <Stat label={t("groups.reached")} value={reached} accent="brass" />
      </div>

      {!whatsapp && (
        <div className="flex items-start gap-2 rounded-lg border border-brass/25 bg-brass-soft px-3 py-2 text-[11.5px] leading-snug text-brass-2">
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("groups.simulatedNote")}</span>
        </div>
      )}

      {groups.length === 0 ? (
        <Empty>{t("groups.empty")}</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id} className="flex flex-col overflow-hidden">
              <div className="border-b border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-[17px] leading-snug">
                      {lang === "ar" ? group.nameAr : group.nameEn}
                    </h2>
                    <div className="mt-0.5 text-[11px] text-ink-3">
                      {group.contacts.length} {t("groups.whatsappNumbers")}
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <div className="font-display text-[24px] leading-none text-brass-2">{group.discountPct}%</div>
                    <div className="mt-0.5 text-[9.5px] uppercase tracking-[0.14em] text-ink-3">{t("groups.off")}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    dir="ltr"
                    className="rounded-md border border-brass/25 bg-brass-soft px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-brass-2"
                  >
                    {group.couponCode}
                  </span>
                  <span className="text-[10.5px] text-ink-3">
                    {group.lastSentAt ? `${t("groups.lastSent")} · ${fmtDate(group.lastSentAt, lang)}` : t("groups.never")}
                  </span>
                </div>
              </div>

              <div className="flex-1 p-3">
                {group.contacts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-line-2 px-3 py-5 text-center text-[11.5px] text-ink-3">
                    {t("groups.noNumbers")}
                  </div>
                ) : (
                  <ul className="space-y-0.5">
                    {group.contacts.map((contact) => (
                      <li
                        key={contact.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-bone-2/60"
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink/90 text-[9px] font-semibold text-bone">
                          {initials(contact.name)}
                        </span>
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="truncate text-[12px]">{contact.name}</div>
                          <div className="mt-0.5 font-mono text-[10.5px] text-ink-3" dir="ltr">
                            {contact.phone}
                          </div>
                        </div>
                        {contact.lastSentAt && (
                          <span className="shrink-0 text-good" title={`${t("groups.lastSent")} · ${fmtDate(contact.lastSentAt, lang)}`}>
                            <Icon name="check" className="h-3.5 w-3.5" />
                          </span>
                        )}
                        {canManage && (
                          <button
                            onClick={() => void actions.removeContact(group.id, contact.id)}
                            title={t("groups.remove")}
                            aria-label={t("groups.remove")}
                            className="shrink-0 text-ink-3/50 transition-colors hover:text-alert"
                          >
                            <Icon name="close" className="h-3 w-3" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canManage && <AddContactForm group={group} actions={actions} t={t} />}

              <div className="border-t border-line p-3">
                {canManage ? (
                  <Btn
                    variant="brass"
                    className="w-full"
                    disabled={group.contacts.length === 0}
                    onClick={() => setSending(group)}
                  >
                    <Icon name="whatsapp" className="h-3.5 w-3.5" />
                    {t("groups.send")}
                  </Btn>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-[10.5px] text-ink-3">
                    <Icon name="lock" className="h-3 w-3" />
                    {t("groups.managerOnly")}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {canManage && showCreate && <CreateGroupDialog onClose={() => setShowCreate(false)} actions={actions} t={t} />}
      {canManage && sending && (
        <SendDialog
          group={groups.find((g) => g.id === sending.id) ?? sending}
          whatsapp={whatsapp}
          onClose={() => setSending(null)}
          actions={actions}
          t={t}
        />
      )}
    </div>
  );
}

function AddContactForm({ group, actions, t }: { group: CustomerGroup; actions: Actions; t: Tfn }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !phone.trim() || busy) return;
    setBusy(true);
    const ok = await actions.addContact(group.id, { name: name.trim(), phone: phone.trim() });
    setBusy(false);
    if (ok) {
      setName("");
      setPhone("");
    }
  }

  if (!open) {
    return (
      <div className="px-3 pb-3">
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-2 px-3 py-2 text-[11.5px] text-ink-3 transition-colors hover:border-brass hover:text-brass-2"
        >
          <Icon name="plus" className="h-3 w-3" />
          {t("groups.addNumber")}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-bone/40 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("groups.customerName")}
          className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] outline-none placeholder:text-ink-3/60 focus:border-brass"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          dir="ltr"
          inputMode="tel"
          placeholder="+20 100 442 8891"
          className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] outline-none placeholder:text-ink-3/60 focus:border-brass"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-ink-3">{t("groups.phoneHint")}</span>
        <div className="flex gap-1.5">
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setName("");
              setPhone("");
            }}
          >
            {t("common.cancel")}
          </Btn>
          <Btn size="sm" onClick={() => void submit()} disabled={busy || !name.trim() || !phone.trim()}>
            {t("groups.add")}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function CreateGroupDialog({ onClose, actions, t }: { onClose: () => void; actions: Actions; t: Tfn }) {
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [discount, setDiscount] = useState("10");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const pct = Math.round(Number(discount));
  const valid = Boolean(nameEn.trim() && nameAr.trim()) && Number.isFinite(pct) && pct >= 1 && pct <= 90;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    const ok = await actions.createGroup({
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      discountPct: pct,
      couponCode: code.trim() || undefined,
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <SectionLabel>{t("groups.new")}</SectionLabel>
              <h3 className="mt-1 font-display text-[19px]">{t("groups.newTitle")}</h3>
            </div>
            <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label={t("common.close")}>
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("groups.nameEn")}</span>
              <input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Regulars"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("groups.nameAr")}</span>
              <input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="العملاء الدائمون"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("groups.discount")}</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                inputMode="numeric"
                placeholder="15"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("groups.code")}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CAIRO15"
                dir="ltr"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 font-mono text-[12.5px] outline-none focus:border-brass"
              />
            </label>
          </div>
          <p className="mt-2 text-[10.5px] leading-snug text-ink-3">{t("groups.codeHint")}</p>

          <div className="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Btn>
            <Btn onClick={() => void submit()} disabled={busy || !valid}>
              <Icon name="plus" className="h-3.5 w-3.5" />
              {t("groups.create")}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SendDialog({
  group,
  whatsapp,
  onClose,
  actions,
  t,
}: {
  group: CustomerGroup;
  whatsapp: boolean;
  onClose: () => void;
  actions: Actions;
  t: Tfn;
}) {
  const [busy, setBusy] = useState(false);
  const preview = couponMessage(group, group.contacts[0]?.name ?? "");

  async function send() {
    if (busy) return;
    setBusy(true);
    const res = await actions.sendGroup(group.id);
    setBusy(false);
    if (res) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <SectionLabel>{group.couponCode}</SectionLabel>
              <h3 className="mt-1 font-display text-[19px]">{t("groups.sendTitle")}</h3>
            </div>
            <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label={t("common.close")}>
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
            <span>
              {t("groups.sendTo")} <strong className="font-semibold text-ink">{group.contacts.length}</strong>{" "}
              {t("groups.whatsappNumbers")}
            </span>
            <Badge tone="warn">
              {group.discountPct}% {t("groups.off")}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-ink-3">{t("groups.sendNote")}</p>

          {!whatsapp && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-brass/25 bg-brass-soft px-3 py-2 text-[10.5px] leading-snug text-brass-2">
              <Icon name="alert" className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{t("groups.simulatedNote")}</span>
            </div>
          )}

          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">{t("groups.preview")}</div>
            <pre className="mt-1.5 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-bone/50 p-3 font-sans text-[11.5px] leading-relaxed text-ink-2">
              {preview}
            </pre>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Btn variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Btn>
            <Btn variant="brass" onClick={() => void send()} disabled={busy}>
              <Icon name={busy ? "refresh" : "whatsapp"} className="h-3.5 w-3.5" />
              {busy ? t("groups.sending") : `${t("groups.send")} · ${group.contacts.length}`}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
