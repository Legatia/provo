import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Intelligence Manager — core operational state.
// The agent's persistent memory: everything it has observed, concluded,
// investigated and reported lives here and drives the realtime dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export default defineSchema({
  // The company the agent works for (single-tenant for the hackathon).
  companies: defineTable({
    name: v.string(),
    product: v.string(),
    productKeywords: v.array(v.string()), // terms used to spot relevant discussions
    employeeEmail: v.optional(v.string()), // who receives internal reports
    agentInbox: v.optional(v.string()), // the agent's AgentMail address
    demoCustomerEmail: v.optional(v.string()), // demo customer's AgentMail address
    demoEmployeeName: v.optional(v.string()),
    scenario: v.optional(v.string()), // which demo scenario pack is active
    realProduct: v.optional(v.boolean()), // real product → investigations search its name
    // web research (Firecrawl) toggle — controlled from the dashboard.
    // undefined falls back to the FIRECRAWL_ENABLED env var.
    webResearchEnabled: v.optional(v.boolean()),
    webResearchCredits: v.optional(v.number()), // last known Firecrawl credit balance
    // long-term memory (Sibyl) toggle — controlled from the dashboard.
    // When on, decision-time history comes from Sibyl recall over the bridge,
    // never from Convex resolved-issues (memory is load-bearing).
    memoryEnabled: v.optional(v.boolean()),
    memoryHealth: v.optional(
      v.object({ ok: v.boolean(), detail: v.string(), checkedAt: v.number() })
    ),
    // live research burst (demo): bounded start/stop web-sweeping session
    researchSession: v.optional(
      v.object({
        running: v.boolean(),
        startedAt: v.number(),
        endsAt: v.number(),
        iterations: v.number(),
        itemsSeen: v.number(),
        signalsFound: v.number(),
      })
    ),
    // engine credits (see convex/credits.ts): topped up via x402 USDC, burned
    // by every metered engine action. undefined = never metered (lazy demo grant).
    creditBalance: v.optional(v.number()),
    createdAt: v.number(),
  }),

  // Credit ledger — every top-up and burn, with the balance after the event.
  creditLedger: defineTable({
    company: v.id("companies"),
    kind: v.string(), // "topup" | "burn"
    amount: v.number(), // signed credits (+top-up / −burn / 0 for blocked)
    action: v.optional(v.string()),
    detail: v.optional(v.string()),
    balanceAfter: v.number(),
    at: v.number(),
  }).index("by_company_time", ["company", "at"]),

  // Monitored public web sources with change detection state.
  sources: defineTable({
    name: v.string(),
    kind: v.string(), // "hn" | "reddit_search" | "web_search" | "url"
    config: v.any(), // kind-specific config (queries, urls, limits)
    company: v.optional(v.id("companies")),
    lastCheckedAt: v.optional(v.number()),
    lastContentHash: v.optional(v.string()),
    lastItemCount: v.optional(v.number()),
    enabled: v.boolean(),
  }).index("by_company", ["company"]),

  // What the company told the agent to care about.
  watchRules: defineTable({
    company: v.id("companies"),
    label: v.string(), // "product complaints", "pricing complaints", ...
    description: v.string(),
    keywords: v.array(v.string()),
    enabled: v.boolean(),
  }).index("by_company", ["company"]),

  // Raw customer observations — every potentially relevant item the agent sees.
  signals: defineTable({
    company: v.id("companies"),
    source: v.string(), // "email" | "hacker_news" | "reddit" | "web" | source name
    sourceUrl: v.optional(v.string()),
    externalId: v.optional(v.string()), // dedupe key (e.g. HN objectID, url hash)
    occurredAt: v.number(), // when the customer said it
    content: v.string(),
    author: v.optional(v.string()),
    // classification (OpenAI structured output)
    relevant: v.boolean(),
    reason: v.optional(v.string()), // why (not) relevant — agent reasoning trace
    topics: v.array(v.string()),
    sentiment: v.optional(v.string()), // positive | neutral | negative
    urgency: v.number(), // 0-100
    productArea: v.optional(v.string()), // e.g. "checkout", "mobile app"
    affectedSegment: v.optional(v.string()), // e.g. "mobile users"
    emailMessageId: v.optional(v.string()), // AgentMail message if source = email
    issue: v.optional(v.id("issues")),
    processedAt: v.number(),
  })
    .index("by_company", ["company"])
    .index("by_issue", ["issue"])
    .index("by_external", ["externalId"])
    .index("by_company_time", ["company", "occurredAt"]),

  // Normalized customer problems / themes — the agent's conclusions.
  issues: defineTable({
    company: v.id("companies"),
    title: v.string(),
    description: v.string(),
    status: v.string(), // emerging | confirmed | critical | watching | resolved
    severity: v.string(), // low | medium | high | critical
    firstDetectedAt: v.number(),
    lastDetectedAt: v.number(),
    mentionCount: v.number(),
    // trend
    mentionsThisWeek: v.number(),
    mentionsPrevWeek: v.number(),
    growthMultiplier: v.optional(v.number()), // this week / prev week
    affectedSegment: v.optional(v.string()),
    confidence: v.number(), // 0-100
    priorityScore: v.number(), // 0-100 composite
    recommendedAction: v.optional(v.string()),
    historicalNote: v.optional(v.string()), // link to prior incidents (memory)
    reasoningSummary: v.optional(v.string()), // agent's reasoning, LLM-written
    resolvedAt: v.optional(v.number()),
    resolutionNote: v.optional(v.string()),
    lastReportedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_company", ["company"])
    .index("by_company_status", ["company", "status"])
    .index("by_company_score", ["company", "priorityScore"]),

  // Every significant conclusion must be traceable.
  evidence: defineTable({
    issue: v.id("issues"),
    source: v.string(),
    url: v.optional(v.string()),
    excerpt: v.string(),
    occurredAt: v.number(),
    collectedAt: v.number(),
    relevance: v.number(), // 0-100
    kind: v.string(), // "signal" | "web" | "email" | "historical"
    signalId: v.optional(v.id("signals")),
  })
    .index("by_issue", ["issue"])
    .index("by_issue_time", ["issue", "occurredAt"]),

  // Active investigations the agent runs.
  investigations: defineTable({
    issue: v.id("issues"),
    status: v.string(), // pending | running | complete | failed
    triggeredBy: v.string(), // "cron" | "employee_reply" | "chat" | "demo" | "threshold"
    question: v.optional(v.string()), // optional focused question from an employee
    plan: v.array(v.string()), // investigation steps
    stepIndex: v.number(),
    findings: v.optional(v.string()), // LLM summary of findings
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_issue", ["issue"]),

  // Reports the agent emailed to the company.
  reports: defineTable({
    issue: v.id("issues"),
    company: v.id("companies"),
    kind: v.string(), // "alert" | "followup" | "digest"
    subject: v.string(),
    bodyText: v.string(),
    sentTo: v.string(),
    scenario: v.optional(v.string()), // which demo scenario this belongs to
    agentmailMessageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    sentAt: v.number(),
  })
    .index("by_issue", ["issue"])
    .index("by_company", ["company"]),

  // Live feed of what the agent is doing — powers the realtime activity UI.
  agentTasks: defineTable({
    company: v.optional(v.id("companies")),
    type: v.string(), // "observe" | "detect" | "investigate" | "remember" | "report" | "reply" | "chat"
    status: v.string(), // running | complete | failed
    label: v.string(), // human-readable one-liner
    detail: v.optional(v.string()),
    issue: v.optional(v.id("issues")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_started", ["startedAt"])
    .index("by_company", ["company", "startedAt"]),

  // Dashboard chat with the agent.
  chatMessages: defineTable({
    role: v.string(), // "user" | "agent"
    content: v.string(),
    // structured side-effects the chat can trigger
    triggeredInvestigation: v.optional(v.id("investigations")),
    sentReport: v.optional(v.id("reports")),
    createdAt: v.number(),
  }).index("by_time", ["createdAt"]),

  // Inbound email routing decisions (customer feedback vs employee question).
  emailRouting: defineTable({
    messageId: v.string(),
    threadId: v.string(),
    fromEmail: v.string(),
    classification: v.string(), // "customer_feedback" | "employee_question" | "other"
    scenario: v.optional(v.string()), // which demo scenario this mail belongs to
    signalId: v.optional(v.id("signals")),
    replySummary: v.optional(v.string()),
    handledAt: v.number(),
  }).index("by_message", ["messageId"]),

  // ── Provo: the project board ───────────────────────────────────────────────
  // Projects that applied to be listed. The desk investigates each applicant
  // from public opinion + Sibyl recall (rug history) and issues a verdict.
  projects: defineTable({
    name: v.string(),
    slug: v.string(),
    tagline: v.string(),
    chain: v.string(), // "base" | "ethereum" | …
    links: v.optional(
      v.object({
        site: v.optional(v.string()),
        x: v.optional(v.string()),
        docs: v.optional(v.string()),
      })
    ),
    teamNote: v.optional(v.string()), // self-declared team info from the application
    realProduct: v.optional(v.boolean()), // real project → brand-name research queries
    simulated: v.optional(v.boolean()), // demo simulation (labeled on the board)
    status: v.string(), // applied | under_review | listed | flagged | rejected
    verdict: v.optional(v.string()), // approved | flagged | rejected
    verdictSummary: v.optional(v.string()),
    sentimentScore: v.optional(v.number()), // 0-100 desk sentiment
    riskTags: v.array(v.string()),
    // top web evidence collected during the listing review
    evidence: v.optional(
      v.array(
        v.object({
          source: v.string(),
          url: v.optional(v.string()),
          excerpt: v.string(),
        })
      )
    ),
    // names of the Sibyl memories the verdict relied on (proof of recall)
    recalledMemories: v.optional(v.array(v.string())),
    featured: v.boolean(), // paid placement — sentiment stays visible regardless
    appliedAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),
});
