# Build Plan — Provo × Sibyl Labs Hackathon

> **Pivot decided Aug 30.** The product is **Provo** (from *provenance*) — no longer an
> internal customer-intelligence tool. Provo is an **intelligence desk for Base
> projects**: projects *apply* to be listed, the desk investigates them from public
> opinion (Firecrawl: Farcaster / Reddit / HN), issues evidence-backed verdicts, sells
> **featuring slots** (paid placement — the honest sentiment stays visible next to the
> paid slot), and sells **per-project intelligence to agents** via x402. Sibyl Memory is
> the desk's brain: verdicts, featuring decisions, and sold reports all depend on
> recalled history (rug history, prior incidents, astroturf patterns). Tagline:
> *"Every project has a past — Provo keeps the record."* Demo close: *"Provo never
> forgets a rug."*

> **Business line locked Aug 30 (evening).** Primary revenue: **Provo Monitor** —
> reputation & incident monitoring sold to projects as a recurring B2B subscription
> (comps: Hypernative × Forta on crypto-infra, Brandwatch/Meltwater on the web2 side).
> The desk's engine already *is* this product; the monitored project (ZephyrSwap) is the
> demo customer, and its Engine + Findings views are the paying customer's screens.
> The board is the trust layer and funnel (free verdicts + featuring budget), and the
> agent-facing Trust API (dossier/odds as JSON, per-call x402 — Blockaid/GoPlus comp) is
> the second door, roadmap-level for this window. Rejected: prediction market,
> generic web-data API (both fail the memory gate or the differentiation test).

> **Billing model locked Aug 31.** Everything is metered through **engine credits**:
> customers top up USDC via x402 and every engine action burns credits visibly —
> sweep 1 · signal 0.1 · investigation 5 · desk review 10 · alert 1 (featuring is a
> flat fee). Tiers (Watch / Dig / Deep) price the three axes: entities × time × depth.
> Positioning: the engine is domain-agnostic — "monitor anything that matters, for
> anyone who runs an agent" — but the hackathon demo stays crypto-native and
> single-entity; multi-entity monitoring is post-window work. Virtuals story (stretch):
> Virtuals-ecosystem agents buy Provo credits / risk checks via ACP — machine customer
> pays machine vendor.
>
> **Wedge → expand:** web3 first (open data, native rails, extreme urgency), then the
> same engine horizontalizes to any monitored entity — startups watching launches, app
> developers watching review spikes, agencies reselling multi-brand monitoring (plain
> $ subscriptions by then; x402 stays the agent rail). The compounding memory corpus —
> not the subscriptions — is the asset.

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

**Strategy:** Sibyl first (gate + 40 pts). Base x402 second (two payment surfaces from one
rail). Virtuals ACP only if both land early — cut without hesitation by **Sep 8 midday**.
**No real paying users are required by the rubric** — demonstrated purchases (own funded
wallet, Basescan tx) are the evidence standard.

---

## 2. Decision log

| Decision | Rationale |
|---|---|
| Pivot from internal tool → Base project intelligence desk | Commercial rails (x402 featuring + data API) only make product sense with external buyers; crypto-native story makes the Base multiplier native |
| **Opt-in listings, never "all of Base"** | No canonical registry exists; a thin directory reads as vaporware. Applicants bring their own links and trigger the investigation loop |
| **Featuring = paid placement, sentiment stays visible** | Editorial/sponsored separation. A shit project can pay for the top slot and the desk still shows its 12/100 sentiment + rug flag — integrity beat, not pay-to-win |
| **AgentMail dropped** | Crypto/agent-native audience doesn't do email; its rubric value was modest. The interactive follow-up beat moves to dashboard chat (+ ACP messages if built). Email code stays dormant, not deleted |
| **Virtuals ACP = stretch, cut Sep 8 midday** | Same narrative beat as x402 at higher friction; adds nothing to memory |
| Sourcing scope: Farcaster (open API, native) + Reddit/HN (working) — **not X/Telegram** | Walled gardens; scope the pitch to what's covered |
| Memory fail-closed | If the bridge is down with memory on, decisions proceed **without** history (visible failed task) — never silently fall back to Convex, or the gate dies |
| **Metered engine credits (Aug 31)** | Projects × time × depth priced as burnable credits; x402 USDC top-up; live burn in the activity feed. Gives x402 a real job: substrate for Monitor, Trust API, and featuring |
| **"For everyone with an agent" = shipped scoped (Aug 31)** | Engine is multi-entity now: it sweeps every monitored entity per cycle, metered per entity (entities is a pricing axis). Live proof: ZephyrSwap (web3) + Lumen Notes (consumer app, simulated) — same pipeline, same credits. Full multi-tenant billing/accounts post-window |
| **Virtuals = agents as customers (Aug 31)** | ACP adapter sells credits / risk checks to Virtuals-ecosystem agents. Still stretch, still cut line — buildable only after credits + x402 exist |

