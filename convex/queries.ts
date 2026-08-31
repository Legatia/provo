import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { fmtDate } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// Reactive queries powering the realtime dashboard + internal lookups used by
// the agent itself.
// ─────────────────────────────────────────────────────────────────────────────

// ── Internal (agent) ─────────────────────────────────────────────────────────

export const getCompanyInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    return company ? { ...company, _id: company._id } : null;
  },
});

/** Per-entity lookup (multi-entity engine). */
export const getCompanyByIdInternal = internalQuery({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

/** Every monitored entity — the engine is domain-agnostic and multi-entity. */
export const listMonitoredInternal = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("companies").collect(),
});

/** Public: which entities currently have the engine watching them. */
export const listMonitoredNames = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("companies").collect();
    return all.map((c) => c.name);
  },
});

export const listSourcesInternal = internalQuery({
  args: { company: v.id("companies") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("sources")
      .withIndex("by_company", (q) => q.eq("company", args.company))
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect(),
});

export const listWatchRulesInternal = internalQuery({
  args: { company: v.id("companies") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("watchRules")
      .withIndex("by_company", (q) => q.eq("company", args.company))
      .collect(),
});

export const listExternalIdsInternal = internalQuery({
  args: { externalIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const found: string[] = [];
    for (const id of args.externalIds) {
      const hit = await ctx.db
        .query("signals")
        .withIndex("by_external", (q) => q.eq("externalId", id))
        .first();
      if (hit) found.push(id);
    }
    return found;
  },
});

export const getSignalInternal = internalQuery({
  args: { signalId: v.id("signals") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.signalId);
    return s ? { ...s, _id: s._id } : null;
  },
});

export const listIssuesInternal = internalQuery({
  args: { company: v.id("companies"), statuses: v.array(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("issues")
      .withIndex("by_company", (q) => q.eq("company", args.company))
      .collect();
    return all
      .filter((i) => args.statuses.includes(i.status))
      .map((i) => ({ ...i, _id: i._id }));
  },
});

export const getIssueInternal = internalQuery({
  args: { issue: v.id("issues") },
  handler: async (ctx, args) => {
    const i = await ctx.db.get(args.issue);
    return i ? { ...i, _id: i._id } : null;
  },
});

export const listEvidenceInternal = internalQuery({
  args: { issue: v.id("issues") },
  handler: async (ctx, args) =>
    await ctx.db
      .query("evidence")
      .withIndex("by_issue", (q) => q.eq("issue", args.issue))
      .collect(),
});

export const recentInvestigationInternal = internalQuery({
  args: { issue: v.id("issues"), sinceMs: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.sinceMs;
    const recent = await ctx.db
      .query("investigations")
      .withIndex("by_issue", (q) => q.eq("issue", args.issue))
      .filter((q) => q.gte(q.field("startedAt"), cutoff))
      .collect();
    return recent.length > 0;
  },
});

/**
 * The agent's live world model, rendered as text context for LLM answers.
 * This is what makes replies evidence-grounded rather than hallucinated.
 */
export const getLiveStateInternal = internalQuery({
  args: { focusIssue: v.optional(v.id("issues")) },
  handler: async (ctx, args) => {
    // desk-wide: the chat answers across EVERY monitored entity
    const companies = await ctx.db.query("companies").collect();
    if (companies.length === 0) return "No monitored entities configured.";
    const lines: string[] = [
      `Desk watching ${companies.length} entities: ${companies
        .map((c) => `${c.name} (${c.product})`)
        .join(", ")}`,
    ];

    for (const company of companies) {
      const issues = await ctx.db
        .query("issues")
        .withIndex("by_company", (q) => q.eq("company", company._id))
        .collect();
      const active = issues.filter((i) => i.status !== "resolved");
      const resolved = issues.filter((i) => i.status === "resolved");
      if (active.length === 0 && resolved.length === 0) continue;

      lines.push(`\nENTITY: ${company.name} — product: ${company.product}`);
      lines.push("ACTIVE FINDINGS:");
      for (const i of active) {
        lines.push(
          `\n- ${i.title} [${i.status}/${i.severity}] — ${i.description}\n` +
            `  mentions: ${i.mentionsThisWeek} this week vs ${i.mentionsPrevWeek} last week` +
            (i.growthMultiplier ? ` (x${i.growthMultiplier})` : "") +
            `\n  affected: ${i.affectedSegment ?? "unknown"}, confidence: ${i.confidence}%` +
            `\n  recommended: ${i.recommendedAction ?? "n/a"}` +
            (i.historicalNote ? `\n  history: ${i.historicalNote}` : "") +
            (i.reasoningSummary ? `\n  desk reasoning: ${i.reasoningSummary}` : "")
        );
        const evidence = await ctx.db
          .query("evidence")
          .withIndex("by_issue", (q) => q.eq("issue", i._id))
          .collect();
        for (const e of evidence.slice(0, 8)) {
          lines.push(
            `  evidence [${e.kind}/${e.source}] (${fmtDate(e.occurredAt)}, relevance ${e.relevance}): "${e.excerpt.slice(0, 200)}"${e.url ? ` ${e.url}` : ""}`
          );
        }
      }
      if (resolved.length > 0) {
        lines.push("\nRESOLVED HISTORICAL FINDINGS:");
        for (const i of resolved) {
          lines.push(
            `- ${i.title} (first ${fmtDate(i.firstDetectedAt)}${i.resolvedAt ? `, resolved ${fmtDate(i.resolvedAt)}` : ""}): ${i.description}${i.resolutionNote ? ` — ${i.resolutionNote}` : ""}`
          );
        }
      }
    }

    if (args.focusIssue) {
      const focus = await ctx.db.get(args.focusIssue);
      if (focus) lines.push(`\nFOCUS FINDING: ${focus.title}`);
    }

    return lines.join("\n");
  },
});

export const listChatInternal = internalQuery({
  args: {},
  handler: async (ctx) =>
    (
      await ctx.db
        .query("chatMessages")
        .withIndex("by_time")
        .order("asc")
        .collect()
    ).map((m) => ({ ...m, _id: m._id })),
});

export const listActiveIssuesInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    // desk-wide: every active finding across every monitored entity
    const issues = await ctx.db.query("issues").collect();
    return issues.filter((i) => i.status !== "resolved").map((i) => ({ ...i, _id: i._id }));
  },
});

