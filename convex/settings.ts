import { query, mutation, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { enabled as envEnabled } from "./lib/firecrawl";

// ─────────────────────────────────────────────────────────────────────────────
// Web-research (Firecrawl) control — toggleable from the dashboard.
// The flag lives in the companies table so the frontend can flip it live;
// undefined falls back to the FIRECRAWL_ENABLED env var.
// ─────────────────────────────────────────────────────────────────────────────

export const getWebResearch = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    return {
      enabled: company?.webResearchEnabled ?? envEnabled(),
      credits: company?.webResearchCredits ?? null,
      configured: !!company,
    };
  },
});

export const setWebResearch = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const company = await ctx.db.query("companies").first();
    if (!company) throw new Error("Run setup first");
    await ctx.db.patch(company._id, { webResearchEnabled: args.enabled });
    // refresh the credit balance shown next to the toggle (free endpoint)
    await ctx.scheduler.runAfter(0, internal.settings.refreshCredits, {});
    return args.enabled;
  },
});

/** Fetch the Firecrawl credit balance (doesn't consume credits). */
export const refreshCredits = internalAction({
  args: {},
  handler: async (ctx) => {
    const company = (await ctx.runQuery(internal.queries.getCompanyInternal, {})) as any;
    if (!company) return;
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) return;
    try {
      const res = await fetch("https://api.firecrawl.dev/v2/team/credit-usage", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: { remainingCredits?: number } };
      const credits = json.data?.remainingCredits;
      if (typeof credits === "number") {
        await ctx.runMutation(internal.settings.storeCredits, { credits });
      }
    } catch {
      // non-fatal — the toggle still works without the balance
    }
  },
});

export const storeCredits = internalMutation({
  args: { credits: v.number() },
  handler: async (ctx, args) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return;
    await ctx.db.patch(company._id, { webResearchCredits: args.credits });
  },
});
