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
    listed: { label: "Listed", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    flagged: { label: "⚠ Flagged", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
    rejected: { label: "Rejected", cls: "border-red-500/30 bg-red-500/10 text-red-300" },
    under_review: { label: "Desk reviewing…", cls: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 animate-pulse" },
    applied: { label: "Applied", cls: "border-white/10 bg-white/[0.04] text-zinc-400" },
  };
  const s = map[status] ?? map.applied;
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function SimBadge() {
  return (
    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-amber-300">
      simulation
    </span>
  );
}

function SentimentBar({ score }: { score?: number }) {
  if (score == null) return <span className="font-mono text-[10px] text-zinc-600">no sentiment yet</span>;
  const color = score >= 60 ? "bg-emerald-400" : score >= 40 ? "bg-amber-400" : "bg-red-400";
  const textColor = score >= 60 ? "text-emerald-300" : score >= 40 ? "text-amber-300" : "text-red-300";
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
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Every project has a past — Provo keeps the record. Choose a project to open its
            dossier; the monitored project also exposes its engine and findings.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500">
          <LiveDot /> desk live
        </span>
      </div>

      {/* featured slot (paid placement) */}
      {featured.map((p) => (
        <div
          key={p._id}
          onClick={() => open(p.slug)}
          className="relative cursor-pointer overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.08] to-violet-600/[0.05] p-5 transition-all hover:border-indigo-500/45"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                Featured · demo placement
              </span>
              <StatusBadge status={p.status} />
              {p.simulated && <SimBadge />}
            </div>
            <SentimentBar score={p.sentimentScore} />
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
            <h3 className="text-[16px] font-semibold text-zinc-100">{p.name}</h3>
            <span className="rounded border border-white/[0.07] px-1.5 py-px font-mono text-[9px] uppercase text-zinc-500">
              {p.chain}
            </span>
            <span className="text-[12.5px] text-zinc-400">{p.tagline}</span>
          </div>
          {p.verdictSummary && (
            <p className="mt-2 max-w-3xl text-[11.5px] leading-relaxed text-zinc-500">{p.verdictSummary}</p>
          )}
        </div>
      ))}

      {/* the board */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rest.map((p) => (
          <Card
            key={p._id}
            className="cursor-pointer p-4 transition-all hover:border-white/[0.14]"
          >
            <div onClick={() => open(p.slug)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={p.status} />
                  {p.simulated && <SimBadge />}
                </div>
                <span className="rounded border border-white/[0.07] px-1.5 py-px font-mono text-[9px] uppercase text-zinc-500">
                  {p.chain}
                </span>
              </div>
              <h3 className="mt-2.5 text-[14px] font-semibold text-zinc-100">{p.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-[2.2em] text-[11.5px] leading-relaxed text-zinc-500">
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
          <Card className="col-span-full p-8 text-center text-[12px] text-zinc-500">
            No applicants yet — seed the demo board from the Demo panel.
          </Card>
        )}
      </div>
    </div>
  );
}