/** Day-bucketed mention counts per issue (last 14 days) for sparklines. */
function dailyBuckets(signals: { issue?: string; occurredAt: number }[], days = 14): Map<string, number[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const out = new Map<string, number[]>();
  for (const s of signals) {
    if (!s.issue) continue;
    const dayIndex = Math.floor(
      (new Date(s.occurredAt).setHours(0, 0, 0, 0) - today) / (24 * 3600_000)
    );
    if (dayIndex < -(days - 1) || dayIndex > 0) continue;
    let arr = out.get(s.issue);
    if (!arr) {
      arr = new Array(days).fill(0);
      out.set(s.issue, arr);
    }
    arr[dayIndex + days - 1]++;
  }
  return out;
}

// ── Public (dashboard) ──────────────────────────────────────────────────────

export const getCompany = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return null;
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .collect();
    const rules = await ctx.db
      .query("watchRules")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .collect();
    return { ...company, sources, watchRules: rules };
  },
});

export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return null;
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .collect();

    const critical = issues.filter(
      (i) => i.status === "critical" || (i.status !== "resolved" && i.severity === "critical")
    );
    const emerging = issues.filter(
      (i) => ["emerging", "confirmed"].includes(i.status) && !critical.includes(i)
    );
    const stable = issues.filter((i) => !critical.includes(i) && !emerging.includes(i));

    const recentChanges = [...issues]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6)
      .map((i) => ({
        _id: i._id,
        title: i.title,
        status: i.status,
        growthMultiplier: i.growthMultiplier,
        mentionsThisWeek: i.mentionsThisWeek,
        mentionsPrevWeek: i.mentionsPrevWeek,
        updatedAt: i.updatedAt,
      }));

    const activity = await ctx.db
      .query("agentTasks")
      .withIndex("by_started")
      .order("desc")
      .take(18);

    const totalSignals = await ctx.db
      .query("signals")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .collect();

    // per-issue sparklines + company-wide daily totals + source mix
    const buckets = dailyBuckets(totalSignals);
    const sparkByIssue = new Map(
      [...buckets.entries()].map(([id, arr]) => [id as string, arr as number[]])
    );
    const totalDaily = new Array(14).fill(0);
    for (const arr of buckets.values()) {
      for (let i = 0; i < 14; i++) totalDaily[i] += arr[i];
    }
    const dayLabels = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });

    return {
      company: { name: company.name, product: company.product },
      counts: { critical: critical.length, emerging: emerging.length, stable: stable.length },
      recentChanges: recentChanges.map((c) => ({
        ...c,
        spark: sparkByIssue.get(c._id as string) ?? new Array(14).fill(0),
      })),
      activity,
      signalCount: totalSignals.length,
      emailSignals: totalSignals.filter((s) => s.source === "email").length,
      webSignals: totalSignals.filter((s) => s.source !== "email").length,
      totalDaily,
      dayLabels,
    };
  },
});

export const listIssues = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return [];
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_company_score", (q) => q.eq("company", company._id))
      .order("desc")
      .collect();
    return issues;
  },
});

/** Issues with day-bucketed mention sparklines (for the issues board). */
export const listIssuesDetailed = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return [];
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_company_score", (q) => q.eq("company", company._id))
      .order("desc")
      .collect();
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .collect();
    const buckets = dailyBuckets(signals);
    const dayLabels = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
    return issues.map((i) => ({
      issue: i,
      spark: buckets.get(i._id as string) ?? new Array(14).fill(0),
      dayLabels,
    }));
  },
});

/** Lightweight counts for sidebar badges. */
export const getNavBadges = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return { critical: 0, emerging: 0 };
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .collect();
    const active = issues.filter((i) => i.status !== "resolved");
    return {
      critical: active.filter(
        (i) => i.status === "critical" || i.severity === "critical"
      ).length,
      emerging: active.filter((i) =>
        ["emerging", "confirmed"].includes(i.status)
      ).length,
    };
  },
});

export const getIssueDetail = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) return null;
    const [evidence, signals, investigations, reports] = await Promise.all([
      ctx.db
        .query("evidence")
        .withIndex("by_issue_time", (q) => q.eq("issue", args.issueId))
        .order("asc")
        .collect(),
      ctx.db
        .query("signals")
        .withIndex("by_issue", (q) => q.eq("issue", args.issueId))
        .collect(),
      ctx.db
        .query("investigations")
        .withIndex("by_issue", (q) => q.eq("issue", args.issueId))
        .order("desc")
        .collect(),
      ctx.db
        .query("reports")
        .withIndex("by_issue", (q) => q.eq("issue", args.issueId))
        .order("desc")
        .collect(),
    ]);
    return { issue, evidence, signals, investigations, reports };
  },
});

export const listReports = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return [];
    return await ctx.db
      .query("reports")
      .withIndex("by_company", (q) => q.eq("company", company._id))
      .order("desc")
      .collect();
  },
});

export const listActivity = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("agentTasks")
      .withIndex("by_started")
      .order("desc")
      .take(40),
});

export const listChat = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("chatMessages")
      .withIndex("by_time")
      .order("asc")
      .collect(),
});
