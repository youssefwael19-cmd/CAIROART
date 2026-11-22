import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Actions, Tfn } from "../contract";
import { fmtDate, type Lang } from "../i18n";
import type { Audit, Database, Employee, SessionUser, StaffRole, TaskStatus } from "../types";
import { Badge, Btn, Card, Empty, Icon, SectionLabel } from "../ui";

interface Props {
  db: Database;
  t: Tfn;
  lang: Lang;
  actions: Actions;
  audit: Audit | null;
  user: SessionUser;
}

const STATUSES: TaskStatus[] = ["todo", "in-progress", "review", "done"];

export default function Team({ db, t, lang, actions, audit, user }: Props) {
  useEffect(() => {
    if (!audit) void actions.loadAudit();
  }, [audit, actions]);

  const canManage = user.role === "manager";
  const [staff, setStaff] = useState<SessionUser[] | null>(null);
  const [staffBusy, setStaffBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState<Employee | null | false>(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [resetting, setResetting] = useState<SessionUser | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      setStaff((await api.staff()).staff);
    } catch (e) {
      actions.toast((e as Error).message, false);
    }
  }, [actions]);

  useEffect(() => {
    if (canManage && !staff) void loadStaff();
  }, [canManage, staff, loadStaff]);

  async function toggleStaff(target: SessionUser) {
    setStaffBusy(target.id);
    try {
      const res = await api.setStaffActive(target.id, !target.active);
      setStaff(res.staff);
      actions.toast(t(target.active ? "team.deactivated" : "team.activated"));
    } catch (e) {
      actions.toast((e as Error).message, false);
    }
    setStaffBusy(null);
  }

  const open = db.tasks.filter((x) => x.status !== "done");
  const overdue = open.filter((x) => new Date(x.dueAt).getTime() < Date.now());
  const employeeName = (id: string) => {
    const e = db.employees.find((x) => x.id === id);
    return e ? (lang === "ar" ? e.nameAr : e.nameEn) : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>{t("nav.team")}</SectionLabel>
          <h1 className="mt-1 font-display text-[28px] leading-tight tracking-tight sm:text-[32px]">{t("team.title")}</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink-3">{t("team.subtitle")}</p>
        </div>
        <Btn variant="outline" onClick={() => void actions.loadAudit()}>
          <Icon name="refresh" className="h-3.5 w-3.5" />
          {t("team.audit")}
        </Btn>
      </div>

      <Card className="overflow-hidden border-ink bg-ink p-4 text-bone/80 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">
              <Icon name="sparkle" className="h-3.5 w-3.5" />
              {t("team.flags")}
            </div>
            <p className="mt-2 max-w-2xl font-display text-[17px] leading-snug text-bone">
              {audit ? (lang === "ar" ? audit.headlineAr : audit.headlineEn) : "…"}
            </p>
          </div>
          <div className="hidden shrink-0 text-end sm:block">
            <div className="font-display text-[26px] leading-none text-brass">{overdue.length}</div>
            <div className="mt-1 text-[9.5px] uppercase tracking-[0.12em] text-bone/40">{t("team.overdue")}</div>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5">
          {audit?.flags.length === 0 && <div className="text-[12px] text-bone/50">{t("team.noFlags")}</div>}
          {audit?.flags.map((f, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2">
              <Icon name="alert" className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${f.severity === "high" ? "text-alert" : "text-brass"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] leading-snug text-bone/80">{lang === "ar" ? f.ar : f.en}</div>
              </div>
              <Badge tone={f.severity === "high" ? "alert" : "warn"}>{t(`team.severity.${f.severity}`)}</Badge>
            </div>
          ))}
        </div>
        {audit && (
          <div className="mt-2.5 text-[9.5px] uppercase tracking-[0.14em] text-bone/30">
            {t("common.generatedBy")} {audit.generatedBy === "ai" ? t("common.llm") : t("common.rules")}
          </div>
        )}
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionLabel>{t("team.employees")}</SectionLabel>
          {canManage && (
            <Btn variant="ghost" size="sm" onClick={() => setShowAddProfile(true)}>
              <Icon name="plus" className="h-3 w-3" />
              {t("team.addProfile")}
            </Btn>
          )}
        </div>
        {db.employees.length === 0 && (
          <Card className="p-4 text-[12px] leading-snug text-ink-3">{t("team.emptyTeam")}</Card>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {db.employees.map((e) => {
            const mine = db.tasks.filter((x) => x.employeeId === e.id);
            const openMine = mine.filter((x) => x.status !== "done");
            const late = openMine.filter((x) => new Date(x.dueAt).getTime() < Date.now()).length;
            const linked = staff?.find((s) => s.employeeId === e.id);
            return (
              <Card key={e.id} className="p-3.5">
                <div className="flex items-center gap-2">
                  <div className="relative grid h-8 w-8 place-items-center rounded-full bg-bone-2 font-display text-[12px] text-ink-3">
                    {(lang === "ar" ? e.nameAr : e.nameEn).slice(0, 1)}
                    <span
                      className={`absolute -bottom-0.5 -end-0.5 h-2 w-2 rounded-full border-2 border-card ${e.online ? "bg-good" : "bg-line-2"}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium">{lang === "ar" ? e.nameAr : e.nameEn}</div>
                    <div className="truncate text-[10px] text-ink-3">{lang === "ar" ? e.roleAr : e.roleEn}</div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[10.5px] text-ink-3">
                  <span>{openMine.length} {t("team.open")}</span>
                  <span className={late ? "font-medium text-alert" : "text-good"}>
                    {late ? `${late} ${t("team.overdue")}` : e.online ? t("team.online") : t("team.offline")}
                  </span>
                </div>
                {canManage && (
                  <div className="mt-2 border-t border-line pt-2 text-[10px]">
                    {linked ? (
                      <span className="block truncate font-mono text-ink-3" dir="ltr" title={linked.email}>
                        {linked.email}
                      </span>
                    ) : (
                      <button
                        onClick={() => setShowAdd(e)}
                        className="inline-flex items-center gap-1 text-brass hover:text-ink"
                      >
                        <Icon name="plus" className="h-3 w-3" />
                        {t("team.createSignIn")}
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {canManage && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <div className="flex items-center gap-1.5">
                <Icon name="lock" className="h-3.5 w-3.5 text-ink-3" />
                <SectionLabel>{t("team.access")}</SectionLabel>
              </div>
              <p className="mt-1 text-[11px] text-ink-3">{t("team.accessNote")}</p>
            </div>
            <Btn variant="outline" size="sm" onClick={() => setShowAdd(null)}>
              <Icon name="plus" className="h-3 w-3" />
              {t("team.addStaff")}
            </Btn>
          </div>

          <div>
            {!staff && <div className="p-4 text-[12px] text-ink-3">{t("common.loading")}</div>}
            {staff?.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-2.5 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium">
                      {lang === "ar" ? account.nameAr : account.nameEn}
                    </span>
                    {account.id === user.id && <Badge tone="neutral">{t("team.you")}</Badge>}
                    {!account.active && <Badge tone="alert">{t("team.inactive")}</Badge>}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-ink-3" dir="ltr">
                    {account.email}
                  </div>
                </div>
                <Badge tone={account.role === "manager" ? "warn" : "neutral"}>{t(`auth.role.${account.role}`)}</Badge>
                <div className="flex items-center gap-1.5">
                  <Btn variant="ghost" size="sm" onClick={() => setResetting(account)}>
                    {t("team.resetPassword")}
                  </Btn>
                  <Btn
                    variant="outline"
                    size="sm"
                    disabled={staffBusy === account.id || account.id === user.id}
                    title={account.id === user.id ? t("team.selfNote") : undefined}
                    onClick={() => void toggleStaff(account)}
                  >
                    <Icon name={account.active ? "lock" : "check"} className="h-3 w-3" />
                    {account.active ? t("team.deactivate") : t("team.activate")}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 pt-4">
          <SectionLabel>{t("team.tasks")}</SectionLabel>
        </div>
        <div className="mt-2">
          {db.tasks.length === 0 && <div className="p-4"><Empty>—</Empty></div>}
          {db.tasks.map((task) => {
            const late = task.status !== "done" && new Date(task.dueAt).getTime() < Date.now();
            return (
              <div
                key={task.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-line px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_140px_100px_110px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`truncate text-[12.5px] ${task.status === "done" ? "text-ink-3 line-through" : "text-ink"}`}>
                      {lang === "ar" ? task.titleAr : task.titleEn}
                    </span>
                    {task.priority === "high" && task.status !== "done" && <Badge tone="alert">{t("team.high")}</Badge>}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-ink-3">
                    {employeeName(task.employeeId)} · {t(`task.${task.status}`)}
                  </div>
                </div>
                <div className={`text-[11px] ${late ? "font-medium text-alert" : "text-ink-3"}`}>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="clock" className="h-3 w-3" />
                    {fmtDate(task.dueAt, lang)}
                  </span>
                </div>
                <Badge tone={task.status === "done" ? "good" : task.status === "review" ? "pearl" : task.status === "in-progress" ? "glass" : "neutral"} className="hidden sm:inline-flex">
                  {t(`task.${task.status}`)}
                </Badge>
                <select
                  value={task.status}
                  onChange={(e) => void actions.taskStatus(task.id, e.target.value as TaskStatus)}
                  className="w-full rounded-md border border-line bg-card px-1.5 py-1 text-[11px] outline-none focus:border-brass"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`task.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </Card>

      {showAdd !== false && (
        <AddStaffDialog
          employees={db.employees}
          prefill={showAdd || null}
          t={t}
          onClose={() => setShowAdd(false)}
          onSaved={(list) => {
            setStaff(list);
            setShowAdd(false);
            actions.toast(t("team.created"));
          }}
        />
      )}

      {showAddProfile && (
        <AddEmployeeDialog
          t={t}
          onClose={() => setShowAddProfile(false)}
          onSaved={() => {
            setShowAddProfile(false);
            actions.toast(t("team.profileCreated"));
          }}
          actions={actions}
        />
      )}

      {resetting && (
        <ResetPasswordDialog
          account={resetting}
          t={t}
          onClose={() => setResetting(null)}
          onSaved={(list) => {
            setStaff(list);
            setResetting(null);
            actions.toast(t("team.passwordSaved"));
          }}
        />
      )}
    </div>
  );
}

function suggestPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function DialogShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card className="p-5">{children}</Card>
      </div>
    </div>
  );
}

function AddStaffDialog({
  employees,
  prefill,
  t,
  onClose,
  onSaved,
}: {
  employees: Employee[];
  prefill: Employee | null;
  t: Tfn;
  onClose: () => void;
  onSaved: (staff: SessionUser[]) => void;
}) {
  const [nameEn, setNameEn] = useState(prefill?.nameEn ?? "");
  const [nameAr, setNameAr] = useState(prefill?.nameAr ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("agent");
  const [employeeId, setEmployeeId] = useState(prefill?.id ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !nameEn.trim() || !nameAr.trim() || !email.trim() || password.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createStaff({
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        email: email.trim(),
        role,
        employeeId: employeeId || null,
        password,
      });
      onSaved(res.staff);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <DialogShell onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>{t("team.addStaff")}</SectionLabel>
          <h3 className="mt-1 font-display text-[19px]">{t("team.addTitle")}</h3>
        </div>
        <button onClick={onClose} className="text-ink-3 hover:text-ink">
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.nameEn")}</span>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Mona Farid"
              className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
            />
          </label>
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.nameAr")}</span>
            <input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="منى فريد"
              dir="rtl"
              className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.email")}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            dir="ltr"
            placeholder="name@cairoart.net"
            className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.role")}</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-2.5 py-2 text-[12.5px] outline-none focus:border-brass"
            >
              <option value="agent">{t("auth.role.agent")}</option>
              <option value="manager">{t("auth.role.manager")}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.employee")}</span>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-2.5 py-2 text-[12.5px] outline-none focus:border-brass"
            >
              <option value="">{t("team.employeeNone")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nameEn}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.password")}</span>
          <div className="mt-1 flex gap-1.5">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              placeholder="at least 8 characters"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bone/40 px-3 py-2 font-mono text-[12px] outline-none focus:border-brass"
            />
            <Btn type="button" variant="ghost" size="sm" onClick={() => setPassword(suggestPassword())}>
              <Icon name="refresh" className="h-3 w-3" />
              {t("team.generate")}
            </Btn>
          </div>
          <span className="mt-1 block text-[10px] leading-snug text-ink-3">{t("team.passwordNote")}</span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-alert/25 bg-alert-soft px-3 py-2 text-[11.5px] leading-snug text-alert">
            <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Btn>
          <Btn
            type="submit"
            disabled={busy || !nameEn.trim() || !nameAr.trim() || !email.trim() || password.length < 8}
          >
            <Icon name={busy ? "refresh" : "plus"} className="h-3.5 w-3.5" />
            {busy ? t("team.creating") : t("team.create")}
          </Btn>
        </div>
      </form>
    </DialogShell>
  );
}

function AddEmployeeDialog({
  t,
  actions,
  onClose,
  onSaved,
}: {
  t: Tfn;
  actions: Actions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [roleEn, setRoleEn] = useState("");
  const [roleAr, setRoleAr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = Boolean(nameEn.trim() && nameAr.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    const ok = await actions.createEmployee({
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      roleEn: roleEn.trim(),
      roleAr: roleAr.trim(),
    });
    if (ok) onSaved();
    else setBusy(false);
  }

  return (
    <DialogShell onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>{t("team.addProfile")}</SectionLabel>
          <h3 className="mt-1 font-display text-[19px]">{t("team.addProfileTitle")}</h3>
        </div>
        <button onClick={onClose} className="text-ink-3 hover:text-ink">
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{t("team.profileNote")}</p>

      <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.nameEn")}</span>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Mona Farid"
              className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
            />
          </label>
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.nameAr")}</span>
            <input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="منى فريد"
              dir="rtl"
              className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.roleEn")}</span>
            <input
              value={roleEn}
              onChange={(e) => setRoleEn(e.target.value)}
              placeholder="Sales"
              className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
            />
          </label>
          <label className="block">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.roleAr")}</span>
            <input
              value={roleAr}
              onChange={(e) => setRoleAr(e.target.value)}
              placeholder="مبيعات"
              dir="rtl"
              className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
            />
          </label>
        </div>

        {error && <p className="text-[11.5px] text-alert">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Btn>
          <Btn type="submit" disabled={busy || !valid}>
            <Icon name={busy ? "refresh" : "plus"} className="h-3.5 w-3.5" />
            {busy ? t("team.saving") : t("team.addProfileSave")}
          </Btn>
        </div>
      </form>
    </DialogShell>
  );
}

function ResetPasswordDialog({
  account,
  t,
  onClose,
  onSaved,
}: {
  account: SessionUser;
  t: Tfn;
  onClose: () => void;
  onSaved: (staff: SessionUser[]) => void;
}) {
  const [password, setPassword] = useState(() => suggestPassword());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || password.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.setStaffPassword(account.id, password);
      onSaved(res.staff);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <DialogShell onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>{t("team.resetPassword")}</SectionLabel>
          <h3 className="mt-1 font-display text-[19px]">{account.nameEn}</h3>
          <p className="mt-1 font-mono text-[10.5px] text-ink-3" dir="ltr">
            {account.email}
          </p>
        </div>
        <button onClick={onClose} className="text-ink-3 hover:text-ink">
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-ink-3">{t("team.resetNote")}</p>

      <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3">
        <label className="block">
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("team.password")}</span>
          <div className="mt-1 flex gap-1.5">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bone/40 px-3 py-2 font-mono text-[12px] outline-none focus:border-brass"
            />
            <Btn type="button" variant="ghost" size="sm" onClick={() => setPassword(suggestPassword())}>
              <Icon name="refresh" className="h-3 w-3" />
              {t("team.generate")}
            </Btn>
          </div>
          <span className="mt-1 block text-[10px] leading-snug text-ink-3">{t("team.passwordNote")}</span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-alert/25 bg-alert-soft px-3 py-2 text-[11.5px] leading-snug text-alert">
            <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Btn>
          <Btn type="submit" disabled={busy || password.length < 8}>
            <Icon name={busy ? "refresh" : "lock"} className="h-3.5 w-3.5" />
            {busy ? t("team.saving") : t("team.savePassword")}
          </Btn>
        </div>
      </form>
    </DialogShell>
  );
}
