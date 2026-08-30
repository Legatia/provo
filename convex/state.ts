import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DAY_MS, WEEK_MS, clamp, now } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// Internal state mutations — the only writers of agent state. Called from
// agent actions so every state change is recorded in one place.
// ─────────────────────────────────────────────────────────────────────────────

/** Insert a classified signal. Returns null if externalId already seen. */
export const insertSignal = internalMutation({
  args: {
    company: v.id("companies"),
    source: v.string(),
    sourceUrl: v.optional(v.string()),
    externalId: v.optional(v.string()),
    occurredAt: v.number(),
    content: v.string(),
    author: v.optional(v.string()),
    relevant: v.boolean(),
    reason: v.optional(v.string()),
    topics: v.array(v.string()),
    sentiment: v.optional(v.string()),
    urgency: v.number(),
    productArea: v.optional(v.string()),
    affectedSegment: v.optional(v.string()),
    emailMessageId: v.optional(v.string()),
    emailThread: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.externalId) {
      const existing = await ctx.db
        .query("signals")
        .withIndex("by_external", (q) => q.eq("externalId", args.externalId))
        .first();
      if (existing) return null;
    }
    const { emailThread, ...rest } = args;
    return await ctx.db.insert("signals", { ...rest, processedAt: now() });
  },
});

/** Link a signal to an issue (after clustering). */
export const linkSignalToIssue = internalMutation({
  args: { signalId: v.id("signals"), issue: v.id("issues") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.signalId, { issue: args.issue });
  },
});

/** Create a new issue from a clustered signal. */
export const createIssue = internalMutation({
  args: {
    company: v.id("companies"),
    title: v.string(),
    description: v.string(),
    severity: v.string(),
    affectedSegment: v.optional(v.string()),
    detectedAt: v.number(),
    historicalNote: v.optional(v.string()),
    status: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    resolutionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("issues", {
      company: args.company,
      title: args.title,
      description: args.description,
      status: args.status ?? "emerging",
      severity: args.severity,
      firstDetectedAt: args.detectedAt,
      lastDetectedAt: args.detectedAt,
      mentionCount: 0,
      mentionsThisWeek: 0,
      mentionsPrevWeek: 0,
      confidence: 30,
      priorityScore: 0,
      affectedSegment: args.affectedSegment,
      historicalNote: args.historicalNote,
      resolvedAt: args.resolvedAt,
      resolutionNote: args.resolutionNote,
      updatedAt: now(),
    });
  },
});

/** Patch an issue (any subset of agent-updatable fields). */
export const patchIssue = internalMutation({
  args: {
    issue: v.id("issues"),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.issue, { ...args.patch, updatedAt: now() });
  },
});

/** Add evidence linked to an issue. */
export const addEvidence = internalMutation({
  args: {
    issue: v.id("issues"),
    source: v.string(),
    url: v.optional(v.string()),
    excerpt: v.string(),
    occurredAt: v.number(),
    relevance: v.number(),
    kind: v.string(),
    signalId: v.optional(v.id("signals")),
  },
  handler: async (ctx, args) => {
    // dedupe evidence by URL per issue for web evidence
    if (args.url) {
      const existing = await ctx.db
        .query("evidence")
        .withIndex("by_issue", (q: any) => q.eq("issue", args.issue))
        .filter((q: any) => q.eq(q.field("url"), args.url))
        .first();
      if (existing) return null;
    }
    return await ctx.db.insert("evidence", { ...args, collectedAt: now() });
  },
});

/** Log an agent activity entry (powers the realtime activity feed). */
export const logTask = internalMutation({
  args: {
    company: v.optional(v.id("companies")),
    type: v.string(),
    status: v.string(),
    label: v.string(),
    detail: v.optional(v.string()),
    issue: v.optional(v.id("issues")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("agentTasks", { ...args, startedAt: now() });
    return id;
  },
});

export const completeTask = internalMutation({
  args: {
    taskId: v.id("agentTasks"),
    status: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      status: args.status ?? "complete",
      detail: args.detail,
      completedAt: now(),
    });
  },
});

