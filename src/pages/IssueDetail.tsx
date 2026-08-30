import { useMemo } from "react";
import { useQuery, useMutation, api } from "../lib/convex";
import {
  Card,
  SectionTitle,
  StatusBadge,
  TrendBadge,
  Button,
  Favicon,
  fmtDate,
  fmtDateTime,
  timeAgo,
  statusText,
} from "../components/ui";
import { RingMeter, BarChart } from "../components/charts";
import { Link, useParams } from "react-router-dom";

const KIND_META: Record<string, { icon: string; label: string; tint: string }> = {
  signal: { icon: "🌐", label: "public discussion", tint: "text-zinc-400" },
  email: { icon: "📧", label: "inbound message", tint: "text-emerald-300" },
  web: { icon: "🔍", label: "web evidence", tint: "text-indigo-300" },
  historical: { icon: "🕘", label: "historical", tint: "text-violet-300" },
};

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function IssueDetail() {
  const { issueId } = useParams();
  const detail = useQuery(api.queries.getIssueDetail, { issueId: issueId as any });
  const investigate = useMutation(api.chat.runInvestigationNow);

  const daily = useMemo(() => {
    if (!detail) return null;
    const arr = new Array(14).fill(0);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = startOfToday.getTime();
    for (const s of detail.signals) {
      const idx = 13 - Math.round((today - new Date(s.occurredAt).setHours(0, 0, 0, 0)) / 86400000);
      if (idx >= 0 && idx < 14) arr[idx]++;
    }
    return arr;
  }, [detail]);

  if (detail === undefined)
    return <div className="skeleton h-96 rounded-2xl" />;
  if (detail === null)
    return (
      <Card className="p-10 text-center text-sm text-zinc-500">
        Issue not found.{" "}
        <Link to="/issues" className="text-indigo-300 hover:text-indigo-200">
          Back to issues →
        </Link>
      </Card>
    );

  const { issue, evidence, signals, investigations, reports } = detail;
  const running = investigations.find((i: any) => i.status === "running" || i.status === "pending");
  const webEvidence = evidence.filter((e: any) => e.kind === "web");
  const dayLabels = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (13 - i));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <Link to="/issues" className="text-[11px] text-zinc-500 transition hover:text-zinc-300">
            ← issues
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h2 className={`text-[22px] font-semibold tracking-tight ${statusText(issue.status)}`}>
              {issue.title}
            </h2>
            <StatusBadge status={issue.status} />
            <span className="rounded-md border border-white/[0.08] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
              {issue.severity}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-400">
            {issue.description}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => investigate({ issueId: issue._id })}
          disabled={!!running}
          className="shrink-0"
        >
          {running ? (
            <>
              <span className="animate-pulse-dot">◍</span> Investigating…
            </>
          ) : (
            <>🔍 Run investigation</>
          )}
        </Button>
      </div>

      {/* stat strip */}
      <Card className="grid grid-cols-2 divide-white/[0.05] sm:grid-cols-4 sm:divide-x">
        <Stat label="Mentions">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-zinc-100">
              {issue.mentionsThisWeek}
            </span>
            <span className="font-mono text-xs text-zinc-500">/ {issue.mentionsPrevWeek} prev wk</span>
          </div>
          <TrendBadge growth={issue.growthMultiplier} />
        </Stat>
        <Stat label="Confidence">
          <div className="flex items-center gap-3">
            <RingMeter value={issue.confidence} size={44} label="%" />
            <span className="text-[11px] leading-snug text-zinc-500">
              {evidence.length} evidence items
            </span>
          </div>
        </Stat>
        <Stat label="Priority">
          <div className="font-mono text-2xl font-semibold text-zinc-100">
            {Math.round(issue.priorityScore)}
            <span className="text-sm text-zinc-600">/100</span>
          </div>
          <div className="flex h-1 w-24 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-700"
              style={{ width: `${issue.priorityScore}%` }}
            />
          </div>
        </Stat>
        <Stat label="Affected">
          <div className="text-[13px] font-medium text-zinc-200">
            {issue.affectedSegment ?? "unknown"}
          </div>
          <span className="font-mono text-[10px] text-zinc-600">
            first {fmtDate(issue.firstDetectedAt)} · last {fmtDate(issue.lastDetectedAt)}
            {issue.resolvedAt ? ` · resolved ${fmtDate(issue.resolvedAt)}` : ""}
          </span>
        </Stat>
      </Card>

      {/* memory / reasoning / recommendation */}
      {(issue.historicalNote || issue.reasoningSummary || issue.recommendedAction) && (
        <div className="grid gap-3 lg:grid-cols-3">
          {issue.historicalNote && (
            <Card className="border-violet-500/20 bg-violet-500/[0.05] p-4">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-300">
                <span>🧠</span> Historical context
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-violet-200/90">
                {issue.historicalNote}
              </p>
            </Card>
          )}
          {issue.reasoningSummary && (
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                <span>◍</span> Agent reasoning
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-zinc-300">
                {issue.reasoningSummary}
              </p>
            </Card>
          )}
          {issue.recommendedAction && (
            <Card className="border-emerald-500/20 bg-emerald-500/[0.05] p-4">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                <span>➜</span> Recommended
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-emerald-200/90">
                {issue.recommendedAction}
              </p>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* evidence timeline */}
        <div className="space-y-5 lg:col-span-3">
          <div>
            <SectionTitle
              right={
                <span className="font-mono text-[10px] text-zinc-600">
                  {evidence.length} items · {webEvidence.length} web
                </span>
              }
            >
              Evidence timeline
            </SectionTitle>
            <Card className="relative p-0">
              {evidence.length === 0 && (
                <div className="px-6 py-10 text-center text-xs text-zinc-500">
                  No evidence collected yet.
                </div>
              )}
              <div className="relative">
                {evidence.length > 0 && (
                  <div className="absolute bottom-5 left-[27px] top-5 w-px bg-gradient-to-b from-white/[0.14] via-white/[0.08] to-transparent" />
                )}
                {evidence.map((e: any) => {
                  const meta = KIND_META[e.kind] ?? KIND_META.signal;
                  return (
                    <div key={e._id} className="animate-fade-up relative flex gap-3.5 px-4 py-3.5 transition hover:bg-white/[0.02]">
                      <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-zinc-900 text-[11px]">
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                          <span className={`font-medium ${meta.tint}`}>{meta.label}</span>
                          {e.source !== e.kind && <span className="text-zinc-600">{e.source}</span>}
                          <span className="text-zinc-700">·</span>
                          <span className="font-mono text-zinc-600">{fmtDate(e.occurredAt)}</span>
                          <span className="ml-auto inline-flex items-center gap-1 font-mono text-zinc-600">
                            rel
                            <span className="rounded bg-white/[0.05] px-1 py-px text-zinc-400">
                              {e.relevance}
                            </span>
                          </span>
                        </div>
                        <blockquote className="mt-1.5 border-l-2 border-white/[0.09] pl-2.5 text-[12.5px] leading-relaxed text-zinc-300">
                          {e.excerpt}
                        </blockquote>
                        {e.url && (
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate font-mono text-[10.5px] text-indigo-300/80 transition hover:text-indigo-200"
                          >
                            <Favicon url={e.url} />
                            <span className="truncate">{e.url}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* raw signals */}
          <div>
            <SectionTitle right={<span className="font-mono text-[10px] text-zinc-600">{signals.length}</span>}>
              Raw signals
            </SectionTitle>
            <Card className="max-h-72 divide-y divide-white/[0.05] overflow-y-auto">
              {[...signals]
                .sort((a: any, b: any) => b.occurredAt - a.occurredAt)
                .map((s: any) => (
                  <div key={s._id} className="group px-4 py-2.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5 text-zinc-500">
                        <span>{s.source === "email" ? "📧" : "🌐"}</span>
                        {s.source}
                        {s.author ? <span className="text-zinc-600">· {s.author}</span> : null}
                      </span>
                      <span className="font-mono text-zinc-600">{fmtDate(s.occurredAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-zinc-400 transition group-hover:text-zinc-300">
                      {s.content}
                    </p>
                  </div>
                ))}
              {signals.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-zinc-500">none</div>
              )}
            </Card>
          </div>
        </div>

        {/* right column */}
        <div className="space-y-5 lg:col-span-2">
          {/* mentions per day */}
          <div>
            <SectionTitle right={<span className="font-mono text-[10px] text-zinc-600">14 days</span>}>
              Mentions / day
            </SectionTitle>
            <Card className="p-4">
              <BarChart data={daily ?? []} labels={dayLabels} height={60} color="#34d399" />
            </Card>
          </div>

          {/* investigations */}
          <div>
            <SectionTitle right={<span className="font-mono text-[10px] text-zinc-600">{investigations.length}</span>}>
              Investigations
            </SectionTitle>
            <Card className="divide-y divide-white/[0.05]">
              {investigations.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-zinc-500">
                  None yet — trigger one above.
                </div>
              )}
              {investigations.map((inv: any) => (
                <div key={inv._id} className={`animate-fade-up p-4 ${inv.status === "running" ? "running-sweep" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={inv.status === "pending" ? "running" : inv.status} />
                    <span className="font-mono text-[9px] text-zinc-600">
                      {fmtDateTime(inv.startedAt)} · {inv.triggeredBy}
                    </span>
                  </div>
                  {inv.question && (
                    <p className="mt-2 text-[12px] italic leading-snug text-zinc-300">“{inv.question}”</p>
                  )}
                  {inv.plan.length > 0 && (
                    <div className="mt-2.5 space-y-1">
                      {inv.plan.map((step: string, idx: number) => {
                        const done = inv.status === "complete" || idx < inv.stepIndex;
                        const current = idx === inv.stepIndex && inv.status === "running";
                        return (
                          <div key={idx} className="flex items-center gap-2 text-[11px]">
                            <span
                              className={
                                done
                                  ? "text-emerald-400"
                                  : current
                                    ? "animate-pulse-dot text-indigo-300"
                                    : "text-zinc-700"
                              }
                            >
                              {done ? "●" : "○"}
                            </span>
                            <span className={done ? "text-zinc-400" : current ? "text-indigo-200" : "text-zinc-600"}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {inv.findings && (
                    <p className="mt-3 whitespace-pre-line rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-zinc-400">
                      {inv.findings}
                    </p>
                  )}
                </div>
              ))}
            </Card>
          </div>

          {/* reports */}
          {reports.length > 0 && (
            <div>
              <SectionTitle>Reports emailed</SectionTitle>
              <Card className="divide-y divide-white/[0.05]">
                {reports.map((r: any) => (
                  <div key={r._id} className="animate-fade-up p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12.5px] font-medium leading-snug text-zinc-200">
                        {r.subject}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] text-zinc-600">
                        {timeAgo(r.sentAt)} ago
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                      <span>→ {r.sentTo}</span>
                      <span className="rounded bg-white/[0.05] px-1.5 py-px uppercase tracking-wider text-zinc-400">
                        {r.kind}
                      </span>
                    </div>
                    <details className="group mt-2">
                      <summary className="cursor-pointer text-[11px] text-zinc-500 transition hover:text-zinc-300">
                        show report
                      </summary>
                      <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/30 p-3 font-mono text-[10.5px] leading-relaxed text-zinc-400">
                        {r.bodyText}
                      </pre>
                    </details>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
