import { action, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import * as analysis from "./lib/analysis";
import { now } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard chat with the agent. Answers come from live Convex state; the chat
// can trigger real investigations and send real reports.
// ─────────────────────────────────────────────────────────────────────────────

export const insertChatMessage = internalMutation({
  args: {
    role: v.string(),
    content: v.string(),
    triggeredInvestigation: v.optional(v.id("investigations")),
    sentReport: v.optional(v.id("reports")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", { ...args, createdAt: now() });
  },
});

export const send = action({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.chat.insertChatMessage, {
      role: "user",
      content: args.message,
    });

    const history = (await ctx.runQuery(internal.queries.listChatInternal, {})) as any[];
    const liveState = (await ctx.runQuery(internal.queries.getLiveStateInternal, {})) as string;
    const issues = (await ctx.runQuery(internal.queries.listActiveIssuesInternal, {})) as any[];

    const result = await analysis.chatReply({
      question: args.message,
      history: history.slice(-6).map((m: any) => ({ role: m.role, content: m.content })),
      context: liveState,
      issueTitles: issues.map((i: any) => i.title),
    });

    let reply = result.reply;

    // side effect: trigger a real investigation
    if (result.investigateIssueTitle) {
      const target =
        issues.find(
          (i: any) =>
            i.title.toLowerCase() === result.investigateIssueTitle!.toLowerCase() ||
            i.title.toLowerCase().includes(result.investigateIssueTitle!.toLowerCase()) ||
            result.investigateIssueTitle!.toLowerCase().includes(i.title.toLowerCase())
        ) ?? null;

      let issueId = target?._id ?? null;
      if (!issueId) {
        const company = (await ctx.runQuery(internal.queries.getCompanyInternal, {})) as any;
        if (company) {
          issueId = await ctx.runMutation(internal.state.createIssue, {
            company: company._id,
            title: result.investigateIssueTitle,
            description: `Opened from a dashboard chat request: "${args.message}"`,
            severity: "medium",
            detectedAt: now(),
          });
        }
      }
      if (issueId) {
        await ctx.scheduler.runAfter(0, internal.agent.investigateIssue, {
          issue: issueId,
          triggeredBy: "chat",
        });
        reply += `\n\n→ I've started a live investigation and will update the issue as evidence comes in.`;
      }
    }

    // side effect: email the findings
    if (result.sendEmailReport) {
      const top = issues.sort((a: any, b: any) => b.priorityScore - a.priorityScore)[0];
      if (top) {
        await ctx.scheduler.runAfter(0, internal.agent.reportIssue, {
          issue: top._id,
          kind: "digest",
        });
        reply += `\n\n→ I've emailed the latest findings to the team.`;
      }
    }

    await ctx.runMutation(internal.chat.insertChatMessage, {
      role: "agent",
      content: reply,
    });
  },
});

/** "Run investigation now" button — deterministic demo trigger. */
export const runInvestigationNow = mutation({
  args: { issueId: v.optional(v.id("issues")) },
  handler: async (ctx, args) => {
    let issueId = args.issueId;
    if (!issueId) {
      const company = await ctx.db.query("companies").first();
      if (!company) throw new Error("Company not set up");
      const issues = await ctx.db
        .query("issues")
        .withIndex("by_company_score", (q) => q.eq("company", company._id))
        .order("desc")
        .collect();
      const active = issues.filter((i) => i.status !== "resolved");
      issueId = active[0]?._id;
    }
    if (!issueId) throw new Error("No issue to investigate");
    await ctx.scheduler.runAfter(0, internal.agent.investigateIssue, {
      issue: issueId,
      triggeredBy: "manual",
    });
    return issueId;
  },
});

/** Manual monitor-cycle trigger for demos. */
export const runMonitorNow = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.agent.runMonitorCycle, {});
  },
});
