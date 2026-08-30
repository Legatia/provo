import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { now } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// Engine credits — the metering substrate (PLAN.md "Billing model").
// Customers top up USDC via x402 and every engine action burns credits visibly:
//   sweep 1 · signal 0.1 · investigation 5 · desk review 10 · alert 1
// featuring is a flat fee (separate surface). Out of credits ⇒ the action is
// BLOCKED and it's visible in the ledger — the monitor pauses honestly, it
// never runs unmetered.
// ─────────────────────────────────────────────────────────────────────────────

export const CREDIT_PRICES: Record<string, number> = {
  monitor_cycle: 1,
  signal: 0.1,
  investigation: 5,
  desk_review: 10,
  alert: 1,
};

const DEMO_INITIAL_GRANT = 1000;

type BurnAction = "monitor_cycle" | "signal" | "investigation" | "desk_review" | "alert";

/** Burn credits for one engine action. Returns ok=false (and a BLOCKED ledger
 *  row unless silent) when the balance can't cover the price. */
export const burn = internalMutation({
  args: {
    company: v.id("companies"),
    action: v.string(),
    detail: v.optional(v.string()),
    silent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const price = CREDIT_PRICES[args.action] ?? 1;
    const company = await ctx.db.get(args.company);
    if (!company) return { ok: false, reason: "no company" };

    let balance = company.creditBalance;
    if (balance === undefined) {
      // lazy demo grant on the first metered action
      balance = DEMO_INITIAL_GRANT;
      await ctx.db.patch(company._id, { creditBalance: balance });
      await ctx.db.insert("creditLedger", {
        company: company._id,
        kind: "topup",
        amount: DEMO_INITIAL_GRANT,
        action: "demo_grant",
        detail: "initial demo grant",
        balanceAfter: balance,
        at: now(),
      });
    }

    if (balance < price) {
      if (!args.silent) {
        await ctx.db.insert("creditLedger", {
          company: company._id,
          kind: "burn",
          amount: 0,
          action: args.action,
          detail: `BLOCKED — insufficient credits (needs ${price})`,
          balanceAfter: balance,
          at: now(),
        });
      }
      return { ok: false, reason: `insufficient credits (needs ${price}, has ${balance})` };
    }

    const balanceAfter = Math.round((balance - price) * 10) / 10;
    await ctx.db.patch(company._id, { creditBalance: balanceAfter });
    await ctx.db.insert("creditLedger", {
      company: company._id,
      kind: "burn",
      amount: -price,
      action: args.action,
      detail: args.detail,
      balanceAfter,
      at: now(),
    });
    return { ok: true, balance: balanceAfter };
  },
});

/** Demo top-up (the x402 rail will call this server-side once wired). */
export const grant = mutation({
  args: { amount: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const company = await ctx.db.query("companies").first();
    if (!company) throw new Error("Run setup first");
    const amount = args.amount ?? 100;
    const balanceAfter = Math.round(((company.creditBalance ?? 0) + amount) * 10) / 10;
    await ctx.db.patch(company._id, { creditBalance: balanceAfter });
    await ctx.db.insert("creditLedger", {
      company: company._id,
      kind: "topup",
      amount,
      action: "demo_topup",
      detail: "demo top-up (x402 rail pending)",
      balanceAfter,
      at: now(),
    });
    return balanceAfter;
  },
});

/** Balance + recent ledger rows for the Monitor card. */
export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return null;
    const history = await ctx.db
      .query("creditLedger")
      .withIndex("by_company_time", (q) => q.eq("company", company._id))
      .order("desc")
      .take(8);
    return {
      balance: company.creditBalance ?? 0,
      history: history.map((h) => ({
        kind: h.kind,
        amount: h.amount,
        action: h.action,
        detail: h.detail,
        balanceAfter: h.balanceAfter,
        at: h.at,
      })),
    };
  },
});
