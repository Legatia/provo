import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/convex";
import { Card, LiveDot, Button } from "../components/ui";

// ─────────────────────────────────────────────────────────────────────────────
// The public project board — Provo's product surface. Featured placement is
// paid; sentiment and verdicts stay visible regardless of payment. Clicking a
// project opens its dossier (and, for the monitored project, engine+findings).
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    listed: { label: "Listed", cls: "border-verdigris/40 bg-verdigris/10 text-verdigris" },
    flagged: { label: "⚠ Flagged", cls: "border-amber-flag/40 bg-amber-flag/10 text-amber-flag" },
    rejected: { label: "Rejected", cls: "border-oxblood/40 bg-oxblood/10 text-oxblood" },
    under_review: { label: "Desk reviewing…", cls: "border-brass/40 bg-brass/10 text-brass-bright animate-pulse" },
    applied: { label: "Applied", cls: "border-rule-strong bg-paper/[0.03] text-paper-dim" },
  };
  const s = map[status] ?? map.applied;
  return <span className={`stamp ${s.cls}`}>{s.label}</span>;
}

function SimBadge() {
  return (
    <span className="stamp border-rule-strong bg-paper/[0.03] text-paper-dim">simulation</span>
  );
}

function SentimentBar({ score }: { score?: number }) {
  if (score == null) return <span className="font-mono text-[10px] text-paper-dim/70">no sentiment yet</span>;
  const color = score >= 60 ? "bg-verdigris" : score >= 40 ? "bg-amber-flag" : "bg-oxblood";
  const textColor = score >= 60 ? "text-verdigris" : score >= 40 ? "text-amber-flag" : "text-oxblood";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`font-mono text-[10px] ${textColor}`}>{score}</span>
    </div>
  );
}

export default function Board() {
  const projects = useQuery(api.projects.listBoard, {});
  const startReview = useMutation(api.projects.startReviewBySlug);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const featured = projects?.filter((p) => p.featured && p.status !== "applied") ?? [];
  const rest = projects?.filter((p) => !featured.includes(p)) ?? [];

  const open = (slug: string) => navigate(`/project/${slug}`);

  return (
    <div className="space-y-6">
      {/* header band */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Project board</h2>
          <p className="mt-0.5 text-[12px] text-paper-dim">
            Every project has a past — Provo keeps the record. Choose a project to open its
            dossier; the monitored project also exposes its engine and findings.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper/[0.02] px-2.5 py-1 text-[10px] uppercase tracking-wider text-paper-dim">
          <LiveDot /> desk live
        </span>
      </div>

      {/* featured slot (paid placement) */}
      {featured.map((p) => (
        <div
          key={p._id}
          onClick={() => open(p.slug)}
          className="relative cursor-pointer overflow-hidden rounded-xl border border-brass/45 bg-gradient-to-br from-brass/[0.10] via-brass/[0.04] to-transparent p-5 shadow-[0_0_32px_rgba(201,162,75,0.08)] transition-all hover:border-brass/70"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="stamp border-brass/40 bg-brass/10 text-brass-bright">Featured · demo placement</span>
              <StatusBadge status={p.status} />
              {p.simulated && <SimBadge />}
            </div>
            <SentimentBar score={p.sentimentScore} />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <h3 className="font-display text-[18px] font-semibold text-paper">{p.name}</h3>
            <span className="rounded border border-rule px-1.5 py-px font-mono text-[9px] uppercase text-paper-dim">
              {p.chain}
            </span>
            <span className="text-[12.5px] text-paper-dim">{p.tagline}</span>
          </div>
          {p.verdictSummary && (
            <p className="mt-2 max-w-3xl text-[11.5px] leading-relaxed text-paper-dim">{p.verdictSummary}</p>
          )}
        </div>
      ))}

      {/* the board */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rest.map((p) => (
          <Card
            key={p._id}
            className="cursor-pointer p-4 transition-all hover:border-brass/40"
          >
            <div onClick={() => open(p.slug)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={p.status} />
                  {p.simulated && <SimBadge />}
                </div>
                <span className="rounded border border-rule px-1.5 py-px font-mono text-[9px] uppercase text-paper-dim">
                  {p.chain}
                </span>
              </div>
              <h3 className="mt-2.5 font-display text-[16px] font-semibold text-paper">{p.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-[2.2em] text-[11.5px] leading-relaxed text-paper-dim">
                {p.tagline}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2.5">
                <SentimentBar score={p.sentimentScore} />
                {p.riskTags && p.riskTags.length > 0 && (
                  <span className="font-mono text-[9.5px] text-amber-400/80">
                    {p.riskTags.slice(0, 2).join(" · ")}
                  </span>
                )}
              </div>
            </div>
            {p.status === "applied" && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  className="mt-3 w-full"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(p.slug);
                    try {
                      await startReview({ slug: p.slug });
                      open(p.slug);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === p.slug ? "submitting…" : "Run desk review"}
                </Button>
              </div>
            )}
          </Card>
        ))}
        {projects && projects.length === 0 && (
          <Card className="col-span-full p-8 text-center text-[12px] text-paper-dim">
            No applicants yet — seed the demo board from the Demo panel.
          </Card>
        )}
      </div>
    </div>
  );
}
