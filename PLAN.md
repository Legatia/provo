# Build Plan — Customer Intelligence Manager × Sibyl Labs Hackathon

> Repo fork of the Convex All Gas submission. Convex remains the workplace (operational
> state, realtime dashboard, email plumbing); **Sibyl becomes the agent's long-term
> memory** — and every important decision must provably depend on it.

---

## 1. The challenge (what actually scores)

Source: [hack.sibyllabs.org](https://hack.sibyllabs.org/) · build window Sep 1–10 · judging Sep 11–12

- **Eligibility gate:** *"Memory must be load-bearing"* — remove the memory layer and the
  project must break. If it still works, it's a wrapper → disqualified.
- **The test:** the agent recalls persisted context **in a fresh session** and that recall
  **changes a decision, action, or result**.
- **Score:** Memory load-bearing **40** · Innovation 25 · Technical execution 20 · Pitch 15 ·
  PMF bonus +10 → 110 max. Stack multipliers: Base ×1.15, Virtuals ×1.15, both ×1.25 —
  only when judges confirm **real work** (not a token gesture).
- **Submission:** public repo (MIT/Apache-2.0) · README · 2–5 min demo featuring the
  *fresh-session recall moment* · 2 build-in-public posts.

**Strategy:** Sibyl first (it is the gate + 40 pts). Base x402 second (clean, demoable).
Virtuals ACP only if both land early. A weak ×1.25 is worth less than a strong core.

---

## 2. Foundation we already have (from the Convex build)

Working and verified end-to-end: real AgentMail inbox (webhook + poll ingest, customer vs
employee routing, threaded evidence-backed replies) · Firecrawl investigations with verbatim
evidence · OpenAI clustering / assessment / reports · realtime Convex dashboard (Overview,
Issues, Mail with scenario filters, Chat, Demo panel) · deterministic scenario runner ·
research-burst button · deployed on Vercel.

**The best existing moment becomes the centerpiece:** "this resembles the resolved August
incident — different segment" — except now that recall must come from **Sibyl**, survive a
full state wipe, and demonstrably change what the agent does.

---

## 3. Architecture

**Constraint (verified):** Sibyl Memory is a local-first **Python** SDK (`sibyl-memory-client`,
SQLite file, five tiers HOT/WARM/COLD/REFERENCE/ARCHIVE, FTS5 search). No hosted API, no npm
package. Our agent runs in Convex cloud actions — no Python, no local files. → **Bridge**.

```
Convex agent (TS, cloud) --HTTPS--> sibyl-bridge (FastAPI ~100 lines) --> sibyl-memory-client (SQLite file)
 Convex = workplace                        persistent host (choose one):      ~/.sibyl-memory data
 signals, dashboard, email                 A) Fly.io free volume (always-on)
                                           B) local Mac + cloudflared tunnel (demo day)
```

**Moves into Sibyl (the agent's knowledge — load-bearing):**
- resolved incidents + resolution notes (`WARM` entities)
- issue conclusions / historical notes / investigation findings (`COLD` journal)
- "what worked" recommendations and outcome notes (`REFERENCE`)

**Stays in Convex (operational only):** raw signals, issues surface for the dashboard,
evidence links, activity feed, chat, mail plumbing. If Sibyl disappears the dashboard still
renders — but the **agent decides wrong** (duplicate issues, generic advice, no history).

**Bridge API (auth via shared secret header):**
- `POST /save` `{tenant, category, name, text, meta}` → Sibyl entity/journal write
- `POST /recall` `{tenant, query, k}` → FTS5 results (scored, with metadata)
- `GET /health` → used by the dashboard to show "memory: Sibyl ✓" status chip

---

## 4. Work plan

### Phase 0 — Setup (today)
- [ ] Register for the hackathon (registration closes **Aug 31, 23:59 UTC**)
- [ ] `pip install sibyl-memory-client`, `sibyl init` (browser activation, wallet/email)
- [ ] Read per-package docs for exact save/recall signatures (docs.sibyllabs.org/memory)
- [ ] Decide bridge host: **Fly.io volume** (preferred) vs local+tunnel

### Phase 1 — Sibyl is load-bearing (the gate + 40 pts)
- [ ] `sibyl-bridge/` FastAPI service; curl-proof `/save` and `/recall`; deploy
- [ ] `convex/lib/sibyl.ts` HTTP client; `SIBYL_BRIDGE_URL` + `SIBYL_BRIDGE_TOKEN` env
- [ ] **Write-through:** when an issue is resolved or investigated, agent saves conclusions
      (resolution note, historical note, findings) to Sibyl
- [ ] **Read-at-decision:** `processSignal` feeds `matchSignalToIssue` from **Sibyl recall**
      (not the Convex resolved-issues query); `compareWithHistory` and `investigateIssue`
      open with a recall call; report drafting includes recalled context
- [ ] `memoryEnabled` toggle in companies + Demo panel switch (mirrors the Firecrawl toggle)
- [ ] Seed: on first run, write the resolved "checkout latency (desktop)" history into Sibyl
- [ ] **The proof flow, e2e:** Reset (Convex wiped — no historical issue anywhere) →
      new complaint arrives → agent calls recall → UI shows the recalled memories →
      agent links to the historical incident + targeted recommendation instead of a
      duplicate generic issue
- [ ] **Counterfactual flow:** `memoryEnabled=false` → same email → duplicate generic issue;
      toggle back on → correct behavior. Record both side by side for the video

### Phase 2 — Base agentic payments (×1.15)
- [ ] x402 endpoint: `GET /report/{issueId}` → HTTP 402 + USDC terms (~$0.05, Base);
      payment unlocks the full intelligence report (x402 TS SDK, Vercel function)
- [ ] Buyer script (`x402-fetch`) or wallet flow; show the Basescan tx in the demo
- [ ] Fund a demo wallet with a few dollars of Base USDC **early**
- [ ] Narrative tie-in: the agent already *pays* real money for its Firecrawl research —
      now it *earns* for its reports (two-sided agentic payments)

### Phase 3 — Virtuals ACP (×1.25 cap) — strictly stretch
- [ ] ACP seller: register "Customer Intelligence Report" service; auto-quote $0.50;
      deliver report on job fulfillment; second script-agent as buyer
- [ ] Cut without hesitation if not green by Day 2 midday

### Phase 4 — Submission
- [ ] MIT license file; README rewrite (Sibyl-first narrative + architecture diagram)
- [ ] 2–5 min video: fresh-session recall moment + counterfactual + payment tx
- [ ] 2 build-in-public posts
- [ ] Point the AgentMail webhook at THIS fork's deployment for the demo window:
      `https://determined-eagle-361.convex.site/agentmail/webhook`
      (inboxes are shared with the original submission — coordinate demo days)
- [ ] Run `setup:ensureSetup` once on this deployment before demoing

---

## 5. Demo script (2–5 min, mapped to the rubric)

1. **The product** (30s): dashboard, the agent's inbox, a real customer email arriving —
   classified, clustered, investigated. "We hired an employee who listens 24/7."
2. **Fresh session + fresh recall** (60s): hit Reset — working state wiped. New complaint
   arrives. Dashboard shows the Sibyl recall call and the memories it returned. The agent
   links the new issue to the resolved incident and recommends "check the prior fix for
   regression" — a decision it could not have made without memory. *(gate + 40 pts)*
3. **Counterfactual** (30s): memory off → duplicate generic issue; memory on → correct
   decision. "Remove the layer and it breaks — that's the point." *(gate insurance)*
4. **The agent gets paid** (45s): another wallet/agent buys the intelligence report —
   x402 USDC on Base, tx on Basescan, report unlocks. *(Base ×1.15 + PMF)*
5. **(If built)** ACP: a Virtuals agent purchases the same service agent-to-agent. *(×1.25)*
6. **Close:** "Convex is its workplace. Sibyl is its long-term memory. Base is its paycheck."

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Bridge unreachable during judging | Named tunnel or Fly volume (never an ephemeral quick-tunnel); `/health` chip on dashboard; proven before anything else |
| Sibyl API surprises (signatures differ from assumptions) | Hands-on in Phase 0 before wiring; MIT code is inspectable if docs are thin |
| Fake-memory suspicion | Bridge calls the real `sibyl-memory-client`; show the SQLite file + `sibyl status` on camera |
| x402 wallet friction | Fund wallet Day 2 AM; Base Sepolia fallback if mainnet terms are an issue |
| Shared AgentMail inboxes with the other submission | Webhook re-point only during this demo window; coordinate resets |
| Scope creep | Virtuals is cuttable; dashboard/email code stays as-is |

---

## 7. Environment facts

- This fork: Convex deployment `determined-eagle-361` (own DB), Vercel project TBD
- Original submission: `../convex` → `nautical-puma-980` → customer-intelligence-manager.vercel.app (do not touch)
- Shared AgentMail account: `customer.intelligence@`, `maria.acme@`, `dana.customer@agentmail.to` (free tier = 3 inboxes)
- Firecrawl: web research toggle + research-burst button work here too; HN monitoring is free
- `PLAN.md` (this file) is the working checklist — tick boxes as phases land
