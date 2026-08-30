import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─────────────────────────────────────────────────────────────────────────────
// Provo Monitor alert delivery. Escalations, findings and listing verdicts go
// to the customer's webhook (or the global demo webhook). The alert copy is
// recurrence-aware — the "↻ recurrence" line comes from Sibyl recall, which is
// what makes Monitor alerts worth paying for. Delivery burns 1 credit.
// ─────────────────────────────────────────────────────────────────────────────

export const sendAlert = internalAction({
  args: {
    company: v.id("companies"),
    kind: v.string(), // "finding" | "verdict"
    title: v.string(),
    body: v.string(),
    recurrence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const company = (await ctx.runQuery(internal.queries.getCompanyInternal, {})) as any;

    // METER: alert delivery (credits.ts)
    let meterReason: string | null = null;
    if (company) {
      const meter = await ctx.runMutation(internal.credits.burn, {
        company: company._id,
        action: "alert",
        detail: args.title,
      });
      if (!meter.ok) meterReason = meter.reason ?? "insufficient credits";
    }

    const payload = {
      service: "Provo Monitor",
      kind: args.kind,
      title: args.title,
      body: args.body,
      recurrence: args.recurrence ?? null,
      at: new Date().toISOString(),
    };

    const targets: string[] = [];
    if (company?.alertWebhook) targets.push(company.alertWebhook);
    if (process.env.ALERT_WEBHOOK_URL) targets.push(process.env.ALERT_WEBHOOK_URL);

    let deliveryNote: string;
    if (meterReason) {
      deliveryNote = `not delivered — ${meterReason}`;
    } else if (targets.length === 0) {
      deliveryNote = "no webhook configured — visible in activity feed only";
    } else {
      const results: string[] = [];
      for (const t of targets) {
        try {
          const res = await fetch(t, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10_000),
          });
          results.push(`${new URL(t).host} → ${res.status}`);
        } catch (e: any) {
          results.push(`${new URL(t).host} → failed: ${String(e.message).slice(0, 60)}`);
        }
      }
      deliveryNote = results.join(" | ");
    }

    await ctx.runMutation(internal.state.logTask, {
      company: company?._id,
      type: "report",
      status: meterReason ? "failed" : "complete",
      label: `Monitor alert: ${args.title}`,
      detail:
        `${args.body.slice(0, 180)}` +
        (args.recurrence ? `\n↻ recurrence: ${args.recurrence.slice(0, 140)}` : "") +
        `\n→ ${deliveryNote} · credit −1`,
    });
    return { deliveryNote };
  },
});
