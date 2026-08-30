import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import * as agentmailApi from "./lib/agentmailApi";

// ─────────────────────────────────────────────────────────────────────────────
// One-time provisioning: the watched project (ZephyrSwap, a fictional listed
// Base project), the desk's watch rules, monitored sources, and the three real
// AgentMail inboxes (legacy channel — dormant).
// Idempotent — safe to run repeatedly.
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_USERNAME = "customer.intelligence";
const EMPLOYEE_USERNAME = "maria.acme"; // shared inboxes — usernames stay stable
const CUSTOMER_USERNAME = "dana.customer";

const WATCH_RULES = [
  {
    label: "Execution failures",
    description: "Traders report swaps/transactions failing, hanging, or timing out",
    keywords: ["failed", "failure", "stuck", "hang", "timeout", "error", "broken"],
  },
  {
    label: "Fund-safety concerns",
    description: "Reports suggesting users could lose funds: exploits, rugs, drains",
    keywords: ["rug", "exploit", "drain", "hack", "scam", "lost funds"],
  },
  {
    label: "Execution quality",
    description: "Slippage, latency and pricing complaints from active traders",
    keywords: ["slippage", "latency", "slow", "pending", "confirm"],
  },
  {
    label: "Venue comparisons",
    description: "Public comparisons with competing DEXes and venues",
    keywords: ["alternative", "switch", "vs", "better than", "moving to"],
  },
  {
    label: "Liquidity flight",
    description: "Signals that liquidity providers or traders are leaving",
    keywords: ["pull my liquidity", "withdrawing", "leaving", "closing my position"],
  },
];

const SOURCES = [
  { name: "Hacker News mentions", kind: "hn", config: { query: "ZephyrSwap" } },
  { name: "Reddit discussions", kind: "reddit_search", config: { query: "ZephyrSwap swaps" } },
  {
    name: "General web mentions",
    kind: "web_search",
    config: { query: '"ZephyrSwap" failed swap OR slippage OR stuck' },
  },
];

export const ensureSetup = action({
  args: {},
  handler: async (ctx): Promise<{
    agentInbox: string;
    employeeEmail: string;
    customerEmail: string;
    companyId: any;
  }> => {
    // 1. real AgentMail inboxes (idempotent, via REST)
    const existing = await agentmailApi.listInboxes();
    const byUsername = (username: string) =>
      existing.find((i) => i.email.toLowerCase().startsWith(username + "@"));

    const ensureInbox = async (username: string, displayName: string) => {
      const hit = byUsername(username);
      if (hit) return hit.email;
      const created = await agentmailApi.createInbox(username, displayName);
      return created.email;
    };

    const agentInbox = await ensureInbox(AGENT_USERNAME, "Customer Intelligence Agent");
    const employeeEmail = await ensureInbox(EMPLOYEE_USERNAME, "Maria - ZephyrSwap ops");
    const customerEmail = await ensureInbox(CUSTOMER_USERNAME, "Dana - ZephyrSwap trader");

    // 2. company + configuration
    const state = await ctx.runMutation(internal.state.getSetupStateInternal, {});
    const companyId = await ctx.runMutation(internal.state.upsertCompanyInternal, {
      name: "ZephyrSwap",
      product: "ZephyrSwap",
      productKeywords: ["ZephyrSwap"],
      agentInbox,
      employeeEmail,
      demoCustomerEmail: customerEmail,
      demoEmployeeName: "Maria",
    });

    // 3. watch rules + monitored sources
    if (state.ruleCount === 0) {
      await ctx.runMutation(internal.state.insertWatchRulesInternal, {
        company: companyId,
        rules: WATCH_RULES,
      });
    }
    if (state.sourceCount === 0) {
      await ctx.runMutation(internal.state.insertSourcesInternal, {
        company: companyId,
        sources: SOURCES,
      });
    }

    return { agentInbox, employeeEmail, customerEmail, companyId };
  },
});
