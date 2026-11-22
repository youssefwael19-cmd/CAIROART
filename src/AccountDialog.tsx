import { useState } from "react";
import { api } from "./api";
import type { Tfn } from "./contract";
import type { SessionUser } from "./types";
import { Btn, Card, Icon, SectionLabel } from "./ui";

interface Props {
  user: SessionUser;
  t: Tfn;
  /* Set on first sign-in: the password must change before the desk opens. */
  required?: boolean;
  onClose: () => void;
  onSaved: (user: SessionUser) => void;
}

export default function AccountDialog({ user, t, required = false, onClose, onSaved }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = current.length > 0 && next.length >= 8 && confirm === next && next !== current && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.changePassword(current, next);
      onSaved(res.user);
    } catch (err) {
      const message = (err as Error).message;
      setError(
        message.includes("current password")
          ? t("auth.wrongPassword")
          : message.includes("must be different")
            ? t("auth.passwordSame")
            : message,
      );
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={required ? undefined : onClose}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionLabel>{t("auth.account")}</SectionLabel>
              <h3 className="mt-1 font-display text-[19px]">{user.nameEn}</h3>
              <div className="mt-0.5 font-mono text-[10.5px] text-ink-3" dir="ltr">
                {user.email}
              </div>
            </div>
            {!required && (
              <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label={t("common.close")}>
                <Icon name="close" className="h-4 w-4" />
              </button>
            )}
          </div>

          {required && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-brass/30 bg-brass-soft/60 px-3 py-2 text-[11px] leading-snug text-brass-2">
              <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("auth.changeRequired")}</span>
            </div>
          )}

          <div className="mt-3 flex items-center gap-1.5 text-[10.5px] text-ink-3">
            <Icon name="lock" className="h-3 w-3" />
            {t(`auth.role.${user.role}`)}
          </div>

          <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3 border-t border-line pt-4">
            <SectionLabel>{t("auth.changePassword")}</SectionLabel>

            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("auth.currentPassword")}</span>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                dir="ltr"
                className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("auth.newPassword")}</span>
                <input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  dir="ltr"
                  className="mt-1 w-full rounded-lg border border-line bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass"
                />
              </label>
              <label className="block">
                <span className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{t("auth.confirmPassword")}</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  dir="ltr"
                  className={`mt-1 w-full rounded-lg border bg-bone/40 px-3 py-2 text-[12.5px] outline-none focus:border-brass ${
                    mismatch ? "border-alert/60" : "border-line"
                  }`}
                />
              </label>
            </div>

            {next.length > 0 && next.length < 8 && (
              <p className="text-[10.5px] text-ink-3">{t("auth.passwordTooShort")}</p>
            )}
            {mismatch && <p className="text-[10.5px] text-alert">{t("auth.passwordMismatch")}</p>}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-alert/25 bg-alert-soft px-3 py-2 text-[11.5px] leading-snug text-alert">
                <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <p className="text-[10px] leading-snug text-ink-3">{t("auth.passwordHint")}</p>

            <div className="flex justify-end gap-2">
              {!required && (
                <Btn type="button" variant="ghost" onClick={onClose}>
                  {t("common.cancel")}
                </Btn>
              )}
              <Btn type="submit" disabled={!ready}>
                <Icon name={busy ? "refresh" : "lock"} className="h-3.5 w-3.5" />
                {busy ? t("auth.saving") : t("auth.savePassword")}
              </Btn>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
