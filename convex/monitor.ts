import { internalAction, internalQuery, internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import * as agentmailApi from "./lib/agentmailApi";
import { now } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// Polling fallback for inbound mail. The AgentMail webhook is the primary
// path; this catches anything the webhook missed (and is the only path on
// deployments without a public URL, e.g. local dev). Unseen messages are fed
// into the exact same handler the webhook uses, so behavior is identical.
// ─────────────────────────────────────────────────────────────────────────────

export const listRoutedMessageIdsInternal = internalQuery({
  args: { messageIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const found: string[] = [];
    for (const id of args.messageIds) {
      const hit = await ctx.db
        .query("emailRouting")
        .withIndex("by_message", (q) => q.eq("messageId", id))
        .first();
      if (hit) found.push(id);
    }
    return found;
  },
});

function bareAddress(from: string): string {
  const m = (from ?? "").match(/<([^>]+)>/);
  return (m ? m[1] : from ?? "").toLowerCase();
}

export const pollInbound = internalAction({
  args: {},
  handler: async (ctx) => {
    const company = (await ctx.runQuery(internal.queries.getCompanyInternal, {})) as any;
    if (!company?.agentInbox) return { polled: 0, processed: 0 };

    const messages = await agentmailApi.listMessages(company.agentInbox, 30);
    const inbound = messages.filter(
      (m) => bareAddress(m.from) !== company.agentInbox.toLowerCase()
    );

    // emailRouting is the dedupe ledger used by the webhook path too
    const known = new Set(
      ((await ctx.runQuery(internal.monitor.listRoutedMessageIdsInternal, {
        messageIds: inbound.map((m) => m.message_id),
      })) as string[]) ?? []
    );

    let processed = 0;
    for (const m of inbound) {
      if (known.has(m.message_id)) continue;
      await ctx.runMutation(internal.email.onMessageReceived, {
        message: m,
        thread: {},
        eventId: `poll:${m.message_id}`,
      });
      processed++;
    }
    return { polled: inbound.length, processed };
  },
});

/** Manual trigger for demos: check the agent's inbox right now. */
export const pollNow = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.monitor.pollInbound, {});
  },
});

/**
 * Mark every message currently in the agent's remote inbox as known WITHOUT
 * processing it. Used after a demo reset so old mail isn't reprocessed.
 */
export const adoptExistingMail = internalAction({
  args: {},
  handler: async (ctx) => {
    const company = (await ctx.runQuery(internal.queries.getCompanyInternal, {})) as any;
    if (!company?.agentInbox) return { adopted: 0 };
    const messages = await agentmailApi.listMessages(company.agentInbox, 100);
    const inbound = messages.filter(
      (m) => bareAddress(m.from) !== company.agentInbox.toLowerCase()
    );
    const known = new Set(
      ((await ctx.runQuery(internal.monitor.listRoutedMessageIdsInternal, {
        messageIds: inbound.map((m) => m.message_id),
      })) as string[]) ?? []
    );
    let adopted = 0;
    for (const m of inbound) {
      if (known.has(m.message_id)) continue;
      await ctx.runMutation(internal.monitor.insertRoutingRow, {
        messageId: m.message_id,
        threadId: m.thread_id,
        fromEmail: m.from,
        classification: "other",
      });
      adopted++;
    }
    return { adopted };
  },
});

export const insertRoutingRow = internalMutation({
  args: {
    messageId: v.string(),
    threadId: v.string(),
    fromEmail: v.string(),
    classification: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailRouting")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first();
    if (existing) return;
    await ctx.db.insert("emailRouting", {
      messageId: args.messageId,
      threadId: args.threadId,
      fromEmail: args.fromEmail,
      classification: args.classification,
      handledAt: now(),
    });
  },
});
