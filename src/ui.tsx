import type { ButtonHTMLAttributes, ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  inbox: <path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20.5l1.9-5.2A8 8 0 1 1 21 11.5Z" />,
  orders: (
    <>
      <path d="M8 4.5h8a1.5 1.5 0 0 1 1.5 1.5v13.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M9.5 10.5h5" />
      <path d="M9.5 14h5" />
      <path d="M9.5 17.5h3" />
    </>
  ),
  catalog: (
    <>
      <path d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4L12 3Z" />
      <path d="m4 7.4 8 4.4 8-4.4" />
      <path d="M12 11.8V21" />
    </>
  ),
  sales: (
    <>
      <path d="M3 17.5 9 11l4 3.8L20.5 7" />
      <path d="M14.5 7h6v6" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.2 20c0-3.1 2.6-5.2 5.8-5.2s5.8 2.1 5.8 5.2" />
      <path d="M16 5.4a3.1 3.1 0 0 1 0 5.9" />
      <path d="M18.4 20c0-2.1-.8-3.7-2-4.8" />
    </>
  ),
  coupon: (
    <>
      <path d="M3.5 8.5V6.8a1.3 1.3 0 0 1 1.3-1.3h14.4a1.3 1.3 0 0 1 1.3 1.3v1.7a2.4 2.4 0 0 0 0 7v1.7a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3v-1.7a2.4 2.4 0 0 0 0-7Z" />
      <path d="m9.5 15.5 5-7" />
      <path d="M9.7 9.7h.01M14.3 14.3h.01" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.2 13.6 9l5.8 1.6-5.8 1.6L12 18l-1.6-5.8L4.6 10.6 10.4 9 12 3.2Z" />
      <path d="M18.5 16.5 19.2 19l2.3.7-2.3.7-.7 2.1-.7-2.1-2.3-.7 2.3-.7.7-2.5Z" />
    </>
  ),
  send: (
    <>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.2 2.6 20h18.8L12 3.2Z" />
      <path d="M12 9v4.8" />
      <path d="M12 17.2h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.7-6" />
      <path d="M20 3.8v5.4h-5.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20.4 11.7a8.4 8.4 0 0 1-12.5 7.4L3.2 20.8l1.7-4.6a8.4 8.4 0 1 1 15.5-4.5Z" />
      <path d="M8.8 8.4c.4-.6 1.3-.5 1.6.2l.4 1.1c.1.3 0 .6-.2.8l-.6.5c.3 1 1 1.7 2 2.1l.5-.6c.2-.2.5-.3.8-.2l1.1.4c.7.3.8 1.2.2 1.6-1.6 1.1-3.7.6-5.4-1.1-1.7-1.7-2.2-3.8-1.1-5.4Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.4 12h17.2" />
      <path d="M12 3.4c2.4 2.5 3.4 5.4 3.4 8.6S14.4 18.1 12 20.6c-2.4-2.5-3.4-5.4-3.4-8.6S9.6 5.9 12 3.4Z" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m4.5 12.5 4.8 4.8L19.5 6.8" />,
  arrow: (
    <>
      <path d="M4.5 12h15" />
      <path d="m13.5 6 6 6-6 6" />
    </>
  ),
  print: (
    <>
      <path d="M6.5 9V4.5h11V9" />
      <rect x="3.5" y="9" width="17" height="7" rx="1.5" />
      <path d="M6.5 14h11v5.5h-11z" />
      <path d="M16.9 11.9h.01" />
    </>
  ),
  terminal: (
    <>
      <path d="m4.5 7 4.8 5-4.8 5" />
      <path d="M12 17h7.5" />
    </>
  ),
  chevron: <path d="m6 9.5 6 6 6-6" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="1.8" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.8 20.2c0-3.5 3-5.8 7.2-5.8s7.2 2.3 7.2 5.8" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4.5H6.8A1.8 1.8 0 0 0 5 6.3v11.4a1.8 1.8 0 0 0 1.8 1.8h7.7" />
      <path d="M17 8.5 20.5 12 17 15.5" />
      <path d="M10.5 12h10" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
      <circle cx="12" cy="12" r="4.1" />
      <path d="M17.4 6.6h.01" />
    </>
  ),
  facebook: (
    <>
      <path d="M14.8 8.6h2.1V5.6h-2.1c-2 0-3.2 1.3-3.2 3.3v1.7H9.2v3h2.4v6.4h3v-6.4h2.3l.5-3h-2.8V9.2c0-.4.2-.6.6-.6Z" />
    </>
  ),
  tiktok: (
    <>
      <path d="M14 4v9.6a3.6 3.6 0 1 1-3.1-3.55" />
      <path d="M14 5.2c.5 2.1 1.9 3.4 4.1 3.7" />
    </>
  ),
};

