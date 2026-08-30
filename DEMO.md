# Demo Runbook — 3-Minute Walkthrough

**Setup (before the demo starts):**
- Dashboard running: `npm run dev` → http://localhost:5173
- Provision done once: Demo panel → **Provision (setup)** (creates inboxes, company, sources)
- Reset to a clean state: Demo panel → **Reset demo data**

> Everything below runs the **real** pipeline: real emails through AgentMail, real web research through Firecrawl, real analysis through OpenAI, realtime state in Convex. No mocks.

---

## The story (what you say)

> "Companies receive customer signals everywhere — forums, reviews, email. Nobody has time to continuously connect them. We gave Acme AI an employee whose only job is to listen."

## Step 0 — The agent's memory (~15s)

Click **Load the agent's memory**.

> "Last month the agent tracked a checkout-latency incident on *desktop* — root cause was a payment-provider timeout, resolved Aug 18. It also watches two stable topics: pricing grumbles (declining) and CSV export requests. This history lives in Convex."

*(Overview shows: 0 critical · 0 emerging · 3 stable, and the memory entry in the activity feed.)*

## Step 1 — A customer email arrives (~20s)

Click **A customer email arrives**. Switch to **Overview** — the activity feed updates in realtime.

> "A real email just landed in the agent's inbox — customer.intelligence@agentmail.to. Watch the feed: it classified the email as checkout feedback, urgency 80, and opened an issue."

*(Dashboard shows, live: `📡 Detected customer signal: checkout` → `🧠 Opened new issue: Mobile Checkout Latency`.)*

## Step 2 — The public discussion ramps (~50s)

Click **Public discussion ramps up**. Stay on Overview.

> "Meanwhile, public discussions are picking up. Twenty signals arrive over the next few seconds — Reddit, HN, support threads. The agent clusters each one into the issue and recomputes the trend."

*(Recent changes flips to the issue's trend. When the priority threshold crosses, the agent starts investigating on its own:)*

> "It didn't wait for anyone — the trend crossed its priority threshold, so it's investigating: generating search queries, searching the public web, extracting evidence."

**Optional Firecrawl showcase:** in the Demo panel, hit **▶ Start research** — a bounded 2-minute live research burst. The activity feed shows sweep-by-sweep web searches on the watched product ("searched 'Firecrawl API complaints' — 4 results") with a countdown and live stats. Hit **■ Stop** whenever you've made the point.

## Step 3 — The issue matures (~30s, can overlap with step 2)

Open the issue from Recent changes.

> "Here's the conclusion. 18 mentions this week vs 3 last. Confidence 92% — driven by 25 pieces of evidence across email, public discussions, and the web. And this is the part that makes it an employee, not a dashboard: it remembered the August desktop incident and noted this one hits a *different segment* — mobile. There's a recommended action."

*(Point at: trend ↑6.0x, confidence meter, 🧠 Historical context card, evidence timeline with real URLs — Razorpay, Stripe, a Shopify community thread — recommended action.)*

> "And it reported this to the team by itself — Maria got this email." *(Mail page: the report + its body.)*

## Step 4 — Maria replies (~70s)

Click **Maria asks: "Is this only affecting mobile users?"** — a real reply on the report thread.

> "Email is two-way. Maria replies on the thread — watch the feed. The agent runs a focused investigation on the question, then answers with evidence."

*(After ~1 min, Mail page shows the agent's reply: "…primarily affecting mobile users. All recent direct user reports mention iPhone/Safari, Pixel…" )*


## Step 5 — Competitor research (~70s)

Click **Maria asks: "Are competitors seeing the same thing?"**

> "Now it does fresh web research. Its answer: no direct competitor reports, but this matches a known industry-wide pattern — citing sources like Shopify community threads and payment-provider guidance. Evidence, not vibes."

## Step 6 — Chat with the agent (live, optional)

Chat page:

- "What are customers complaining about this week?" → quantitative answer from live state
- "Which one is most urgent?" → prioritized answer
- "Email me the findings." → sends a digest

## Closing

> "It doesn't summarize what customers said. It listens 24/7 — cron jobs run the monitor cycle every 5 minutes — it investigates what changed, remembers what the company already knows, and tells the team what needs attention."

*(Point at the sidebar: Observes · Investigates · Remembers · Reports.)*

---

## Timing budget

| Segment | Active time | Processing (narrate over it) |
|---|---|---|
| Memory + email | 30s | ~20s |
| Ramp → investigation → report | 60s | ~50s (happens live on screen) |
| Maria Q1 | 15s | ~70s |
| Maria Q2 | 15s | ~70s |
| **Total wall clock** | **~2 min talking** | **~3.5 min** |

The processing gaps ARE the demo — the dashboard shows the agent working in realtime. If you need to compress: skip Step 5, or ask the questions while showing the issue page.

## Recovery / notes

- Everything is idempotent: **Reset demo data** → re-run steps in order.
- Inbound email: AgentMail webhook (primary) + 2-minute poll fallback (cron) — both feed the same handler.
- If a button errors, check Convex dashboard logs (`npx convex dashboard`).
- **Firecrawl budget:** toggle web research on/off from the **Demo panel → Web research · Firecrawl** card (live Convex state, shows remaining credits). When paused, investigations complete from stored email/discussion evidence and note the pause in their findings; free HN monitoring keeps running. Top up credits, flip the toggle, and the competitor-research step (5) shines with live web evidence again.
- The monitor cycle can also be triggered manually ("Run monitor" via chat:runMonitorNow) — deterministic keyword pre-filtering keeps noise out.
