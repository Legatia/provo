import { useQuery, api } from "../lib/convex";
import {
  Card,
  SectionTitle,
  StatusBadge,
  TrendBadge,
  TypeIcon,
  timeAgo,
  SkeletonBlock,
  EmptyState,
} from "../components/ui";
import { Sparkline, BarChart, MixBar } from "../components/charts";
import { Link } from "react-router-dom";

function StatCard({
  label,
  value,
  icon,
  accent,
  sub,
  loading,
}: {
  label: string;
  value: number | string;
  icon: string;
  accent: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden p-4">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl"
        style={{ background: accent, opacity: 0.14 }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </span>
        <span className="text-sm opacity-70">{icon}</span>
      </div>
      {loading ? (
        <SkeletonBlock className="mt-2 h-8 w-14" />
      ) : (
        <div className={`mt-1.5 font-mono text-[28px] font-semibold leading-none ${sub ? "" : "mb-2"}`} style={{ color: accent }}>
          {value}
        </div>
      )}
      {sub && <div className="mt-1.5 text-[11px] leading-none text-zinc-500">{sub}</div>}
    </Card>
  );
}

export default function Overview() {
  const overview = useQuery(api.queries.getOverview, {});

  if (overview === undefined) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <SkeletonBlock className="h-72" />
          <SkeletonBlock className="h-72" />
        </div>
      </div>
    );
  }
  if (overview === null) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon="🛰️"
          title="The agent isn't hired yet"
          hint="Run setup from the Demo panel to provision the company, the real AgentMail inboxes and the monitored sources."
        />
        <div className="flex justify-center pb-6">
          <Link
            to="/demo"
            className="rounded-xl bg-indigo-500/90 px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] transition hover:bg-indigo-400"
          >
            Open Demo Panel →
          </Link>
        </div>
      </Card>
    );
  }

  const recentUp = overview.recentChanges.filter(
    (c: any) => (c.growthMultiplier ?? 1) > 1
  ).length;

  return (
    <div className="space-y-6">
      {/* header line */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {overview.company.name} · <span className="text-zinc-400">{overview.company.product}</span>
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {overview.signalCount} signals under watch · {recentUp} trend
            {recentUp === 1 ? "" : "s"} rising · inbox monitored around the clock
          </p>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Critical" value={overview.counts.critical} icon="🔥" accent="#f87171" loading={false} />
        <StatCard label="Emerging" value={overview.counts.emerging} icon="⚠️" accent="#fbbf24" loading={false} />
        <StatCard label="Stable" value={overview.counts.stable} icon="🟢" accent="#38bdf8" loading={false} />
        <StatCard
          label="Signals"
          value={overview.signalCount}
          icon="📡"
          accent="#a5b4fc"
          sub={`${overview.emailSignals} email · ${overview.webSignals} web`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* left column */}
        <div className="space-y-5 lg:col-span-3">
          {/* signal volume */}
          <div>
            <SectionTitle
              right={
                <span className="font-mono text-[10px] text-zinc-600">last 14 days</span>
              }
            >
              Signal volume
            </SectionTitle>
            <Card className="p-4">
              <BarChart
                data={overview.totalDaily}
                labels={overview.dayLabels}
                height={64}
                color="#818cf8"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-600">
                <span className="font-mono">{overview.dayLabels[0]}</span>
                <span className="font-mono">{overview.dayLabels[13]}</span>
              </div>
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                <MixBar
                  parts={[
                    { label: "email", count: overview.emailSignals, color: "#34d399" },
                    { label: "reddit", count: overview.webSignals, color: "#818cf8" },
                  ]}
                />
              </div>
            </Card>
          </div>

          {/* recent changes */}
          <div>
            <SectionTitle
              right={
                <Link to="/issues" className="text-[11px] text-zinc-500 transition hover:text-zinc-300">
                  all issues →
                </Link>
              }
            >
              Recent changes
            </SectionTitle>
            <Card hover className="divide-y divide-white/[0.05]">
              {overview.recentChanges.length === 0 && (
                <EmptyState icon="🌊" title="Quiet out there" hint="No issues yet — the agent opens one when signals cluster." />
              )}
              {overview.recentChanges.map((c: any) => (
                <Link key={c._id} to={`/issues/${c._id}`} className="group flex items-center gap-4 p-4 transition hover:bg-white/[0.02]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-zinc-200 group-hover:text-white">
                      {c.title}
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                      <span>{c.mentionsThisWeek} this wk</span>
                      <span className="text-zinc-700">·</span>
                      <span>{c.mentionsPrevWeek} last</span>
                    </div>
                  </div>
                  <Sparkline
                    data={c.spark}
                    width={90}
                    height={26}
                    stroke={(c.growthMultiplier ?? 1) > 1 ? "#f87171" : "#34d399"}
                    className="w-[90px] shrink-0"
                  />
                  <TrendBadge growth={c.growthMultiplier} />
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </Card>
          </div>
        </div>

        {/* right column: activity */}
        <div className="lg:col-span-2">
          <SectionTitle right={<span className="flex items-center gap-1.5 text-[10px] text-emerald-400"><span className="relative flex h-1.5 w-1.5"><span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" /></span>live</span>}>
            Agent activity
          </SectionTitle>
          <Card className="max-h-[560px] overflow-y-auto p-2">
            {overview.activity.length === 0 && (
              <EmptyState icon="🌙" title="Agent idle" hint="Monitoring cycles run every 5 minutes." />
            )}
            <div className="relative">
              {overview.activity.map((t: any, i: number) => (
                <div key={t._id} className="animate-fade-up relative flex gap-3 rounded-xl p-2.5 transition hover:bg-white/[0.02]">
                  <TypeIcon type={t.type} running={t.status === "running"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-[12.5px] leading-snug ${
                          t.status === "running" ? "text-indigo-200" : "text-zinc-300"
                        }`}
                      >
                        {t.label}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] text-zinc-600">
                        {timeAgo(t.startedAt)}
                      </span>
                    </div>
                    {t.detail && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                        {t.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
