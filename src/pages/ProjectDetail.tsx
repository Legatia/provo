import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../lib/convex";
import Overview from "./Overview";
import Issues from "./Issues";
import { Card, SectionTitle, timeAgo } from "../components/ui";
// ─────────────────────────────────────────────────────────────────────────────
// Per-project view: dossier (verdict + memories + evidence), plus — for the
// project the engine deeply monitors — its monitoring engine and findings.
// Reached only by choosing a project on the board.
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "dossier" | "engine" | "findings";

export default function ProjectDetail() {
  const { slug } = useParams<{ slug: string }>();
  const project = useQuery(api.projects.getProjectBySlug, slug ? { slug } : "skip");
  const company = useQuery(api.queries.getCompany, {});
  const credits = useQuery(api.credits.getBalance, {});
  const topUp = useMutation(api.credits.grant);
  const [topping, setTopping] = useState(false);
  const [tab, setTab] = useState<Tab>("dossier");

  if (project === undefined) {
    return <div className="py-16 text-center text-[12px] text-zinc-500">loading…</div>;
  }
  if (project === null) {
    return <div className="py-16 text-center text-[12px] text-zinc-500">No such project on the board.</div>;
  }

  // the engine deeply monitors exactly one project (the watched one)
  const monitored =
    !!company && company.name.toLowerCase() === project.name.toLowerCase();

  const tabs: { id: Tab; label: string }[] = [
    { id: "dossier", label: "Dossier" },
    ...(monitored ? [{ id: "engine" as Tab, label: "Engine" }, { id: "findings" as Tab, label: "Findings" }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
            {project.name}
            {project.simulated && (
              <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-amber-300">
                simulation
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">{project.tagline}</p>
        </div>
        <div className="flex items-center gap-2">
          {project.links?.site && (
            <a
              href={project.links.site}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/[0.08] px-2.5 py-1 font-mono text-[10px] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
            >
              {project.links.site.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span className="rounded border border-white/[0.07] px-1.5 py-px font-mono text-[9px] uppercase text-zinc-500">
            {project.chain}
          </span>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl border px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
              tab === t.id
                ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-200"
                : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Provo Monitor — the paying customer's card, with its live meter */}
      {monitored && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            <span className="text-[12.5px] font-medium text-emerald-300">
              Provo Monitor · active
            </span>
            <span className="text-[11px] text-zinc-500">
              Engine + Findings are this customer's monitoring view
            </span>
          </div>
          <div className="flex items-center gap-3">
            {credits && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-500">credits</span>
                <span
                  className={`font-mono text-[12px] font-semibold ${
                    credits.balance > 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {credits.balance.toFixed(1)}
                </span>
                {credits.history[0] && credits.history[0].kind === "burn" && (
                  <span className="font-mono text-[10px] text-zinc-600">
                    last: {credits.history[0].amount} · {credits.history[0].action}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={async () => {
                setTopping(true);
                try {
                  await topUp({});
                } finally {
                  setTopping(false);
                }
              }}
              disabled={topping}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {topping ? "…" : "+100 top-up (demo — x402 pending)"}
            </button>
          </div>
        </div>
      )}

      {tab === "dossier" && (
        <Card className="p-5">
          <SectionTitle>
            Verdict {project.verdict ? `— ${project.verdict.toUpperCase()}` : ""}
          </SectionTitle>
          {project.verdictSummary ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-300">{project.verdictSummary}</p>
          ) : project.status === "under_review" ? (
            <p className="mt-2 text-[12px] text-indigo-300">The desk is reviewing this application…</p>
          ) : (
            <p className="mt-2 text-[12px] text-zinc-500">No verdict yet — the desk hasn't reviewed this application.</p>
          )}

          {project.riskTags && project.riskTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.riskTags.map((t) => (
                <span key={t} className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                  {t}
                </span>
              ))}
            </div>
          )}

          {project.recalledMemories && project.recalledMemories.length > 0 && (
            <div className="mt-4">
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                Sibyl memories the verdict relied on
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {project.recalledMemories.map((m) => (
                  <span key={m} className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] text-violet-300">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {project.evidence && project.evidence.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                Public-opinion evidence
              </div>
              {project.evidence.map((e, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[11.5px] leading-relaxed text-zinc-400">“{e.excerpt}”</p>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-[10px] text-zinc-600 hover:text-zinc-400">
                      {e.url.slice(0, 70)}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-white/[0.05] pt-2.5 text-[10px] text-zinc-600">
            applied {timeAgo(project.appliedAt)} ago
            {project.decidedAt ? ` · decided ${timeAgo(project.decidedAt)} ago` : ""}
          </div>
        </Card>
      )}

      {tab === "engine" && monitored && <Overview />}
      {tab === "findings" && monitored && <Issues />}

      {!monitored && tab !== "dossier" && (
        <Card className="p-8 text-center text-[12px] text-zinc-500">
          Deep monitoring isn't enabled for this project yet — the engine currently watches one project at a time.
        </Card>
      )}
    </div>
  );
}
