import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type AppMeta, type SessionState } from "./api";
import type { Actions, Tfn, View } from "./contract";
import { makeT, type Lang } from "./i18n";
import type { Analysis, Audit, Database, SessionUser, TaskStatus } from "./types";
import { Badge, Icon } from "./ui";
import SignIn from "./SignIn";
import AccountDialog from "./AccountDialog";
import Campaigns from "./pages/Campaigns";
import Catalog from "./pages/Catalog";
import Inbox from "./pages/Inbox";
import Orders from "./pages/Orders";
import Overview from "./pages/Overview";
import Sales from "./pages/Sales";
import Team from "./pages/Team";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export interface Digest {
  headlineEn: string;
  headlineAr: string;
  bulletsEn: string[];
  bulletsAr: string[];
  generatedBy: string;
}

const NAV: { view: View; icon: string; key: string }[] = [
  { view: "overview", icon: "overview", key: "nav.overview" },
  { view: "inbox", icon: "inbox", key: "nav.inbox" },
  { view: "groups", icon: "coupon", key: "nav.groups" },
  { view: "orders", icon: "orders", key: "nav.orders" },
  { view: "catalog", icon: "catalog", key: "nav.catalog" },
  { view: "sales", icon: "sales", key: "nav.sales" },
  { view: "team", icon: "team", key: "nav.team" },
];

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("ca-lang") : null;
    return stored === "ar" ? "ar" : "en";
  });
  const [view, setView] = useState<View>("overview");
  const [db, setDb] = useState<Database | null>(null);
  const [meta, setMeta] = useState<AppMeta | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  /* undefined = still checking the session, null = signed out */
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  const t = useMemo<Tfn>(() => makeT(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("ca-lang", lang);
  }, [lang]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  const notify = useCallback((text: string, ok = true) => setToast({ text, ok }), []);

  useEffect(() => {
    api.onUnauthorized(() => {
      setUser(null);
      setDb(null);
    });
    api
      .state()
      .then((s) => {
        setDb(s.db);
        setMeta(s.meta);
        setUser(s.user);
      })
      .catch(() => setUser(null));
  }, []);

  const signIn = useCallback((s: SessionState) => {
    setDb(s.db);
    setMeta(s.meta);
    setUser(s.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* the local session is dropped either way */
    }
    setUser(null);
    setDb(null);
    setDigest(null);
    setAnalysis(null);
    setAudit(null);
    setView("overview");
  }, []);

  const loadDigest = useCallback(async () => {
    try {
      const res = await api.digest();
      setDigest(res.digest);
    } catch (e) {
      notify((e as Error).message, false);
    }
  }, [notify]);

  useEffect(() => {
    if (db && !digest) void loadDigest();
  }, [db, digest, loadDigest]);

  const send = useCallback(
    async (conversationId: string, text: string, author: "customer" | "employee") => {
      try {
        const s = await api.message(conversationId, text, author);
        setDb(s.db);
        setMeta(s.meta);
        if (author === "customer") void loadDigest();
      } catch (e) {
        notify((e as Error).message, false);
      }
    },
    [notify, loadDigest],
  );

  const handoff = useCallback(
    async (conversationId: string, employeeId: string) => {
      try {
        const s = await api.handoff(conversationId, employeeId);
        setDb(s.db);
        const emp = s.db.employees.find((x) => x.id === employeeId);
        notify(lang === "ar" ? `تم التحويل إلى ${emp?.nameAr ?? ""}` : `Handed over to ${emp?.nameEn ?? ""}`);
      } catch (e) {
        notify((e as Error).message, false);
      }
    },
    [notify, lang],
  );

  const newEnquiry = useCallback<Actions["newEnquiry"]>(
    async (payload) => {
      try {
        const s = await api.newEnquiry(payload);
        setDb(s.db);
        setActiveConversationId(s.conversationId);
        setView("inbox");
        return s.conversationId;
      } catch (e) {
        notify((e as Error).message, false);
        return undefined;
      }
    },
    [notify],
  );

  const command = useCallback<Actions["command"]>(
    async (raw) => {
      const res = await api.command(raw);
      setDb(res.db);
      return { ok: res.ok, text: lang === "ar" ? res.replyAr : res.replyEn };
    },
    [lang],
  );

  const updateOrder = useCallback<Actions["updateOrder"]>(
    async (id, patch) => {
      try {
        const s = await api.updateOrder(id, patch);
        setDb(s.db);
      } catch (e) {
        notify((e as Error).message, false);
      }
    },
    [notify],
  );

  const uploadProduct = useCallback<Actions["uploadProduct"]>(
    async (form) => {
      try {
        const s = await api.uploadProduct(form);
        setDb(s.db);
        notify(
          s.cutout
            ? lang === "ar"
              ? "تم رفع المنتج — خلفية بيضاء وإضاءة معدّلة وعلامة Cairoart.net."
              : "Product uploaded — white background, evened lighting and the Cairoart.net mark."
            : lang === "ar"
              ? "تم رفع المنتج، لكن الخلفية لم تكن بسيطة فتركت الصورة كما هي مع ضبط الإضاءة والعلامة."
              : "Product uploaded, but the backdrop was not plain enough to cut — the photo was kept, with lighting fixed and the Cairoart.net mark added.",
        );
        return { productId: s.productId, cutout: s.cutout };
      } catch (e) {
        notify((e as Error).message, false);
        return undefined;
      }
    },
    [notify, lang],
  );

  const toggle = useCallback(
    async (id: string) => {
      try {
        const s = await api.toggleProduct(id);
        setDb(s.db);
      } catch (e) {
        notify((e as Error).message, false);
      }
    },
    [notify],
  );

  const taskStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      try {
        const s = await api.taskStatus(id, status);
        setDb(s.db);
        setAudit(null);
      } catch (e) {
        notify((e as Error).message, false);
      }
    },
    [notify],
  );

  const createGroup = useCallback<Actions["createGroup"]>(
    async (payload) => {
      try {
        const s = await api.createGroup(payload);
        setDb(s.db);
        notify(lang === "ar" ? "تم إنشاء المجموعة." : "Group created.");
        return true;
      } catch (e) {
        notify((e as Error).message, false);
        return false;
      }
    },
    [notify, lang],
  );

  const createEmployee = useCallback<Actions["createEmployee"]>(
    async (payload) => {
      try {
        const s = await api.createEmployee(payload);
        setDb(s.db);
        notify(lang === "ar" ? "تمت إضافة الموظف للفريق." : "Team profile added.");
        return true;
      } catch (e) {
        notify((e as Error).message, false);
        return false;
      }
    },
    [notify, lang],
  );

  const addContact = useCallback<Actions["addContact"]>(
    async (groupId, payload) => {
      try {
        const s = await api.addContact(groupId, payload);
        setDb(s.db);
        notify(lang === "ar" ? "تمت إضافة الرقم إلى المجموعة." : "Number added to the group.");
        return true;
      } catch (e) {
        notify((e as Error).message, false);
        return false;
      }
    },
    [notify, lang],
  );

  const removeContact = useCallback<Actions["removeContact"]>(
    async (groupId, contactId) => {
      try {
        const s = await api.removeContact(groupId, contactId);
        setDb(s.db);
      } catch (e) {
        notify((e as Error).message, false);
      }
    },
    [notify],
  );

  const sendGroup = useCallback<Actions["sendGroup"]>(
    async (groupId) => {
      try {
        const res = await api.sendGroup(groupId);
        setDb(res.db);
        if (res.simulated) {
          notify(
            lang === "ar"
              ? `محاكاة: تم تجهيز الكوبون لـ ${res.total} رقم — واتساب غير متصل.`
              : `Simulated: coupon prepared for ${res.total} numbers — WhatsApp is not connected.`,
          );
        } else if (res.failed > 0) {
          notify(
            lang === "ar"
              ? `تم الإرسال إلى ${res.sent} من ${res.total} — تعذّر الوصول إلى ${res.failed}.`
              : `Sent to ${res.sent} of ${res.total} — ${res.failed} could not be reached.`,
            false,
          );
        } else {
          notify(lang === "ar" ? `تم إرسال الكوبون إلى ${res.sent} رقم.` : `Coupon sent to ${res.sent} numbers.`);
        }
        return { sent: res.sent, total: res.total, failed: res.failed, simulated: res.simulated };
      } catch (e) {
        notify((e as Error).message, false);
        return undefined;
      }
    },
    [notify, lang],
  );

  const loadSales = useCallback(async () => {
    try {
      const res = await api.sales();
      setAnalysis(res.analysis);
    } catch (e) {
      notify((e as Error).message, false);
    }
  }, [notify]);

  const loadAudit = useCallback(async () => {
    try {
      const res = await api.audit();
      setAudit(res.audit);
    } catch (e) {
      notify((e as Error).message, false);
    }
  }, [notify]);

  const goInbox = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    setView("inbox");
  }, []);

  const actions: Actions = {
    send,
    handoff,
    newEnquiry,
    command,
    updateOrder,
    toggle,
    uploadProduct,
    taskStatus,
    createGroup,
    createEmployee,
    addContact,
    removeContact,
    sendGroup,
    loadSales,
    loadAudit,
    loadDigest,
    goInbox,
    toast: notify,
  };

  const current = NAV.find((n) => n.view === view) ?? NAV[0];
  const unread = db?.conversations.filter((c) => c.unread).length ?? 0;
  const waiting = db?.conversations.filter((c) => c.status === "ready-for-handoff").length ?? 0;
  const newOrders = db?.orders.filter((o) => o.status === "new").length ?? 0;
  const counts: Record<View, number> = { overview: 0, inbox: unread, groups: 0, orders: newOrders, catalog: 0, sales: 0, team: 0 };

  if (user === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-bone">
        <div className="flex items-center gap-3 text-[13px] text-ink-3">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-brass" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (!user) return <SignIn lang={lang} setLang={setLang} onSignedIn={signIn} />;

  if (!db) {
    return (
      <div className="grid min-h-screen place-items-center bg-bone">
        <div className="flex items-center gap-3 text-[13px] text-ink-3">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-brass" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bone text-ink">
      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-e border-ink/40 bg-ink text-bone lg:flex">
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="grid h-9 w-9 place-items-center rounded-md border border-brass/60 bg-brass/10 font-display text-[15px] text-brass">
              CA
            </div>
            <div className="min-w-0">
              <div className="font-display text-[15px] leading-none tracking-wide text-bone">{t("brand.name")}</div>
              <div className="mt-1 text-[9.5px] uppercase tracking-[0.2em] text-bone/40">{t("brand.product")}</div>
            </div>
          </div>

          <nav className="mt-2 flex flex-col gap-0.5 px-2.5">
            {NAV.map((item) => {
              const active = item.view === view;
              return (
                <button
                  key={item.view}
                  onClick={() => setView(item.view)}
                  className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] transition-colors ${
                    active ? "bg-white/[0.07] text-bone" : "text-bone/55 hover:bg-white/[0.04] hover:text-bone/90"
                  }`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded ${active ? "text-brass" : "text-bone/45 group-hover:text-bone/70"}`}>
                    <Icon name={item.icon} className="h-[15px] w-[15px]" />
                  </span>
                  <span>{t(item.key)}</span>
                  {counts[item.view] > 0 && (
                    <span className="ms-auto rounded bg-brass/20 px-1.5 py-0.5 text-[10px] font-semibold text-brass">{counts[item.view]}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 p-4">
            {waiting > 0 && (
              <div className="rounded-lg border border-brass/25 bg-brass/[0.08] p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-brass">
                  <Icon name="alert" className="h-3 w-3" />
                  {t("status.ready-for-handoff")}
                </div>
                <div className="mt-1.5 font-display text-[22px] leading-none text-bone">{waiting}</div>
                <button onClick={() => setView("inbox")} className="mt-2 inline-flex items-center gap-1 text-[11px] text-bone/60 hover:text-brass">
                  {t("overview.viewAll")} <Icon name="arrow" className="h-3 w-3 rtl:rotate-180" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-2">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-good" />
              <div className="min-w-0 text-[10.5px] leading-tight text-bone/50">
                <div className="text-bone/80">{t("common.ai")}</div>
                <div className="truncate">{meta?.aiMode === "llm" ? t("common.llm") : t("common.rules")}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-line bg-bone/90 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="grid h-7 w-7 place-items-center rounded border border-brass/50 bg-brass/10 font-display text-[12px] text-brass-2">
                  CA
                </div>
                <span className="font-display text-[14px]">{t("brand.name")}</span>
              </div>

              <div className="hidden items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-ink-3 lg:flex">
                <Icon name={current.icon} className="h-3.5 w-3.5" />
                <span>{t(current.key)}</span>
                <span className="text-line-2">·</span>
                <span className="text-ink-3/70">{t("brand.name")}</span>
              </div>

              <div className="ms-auto flex items-center gap-1.5">
                <div className="flex items-center gap-2 rounded-md border border-line-2 bg-card px-2 py-1">
                  <span className="grid h-6 w-6 place-items-center rounded bg-ink/90 text-[10px] font-semibold text-bone">
                    {initials(lang === "ar" ? user.nameAr : user.nameEn)}
                  </span>
                  <div className="hidden leading-tight sm:block">
                    <div className="max-w-[130px] truncate text-[11.5px] font-medium">
                      {lang === "ar" ? user.nameAr : user.nameEn}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.16em] text-ink-3">{t(`auth.role.${user.role}`)}</div>
                  </div>
                  <button
                    onClick={() => setShowAccount(true)}
                    title={t("auth.changePassword")}
                    aria-label={t("auth.changePassword")}
                    className="ms-0.5 text-ink-3 transition-colors hover:text-brass-2"
                  >
                    <Icon name="lock" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => void signOut()}
                    title={t("auth.signOut")}
                    aria-label={t("auth.signOut")}
                    className="ms-0.5 text-ink-3 transition-colors hover:text-alert"
                  >
                    <Icon name="logout" className="h-3.5 w-3.5 rtl:rotate-180" />
                  </button>
                </div>
                <Badge tone={meta?.whatsapp ? "good" : "neutral"} className="hidden sm:inline-flex">
                  <span className={`h-1.5 w-1.5 rounded-full ${meta?.whatsapp ? "bg-good" : "bg-line-2"}`} />
                  {t("channel.meta")} · {meta?.whatsapp ? t("common.live") : t("common.demo")}
                </Badge>
                <div className="flex items-center rounded-md border border-line-2 bg-card p-0.5">
                  {(["en", "ar"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                        lang === l ? "bg-ink text-bone" : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      {l === "en" ? "EN" : "ع"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile nav */}
            <div className="scroll-thin flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
              {NAV.map((item) => (
                <button
                  key={item.view}
                  onClick={() => setView(item.view)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] ${
                    item.view === view ? "bg-ink text-bone" : "text-ink-3"
                  }`}
                >
                  <Icon name={item.icon} className="h-3.5 w-3.5" />
                  {t(item.key)}
                </button>
              ))}
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-8">
            <div key={view} className="fade-in">
              {view === "overview" && (
                <Overview db={db} t={t} lang={lang} digest={digest} onRefreshDigest={loadDigest} onOpenConversation={goInbox} />
              )}
              {view === "inbox" && (
                <Inbox db={db} t={t} lang={lang} actions={actions} activeId={activeConversationId} meta={meta} role={user.role} />
              )}
              {view === "groups" && (
                <Campaigns db={db} t={t} lang={lang} actions={actions} role={user.role} whatsapp={Boolean(meta?.whatsapp)} />
              )}
              {view === "orders" && <Orders db={db} t={t} lang={lang} actions={actions} role={user.role} />}
              {view === "catalog" && <Catalog db={db} t={t} lang={lang} actions={actions} role={user.role} />}
              {view === "sales" && <Sales db={db} t={t} lang={lang} actions={actions} analysis={analysis} />}
              {view === "team" && <Team db={db} t={t} lang={lang} actions={actions} audit={audit} user={user} />}
            </div>
          </main>
        </div>
      </div>

      {user.mustChangePassword && (
        <AccountDialog
          user={user}
          t={t}
          required
          onClose={() => undefined}
          onSaved={(updated) => {
            setUser(updated);
            notify(t("auth.passwordChanged"));
          }}
        />
      )}

      {showAccount && !user.mustChangePassword && (
        <AccountDialog
          user={user}
          t={t}
          onClose={() => setShowAccount(false)}
          onSaved={(updated) => {
            setUser(updated);
            setShowAccount(false);
            notify(t("auth.passwordChanged"));
          }}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <div
            className={`pointer-events-auto flex max-w-xl items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[12.5px] shadow-lg ${
              toast.ok ? "border-ink bg-ink text-bone" : "border-alert bg-alert-soft text-alert"
            }`}
          >
            <Icon name={toast.ok ? "check" : "alert"} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
