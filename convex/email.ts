import { internalMutation, internalAction, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { AgentMail } from "@agentmail/convex";
import * as analysis from "./lib/analysis";
import * as agentmailApi from "./lib/agentmailApi";
import { clamp, now } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// AgentMail integration — the agent's business inbox.
// Inbound: customer feedback becomes signals; employee questions trigger
// investigations and evidence-backed replies. Outbound: internal reports.
// ─────────────────────────────────────────────────────────────────────────────

export const agentmail: AgentMail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.email.onMessageReceived,
});

/** Normalize a raw AgentMail webhook message (snake_case or camelCase). */
function normalize(m: any) {
  return {
    messageId: m.message_id ?? m.messageId ?? "",
    threadId: m.thread_id ?? m.threadId ?? "",
    inboxId: m.inbox_id ?? m.inboxId ?? "",
    from: (m.from ?? "").toString(),
    to: Array.isArray(m.to) ? m.to.join(", ") : (m.to ?? "").toString(),
    subject: m.subject ?? "",
    text: (m.text ?? m.extracted_text ?? "").toString(),
    timestamp:
      typeof m.timestamp === "number" ? m.timestamp : Date.parse(m.timestamp ?? "") || now(),
  };
}

/** Extract bare address from "Name <addr>" or return as-is. */
function bareAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).toLowerCase();
}

/**
 * Webhook entry point. Only mail addressed to the agent's own inbox is
 * processed, and the agent's own outbound copies (AgentMail mirrors sent mail
 * into the sending inbox) are ignored.
 */
export const onMessageReceived = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  handler: async (ctx, args) => {
    const m = normalize(args.message);
    if (!m.messageId) return;

    const company = await ctx.db.query("companies").first();
    if (!company || !company.agentInbox || m.inboxId !== company.agentInbox) return;
    if (bareAddress(m.from) === company.agentInbox.toLowerCase()) return; // self-sent

    // dedupe by message
    const existing = await ctx.db
      .query("emailRouting")
      .withIndex("by_message", (q) => q.eq("messageId", m.messageId))
      .first();
    if (existing) return;
    await ctx.db.insert("emailRouting", {
      messageId: m.messageId,
      threadId: m.threadId,
      fromEmail: m.from,
      classification: "pending",
      scenario: company.scenario ?? "desk",
      handledAt: now(),
    });

    await ctx.scheduler.runAfter(0, internal.email.handleInbound, m);
  },
});

/** Classify and route inbound mail. */
export const handleInbound = internalAction({
  args: {
    messageId: v.string(),
    threadId: v.string(),
    inboxId: v.string(),
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const company = (await ctx.runQuery(internal.queries.getCompanyInternal, {})) as any;
    if (!company) return;

    const intent = await analysis.classifyInboundEmail({
      from: args.from,
      employeeEmail: company.employeeEmail ?? "",
      agentEmail: company.agentInbox ?? "",
      subject: args.subject,
      text: args.text.slice(0, 3000),
    });
    await ctx.runMutation(internal.email.setRouting, {
      messageId: args.messageId,
      classification: intent.classification,
    });

    if (intent.classification === "customer_feedback") {
      // ── customer voice → signal → clustering pipeline ──
      const task = await ctx.runMutation(internal.state.logTask, {
        company: company._id,
        type: "detect",
        status: "running",
        label: `Customer email received: ${args.subject.slice(0, 60)}`,
      });
      const classified = await analysis.classifyItems({
        company: company.name,
        product: company.product,
        watchRules: [],
        items: [
          {
            externalId: `email:${args.messageId}`,
            title: args.subject,
            content: `Subject: ${args.subject}\n\n${args.text}`,
            author: args.from,
            url: undefined,
            occurredAt: args.timestamp,
            source: "email",
          },
        ],
      });
      const c = classified[0];
      if (c && c.relevant) {
        const signalId = await ctx.runMutation(internal.state.insertSignal, {
          company: company._id,
          source: "email",
          externalId: `email:${args.messageId}`,
          occurredAt: args.timestamp,
          content: `Subject: ${args.subject}\n\n${args.text}`.slice(0, 2000),
          author: args.from,
          relevant: true,
          reason: c.reason,
          topics: c.topics,
          sentiment: c.sentiment,
          urgency: Math.round(clamp(c.urgency, 0, 100)),
          productArea: c.productArea,
          affectedSegment: c.affectedSegment,
          emailMessageId: args.messageId,
        });
        await ctx.runMutation(internal.state.completeTask, {
          taskId: task,
          detail: `Classified as customer feedback: ${c.productArea} (urgency ${Math.round(c.urgency)})`,
        });
        if (signalId) await ctx.runAction(internal.agent.processSignal, { signalId });
      } else {
        await ctx.runMutation(internal.state.completeTask, {
          taskId: task,
          detail: "Customer email not relevant to watch rules — noted, no issue",
        });
      }
      return;
    }

    if (intent.classification === "employee_question" && intent.question) {
      // ── internal teammate → investigate → evidence-backed reply ──
      const task = await ctx.runMutation(internal.state.logTask, {
        company: company._id,
        type: "reply",
        status: "running",
        label: `Employee question: ${intent.question.slice(0, 80)}`,
      });
      try {
        // find the issue this question relates to; if none matches directly,
        // investigate the current top issue so the question still gets
        // fresh web research
        const openIssues = (await ctx.runQuery(internal.queries.listIssuesInternal, {
          company: company._id,
          statuses: ["emerging", "confirmed", "critical", "watching"],
        })) as any[];
        let issueId: any = null;
        if (openIssues.length > 0) {
          const match = await analysis.matchSignalToIssue({
            signal: {
              content: intent.question,
              topics: [],
              productArea: "",
            },
            openIssues: openIssues.map((i: any) => ({
              id: i._id,
              title: i.title,
              description: i.description,
              status: i.status,
              affectedSegment: i.affectedSegment,
            })),
            resolvedIssues: [],
          });
          if (match.action === "existing" && match.issueId) issueId = match.issueId;
        }
        if (!issueId && openIssues.length > 0) {
          issueId = [...openIssues].sort(
            (a: any, b: any) => b.priorityScore - a.priorityScore
          )[0]._id;
        }

        if (issueId) {
          await ctx.runAction(internal.agent.investigateIssue, {
            issue: issueId,
            triggeredBy: "employee_reply",
            question: intent.question,
          });
        }

        // answer with the (now-updated) live state
        const liveState = (await ctx.runQuery(internal.queries.getLiveStateInternal, {
          focusIssue: issueId ?? undefined,
        })) as string;
        const answer = await analysis.answerFromContext({
          question: intent.question,
          context: liveState,
        });
        await ctx.runAction(internal.email.replyEmail, {
          inboxId: args.inboxId,
          parentMessageId: args.messageId,
          text: answer,
        });
        await ctx.runMutation(internal.email.setRouting, {
          messageId: args.messageId,
          replySummary: answer.slice(0, 300),
        });
        await ctx.runMutation(internal.state.completeTask, {
          taskId: task,
          detail: `Replied with findings (${issueId ? "investigation refreshed" : "no related issue"})`,
        });
      } catch (e: any) {
        await ctx.runMutation(internal.state.completeTask, {
          taskId: task,
          status: "failed",
          detail: e.message,
        });
      }
    }
  },
});

