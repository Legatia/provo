import { clsx } from "../lib/clsx";

// ── Shared UI atoms for the ops console ─────────────────────────────────────

export function Card({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-white/[0.07] bg-white/[0.025] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm",
        hover && "transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.04]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {children}
      </h2>
      {right}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  critical: "bg-red-500/12 text-red-300 border-red-500/25",
  confirmed: "bg-orange-500/12 text-orange-300 border-orange-500/25",
  emerging: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  watching: "bg-sky-500/12 text-sky-300 border-sky-500/25",
  resolved: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  running: "bg-brass/12 text-brass-bright border-brass/25",
  complete: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  pending: "bg-zinc-500/12 text-zinc-400 border-zinc-500/25",
  failed: "bg-red-500/12 text-red-300 border-red-500/25",
};

const STATUS_DOTS: Record<string, string> = {
  critical: "bg-red-400",
  confirmed: "bg-orange-400",
  emerging: "bg-amber-400",
  watching: "bg-sky-400",
  resolved: "bg-emerald-400",
  running: "bg-brass",
  complete: "bg-emerald-400",
  pending: "bg-zinc-400",
  failed: "bg-red-400",
};

const STATUS_TEXT: Record<string, string> = {
  critical: "text-red-300",
  confirmed: "text-orange-300",
  emerging: "text-amber-300",
  watching: "text-sky-300",
  resolved: "text-emerald-300",
  running: "text-brass-bright",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-medium uppercase tracking-wider",
        STATUS_STYLES[status] ?? STATUS_STYLES.pending
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", STATUS_DOTS[status] ?? "bg-zinc-400")} />
      {status}
    </span>
  );
}

/** status text color for large titles */
export function statusText(status: string): string {
  return STATUS_TEXT[status] ?? "text-zinc-300";
}

const TYPE_CONFIG: Record<string, { icon: string; ring: string }> = {
  observe: { icon: "👁", ring: "ring-sky-500/20 bg-sky-500/10" },
  detect: { icon: "📡", ring: "ring-amber-500/20 bg-amber-500/10" },
  investigate: { icon: "🔍", ring: "ring-brass/20 bg-brass/10" },
  remember: { icon: "🧠", ring: "ring-verdigris/20 bg-verdigris/10" },
  report: { icon: "✉️", ring: "ring-emerald-500/20 bg-emerald-500/10" },
  reply: { icon: "💬", ring: "ring-teal-500/20 bg-teal-500/10" },
  chat: { icon: "💬", ring: "ring-teal-500/20 bg-teal-500/10" },
};

export function TypeIcon({ type, running }: { type: string; running?: boolean }) {
  const cfg = TYPE_CONFIG[type] ?? { icon: "•", ring: "ring-white/10 bg-white/5" };
  return (
    <span
      className={clsx(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] ring-1",
        cfg.ring,
        running && "animate-pulse-dot"
      )}
    >
      {cfg.icon}
    </span>
  );
}

export function TrendBadge({ growth, big = false }: { growth?: number | null; big?: boolean }) {
  if (growth == null)
    return <span className={clsx("font-mono text-zinc-600", big ? "text-sm" : "text-[11px]")}>—</span>;
  const up = growth > 1;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border font-mono font-semibold",
        big ? "px-2 py-0.5 text-xs" : "px-1.5 text-[10px]",
        up
          ? "border-red-500/25 bg-red-500/10 text-red-300"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      )}
    >
      <svg width="9" height="9" viewBox="0 0 10 10" className={up ? "" : "rotate-180"}>
        <path d="M5 1 L9 8 L1 8 Z" fill="currentColor" />
      </svg>
      {up ? `${growth.toFixed(1)}×` : `−${Math.round((1 - growth) * 100)}%`}
    </span>
  );
}

export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={clsx("relative inline-flex h-2 w-2", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
    </span>
  );
}

export function Favicon({ url, className = "" }: { url?: string; className?: string }) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
        alt=""
        className={clsx("h-3.5 w-3.5 rounded-sm", className)}
        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
      />
    );
  } catch {
    return null;
  }
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-xl">
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium text-zinc-300">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">{hint}</p>}
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  className = "",
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" &&
          "bg-indigo-500/90 text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] hover:bg-indigo-400",
        variant === "default" &&
          "border border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:bg-white/[0.08]",
        variant === "ghost" && "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200",
        className
      )}
    >
      {children}
    </button>
  );
}

// ── time formatting ─────────────────────────────────────────────────────────

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
