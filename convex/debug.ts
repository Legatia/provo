import { internalQuery } from "./_generated/server";

// Temporary diagnostics.
export const lastReply = internalQuery({
  args: {},
  handler: async (ctx) => {
    const routing = await ctx.db.query("emailRouting").collect();
    const eqs = routing.filter((r) => r.classification === "employee_question");
    return eqs[eqs.length - 1]?.replySummary ?? "none";
  },
});

/** Web evidence for the top non-resolved issue. */
export const dumpEvidence = internalQuery({
  args: {},
  handler: async (ctx) => {
    const issues = await ctx.db.query("issues").collect();
    const target = issues
      .filter((i) => i.status !== "resolved")
      .sort((a, b) => b.priorityScore - a.priorityScore)[0];
    if (!target) return null;
    const evidence = await ctx.db
      .query("evidence")
      .withIndex("by_issue", (q) => q.eq("issue", target._id))
      .collect();
    return {
      issue: target.title,
      web: evidence
        .filter((e) => e.kind === "web")
        .map((e) => ({ url: e.url, excerpt: e.excerpt.slice(0, 120), rel: e.relevance })),
    };
  },
});

export const dumpState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const routing = await ctx.db.query("emailRouting").collect();
    const signals = await ctx.db.query("signals").collect();
    const issues = await ctx.db.query("issues").collect();
    const tasks = await ctx.db
      .query("agentTasks")
      .withIndex("by_started")
      .order("desc")
      .take(10);
    return {
      routing: routing.map((r) => ({
        msg: r.messageId.slice(-20),
        classification: r.classification,
        scenario: r.scenario ?? "(no stamp)",
        from: r.fromEmail,
        reply: r.replySummary?.slice(0, 120),
      })),
      signals: signals.length,
      emailSignals: signals.filter((s) => s.source === "email").length,
      issues: issues.map((i) => ({
        title: i.title,
        status: i.status,
        score: Math.round(i.priorityScore),
        mentions: `${i.mentionsThisWeek}/${i.mentionsPrevWeek}`,
        confidence: i.confidence,
        hist: i.historicalNote?.slice(0, 100),
      })),
      tasks: tasks.map((t) => `${t.type}/${t.status}: ${t.label} ${t.detail?.slice(0, 80) ?? ""}`),
    };
  },
});