// ── Metrics & scoring ───────────────────────────────────────────────────────
//
// Deterministic prioritization in code (the LLM supplies impact/novelty):
//   priority = (0.25·frequency + 0.30·growth + 0.15·urgency + 0.20·impact + 0.10·novelty)
//              × (0.5 + 0.5·confidence/100)

export async function computeIssueMetrics(
  ctx: any,
  issueId: any,
  impact?: number,
  novelty?: number
): Promise<{ priorityScore: number; mentionsThisWeek: number; mentionsPrevWeek: number; growthMultiplier: number | undefined; avgUrgency: number }> {
  const issue = await ctx.db.get(issueId);
  if (!issue) throw new Error("issue not found");

  const signals = await ctx.db
    .query("signals")
    .withIndex("by_issue", (q: any) => q.eq("issue", issueId))
    .collect();

  const t = now();
  const thisWeek = signals.filter((s: any) => s.occurredAt > t - WEEK_MS);
  const prevWeek = signals.filter(
    (s: any) => s.occurredAt <= t - WEEK_MS && s.occurredAt > t - 2 * WEEK_MS
  );
  const avgUrgency =
    thisWeek.length > 0
      ? Math.round(thisWeek.reduce((a: number, s: any) => a + (s.urgency ?? 40), 0) / thisWeek.length)
      : 40;

  const freq = Math.min(100, thisWeek.length * 4);
  const growth =
    prevWeek.length === 0
      ? thisWeek.length > 0
        ? 100
        : 0
      : Math.min(100, 30 + ((thisWeek.length - prevWeek.length) / prevWeek.length) * 70);
  const imp = impact ?? 50;
  const nov = novelty ?? 50;

  let score = 0.25 * freq + 0.3 * growth + 0.15 * avgUrgency + 0.2 * imp + 0.1 * nov;
  score = score * (0.5 + (0.5 * issue.confidence) / 100);

  await ctx.db.patch(issueId, {
    mentionCount: signals.length,
    mentionsThisWeek: thisWeek.length,
    mentionsPrevWeek: prevWeek.length,
    growthMultiplier:
      prevWeek.length > 0
        ? Math.round((thisWeek.length / prevWeek.length) * 10) / 10
        : undefined,
    priorityScore: Math.round(clamp(score, 0, 100)),
    lastDetectedAt: signals.reduce((a: number, s: any) => Math.max(a, s.occurredAt), issue.lastDetectedAt),
    updatedAt: now(),
  });

  return {
    priorityScore: Math.round(score),
    mentionsThisWeek: thisWeek.length,
    mentionsPrevWeek: prevWeek.length,
    growthMultiplier:
      prevWeek.length > 0
        ? Math.round((thisWeek.length / prevWeek.length) * 10) / 10
        : undefined,
    avgUrgency,
  };
}

/** Recompute metrics for one issue (exposed as internal mutation). */
export const recomputeIssue = internalMutation({
  args: {
    issue: v.id("issues"),
    impact: v.optional(v.number()),
    novelty: v.optional(v.number()),
  },
  handler: async (ctx, args) => computeIssueMetrics(ctx, args.issue, args.impact, args.novelty),
});

/**
 * Atomically begin an investigation: returns null if one is already running
 * or started recently (prevents thundering herds of concurrent investigations
 * hammering external APIs). Employee questions always get fresh research —
 * they're deduped by question text with a short window instead.
 */
export const tryBeginInvestigation = internalMutation({
  args: {
    issue: v.id("issues"),
    triggeredBy: v.string(),
    question: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.question) {
      // question-focused: block only an identical question in the last 10 min
      const cutoff = now() - 10 * 60 * 1000;
      const dup = await ctx.db
        .query("investigations")
        .withIndex("by_issue", (q) => q.eq("issue", args.issue))
        .filter((q) => q.gte(q.field("startedAt"), cutoff))
        .filter((q) => q.eq(q.field("question"), args.question))
        .first();
      if (dup) return null;
      return await ctx.db.insert("investigations", {
        issue: args.issue,
        triggeredBy: args.triggeredBy,
        question: args.question,
        plan: [],
        stepIndex: 0,
        status: "pending",
        startedAt: now(),
      });
    }

    const cutoff = now() - 30 * 60 * 1000;
    const recent = await ctx.db
      .query("investigations")
      .withIndex("by_issue", (q) => q.eq("issue", args.issue))
      .filter((q) => q.gte(q.field("startedAt"), cutoff))
      .filter((q) => q.neq(q.field("status"), "failed"))
      .first();
    if (recent) return null;
    return await ctx.db.insert("investigations", {
      issue: args.issue,
      triggeredBy: args.triggeredBy,
      question: args.question,
      plan: [],
      stepIndex: 0,
      status: "pending",
      startedAt: now(),
    });
  },
});

