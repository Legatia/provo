import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
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
  const monitoredNames = useQuery(api.queries.listMonitoredNames, {});
  const credits = useQuery(api.credits.getBalance, project ? { name: project.name } : "skip");
  const [topping, setTopping] = useState(false);
  const topUp = async () => {
    await fetch(
      `${import.meta.env.VITE_CONVEX_SITE_URL}/api/credits/demo?amount=100`,
      { method: "POST", headers: { "X-DEMO-KEY": import.meta.env.VITE_DEMO_KEY ?? "" } }
    );
  };
  const [tab, setTab] = useState<Tab>("dossier");

  if (project === undefined || monitoredNames === undefined) {
    return <div className="py-16 text-center text-[12px] text-paper-dim">loading…</div>;
  }
  if (project === null) {
    return <div className="py-16 text-center text-[12px] text-paper-dim">No such project on the board.</div>;
  }

  // the engine watches every monitored entity; Engine + Findings are exposed
  // per entity
  const monitored = monitoredNames.includes(project.name);

  const tabs: { id: Tab; label: string }[] = [
    { id: "dossier", label: "Dossier" },
    ...(monitored ? [{ id: "engine" as Tab, label: "Engine" }, { id: "findings" as Tab, label: "Findings" }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-[24px] font-semibold tracking-tight text-paper">
            {project.name}
            {project.simulated && (
              <span className="stamp ml-2 border-rule-strong bg-paper/[0.03] text-paper-dim">simulation</span>
            )}
          </h2>
          <p className="mt-0.5 text-[12px] text-paper-dim">{project.tagline}</p>
        </div>
        <div className="flex items-center gap-2">
          {project.links?.site && (
            <a
              href={project.links.site}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/[0.08] px-2.5 py-1 font-mono text-[10px] text-paper-dim hover:border-white/20 hover:text-zinc-200"
            >
              {project.links.site.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span className="rounded border border-rule px-1.5 py-px font-mono text-[9px] uppercase text-paper-dim">
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
                ? "border-brass/50 bg-brass/15 text-brass-bright"
                : "border-rule-strong bg-paper/[0.02] text-paper-dim hover:border-paper/25 hover:text-paper"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Provo Monitor — the paying customer's card, with its live meter */}
      {monitored && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-verdigris/30 bg-verdigris/[0.06] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-verdigris shadow-[0_0_6px_rgba(88,185,140,0.7)]" />
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-verdigris">
              Provo Monitor · active
            </span>
            <span className="text-[11px] text-paper-dim">
              Engine + Findings are this customer's monitoring view
            </span>
          </div>
          <div className="flex items-center gap-3">
            {credits && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-paper-dim">credits</span>
                <span
                  className={`font-mono text-[12px] font-semibold ${
                    credits.balance > 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {credits.balance.toFixed(1)}
                </span>
                {credits.history[0] && credits.history[0].kind === "burn" && (
                  <span className="font-mono text-[10px] text-paper-dim/70">
                    last: {credits.history[0].amount} · {credits.history[0].action}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={async () => {
                setTopping(true);
                try {
                  await topUp();
                } finally {
                  setTopping(false);
                }
              }}
              disabled={topping}
              className="rounded-md border border-verdigris/40 bg-verdigris/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-verdigris transition-colors hover:bg-verdigris/20 disabled:opacity-40"
            >
              {topping ? "…" : "+100 demo top-up"}
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
            <p className="mt-2 text-[12.5px] leading-relaxed text-paper/90">{project.verdictSummary}</p>
          ) : project.status === "under_review" ? (
            <p className="mt-2 text-[12px] text-indigo-300">The desk is reviewing this application…</p>
          ) : (
            <p className="mt-2 text-[12px] text-paper-dim">No verdict yet — the desk hasn't reviewed this application.</p>
          )}

          {project.riskTags && project.riskTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.riskTags.map((t) => (
                <span key={t} className={`stamp border-amber-flag/40 bg-amber-flag/10 text-amber-flag`}>
                  {t}
                </span>
              ))}
            </div>
          )}

          {project.recalledMemories && project.recalledMemories.length > 0 && (
            <div className="mt-4">
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-paper-dim/70">
                Sibyl memories the verdict relied on
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {project.recalledMemories.map((m) => (
                  <span key={m} className="rounded-sm border border-verdigris/30 bg-verdigris/10 px-2 py-0.5 font-mono text-[10px] text-verdigris">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {project.evidence && project.evidence.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-paper-dim/70">
                Public-opinion evidence
              </div>
              {project.evidence.map((e, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-paper/[0.015] p-3">
                  <p className="text-[11.5px] leading-relaxed text-paper-dim">“{e.excerpt}”</p>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-[10px] text-paper-dim/70 hover:text-paper-dim">
                      {e.url.slice(0, 70)}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-white/[0.05] pt-2.5 text-[10px] text-paper-dim/70">
            applied {timeAgo(project.appliedAt)} ago
            {project.decidedAt ? ` · decided ${timeAgo(project.decidedAt)} ago` : ""}
          </div>
        </Card>
      )}

      {tab === "engine" && monitored && <Overview entity={project.name} />}
      {tab === "findings" && monitored && <Issues entity={project.name} />}

      {!monitored && tab !== "dossier" && (
        <Card className="p-8 text-center text-[12px] text-paper-dim">
          Deep monitoring isn't enabled for this project yet — the engine currently watches one project at a time.
        </Card>
      )}
    </div>
  );
}
