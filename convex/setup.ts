import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import * as agentmailApi from "./lib/agentmailApi";

// ─────────────────────────────────────────────────────────────────────────────
// One-time provisioning: the demo company (Acme AI), its watch rules,
// monitored sources, and the three real AgentMail inboxes.
// Idempotent — safe to run repeatedly.
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_USERNAME = "customer.intelligence";
const EMPLOYEE_USERNAME = "maria.acme";
const CUSTOMER_USERNAME = "dana.customer";

const WATCH_RULES = [
  {
    label: "Product complaints",
    description: "Customer pain using the product: slow, broken, confusing flows",
    keywords: ["slow", "broken", "bug", "crash", "error", "fails"],
  },
  {
    label: "Pricing complaints",
    description: "Complaints or churn signals about pricing and packaging",
    keywords: ["expensive", "price", "pricing", "cost", "refund"],
  },
  {
    label: "Missing features",
    description: "Repeated requests for features the product lacks",
    keywords: ["wish", "missing", "no export", "feature request"],
  },
  {
    label: "Competitor comparisons",
    description: "Public comparisons with competing products",
    keywords: ["alternative", "switch", "vs", "competitor"],
  },
  {
    label: "Churn signals",
    description: "Indications customers are leaving or reducing usage",
    keywords: ["cancel", "leaving", "churn", "downgrade"],
  },
];

const SOURCES = [
  { name: "Hacker News mentions", kind: "hn", config: { query: "Acme Assistant" } },
  { name: "Reddit discussions", kind: "reddit_search", config: { query: "Acme Assistant" } },
  {
    name: "General web mentions",
    kind: "web_search",
    config: { query: '"Acme Assistant" review OR complaint' },
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
    const employeeEmail = await ensureInbox(EMPLOYEE_USERNAME, "Maria - Acme AI");
    const customerEmail = await ensureInbox(CUSTOMER_USERNAME, "Dana - Acme customer");

    // 2. company + configuration
    const state = await ctx.runMutation(internal.state.getSetupStateInternal, {});
    const companyId = await ctx.runMutation(internal.state.upsertCompanyInternal, {
      name: "Acme AI",
      product: "Acme Assistant",
      productKeywords: ["Acme Assistant", "Acme AI"],
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
