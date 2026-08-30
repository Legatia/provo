import { internalAction, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import * as sibyl from "./lib/sibyl";
import { now } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// The desk's long-term memory (Sibyl) — health monitoring + seeding.
// Read-at-decision and write-through live in agent.ts, which calls lib/sibyl
// directly; this module owns the dashboard-facing and setup-facing flows.
// ─────────────────────────────────────────────────────────────────────────────

type BridgeHealth = { ok: boolean; detail: string };

/** Dashboard "Test bridge" button: probe + store + return the result. */
export const checkBridge = action({
  args: {},
  handler: async (ctx): Promise<BridgeHealth> => {
    return await ctx.runAction(internal.memory.checkBridgeInternal, {});
  },
});

/** Probe the bridge and store the result for the dashboard chip. */
export const checkBridgeInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<BridgeHealth> => {
    let result: BridgeHealth;
    try {
      const h = await sibyl.health();
      result = {
        ok: true,
        detail: `tenant ${h.tenant ?? "?"} · tier ${h.tier ?? "?"} · schema v${h.schema_version ?? "?"}`,
      };
    } catch (e: any) {
      result = { ok: false, detail: String(e.message ?? e).slice(0, 200) };
    }
    await ctx.runMutation(internal.memory.storeHealth, { health: result });
    return result;
  },
});

export const storeHealth = internalMutation({
  args: { health: v.object({ ok: v.boolean(), detail: v.string() }) },
  handler: async (ctx, args) => {
    const company = await ctx.db.query("companies").first();
    if (!company) return;
    await ctx.db.patch(company._id, {
      memoryHealth: { ...args.health, checkedAt: now() },
    });
  },
});

/**
 * Write every resolved issue into Sibyl (idempotent upserts): a WARM entity
 * per incident, a COLD journal event, and a REFERENCE "what worked" doc.
 * Called by the demo's seedHistory step and safe to re-run any time.
 */
export const seedResolvedHistory = internalAction({
  args: {},
  handler: async (ctx) => {
    const company = (await ctx.runQuery(internal.queries.getCompanyInternal, {})) as any;
    if (!company) return;
    const resolved = (await ctx.runQuery(internal.queries.listIssuesInternal, {
      company: company._id,
      statuses: ["resolved"],
    })) as any[];
    if (resolved.length === 0) return;

    let saved = 0;
    for (const issue of resolved) {
      const name = sibyl.slug(issue.title);
      try {
        await sibyl.save({
          kind: "entity",
          category: "resolved_incident",
          name,
          body: {
            title: issue.title,
            description: issue.description,
            affectedSegment: issue.affectedSegment ?? null,
            resolvedAt: issue.resolvedAt ?? null,
            resolutionNote: issue.resolutionNote ?? null,
            sourceIssueId: String(issue._id),
          },
        });
        await sibyl.save({
          kind: "event",
          text: `Resolved "${issue.title}": ${issue.resolutionNote ?? "no resolution note"}`,
          meta: { category: "resolved_incident", name },
        });
        if (issue.resolutionNote) {
          await sibyl.save({
            kind: "reference",
            name: `what-worked/${name}`,
            text: issue.resolutionNote,
            meta: { title: issue.title },
          });
        }
        saved++;
      } catch (e: any) {
        await ctx.runMutation(internal.state.logTask, {
          company: company._id,
          type: "remember",
          status: "failed",
          label: `Sibyl seed failed for "${issue.title}"`,
          detail: String(e.message ?? e).slice(0, 200),
        });
      }
    }

    await ctx.runMutation(internal.state.logTask, {
      company: company._id,
      type: "remember",
      status: saved > 0 ? "complete" : "failed",
      label:
        saved > 0
          ? `Sibyl memory seeded: ${saved} resolved incident${saved === 1 ? "" : "s"} written`
          : "Sibyl memory seed failed (bridge unreachable?)",
      detail: "Long-term history now lives in Sibyl — wipe Convex and it survives.",
    });
  },
});
