import { useEffect, useState } from "react";
import { api, type SessionState } from "./api";
import { makeT, type Lang } from "./i18n";
import { DEMO_STAFF } from "./staff";
import { Badge, Btn, Card, Icon } from "./ui";

interface Props {
  lang: Lang;
  setLang: (lang: Lang) => void;
  onSignedIn: (state: SessionState) => void;
}

export default function SignIn({ lang, setLang, onSignedIn }: Props) {
  const t = makeT(lang);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  /* Demo credentials are only rendered when the server explicitly runs in
     demo mode; a published build shows nothing. */
  useEffect(() => {
    api
      .authConfig()
      .then((config) => setDemo(config.demo))
      .catch(() => setDemo(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await api.login(email.trim(), password));
    } catch (err) {
      const message = (err as Error).message;
      setError(message.includes("too many") ? t("auth.restricted") : t("auth.invalid"));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-bone text-ink lg:grid-cols-[1.02fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink px-10 py-10 text-bone lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-brass/60 bg-brass/10 font-display text-[16px] text-brass">
            CA
          </div>
          <div>
            <div className="font-display text-[16px] leading-none tracking-wide">{t("brand.name")}</div>
            <div className="mt-1 text-[9.5px] uppercase tracking-[0.2em] text-bone/40">{t("brand.product")}</div>
          </div>
        </div>

        <div className="max-w-sm">
          <div className="text-[10px] uppercase tracking-[0.22em] text-brass">{t("auth.eyebrow")}</div>
          <h1 className="mt-3 font-display text-[34px] leading-[1.12] tracking-tight">{t("auth.leftTitle")}</h1>
          <ul className="mt-7 space-y-3">
            {["auth.feature1", "auth.feature2", "auth.feature3"].map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-bone/70">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-brass/40 text-brass">
                  <Icon name="check" className="h-2.5 w-2.5" />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-[10.5px] text-bone/40">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-good" />
          {t("auth.sessionNote")}
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[360px]">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded border border-brass/50 bg-brass/10 font-display text-[13px] text-brass-2">
                CA
              </div>
              <span className="font-display text-[15px]">{t("brand.name")}</span>
            </div>
            <LangToggle lang={lang} setLang={setLang} />
          </div>

          <div className="hidden justify-end lg:flex">
            <LangToggle lang={lang} setLang={setLang} />
          </div>

          <h2 className="mt-4 font-display text-[25px] leading-tight tracking-tight">{t("auth.title")}</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">{t("auth.subtitle")}</p>

          <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-3">{t("auth.email")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="name@cairoart.net"
                dir="ltr"
                className="mt-1 w-full rounded-lg border border-line-2 bg-card px-3 py-2.5 text-[13px] outline-none placeholder:text-ink-3/50 focus:border-brass"
              />
            </label>

            <label className="block">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-3">{t("auth.password")}</span>
              <div className="relative mt-1">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full rounded-lg border border-line-2 bg-card py-2.5 pe-9 ps-3 text-[13px] outline-none placeholder:text-ink-3/50 focus:border-brass"
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-3/60">
                  <Icon name="lock" className="h-3.5 w-3.5" />
                </span>
              </div>
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-alert/25 bg-alert-soft px-3 py-2 text-[11.5px] leading-snug text-alert">
                <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Btn type="submit" variant="brass" disabled={busy || !email.trim() || !password} className="w-full">
              <Icon name={busy ? "refresh" : "arrow"} className="h-3.5 w-3.5 rtl:rotate-180" />
              {busy ? t("auth.signingIn") : t("auth.signIn")}
            </Btn>
          </form>

          {demo && (
          <Card className="mt-6 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{t("auth.demo")}</span>
              <Icon name="user" className="h-3.5 w-3.5 text-ink-3/60" />
            </div>
            <div className="mt-2 space-y-1">
              {DEMO_STAFF.map((staff) => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => {
                    setEmail(staff.email);
                    setPassword(staff.password);
                    setError(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-start transition-colors hover:border-line hover:bg-bone-2/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium">{lang === "ar" ? staff.nameAr : staff.nameEn}</span>
                    <span className="block truncate font-mono text-[10px] text-ink-3" dir="ltr">
                      {staff.email} · {staff.password}
                    </span>
                  </span>
                  <Badge tone={staff.role === "manager" ? "warn" : "neutral"}>{t(`auth.role.${staff.role}`)}</Badge>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-ink-3/80">{t("auth.demoNote")}</p>
          </Card>
          )}

          {!demo && (
            <p className="mt-6 text-[10.5px] leading-snug text-ink-3">{t("auth.noDemoNote")}</p>
          )}
        </div>
      </main>
    </div>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (lang: Lang) => void }) {
  return (
    <div className="flex items-center rounded-md border border-line-2 bg-card p-0.5">
      {(["en", "ar"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
            lang === l ? "bg-ink text-bone" : "text-ink-3 hover:text-ink"
          }`}
        >
          {l === "en" ? "EN" : "ع"}
        </button>
      ))}
    </div>
  );
}