export const patchInvestigation = internalMutation({
  args: { investigation: v.id("investigations"), patch: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.investigation, args.patch);
  },
});

/** Record a sent report. */
export const insertReport = internalMutation({
  args: {
    issue: v.id("issues"),
    company: v.id("companies"),
    kind: v.string(),
    subject: v.string(),
    bodyText: v.string(),
    sentTo: v.string(),
    scenario: v.optional(v.string()),
    agentmailMessageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("reports", { ...args, sentAt: now() });
    await ctx.db.patch(args.issue, { lastReportedAt: now() });
    return id;
  },
});

/** Update a source's monitoring state after a check. */
export const updateSource = internalMutation({
  args: {
    source: v.id("sources"),
    lastContentHash: v.optional(v.string()),
    lastItemCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.source, {
      lastContentHash: args.lastContentHash,
      lastItemCount: args.lastItemCount,
      lastCheckedAt: now(),
    });
  },
});

// ── Setup helpers (used by the setup action, which has no direct db access) ─

export const getSetupStateInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return { companyId: null, ruleCount: 0, sourceCount: 0 };
    const rules = await ctx.db
      .query("watchRules")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .collect();
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .collect();
    return {
      companyId: company._id,
      ruleCount: rules.length,
      sourceCount: sources.length,
    };
  },
});

export const upsertCompanyInternal = internalMutation({
  args: {
    name: v.string(),
    product: v.string(),
    productKeywords: v.array(v.string()),
    agentInbox: v.string(),
    employeeEmail: v.string(),
    demoCustomerEmail: v.string(),
    demoEmployeeName: v.string(),
  },
  handler: async (ctx, args) => {
    let company = await ctx.db.query("companies").first();
    if (!company) {
      const id = await ctx.db.insert("companies", { ...args, createdAt: now() });
      return id;
    }
    await ctx.db.patch(company._id, args);
    return company._id;
  },
});

export const insertWatchRulesInternal = internalMutation({
  args: {
    company: v.id("companies"),
    rules: v.array(
      v.object({
        label: v.string(),
        description: v.string(),
        keywords: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const r of args.rules) {
      await ctx.db.insert("watchRules", { company: args.company, enabled: true, ...r });
    }
  },
});

export const insertSourcesInternal = internalMutation({
  args: {
    company: v.id("companies"),
    sources: v.array(
      v.object({
        name: v.string(),
        kind: v.string(),
        config: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const s of args.sources) {
      await ctx.db.insert("sources", { company: args.company, enabled: true, ...s });
    }
  },
});

/** Retarget the whole product at a scenario pack (company identity + sources). */
export const configureScenarioInternal = internalMutation({
  args: {
    scenario: v.string(),
    name: v.string(),
    product: v.string(),
    productKeywords: v.array(v.string()),
    realProduct: v.boolean(),
    sources: v.array(
      v.object({
        name: v.string(),
        kind: v.string(),
        config: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const company = await ctx.db.query("companies").first();
    if (!company) throw new Error("Run setup first");
    await ctx.db.patch(company._id, {
      name: args.name,
      product: args.product,
      productKeywords: args.productKeywords,
      realProduct: args.realProduct,
      scenario: args.scenario,
    });
    // rebuild monitored sources for the new product
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .collect();
    for (const s of existing) await ctx.db.delete(s._id);
    for (const s of args.sources) {
      await ctx.db.insert("sources", { company: company._id, enabled: true, ...s });
    }
  },
});
