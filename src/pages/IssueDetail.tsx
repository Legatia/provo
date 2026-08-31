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
  signal: { icon: "🌐", label: "public discussion", tint: "text-paper-dim" },
  email: { icon: "📧", label: "inbound message", tint: "text-verdigris" },
  web: { icon: "🔍", label: "web evidence", tint: "text-brass-bright" },
  historical: { icon: "🕘", label: "historical", tint: "text-verdigris" },
};

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-paper-dim/70">
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
    return <div className="skeleton h-96 rounded-xl" />;
  if (detail === null)
    return (
      <Card className="p-10 text-center text-sm text-paper-dim">
        Issue not found.{" "}
        <Link to="/issues" className="text-brass-bright hover:text-brass-bright">
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
          <Link to="/issues" className="text-[11px] text-paper-dim transition hover:text-paper/90">
            ← issues
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h2 className={`text-[22px] font-semibold tracking-tight ${statusText(issue.status)}`}>
              {issue.title}
            </h2>
            <StatusBadge status={issue.status} />
            <span className="rounded-md border border-rule px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-paper-dim">
              {issue.severity}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-paper-dim">
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
            <span className="font-mono text-2xl font-semibold text-paper">
              {issue.mentionsThisWeek}
            </span>
            <span className="font-mono text-xs text-paper-dim">/ {issue.mentionsPrevWeek} prev wk</span>
          </div>
          <TrendBadge growth={issue.growthMultiplier} />
        </Stat>
        <Stat label="Confidence">
          <div className="flex items-center gap-3">
            <RingMeter value={issue.confidence} size={44} label="%" />
            <span className="text-[11px] leading-snug text-paper-dim">
              {evidence.length} evidence items
            </span>
          </div>
        </Stat>
        <Stat label="Priority">
          <div className="font-mono text-2xl font-semibold text-paper">
            {Math.round(issue.priorityScore)}
            <span className="text-sm text-paper-dim/70">/100</span>
          </div>
          <div className="flex h-1 w-24 overflow-hidden rounded-full bg-paper/[0.04]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brass to-verdigris transition-all duration-700"
              style={{ width: `${issue.priorityScore}%` }}
            />
          </div>
        </Stat>
        <Stat label="Affected">
          <div className="text-[13px] font-medium text-paper">
            {issue.affectedSegment ?? "unknown"}
          </div>
          <span className="font-mono text-[10px] text-paper-dim/70">
            first {fmtDate(issue.firstDetectedAt)} · last {fmtDate(issue.lastDetectedAt)}
            {issue.resolvedAt ? ` · resolved ${fmtDate(issue.resolvedAt)}` : ""}
          </span>
        </Stat>
      </Card>

      {/* memory / reasoning / recommendation */}
      {(issue.historicalNote || issue.reasoningSummary || issue.recommendedAction) && (
        <div className="grid gap-3 lg:grid-cols-3">
          {issue.historicalNote && (
            <Card className="border-verdigris/20 bg-verdigris/[0.05] p-4">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-verdigris">
                <span>🧠</span> Historical context
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-violet-200/90">
                {issue.historicalNote}
              </p>
            </Card>
          )}
          {issue.reasoningSummary && (
            <Card className="p-4">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-paper-dim">
                <span>◍</span> Agent reasoning
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-paper/90">
                {issue.reasoningSummary}
              </p>
            </Card>
          )}
          {issue.recommendedAction && (
            <Card className="border-verdigris/20 bg-verdigris/[0.05] p-4">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-verdigris">
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
                <span className="font-mono text-[10px] text-paper-dim/70">
                  {evidence.length} items · {webEvidence.length} web
                </span>
              }
            >
              Evidence timeline
            </SectionTitle>
            <Card className="relative p-0">
              {evidence.length === 0 && (
                <div className="px-6 py-10 text-center text-xs text-paper-dim">
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
                    <div key={e._id} className="animate-fade-up relative flex gap-3.5 px-4 py-3.5 transition hover:bg-paper/[0.015]">
                      <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rule bg-ink-raised text-[11px]">
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                          <span className={`font-medium ${meta.tint}`}>{meta.label}</span>
                          {e.source !== e.kind && <span className="text-paper-dim/70">{e.source}</span>}
                          <span className="text-zinc-700">·</span>
                          <span className="font-mono text-paper-dim/70">{fmtDate(e.occurredAt)}</span>
                          <span className="ml-auto inline-flex items-center gap-1 font-mono text-paper-dim/70">
                            rel
                            <span className="rounded bg-paper/[0.03] px-1 py-px text-paper-dim">
                              {e.relevance}
                            </span>
                          </span>
                        </div>
                        <blockquote className="mt-1.5 border-l-2 border-rule pl-2.5 text-[12.5px] leading-relaxed text-paper/90">
                          {e.excerpt}
                        </blockquote>
                        {e.url && (
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate font-mono text-[10.5px] text-brass-bright/80 transition hover:text-brass-bright"
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
            <SectionTitle right={<span className="font-mono text-[10px] text-paper-dim/70">{signals.length}</span>}>
              Raw signals
            </SectionTitle>
            <Card className="max-h-72 divide-y divide-white/[0.05] overflow-y-auto">
              {[...signals]
                .sort((a: any, b: any) => b.occurredAt - a.occurredAt)
                .map((s: any) => (
                  <div key={s._id} className="group px-4 py-2.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5 text-paper-dim">
                        <span>{s.source === "email" ? "📧" : "🌐"}</span>
                        {s.source}
                        {s.author ? <span className="text-paper-dim/70">· {s.author}</span> : null}
                      </span>
                      <span className="font-mono text-paper-dim/70">{fmtDate(s.occurredAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-paper-dim transition group-hover:text-paper/90">
                      {s.content}
                    </p>
                  </div>
                ))}
              {signals.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-paper-dim">none</div>
              )}
            </Card>
          </div>
        </div>

        {/* right column */}
        <div className="space-y-5 lg:col-span-2">
          {/* mentions per day */}
          <div>
            <SectionTitle right={<span className="font-mono text-[10px] text-paper-dim/70">14 days</span>}>
              Mentions / day
            </SectionTitle>
            <Card className="p-4">
              <BarChart data={daily ?? []} labels={dayLabels} height={60} color="#58B98C" />
            </Card>
          </div>

          {/* investigations */}
          <div>
            <SectionTitle right={<span className="font-mono text-[10px] text-paper-dim/70">{investigations.length}</span>}>
              Investigations
            </SectionTitle>
            <Card className="divide-y divide-white/[0.05]">
              {investigations.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-paper-dim">
                  None yet — trigger one above.
                </div>
              )}
              {investigations.map((inv: any) => (
                <div key={inv._id} className={`animate-fade-up p-4 ${inv.status === "running" ? "running-sweep" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={inv.status === "pending" ? "running" : inv.status} />
                    <span className="font-mono text-[9px] text-paper-dim/70">
                      {fmtDateTime(inv.startedAt)} · {inv.triggeredBy}
                    </span>
                  </div>
                  {inv.question && (
                    <p className="mt-2 text-[12px] italic leading-snug text-paper/90">“{inv.question}”</p>
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
                                  ? "text-verdigris"
                                  : current
                                    ? "animate-pulse-dot text-brass-bright"
                                    : "text-zinc-700"
                              }
                            >
                              {done ? "●" : "○"}
                            </span>
                            <span className={done ? "text-paper-dim" : current ? "text-brass-bright" : "text-paper-dim/70"}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {inv.findings && (
                    <p className="mt-3 whitespace-pre-line rounded-xl border border-rule bg-paper/[0.015] p-3 text-[11px] leading-relaxed text-paper-dim">
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
                      <span className="text-[12.5px] font-medium leading-snug text-paper">
                        {r.subject}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] text-paper-dim/70">
                        {timeAgo(r.sentAt)} ago
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-paper-dim">
                      <span>→ {r.sentTo}</span>
                      <span className="rounded bg-paper/[0.03] px-1.5 py-px uppercase tracking-wider text-paper-dim">
                        {r.kind}
                      </span>
                    </div>
                    <details className="group mt-2">
                      <summary className="cursor-pointer text-[11px] text-paper-dim transition hover:text-paper/90">
                        show report
                      </summary>
                      <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-rule bg-black/30 p-3 font-mono text-[10.5px] leading-relaxed text-paper-dim">
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
