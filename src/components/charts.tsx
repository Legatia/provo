// ─────────────────────────────────────────────────────────────────────────────
// Tiny dependency-free SVG charts for the ops console.
// All data-driven from live Convex state.
// ─────────────────────────────────────────────────────────────────────────────

const path = (data: number[], w: number, h: number, pad = 2): string => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
  return data
    .map((v, i) => `${i === 0 ? "M" : "L"}${(pad + i * step).toFixed(2)},${y(v).toFixed(2)}`)
    .join(" ");
};

/** Inline trend sparkline with soft area fill. */
export function Sparkline({
  data,
  className = "",
  stroke = "#818cf8",
  width = 120,
  height = 32,
}: {
  data: number[];
  className?: string;
  stroke?: string;
  width?: number;
  height?: number;
}) {
  const id = `sp-${stroke.replace("#", "")}-${data.length}-${Math.round(data[0] ?? 0)}-${Math.round(
    data[data.length - 1] ?? 0
  )}`;
  const line = path(data, width, height);
  const area = `${line} L${width - 2},${height - 2} L2,${height - 2} Z`;
  const last = data[data.length - 1] ?? 0;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const lastY =
    height - 2 - ((last - min) / Math.max(max - min, 1)) * (height - 4);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width - 2}
        cy={lastY}
        r="2.4"
        fill={stroke}
        stroke="#09090b"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/** Daily-mentions bar chart with hover tooltips (14 days). */
export function BarChart({
  data,
  className = "",
  color = "#818cf8",
  height = 72,
  labels,
}: {
  data: number[];
  className?: string;
  color?: string;
  height?: number;
  labels?: string[];
}) {
  const max = Math.max(...data, 1);
  return (
    <div className={`flex items-end gap-[3px] ${className}`} style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="group relative flex-1 rounded-t-[3px] transition-all duration-300"
          style={{
            height: `${Math.max((v / max) * 100, v > 0 ? 6 : 2)}%`,
            background:
              v > 0
                ? `linear-gradient(180deg, ${color}dd, ${color}55)`
                : "rgba(255,255,255,0.06)",
          }}
          title={labels ? `${labels[i]}: ${v} mention${v === 1 ? "" : "s"}` : `${v}`}
        >
          <div className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300 opacity-0 shadow-lg transition group-hover:opacity-100">
            {labels ? `${labels[i]}` : ""} {v}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Circular confidence meter. */
export function RingMeter({
  value,
  size = 46,
  stroke = 4,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c;
  const color =
    value >= 75 ? "#34d399" : value >= 50 ? "#fbbf24" : "#a1a1aa";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[11px] font-semibold leading-none">{value}</span>
        {label && <span className="mt-0.5 text-[7px] uppercase tracking-wider text-zinc-500">{label}</span>}
      </div>
    </div>
  );
}

/** Stacked source-mix bar (email / forums / web). */
export function MixBar({
  parts,
  className = "",
}: {
  parts: { label: string; count: number; color: string }[];
  className?: string;
}) {
  const total = Math.max(
    parts.reduce((a, p) => a + p.count, 0),
    1
  );
  return (
    <div className={className}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
        {parts
          .filter((p) => p.count > 0)
          .map((p) => (
            <div
              key={p.label}
              className="h-full transition-all duration-500"
              style={{ width: `${(p.count / total) * 100}%`, background: p.color }}
              title={`${p.label}: ${p.count}`}
            />
          ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {parts
          .filter((p) => p.count > 0)
          .map((p) => (
            <span key={p.label} className="flex items-center gap-1 text-[10px] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
              {p.label}
              <span className="font-mono text-zinc-400">{p.count}</span>
            </span>
          ))}
      </div>
    </div>
  );
}
