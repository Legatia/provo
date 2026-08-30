import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../lib/convex";

// ─────────────────────────────────────────────────────────────────────────────
// Public landing page — what Provo is, with live proof from the board.
// ─────────────────────────────────────────────────────────────────────────────

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`mx-auto w-full max-w-5xl px-6 ${className}`}>{children}</section>
  );
}

export default function Landing() {
  const projects = useQuery(api.projects.listBoard, {});
  const listed = projects?.filter((p) => p.status === "listed").length ?? 0;
  const flagged = projects?.filter((p) => p.status === "flagged").length ?? 0;
  const decided = projects?.filter((p) => p.verdict).length ?? 0;
  const spotlight = projects?.find((p) => p.featured) ?? null;
  const flaggedExample = projects?.find((p) => p.status === "flagged") ?? null;

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      {/* nav */}
      <nav className="sticky top-0 z-20 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl">
        <Section className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/80 to-violet-600/80 text-sm">
              🏛️
            </span>
            <span className="text-[14px] font-semibold tracking-tight">Provo</span>
            <span className="hidden rounded-full border border-white/[0.07] px-2 py-0.5 text-[9.5px] uppercase tracking-wider text-zinc-500 sm:inline">
              project intelligence desk
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Legatia/provo"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-3 py-1.5 text-[12px] text-zinc-400 transition hover:text-zinc-100"
            >
              GitHub
            </a>
            <Link
              to="/board"
              className="rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3.5 py-1.5 text-[12px] font-medium text-indigo-200 transition hover:bg-indigo-500/25"
            >
              Open the board →
            </Link>
          </div>
        </Section>
      </nav>

      {/* hero */}
      <Section className="pb-14 pt-20 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-1 text-[10.5px] text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> live on Base — {decided}{" "}
          verdicts{decided > 0 ? ` · ${listed} listed · ${flagged} flagged` : ""}
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-[42px] font-semibold leading-[1.08] tracking-tight md:text-[56px]">
          The desk that
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            {" "}
            never forgets
          </span>
          .
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
          Provo is an autonomous intelligence desk. Projects apply to be listed; the desk
          investigates them across public opinion, remembers every team's history, and
          issues evidence-backed verdicts — then sells attention and intelligence, never
          opinions. Built on web3, watching anything: the same engine monitors protocols,
          consumer apps, and any entity you point it at.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/board"
            className="rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-5 py-2.5 text-[13.5px] font-medium text-indigo-100 shadow-[0_0_24px_rgba(99,102,241,0.2)] transition hover:bg-indigo-500/30"
          >
            Open the project board
          </Link>
          <a
            href="https://github.com/Legatia/provo"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/[0.1] px-5 py-2.5 text-[13.5px] text-zinc-300 transition hover:border-white/25"
          >
            Read the source (MIT)
          </a>
        </div>

        {/* live spotlight */}
        {spotlight && (
          <Link
            to={`/project/${spotlight.slug}`}
            className="mx-auto mt-12 block max-w-2xl rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.08] to-violet-600/[0.05] p-5 text-left transition hover:border-indigo-500/45"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-indigo-300">
                Featured · demo placement
              </span>
              <span className="font-mono text-[10px] text-zinc-500">
                sentiment {spotlight.sentimentScore ?? "—"}/100 — visible, even when paid
              </span>
            </div>
            <div className="mt-2 text-[15px] font-semibold">{spotlight.name}</div>
            <p className="mt-1 text-[12px] text-zinc-400">{spotlight.tagline}</p>
          </Link>
        )}
      </Section>

      {/* three doors */}
      <Section className="pb-16">
        <h2 className="text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          One intelligence engine · three doors
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              t: "Board",
              s: "Free",
              d: "The public trust layer: opt-in listings, evidence-backed verdicts, dossiers with receipts. Featuring slots are the only thing for sale here — sentiment stays visible.",
              c: "text-zinc-200",
            },
            {
              t: "Monitor",
              s: "Credits · $0.01 each, via x402",
              d: "Reputation & incident watch for your project: continuous public-opinion sweeps, escalation findings, recurrence-aware alerts — alerts that remember your last incident.",
              c: "text-emerald-300",
            },
            {
              t: "Trust API",
              s: "Per-call · x402",
              d: "For agents and wallets: one call before your agent swaps, signs, or lists. Verdict, odds and the team's history — point-in-time scanners can't know who ran the rug.",
              c: "text-violet-300",
            },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="flex items-baseline justify-between">
                <h3 className={`text-[15px] font-semibold ${x.c}`}>{x.t}</h3>
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">
                  {x.s}
                </span>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-zinc-400">{x.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* how it works */}
      <Section className="pb-16">
        <h2 className="text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          How a listing gets decided
        </h2>
        <div className="mt-8 grid gap-3 md:grid-cols-5">
          {[
            ["Apply", "a project asks to be listed"],
            ["Watch", "the desk reads the public internet"],
            ["Remember", "history comes from Sibyl — not from a cache"],
            ["Verdict", "approve, flag, reject — with receipts"],
            ["Sell", "attention & intelligence, never opinions"],
          ].map(([t, d], i) => (
            <div key={t} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="font-mono text-[10px] text-indigo-400">0{i + 1}</div>
              <div className="mt-1.5 text-[13px] font-semibold">{t}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* the memory moment */}
      <Section className="pb-16">
        <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/[0.07] to-indigo-600/[0.04] p-8">
          <h2 className="text-center text-[20px] font-semibold tracking-tight">
            Why memory is the product
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[13px] leading-relaxed text-zinc-400">
            Point-in-time scanners check contracts. Dashboards show this month's mentions.
            Neither can tell you that the team applying for listing today{" "}
            <span className="text-zinc-200">ran the project that rugged in July</span>.
            Provo's verdicts read a Sibyl memory ledger that survives full state wipes —
            wipe the database, and the desk still knows.
          </p>
          {flaggedExample && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300">
                  ⚠ flagged on the live board
                </span>
                <span className="font-mono text-[9.5px] uppercase text-zinc-500">
                  {flaggedExample.simulated ? "simulation · demo construct" : "live verdict"}
                </span>
              </div>
              <div className="mt-2 text-[13.5px] font-semibold">{flaggedExample.name}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-400">
                {flaggedExample.verdictSummary}
              </p>
              <Link
                to={`/project/${flaggedExample.slug}`}
                className="mt-2 inline-block font-mono text-[10.5px] text-amber-300/80 hover:text-amber-200"
              >
                open the dossier → the receipts are attached
              </Link>
            </div>
          )}
        </div>
      </Section>

      {/* meter */}
      <Section className="pb-20">
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8">
          <h2 className="text-center text-[16px] font-semibold">Metered, not gated</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[12px] leading-relaxed text-zinc-500">
            Monitor and the Trust API run on engine credits, topped up in USDC on Base via
            x402. Every action burns visibly; out of credits the desk pauses honestly.
          </p>
          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["source sweep", "1"],
              ["signal", "0.1"],
              ["deep dig", "5"],
              ["desk review", "10"],
              ["alert", "1"],
            ].map(([a, c]) => (
              <div key={a} className="rounded-xl border border-white/[0.06] p-3 text-center">
                <div className="font-mono text-[15px] font-semibold text-zinc-200">{c}</div>
                <div className="mt-0.5 text-[10px] text-zinc-500">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* footer */}
      <footer className="border-t border-white/[0.06] py-10">
        <Section className="flex flex-wrap items-center justify-between gap-4 text-[11px] text-zinc-600">
          <div>
            <span className="font-semibold text-zinc-400">Provo</span> — every project has a
            past. Built for the Sibyl Labs hackathon (Sep 2026).
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["convex", "sibyl memory", "firecrawl", "openai", "base · x402"].map((s) => (
              <span
                key={s}
                className="rounded-full border border-white/[0.07] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider"
              >
                {s}
              </span>
            ))}
            <a
              href="https://github.com/Legatia/provo"
              className="rounded-full border border-white/[0.07] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider hover:text-zinc-400"
            >
              MIT · github
            </a>
          </div>
        </Section>
      </footer>
    </div>
  );
}
