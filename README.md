> **Note — Sibyl Labs hackathon build.** This is a fork of the Convex All Gas submission (`../convex`) retargeted for [hack.sibyllabs.org](https://hack.sibyllabs.org/): the agent's long-term memory is being migrated to Sibyl Memory (load-bearing, fresh-session recall), with Base agentic payments and Virtuals ACP as stack multipliers. The original Convex submission lives separately and is unaffected.

# 🛰️ Customer Intelligence Manager

An autonomous AI employee for the [Convex All Gas hackathon](https://convex.dev) that continuously listens to the customer's voice across the public web and the company inbox, investigates emerging issues, remembers historical context, and proactively reports what matters to the team.

> It doesn't just summarize what customers said. It listens 24/7, investigates what changed, remembers what the company already knows, and tells the team what needs attention.

## How it works

```
OBSERVE    monitored sources on demand (HN via direct free fetch; web/Reddit via
           Firecrawl when enabled) + inbound email via webhook/poll
DETECT     deterministic keyword pre-filter, then OpenAI classifies every new
           item against the company's watch rules
INVESTIGATE  when the priority threshold crosses, the agent plans targeted
           web searches (Firecrawl) and extracts verbatim evidence
REMEMBER   every signal, issue, evidence item and investigation lives in Convex —
           including resolved incidents the agent compares new issues against
PRIORITIZE deterministic scoring: frequency × growth × urgency × impact × novelty,
            scaled by evidence confidence
REPORT     internal alerts email themselves to the team via AgentMail
FOLLOW UP  employees reply on the email thread; the agent investigates the
           question and answers with evidence
```

## The stack

| Tech | Role |
|---|---|
| **Convex** | All persistent state (signals, issues, evidence, investigations, reports), scheduled autonomy, realtime reactive dashboard, http endpoints |
| **Firecrawl** | Targeted investigation searches (evidence extraction with verbatim excerpts); kill-switchable via env when budget is exhausted |
| **OpenAI** | Classification, clustering, historical comparison, prioritization inputs, investigation planning, evidence extraction, report & reply writing (JSON-schema structured outputs) |
| **AgentMail** | The agent's real business inbox (`customer.intelligence@agentmail.to`): inbound customer email → signals; employee replies → focused investigations + evidence-backed answers; outbound internal reports |

## The demo (Acme AI)

A fictional company with a pre-loaded memory: a resolved desktop checkout-latency incident (Aug 12–18, payment-provider timeout). During the demo:

1. A **real customer email** arrives → classified → issue opened
2. 20 public-discussion signals ramp in → clustered → trend ↑6×
3. The priority threshold crosses → the agent **investigates on its own** with real web research (Razorpay, Stripe, Shopify community threads as evidence)
4. It recognizes the relationship to the August incident — *different segment this time*
5. It emails an internal report to Maria
6. Maria replies twice ("mobile only?", "competitors?") → focused investigations → evidence-backed replies on the thread

See **[DEMO.md](./DEMO.md)** for the full 3-minute walkthrough with speaker notes.

## Running it

```bash
npm install
npx convex dev          # push functions + run the dev deployment
npm run dev             # dashboard at http://localhost:5173
```

Env vars (in Convex): `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET` (Svix secret from the registered webhook). Web research (Firecrawl) is toggled live from the dashboard — Demo panel → *Web research* — with the credit balance shown; the `FIRECRAWL_ENABLED` env var acts only as the fallback default.

First-time setup: open the dashboard → **Demo** → *Provision*. That creates the three real AgentMail inboxes (agent, employee, customer), the company, watch rules, and monitored sources.

**Cost control:** nothing calls Firecrawl on a schedule. The inbound-mail poll (cron, 2 min) is pure AgentMail REST; investigation searches run only when an investigation triggers (demo steps or threshold), max 2 queries each — and only when web research is toggled on in the dashboard. The **Live research burst** button (Demo panel) runs a bounded, operator-controllable 2-minute sweep that makes Firecrawl usage visible on demand; a deterministic keyword pre-filter keeps fuzzy search noise away from the LLM.

**Deployed:** dashboard on Vercel (`customer-intelligence-manager.vercel.app`) against a Convex cloud deployment; the AgentMail webhook points at the Convex `convex.site` URL.

## Architecture

```
convex/
  schema.ts           normalized model: companies, sources, watchRules, signals,
                      issues, evidence, investigations, reports, agentTasks, chat, emailRouting
  agent.ts            the loop: monitor cycle, signal clustering, investigation, reporting
  email.ts            AgentMail integration: webhook ingest → routing (customer vs employee)
  monitor.ts          polling fallback for inbound mail (cron backup for the webhook)
  state.ts            all state mutations + deterministic priority scoring
  lib/analysis.ts     every LLM interaction (strict JSON schemas)
  lib/firecrawl.ts    search/scrape + content hashing
  demo.ts             deterministic scenario steps (each runs the real pipeline)
  cron.ts             5-min monitor cycle + 2-min inbound-mail poll
src/
  pages/              Overview, Issues, IssueDetail, Mail, Chat, DemoPanel
```

**Design principles:** evidence over hallucination (every conclusion traces to stored evidence), deterministic orchestration (the LLM never decides control flow), semantic state (issues and relationships, not chat logs), and visible autonomy (the activity feed shows the agent working in realtime).
