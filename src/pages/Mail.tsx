import { useState } from "react";
import { useQuery, api } from "../lib/convex";
import {
  Card,
  SectionTitle,
  SkeletonBlock,
  EmptyState,
  timeAgo,
} from "../components/ui";

const ROUTING_META: Record<string, { label: string; cls: string }> = {
  customer_feedback: {
    label: "customer feedback → became a signal",
    cls: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
  employee_question: {
    label: "employee question → investigated + replied",
    cls: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
  },
  other: { label: "noted", cls: "border-white/10 bg-white/[0.04] text-zinc-500" },
  pending: { label: "processing…", cls: "border-white/10 bg-white/[0.04] text-zinc-400" },
};

const SCENARIO_LABELS: Record<string, string> = {
  desk: "ZephyrSwap",
  firecrawl: "Firecrawl",
  agentmail: "AgentMail",
  archived: "Archived",
};

function initials(from: string): string {
  const m = from.match(/^"?([A-Za-z]+)/);
  return (m ? m[1][0] : "?").toUpperCase();
}

function senderColor(from: string): string {
  if (from.includes("maria")) return "bg-gradient-to-br from-sky-500/70 to-blue-600/70";
  if (from.includes("dana")) return "bg-gradient-to-br from-emerald-500/70 to-teal-600/70";
  if (from.includes("intelligence")) return "bg-gradient-to-br from-indigo-500/70 to-violet-600/70";
  return "bg-gradient-to-br from-zinc-500/70 to-zinc-600/70";
}

type Msg = {
  messageId: string;
  from: string;
  subject: string;
  preview: string;
  timestamp: number;
  routing: { classification: string; scenario?: string; replySummary?: string } | null;
};

function MessageRow({ m }: { m: Msg }) {
  const routing = m.routing?.classification
    ? (ROUTING_META[m.routing.classification] ?? ROUTING_META.other)
    : null;
  return (
    <div className="animate-fade-up p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${senderColor(m.from)}`}
        >
          {initials(m.from)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-[13px] font-medium text-zinc-200">
              {m.subject || "(no subject)"}
            </span>
            <span className="shrink-0 font-mono text-[9px] text-zinc-600">
              {timeAgo(m.timestamp)} ago
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[10.5px] text-zinc-500">{m.from}</div>
          <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-zinc-400">{m.preview}</p>
          {routing && (
            <span className={`mt-2.5 inline-block rounded-full border px-2 py-0.5 text-[10px] ${routing.cls}`}>
              {routing.label}
            </span>
          )}
          {m.routing?.replySummary && (
            <details className="mt-2.5">
              <summary className="cursor-pointer text-[11px] text-zinc-500 transition hover:text-zinc-300">
                ↩ agent replied — show
              </summary>
              <p className="mt-1.5 whitespace-pre-line rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-zinc-300">
                {m.routing.replySummary}
              </p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Mail() {
  const inbox = useQuery(api.email.getAgentInbox, {});
  const reports = useQuery(api.queries.listReports, {});
  const company = useQuery(api.queries.getCompany, {});

  // default filter = the currently active scenario
  const activeScenario = company?.scenario ?? "desk";
  const [filter, setFilter] = useState<string | null>(null);
  const selected = filter ?? activeScenario;

  if (inbox === undefined || reports === undefined)
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
      </div>
    );

  // the agent's own outbound copies land in its inbox — hide them (reports
  // column already shows everything the agent sent)
  const inbound = (inbox.messages as Msg[]).filter(
    (m) => !m.from.toLowerCase().includes((inbox.inbox ?? "").toLowerCase())
  );

  const scenarioOf = (m: Msg) => m.routing?.scenario ?? "archived";
  const matches = (scenario: string | undefined) =>
    selected === "all" ? true : scenario === selected;

  const filtered = inbound.filter((m) => matches(scenarioOf(m)));
  const filteredReports = reports.filter((r: any) =>
    matches(r.scenario ?? "archived")
  );

  // tab counts (all messages, not just filtered)
  const counts: Record<string, number> = { all: inbound.length };
  for (const m of inbound) {
    const s = scenarioOf(m);
    counts[s] = (counts[s] ?? 0) + 1;
  }

  const tabs = ["all", "desk", "firecrawl", "agentmail", "archived"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-zinc-400">
          The agent's real inbox — mail is tagged by the product scenario it belongs to.
        </p>
        {inbox?.inbox && (
          <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-emerald-300">
            {inbox.inbox}
          </span>
        )}
      </div>

      {/* scenario filter */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const n = counts[t] ?? 0;
          const isSel = selected === t;
          const label = t === "all" ? "All" : (SCENARIO_LABELS[t] ?? t);
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] transition-all ${
                isSel
                  ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-200"
                  : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              {label}
              {t === activeScenario && <span className="text-[9px] text-emerald-400">●</span>}
              <span className="font-mono text-[10px] text-zinc-500">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* inbound */}
        <div>
          <SectionTitle
            right={
              <span className="font-mono text-[10px] text-zinc-600">
                {filtered.length}
                {selected === "all" ? "" : ` · ${SCENARIO_LABELS[selected] ?? selected}`}
              </span>
            }
          >
            Inbound · realtime
          </SectionTitle>
          <Card className="divide-y divide-white/[0.05]">
            {filtered.length === 0 ? (
              <EmptyState
                icon="📬"
                title="No mail for this product"
                hint="Run the scenario's email step, or pick another filter. New mail is tagged with the active product automatically."
              />
            ) : (
              filtered.map((m) => <MessageRow key={m.messageId} m={m} />)
            )}
          </Card>
        </div>

        {/* reports */}
        <div>
          <SectionTitle right={<span className="font-mono text-[10px] text-zinc-600">{filteredReports.length} sent</span>}>
            Internal reports sent
          </SectionTitle>
          <Card className="divide-y divide-white/[0.05]">
            {filteredReports.length === 0 ? (
              <EmptyState
                icon="✉️"
                title="No reports for this product"
                hint="When an issue crosses the alert threshold, the agent emails the team by itself."
              />
            ) : (
              filteredReports.map((r: any) => (
                <div key={r._id} className="animate-fade-up p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-medium leading-snug text-zinc-200">
                      {r.subject}
                    </span>
                    <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                      {r.kind}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[10.5px] text-zinc-500">
                    → {r.sentTo} · {timeAgo(r.sentAt)} ago
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-zinc-500 transition hover:text-zinc-300">
                      show report
                    </summary>
                    <pre className="mt-1.5 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/30 p-3 font-mono text-[10.5px] leading-relaxed text-zinc-400">
                      {r.bodyText}
                    </pre>
                  </details>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
