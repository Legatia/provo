# 🏛️ Provo — the intelligence desk that never forgets

> **Provo** (from *provenance*) is an autonomous intelligence desk for Base projects.
> Projects apply to be listed; the desk investigates them from public opinion
> (Farcaster, Reddit, HN), issues evidence-backed verdicts, sells **featured slots**
> (paid placement — the honest sentiment stays visible next to the slot), and sells
> **per-project intelligence to agents** via x402. Its long-term memory lives in
> **Sibyl Memory** — and it is load-bearing: wipe the working state and the desk still
> remembers which team ran the July rug.
>
> *Sibyl Labs hackathon build (Sep 1–10). Working plan: [PLAN.md](./PLAN.md).*

## The pipeline

```
APPLY      a project asks to be listed (chat / demo step)
OBSERVE    the desk monitors public opinion on it (HN free fetch; Reddit/Farcaster
           via Firecrawl when enabled)
DETECT     deterministic keyword pre-filter, then OpenAI classifies against
           the desk's risk categories (rug history, token dumps, broken claims…)
REMEMBER   every conclusion lands in Sibyl (SQLite, five tiers) — decision-time
           history comes from Sibyl recall, never from the working DB
INVESTIGATE  targeted web research with verbatim evidence when priority crosses
VERDICT    approve / flag / reject — every claim traceable to stored evidence
SELL       featured slot (x402, sentiment stays visible) · intelligence reports for agents (x402)
```

## The stack

| Tech | Role |
|---|---|
| **Convex** | The desk's workplace: operational state, deterministic orchestration, scheduled autonomy, realtime dashboard |
| **Sibyl Memory** | The desk's long-term memory (`sibyl-bridge/` FastAPI → local SQLite). Load-bearing: remove it and verdicts, recurrences, and rug checks all break |
| **Firecrawl** | Public-opinion research: search + verbatim evidence extraction, kill-switchable from the dashboard |
| **OpenAI** | Classification, clustering, historical comparison, investigation planning, report writing (strict JSON schemas) |
| **Base / x402** | Agentic payments: featured slots + intelligence reports, USDC on Base |
| AgentMail *(dormant)* | Legacy email channel from the previous build — code kept, channel dropped (crypto-native audience) |

## Memory is load-bearing (the core claim)

The desk's decisions read history from **Sibyl recall over the bridge** — never from the
working database. Verified end-to-end: seed one resolved incident into Sibyl → wipe all
Convex working state → new complaint arrives → the activity feed shows the recall call and
the memories returned → the desk links the recurrence and writes a targeted
recommendation. With memory toggled off, the same input produces generic, duplicate issues
with no historical link. Decisions differ only because memory exists.

## Running it

```bash
npm install
npx convex dev          # push functions + run the dev deployment
npm run dev             # dashboard at http://localhost:5173
```

Env vars (Convex): `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `SIBYL_BRIDGE_URL`,
`SIBYL_BRIDGE_TOKEN`. The bridge runs from [`sibyl-bridge/`](./sibyl-bridge/) — see its
README for hosting (Fly volume, or a local Mac behind a named cloudflared tunnel on demo
day).

First-time setup: dashboard → **Demo** → *Provision*, then *Seed history* (writes the
resolved incident into Sibyl), then flip **Long-term memory · Sibyl** on.

## The business

One intelligence engine, two doors:

- **Provo Monitor (primary)** — reputation & incident monitoring for onchain projects,
  as a recurring subscription. Comps: Hypernative/Forta (crypto-infra) and
  Brandwatch/Meltwater (web2). The desk watches the internet about your project,
  remembers your incident history, and warns you before sentiment becomes a bank run —
  with recurrence-aware alerts ("this looks like the Aug RPC incident") that only exist
  because the desk remembers.
- **Provo Trust API (second door)** — the dossier/odds as JSON, per-call via x402 for
  agent stacks and wallets (Blockaid/GoPlus comp): one call before your agent swaps,
  signs, or lists.

The **board** is the free trust layer and the funnel: verdicts and sentiment are public
content; **featuring slots** are what projects buy (paid placement, visible sentiment).

**Beyond web3.** The engine is domain-agnostic — the same monitor watches any entity
(a product launch, an app, a competitor, a founder) with the same memory. Web3 is the
wedge, not the boundary: it's where the data is legally open (Farcaster, public forums),
the payment rails are native (USDC/x402), and the urgency is extreme. Every monitored
entity in every domain deposits into the same compounding memory corpus — that corpus,
not the subscriptions, is the business.

## Design principles

Evidence over hallucination (every conclusion traces to stored evidence) · deterministic
orchestration (the LLM never decides control flow) · semantic state (issues and
relationships, not chat logs) · visible autonomy (the activity feed shows the desk working
in realtime) · **paid placement ≠ paid opinions** (featured slots, visible sentiment).