export const setRouting = internalMutation({
  args: { messageId: v.string(), classification: v.optional(v.string()), replySummary: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("emailRouting")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first();
    if (row) {
      await ctx.db.patch(row._id, {
        classification: args.classification ?? row.classification,
        replySummary: args.replySummary ?? row.replySummary,
        handledAt: now(),
      });
    }
  },
});

// ── Outbound (REST actions — synchronous and reliably delivered) ────────────

export const sendEmail = internalAction({
  args: {
    inboxId: v.string(),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await agentmailApi.sendMessage(args.inboxId, {
      to: args.to,
      subject: args.subject,
      text: args.text,
      labels: args.labels,
    });
  },
});

export const replyEmail = internalAction({
  args: { inboxId: v.string(), parentMessageId: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    return await agentmailApi.replyMessage(args.inboxId, args.parentMessageId, {
      text: args.text,
    });
  },
});

/** Find the agent's latest message in an inbox and reply to it (as that inbox's owner). */
export const replyToAgentFrom = internalAction({
  args: { inboxId: v.string(), agentInbox: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const messages = await agentmailApi.listMessages(args.inboxId, 20);
    const fromAgent = [...messages]
      .sort((a, b) => ts(b.timestamp) - ts(a.timestamp))
      .find((m) => (m.from ?? "").includes(args.agentInbox));
    if (fromAgent) {
      return await agentmailApi.replyMessage(args.inboxId, fromAgent.message_id, {
        text: args.text,
      });
    }
    // no prior message — send a fresh one
    return await agentmailApi.sendMessage(args.inboxId, {
      to: args.agentInbox,
      subject: "Question for you",
      text: args.text,
    });
  },
});

function ts(t: string | number): number {
  return typeof t === "number" ? t : Date.parse(t) || 0;
}

// ── UI queries ──────────────────────────────────────────────────────────────

export const listInboxMessages = query({
  args: { inboxId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.agentmail.lib.listInboundMessages, {
      inboxId: args.inboxId,
    });
  },
});

/** Inbound mail to the agent's inbox, newest first, with routing decisions. */
export const getAgentInbox = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company?.agentInbox) return { inbox: null, messages: [], routing: [] };
    const messages = await ctx.runQuery(
      components.agentmail.lib.listInboundMessages,
      { inboxId: company.agentInbox }
    );
    const routing = await ctx.db.query("emailRouting").collect();
    const routingByMessage = new Map(routing.map((r) => [r.messageId, r]));
    return {
      inbox: company.agentInbox,
      messages: [...messages]
        .sort((a: any, b: any) => b.timestamp - a.timestamp)
        .map((m: any) => ({
          messageId: m.messageId,
          threadId: m.threadId,
          from: m.from,
          subject: m.subject,
          preview: (m.extractedText ?? m.text ?? "").slice(0, 220),
          timestamp: m.timestamp,
          routing: routingByMessage.get(m.messageId) ?? null,
        })),
    };
  },
});

/** Send an email as the agent (used by the demo runner and chat). */
export const sendAsAgent = mutation({
  args: { to: v.string(), subject: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const company = await ctx.db.query("companies").first();
    if (!company?.agentInbox) throw new Error("Company not set up");
    await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
      inboxId: company.agentInbox,
      to: args.to,
      subject: args.subject,
      text: args.text,
      labels: ["intelligence-report"],
    });
    return "scheduled";
  },
});
