import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../lib/convex";

// ─────────────────────────────────────────────────────────────────────────────
// Public landing — the bureau front page. Masthead, ledger rules, stamps.
// ─────────────────────────────────────────────────────────────────────────────

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`mx-auto w-full max-w-5xl px-6 ${className}`}>{children}</section>
  );
}

const RISE = (ms: number) => ({ animationDelay: `${ms}ms` }) as React.CSSProperties;

export default function Landing() {
  const projects = useQuery(api.projects.listBoard, {});
  const listed = projects?.filter((p) => p.status === "listed").length ?? 0;
  const flagged = projects?.filter((p) => p.status === "flagged").length ?? 0;
  const decided = projects?.filter((p) => p.verdict).length ?? 0;
  const spotlight = projects?.find((p) => p.featured) ?? null;
  const flaggedExample = projects?.find((p) => p.status === "flagged") ?? null;

  return (
    <div className="min-h-full bg-ink text-paper">
      {/* masthead bar */}
      <div className="border-b border-rule">
        <Section className="flex h-9 items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.22em] text-paper-dim">
          <span>Onchain intelligence bureau</span>
          <span className="hidden sm:inline">Est. 2026 · Base</span>
          <span className="flex items-center gap-1.5 text-verdigris">
            <span className="h-1 w-1 rounded-full bg-verdigris" /> desk on duty
          </span>
        </Section>
      </div>

      {/* nav */}
      <nav className="sticky top-0 z-20 border-b border-rule bg-ink/85 backdrop-blur-xl">
        <Section className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center border border-brass/50 font-display text-[17px] font-semibold italic text-brass-bright">
              P
            </span>
            <span className="font-display text-[19px] font-semibold tracking-tight">Provo</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Legatia/provo"
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-3 py-1.5 font-mono text-[11px] text-paper-dim transition hover:text-paper"
            >
              GitHub
            </a>
            <Link
              to="/board"
              className="rounded-md border border-brass/40 bg-brass/10 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-brass-bright transition hover:bg-brass/20"
            >
              Open the board →
            </Link>
          </div>
        </Section>
      </nav>

      {/* hero */}
      <Section className="pb-16 pt-20 text-center">
        <div className="rise" style={RISE(0)}>
          <div className="ledger-rule" />
          <div className="mt-3 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.22em] text-paper-dim">
            <span>Vol. I — the record</span>
            <span>
              {decided} verdicts{decided > 0 ? ` · ${listed} listed · ${flagged} flagged` : ""}
            </span>
          </div>
        </div>

        <h1
          className="rise mx-auto mt-10 max-w-3xl font-display text-[46px] font-medium leading-[1.04] tracking-tight md:text-[64px]"
          style={RISE(90)}
        >
          The desk that
          <span className="text-brass-bright"> never forgets</span>.
        </h1>

        <p
          className="rise mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-paper-dim"
          style={RISE(180)}
        >
          Provo is an autonomous intelligence desk. Projects apply to be listed; the desk
          investigates them across public opinion, remembers every team's history, and
          issues evidence-backed verdicts — then sells attention and intelligence, never
          opinions. Built on web3, watching anything: the same engine monitors protocols,
          consumer apps, and any entity you point it at.
        </p>

        <div className="rise mt-9 flex flex-wrap items-center justify-center gap-3" style={RISE(260)}>
          <Link
            to="/board"
            className="rounded-md border border-brass/50 bg-brass/15 px-6 py-2.5 font-mono text-[12px] uppercase tracking-wider text-brass-bright shadow-[0_0_28px_rgba(201,162,75,0.15)] transition hover:bg-brass/25"
          >
            Open the project board
          </Link>
          <a
            href="https://github.com/Legatia/provo"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-rule-strong px-6 py-2.5 font-mono text-[12px] uppercase tracking-wider text-paper-dim transition hover:border-paper/30 hover:text-paper"
          >
            Read the source · MIT
          </a>
        </div>

        {/* live spotlight — the paid slot, honest numbers beside it */}
        {spotlight && (
          <Link
            to={`/project/${spotlight.slug}`}
            className="rise mx-auto mt-14 block max-w-2xl border border-rule-strong bg-ink-raised p-5 text-left transition hover:border-brass/40"
            style={RISE(340)}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="stamp border-brass/40 bg-brass/10 text-brass-bright">
                Featured · demo placement
              </span>
              <span className="font-mono text-[9.5px] text-paper-dim">
                sentiment {spotlight.sentimentScore ?? "—"}/100 — visible even when paid
              </span>
            </div>
            <div className="mt-3 font-display text-[19px] font-semibold">{spotlight.name}</div>
            <p className="mt-1 text-[12px] text-paper-dim">{spotlight.tagline}</p>
          </Link>
        )}
      </Section>

      {/* three doors */}
      <Section className="pb-16">
        <div className="ledger-rule" />
        <h2 className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-paper-dim">
          One intelligence engine · three doors
        </h2>
        <div className="mt-8 grid gap-px border border-rule bg-rule md:grid-cols-3">
          {[
            {
              n: "№ 01",
              t: "Board",
              s: "free",
              d: "The public trust layer: opt-in listings, evidence-backed verdicts, dossiers with receipts. Featuring slots are the only thing for sale here — sentiment stays visible.",
              c: "text-paper",
            },
            {
              n: "№ 02",
              t: "Monitor",
              s: "credits · $0.01 · x402",
              d: "Reputation & incident watch for your project: continuous public-opinion sweeps, escalation findings, recurrence-aware alerts — alerts that remember your last incident.",
              c: "text-verdigris",
            },
            {
              n: "№ 03",
              t: "Trust API",
              s: "per-call · $0.05 · x402",
              d: "For agents and wallets: one call before your agent swaps, signs, or lists. Verdict, odds and the team's history — point-in-time scanners can't know who ran the rug.",
              c: "text-brass-bright",
            },
          ].map((x) => (
            <div key={x.t} className="bg-ink p-6 transition hover:bg-ink-raised">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10px] text-brass">{x.n}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-dim">
                  {x.s}
                </span>
              </div>
              <h3 className={`mt-3 font-display text-[20px] font-semibold ${x.c}`}>{x.t}</h3>
              <p className="mt-2.5 text-[12px] leading-relaxed text-paper-dim">{x.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* how it works — ledger row */}
      <Section className="pb-16">
        <div className="ledger-rule" />
        <h2 className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-paper-dim">
          How a listing gets decided
        </h2>
        <div className="mt-8 grid gap-px border border-rule bg-rule md:grid-cols-5">
          {[
            ["01", "Apply", "a project asks to be listed"],
            ["02", "Watch", "the desk reads the public internet"],
            ["03", "Remember", "history from Sibyl — not a cache"],
            ["04", "Verdict", "approve, flag, reject — with receipts"],
            ["05", "Sell", "attention & intelligence, never opinions"],
          ].map(([n, t, d]) => (
            <div key={t} className="bg-ink p-4">
              <div className="font-mono text-[10px] text-brass">{n}</div>
              <div className="mt-1.5 font-display text-[15px] font-semibold">{t}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-paper-dim">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* the memory moment */}
      <Section className="pb-16">
        <div className="border border-rule bg-ink-raised p-8 md:p-10">
          <h2 className="text-center font-display text-[24px] font-semibold tracking-tight">
            Why memory is the product
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] leading-relaxed text-paper-dim">
            Point-in-time scanners check contracts. Dashboards show this month's mentions.
            Neither can tell you that the team applying for listing today{" "}
            <span className="text-paper">ran the project that rugged in July</span>. Provo's
            verdicts read a Sibyl memory ledger that survives full state wipes — wipe the
            database, and the desk still knows.
          </p>
          {flaggedExample && (
            <div className="mx-auto mt-7 max-w-2xl border border-amber-flag/30 bg-amber-flag/[0.05] p-5 text-left">
              <div className="flex items-center justify-between">
                <span className="stamp-in stamp border-amber-flag/50 bg-amber-flag/10 text-amber-flag">
                  ⚠ flagged on the live board
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-paper-dim">
                  {flaggedExample.simulated ? "simulation · demo construct" : "live verdict"}
                </span>
              </div>
              <div className="mt-3 font-display text-[17px] font-semibold">
                {flaggedExample.name}
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-paper-dim">
                {flaggedExample.verdictSummary}
              </p>
              <Link
                to={`/project/${flaggedExample.slug}`}
                className="mt-2.5 inline-block font-mono text-[10.5px] text-amber-flag/90 hover:text-amber-flag"
              >
                open the dossier → the receipts are attached
              </Link>
            </div>
          )}
        </div>
      </Section>

      {/* the meter */}
      <Section className="pb-20">
        <div className="border border-rule bg-ink-raised p-8">
          <h2 className="text-center font-display text-[19px] font-semibold">
            Metered, not gated
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[12px] leading-relaxed text-paper-dim">
            Monitor and the Trust API run on engine credits, topped up in USDC on Base via
            x402. Every action burns visibly; out of credits the desk pauses honestly.
          </p>
          <div className="mx-auto mt-7 grid max-w-2xl grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-5">
            {[
              ["source sweep", "1"],
              ["signal", "0.1"],
              ["deep dig", "5"],
              ["desk review", "10"],
              ["alert", "1"],
            ].map(([a, c]) => (
              <div key={a} className="bg-ink p-3.5 text-center">
                <div className="font-mono text-[16px] font-semibold text-brass-bright">{c}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-dim">
                  {a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* footer */}
      <footer className="border-t border-rule py-10">
        <Section className="flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] text-paper-dim">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center border border-rule-strong font-display text-[13px] italic text-brass">
              P
            </span>
            <span>
              <span className="text-paper">Provo</span> — every project has a past. Built for
              the Sibyl Labs hackathon (Sep 2026).
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["convex", "sibyl memory", "firecrawl", "openai", "base · x402"].map((s) => (
              <span
                key={s}
                className="rounded-sm border border-rule px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]"
              >
                {s}
              </span>
            ))}
            <a
              href="https://github.com/Legatia/provo"
              className="rounded-sm border border-rule px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] hover:text-paper"
            >
              MIT · github
            </a>
          </div>
        </Section>
      </footer>
    </div>
  );
}
