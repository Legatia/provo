import { useQuery, api } from "../lib/convex";
import {
  Card,
  StatusBadge,
  TrendBadge,
  SkeletonBlock,
  EmptyState,
  fmtDate,
  statusText,
} from "../components/ui";
import { Sparkline } from "../components/charts";
import { Link } from "react-router-dom";

const SEVERITY_BAR: Record<string, string> = {
  critical: "bg-oxblood",
  high: "bg-amber-flag",
  medium: "bg-amber-flag",
  low: "bg-brass",
};

export default function Issues({ entity }: { entity?: string }) {
  const rows = useQuery(api.queries.listIssuesDetailed, entity ? { entity } : {});

  if (rows === undefined)
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <SkeletonBlock key={i} className="h-28" />
        ))}
      </div>
    );

  const active = rows.filter((r: any) => r.issue.status !== "resolved");
  const resolved = rows.filter((r: any) => r.issue.status === "resolved");

  const IssueRow = ({ row }: { row: any }) => {
    const i = row.issue;
    const sparkColor = (i.growthMultiplier ?? 1) > 1 ? "#f87171" : "#58B98C";
    return (
      <Link to={`/issues/${i._id}`}>
        <Card hover className="group relative overflow-hidden p-4">
          <div
            className={`absolute left-0 top-0 h-full w-[3px] ${SEVERITY_BAR[i.severity] ?? "bg-zinc-500"} opacity-70`}
          />
          <div className="flex items-start gap-4 pl-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[15px] font-semibold tracking-tight ${statusText(i.status)}`}>
                  {i.title}
                </span>
                <StatusBadge status={i.status} />
              </div>
              <p className="mt-1.5 line-clamp-2 max-w-2xl text-[12.5px] leading-relaxed text-paper-dim">
                {i.description}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] text-paper-dim">
                <span>
                  <span className="text-paper">{i.mentionsThisWeek}</span>/wk now ·{" "}
                  {i.mentionsPrevWeek} prev
                </span>
                {i.affectedSegment && (
                  <span className="font-sans">
                    affected: <span className="text-paper/90">{i.affectedSegment}</span>
                  </span>
                )}
                <span className="font-sans">first seen {fmtDate(i.firstDetectedAt)}</span>
              </div>
              {i.historicalNote && (
                <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-verdigris/20 bg-verdigris/[0.07] px-2.5 py-1.5 text-[11px] leading-snug text-verdigris">
                  <span>🧠</span>
                  <span className="truncate">{i.historicalNote}</span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2.5">
              <Sparkline data={row.spark} width={110} height={34} stroke={sparkColor} className="w-[110px]" />
              <div className="flex items-center gap-2">
                <TrendBadge growth={i.growthMultiplier} />
                <div className="rounded-lg border border-rule bg-paper/[0.02] px-2 py-1 text-center">
                  <div className="font-mono text-[13px] font-semibold leading-none text-paper">
                    {Math.round(i.priorityScore)}
                  </div>
                  <div className="mt-0.5 text-[8px] uppercase tracking-wider text-paper-dim/70">prio</div>
                </div>
                <div className="rounded-lg border border-rule bg-paper/[0.02] px-2 py-1 text-center">
                  <div className="font-mono text-[13px] font-semibold leading-none text-paper">
                    {i.confidence}%
                  </div>
                  <div className="mt-0.5 text-[8px] uppercase tracking-wider text-paper-dim/70">conf</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    );
  };

  return (
    <div className="space-y-5">
      {rows.length === 0 && (
        <Card>
          <EmptyState
            icon="◉"
            title="No issues yet"
            hint="When public-opinion signals cluster, the desk opens a normalized finding with evidence and a priority score."
          />
        </Card>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-paper-dim">
            Active · {active.length}
          </h3>
          {active.map((row: any) => (
            <IssueRow key={row.issue._id} row={row} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-3 opacity-60 transition hover:opacity-100">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-paper-dim">
            Resolved · {resolved.length} · the agent's memory
          </h3>
          {resolved.map((row: any) => (
            <IssueRow key={row.issue._id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