export function Icon({ name, className = "h-4 w-4" }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.55}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] ?? null}
    </svg>
  );
}

export function ChannelIcon({ channel, className = "h-3.5 w-3.5" }: { channel: string; className?: string }) {
  const map: Record<string, string> = { website: "globe", whatsapp: "whatsapp", instagram: "instagram", facebook: "facebook", tiktok: "tiktok" };
  return <Icon name={map[channel] ?? "globe"} className={className} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-card shadow-[0_1px_2px_rgba(23,19,15,0.035)] ${className}`}>
      {children}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  neutral: "bg-bone-2 text-ink-3 border-line-2",
  good: "bg-good-soft text-good border-good/20",
  warn: "bg-brass-soft text-brass-2 border-brass/25",
  alert: "bg-alert-soft text-alert border-alert/20",
  glass: "bg-glass-soft text-glass border-glass/20",
  pearl: "bg-pearl-soft text-pearl border-pearl/20",
  ink: "bg-ink text-bone/85 border-ink",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "brass" | "ghost" | "outline";
  size?: "sm" | "md";
};

export function Btn({ variant = "primary", size = "md", className = "", children, ...rest }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const sizes = size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-3.5 py-2 text-[13px]";
  const variants = {
    primary: "bg-ink text-bone hover:bg-ink-2",
    brass: "bg-brass text-white hover:bg-brass-2",
    ghost: "text-ink-3 hover:bg-bone-2 hover:text-ink",
    /* No text colour here: outline buttons inherit the ink of a light card and
       the bone of a dark one. */
    outline: "border border-line-2 hover:border-brass hover:text-brass-2",
  };
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-3 ${className}`}>{children}</div>
  );
}

export function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const inner = size - 16;
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(var(--color-brass) ${score * 3.6}deg, var(--color-line) 0deg)` }}
    >
      <div
        className="grid place-items-center rounded-full bg-card font-display text-[17px] leading-none text-ink"
        style={{ width: inner, height: inner }}
      >
        {score}%
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent = "ink",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "ink" | "brass" | "glass" | "alert" | "good";
}) {
  const accentText = {
    ink: "text-ink",
    brass: "text-brass-2",
    glass: "text-glass",
    alert: "text-alert",
    good: "text-good",
  }[accent];
  return (
    <Card className="p-4">
      <SectionLabel>{label}</SectionLabel>
      <div className={`mt-2 font-display text-[26px] leading-none tracking-tight ${accentText}`}>{value}</div>
      {hint && <div className="mt-1.5 text-[11.5px] text-ink-3">{hint}</div>}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-line-2 px-6 py-10 text-center text-[13px] text-ink-3">
      {children}
    </div>
  );
}

export function ProgressBar({ value, tone = "brass" }: { value: number; tone?: "brass" | "glass" | "pearl" | "alert" }) {
  const colors = { brass: "bg-brass", glass: "bg-glass", pearl: "bg-pearl", alert: "bg-alert" };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bone-2">
      <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}