---

## 3. Foundation we keep

Working and verified end-to-end from the Convex build: Firecrawl investigations with
verbatim evidence · OpenAI classification/clustering/assessment/reports (strict JSON) ·
realtime Convex dashboard (Overview, Issues, Chat, Demo panel) · deterministic scenario
runner · research-burst button · deterministic priority scoring · deployed on Vercel +
Convex cloud.

**What moves into Sibyl (the desk's knowledge — load-bearing):** resolved incidents +
resolution notes (`WARM` entities `resolved_incident/*`), issue conclusions and
investigation findings (`WARM` entities `issue_conclusion/*` + `COLD` journal events),
"what worked" notes (`REFERENCE` docs).

**What stays in Convex (operational only):** raw signals, issues/issues surface for the
dashboard, evidence links, activity feed, chat, sources. If Sibyl disappears the dashboard
still renders — but the **desk decides wrong** (approves rebranded rugs, generic verdicts,
no history).

---

## 4. Architecture

**Constraint (verified against the shipped SDK, v0.7.0):** Sibyl Memory is a local-first
**Python** SDK (`sibyl-memory-client`, SQLite at `~/.sibyl-memory/`, five tiers
HOT/WARM/COLD/REFERENCE/ARCHIVE, FTS5 cross-tier `search()`, real multi-tenancy via
`tenant_id`). No hosted API, no npm package. Our agent runs in Convex cloud actions →
**bridge**.

```
Convex agent (TS, cloud) --HTTPS--> sibyl-bridge (FastAPI, sibyl-bridge/) --> sibyl-memory-client (SQLite)
 Convex = workplace                        persistent host (choose one):
 signals, dashboard, listings              A) Fly.io free volume (always-on)
                                           B) local Mac + cloudflared named tunnel (demo day)
```

**Bridge API (auth: `Authorization: Bearer $SIBYL_BRIDGE_TOKEN`), implemented in `sibyl-bridge/`:**
- `POST /save` `{tenant?, kind: "entity"|"event"|"reference", category, name, text, body?, meta?, status?}`
  → `set_entity` / `write_event(acted=[...], extra=...)` / `set_reference`
- `POST /recall` `{tenant?, query, k}` → cross-tier `search()`, normalized to
  `{kind, category?, name, text, ts}` rows
- `GET /health` → `{ok, db, tenant, tier, schema_version}` — feeds the dashboard memory chip

**SDK surface in use (verified from source):** `MemoryClient.local(path, {tenant_id})`,
`set_entity(category, name, body, {status})`, `write_event({acted, extra})`,
`set_reference(key, body)`, `search(query, {limit})`.

---

## 5. Work plan

### Phase 0 — Setup (Aug 30–31) — registration closes **Aug 31, 23:59 UTC**
- [ ] **Register for the hackathon** (user action, do today)
- [ ] `pip install 'sibyl-memory-cli[mcp]'` · `sibyl init` (browser activation — user action)
- [ ] `pip install -r sibyl-bridge/requirements.txt`; run the bridge locally; curl-proof
      `/save`, `/recall`, `/health`
- [ ] Set Convex env: `SIBYL_BRIDGE_URL`, `SIBYL_BRIDGE_TOKEN`
- [ ] Decide bridge host: **Fly.io volume** (preferred) vs local Mac + named cloudflared tunnel

### Phase 1 — Sibyl is load-bearing (the gate + 40 pts) — Sep 1–2
- [x] `sibyl-bridge/` FastAPI service (`/save`, `/recall`, `/health`, token auth) — written
- [x] `convex/lib/sibyl.ts` HTTP client (`SIBYL_BRIDGE_URL` + `SIBYL_BRIDGE_TOKEN`)
- [x] `memoryEnabled` toggle in companies + Demo panel switch + bridge health chip
      (mirrors the Firecrawl toggle pattern)
- [x] **Read-at-decision:** `processSignal` and `investigateIssue` source resolved-issue
      history from **Sibyl recall** when memory is on (Convex read only when memory is
      off — the old path is gated, not deleted)
- [x] **Write-through:** completed investigations save an `issue_conclusion` entity +
      `COLD` journal event; seeded resolutions save `resolved_incident` entities
- [x] `convex/memory.ts`: bridge health check, `seedResolvedHistory` (idempotent)
- [ ] Wire `seedHistory` demo step + first-run setup to call `seedResolvedHistory`
- [ ] **The proof flow, e2e:** Reset (Convex wiped) → new complaint arrives → activity feed
      shows the Sibyl recall call + returned memories → desk links to the historical
      incident + targeted recommendation instead of a duplicate generic issue
- [ ] **Counterfactual flow:** `memoryEnabled=false` → same input → duplicate generic issue;
      toggle back on → correct behavior. Record both side by side for the video
- [ ] Deploy bridge (Fly volume or tunnel); verify from Convex prod actions

### Phase 2 — Credits, money, Monitor productization — Sep 3–5
- [x] **Board UI live:** public project board (landing page) with featured slot
      (paid-placement label, sentiment visible), applicant cards, dossiers showing
      verdict + recalled memories + evidence
- [x] **Listing application flow:** applied → desk review (Sibyl recall + Firecrawl +
      verdict LLM) → listed/flagged/rejected; write-through of verdicts to Sibyl;
      demo seed: 5 real Base applicants (Aerodrome/Uniswap/Aave/Moonwell/BaseSwap,
      reviewed by the real pipeline — Moonwell flagged on evidence) + 2 labeled
      simulations; Zenith flagged citing the Aurum wallet match
- [x] **Monitor customer surface:** "Provo Monitor · active" card on the monitored
      project's page — Engine + Findings tabs are the paying customer's screens
- [x] **Credits ledger (the substrate):** burn table (sweep 1 · signal 0.1 ·
      investigation 5 · desk review 10 · alert 1) hooked into the monitor /
      investigate / review actions; live balance + burn history on the Monitor card
      and in the activity feed. *Live and verified: sweep burned −1 (balance 1000→999).
      The alert burn arrives with alert delivery.*
- [x] **x402 top-up:** `GET /api/credits?credits=N` → 402 + USDC terms on Base →
      settle → credits minted (facilitator path wired; dev-settlement for demos).
      *Live: 402 terms verified at $0.01/credit, dev settle minted +100 (balance 1099).
      Buyer script: scripts/x402-buy.mjs. Fund the demo wallet with a few dollars of
      Base USDC before filming.*
- [x] **Alert delivery:** finding/verdict events → webhook (+ Farcaster DM once Phase 3
      lands); recurrence-aware alert copy ("looks like the Aug RPC incident") — Sibyl
      recall is what makes alerts smart (load-bearing, demo it). *Live: verdict alert
      fired with memory-recurrence line, −1 credit; set ALERT_WEBHOOK_URL or
      companies.alertWebhook to deliver externally.*
- [x] **Featuring:** x402 `GET /api/feature?slug=...` → 402 + USDC terms ($1/7 days) →
      slot rotates (one slot), sentiment + verdict **stay visible** beside it.
      *Live: verified — Aave bought the slot; approved/92 stays beside the paid badge.
      Label on the board says "Featured · demo placement" until a real wallet pays.*
- [x] (done, near-free) **Trust API:** `GET /api/trust?slug=...` — full dossier as JSON
      behind x402 ($0.05/call) — the second door (Blockaid/GoPlus comp); shares the
      x402 guard with the credits door. *Live: 402 terms + settled dossier verified.*

### Phase 3 — Sources + narrative — Sep 6–7
- [x] Farcaster ingestion as a first-class source kind (`farcaster_search` via
      Firecrawl site-search — no extra key) wired into both monitored entities.
      X stays roadmap, licensed access only
- [x] Disable inbound-mail poll cron + webhook route (email teardown done Aug 31; code dormant)
- [x] Provo rebrand in demo *content*: monitored project (ZephyrSwap) replaced Acme,
      watch rules are listing-risk categories, scenario packs + prompts re-voiced
- [ ] Memory story polish: rug-history recall, astroturf-pattern note in reports/alerts

### Phase 4 — Virtuals ACP (×1.25 cap) — strictly stretch, **cut Sep 8 midday**
- [ ] The story is now coherent: **Virtuals-ecosystem agents are Monitor's machine
      customers** — an agent tops up credits / buys a risk check through ACP
      (machine customer pays machine vendor, on Virtuals' rails)
- [ ] ACP adapter on top of the credits rail: register service, auto-quote, fulfill,
      second script-agent as buyer. Only buildable after the credits ledger and x402
      top-up land; cut without hesitation if the cutoff arrives first

### Phase 5 — Submission — Sep 9–10
- [ ] MIT license; README rewrite (Desk-first narrative + architecture diagram)
- [ ] 2–5 min video: fresh-session rug recall + counterfactual + featuring integrity beat +
      Basescan tx
- [ ] 2 build-in-public posts
- [ ] `setup:ensureSetup` + `seedResolvedHistory` on the demo deployment before demoing

---

## 6. Demo script (2–5 min, mapped to the rubric)

1. **The product** (30s): dashboard, the desk monitoring a Base project's public opinion;
   a listing application arrives → investigation → verdict. "We run the desk that vets
   Base projects — and it never forgets."
2. **Fresh session + fresh recall** (60s): hit Reset — working state wiped. The rebranded
   team applies for listing. Activity feed shows the Sibyl recall call and the returned
   memories. The desk flags the application: *"this team ran the project that rugged in
   July."* A decision it could not have made without memory. *(gate + 40 pts)*
3. **Counterfactual** (30s): memory off → same application approved clean; memory on →
   flagged. "Remove the layer and it breaks — that's the point." *(gate insurance)*
4. **Money** (45s): top up monitor credits via x402 (Basescan tx) → run a dig → the
   activity feed burns credits live; the shit project pays for the top slot and the desk
   still shows its terrible sentiment beside the paid placement. *(Base ×1.15 + PMF)*
5. **(If built)** ACP: a Virtuals agent tops up credits / buys a risk check
   agent-to-agent. *(×1.25)*
6. **Close:** "Convex is the desk's workplace. Sibyl is its memory. Base is its register."

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Bridge unreachable during judging | **Still the #1 risk until deployed:** fly.toml + Dockerfile ready in sibyl-bridge/ (one-time: `fly launch && fly volumes create sibyl_data && fly secrets set … && fly deploy`, then update SIBYL_BRIDGE_URL). Never rely on the ephemeral quick-tunnel; health chip on dashboard; fail-closed is the design |
| Sibyl API drift | Signatures verified against the shipped 0.7.0 wheel; SDK calls isolated in `sibyl-bridge/sibyl_adapter.py` |
| Fake-memory suspicion | Bridge calls the real `sibyl-memory-client`; show the SQLite file + `sibyl status` on camera |
| Directory looks thin | Pitch opt-in listings, never "all of Base"; ~10 seeded applicants |
| Featurer/verdict conflict question | The integrity beat *is* the answer: paid placement, visible sentiment, receipts on screen |
| Sourcing gap (no X/Telegram) | Farcaster native + Reddit/HN; scope the pitch to covered sources |
| x402 wallet friction | Facilitator path now conforms to official /verify+isValid (untested against live facilitator — fund wallet and test Sep 3); dev-settlement (X402_DEV_SETTLE=1) currently ON for demos — anyone with a "dev-" header can mint; acceptable for the window, remove for production |
| Featuring integrity question | Answered by design and by the live board: slot sold, verdict + sentiment stay beside it |
| Judge-poking the payment rail (Aug 31 audit) | dev settlement now requires the exact `dev-<DEMO_KEY>` header; demo top-up moved behind key-gated `/api/credits/demo`; `credits.grant` removed from the public API; facilitator path refuses the burn-address placeholder until a real wallet is set |
| Cross-entity data bleed (Aug 31 audit) | fixed: Engine/Findings queries are entity-scoped — Lumen's tabs show Lumen's data |
| Destructive demo ops (Aug 31 audit) | `resetDemo`/`reseedBoard` require the demo key; /mail route removed; legacy email steps relabeled in the demo panel |
| Scope creep | Cut line: multi-entity monitoring + Trust API UI (post-window); ACP cuttable; email already dropped |

---

## 8. Environment facts

- This fork: Convex deployment `determined-eagle-361` (own DB), Vercel project TBD
- Original submission: `../convex` → `nautical-puma-980` → customer-intelligence-manager.vercel.app (do not touch)
- **AgentMail no longer needed here** — inboxes stay with the original submission; no webhook repoint
- Firecrawl: web research toggle + research-burst button work here; HN monitoring is free
- Convex env vars: `OPENAI_API_KEY`, `FIRECRAWL_API_KEY` (existing) + `SIBYL_BRIDGE_URL`,
  `SIBYL_BRIDGE_TOKEN` (new)
- `PLAN.md` (this file) is the working checklist — tick boxes as phases land
