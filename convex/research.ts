import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { fetchSource } from "./agent";
import * as firecrawl from "./lib/firecrawl";
import * as analysis from "./lib/analysis";
import { clamp, now } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// Live research burst — bounded, visible Firecrawl usage for demos.
// Start opens a timed session; a chained action sweeps sources + runs one
// rotating product search per iteration until the window closes or Stop is
// pressed. Each sweep is logged to the activity feed so the audience can see
// Firecrawl working in realtime.
// ─────────────────────────────────────────────────────────────────────────────

const SWEEP_GAP_MS = 6_000;
const ANGLES = [
  "complaints",
  "issues this week",
  "rate limits OR errors",
  "vs alternatives",
  "pricing complaints",
  "outage OR status",
];

export const startResearch = mutation({
  args: { durationSec: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const company = await ctx.db.query("companies").first();
    if (!company) throw new Error("Run setup first");
    const durationSec = Math.min(Math.max(args.durationSec ?? 120, 30), 600);
    await ctx.db.patch(company._id, {
      researchSession: {
        running: true,
        startedAt: now(),
        endsAt: now() + durationSec * 1000,
        iterations: 0,
        itemsSeen: 0,
        signalsFound: 0,
      },
    });
    await ctx.db.insert("agentTasks", {
      company: company._id,
      type: "observe",
      status: "running",
      label: `Live research started — ${Math.round(durationSec / 60)} min web sweep`,
      detail: "Fetching monitored sources + rotating product searches",
      startedAt: now(),
    });
    await ctx.scheduler.runAfter(0, internal.research.sweep, {});
    return durationSec;
  },
});

export const stopResearch = mutation({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company?.researchSession?.running) return "not running";
    const s = company.researchSession;
    await ctx.db.patch(company._id, {
      researchSession: { ...s, running: false },
    });
    await ctx.db.insert("agentTasks", {
      company: company._id,
      type: "observe",
      status: "complete",
      label: `Live research stopped by operator`,
      detail: `${s.iterations} sweeps · ${s.itemsSeen} items seen · ${s.signalsFound} new signals`,
      startedAt: now(),
      completedAt: now(),
    });
    return "stopped";
  },
});

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    const s = company?.researchSession;
    return {
      running: !!s?.running && (s?.endsAt ?? 0) > now(),
      startedAt: s?.startedAt,
      endsAt: s?.endsAt,
      iterations: s?.iterations ?? 0,
      itemsSeen: s?.itemsSeen ?? 0,
      signalsFound: s?.signalsFound ?? 0,
      webResearchEnabled: company?.webResearchEnabled ?? true,
    };
  },
});

/** One sweep iteration; chains itself while the session window is open. */
export const sweep = internalAction({
  args: {},
  handler: async (ctx) => {
    const company = (await ctx.runQuery(internal.queries.getCompanyInternal, {})) as any;
    const s = company?.researchSession;
    if (!company || !s?.running || s.endsAt <= now()) {
      await ctx.runMutation(internal.research.finalize, {});
      return;
    }
    const iteration = s.iterations + 1;
    const webOn = company.webResearchEnabled ?? firecrawl.enabled();

    // 1) sweep one configured source per iteration (rotate through them)
    const sources = (await ctx.runQuery(internal.queries.listSourcesInternal, {
      company: company._id,
    })) as any[];
    const source = sources[(iteration - 1) % Math.max(sources.length, 1)];
    let items: any[] = [];
    try {
      items = await fetchSource(source, webOn);
    } catch {
      items = [];
    }

    // dedupe against already-stored signals
    const seen = new Set(
      ((await ctx.runQuery(internal.queries.listExternalIdsInternal, {
        externalIds: items.map((i: any) => i.externalId),
      })) as string[]) ?? []
    );
    const fresh = items.filter((i: any) => !seen.has(i.externalId)).slice(0, 5);

    // 2) one rotating product search — the visible Firecrawl moment
    const angle = ANGLES[(iteration - 1) % ANGLES.length];
    const queryStr = `${company.product} ${angle}`;
    let hits: any[] = [];
    if (webOn) {
      hits = await firecrawl.searchLite(queryStr, 4);
    }

    await ctx.runMutation(internal.state.logTask, {
      company: company._id,
      type: "observe",
      status: "complete",
      label: `Research sweep ${iteration}: ${source?.name ?? "sources"} + web search`,
      detail: `${items.length} source items · searched "${queryStr}" — ${hits.length} results`,
    });

    // 3) classify fresh source items + web hits into candidate signals
    const candidates: any[] = [
      ...fresh,
      ...hits.map((h) => ({
        externalId: `web:${h.url}`,
        title: h.title,
        content: [h.title, h.description].join("\n"),
        url: h.url,
        occurredAt: now(),
        source: "web",
      })),
    ].slice(0, 6);

    let signalsFound = 0;
    if (candidates.length > 0) {
      const keywords = ((company.productKeywords ?? []) as string[]).map((k: string) => k.toLowerCase());
      const plausible = candidates.filter((c: any) =>
        keywords.some((k: string) => `${c.title ?? ""} ${c.content}`.toLowerCase().includes(k))
      );
      if (plausible.length > 0) {
        const rules = (await ctx.runQuery(internal.queries.listWatchRulesInternal, {
          company: company._id,
        })) as any[];
        const classified = await analysis.classifyItems({
          company: company.name,
          product: company.product,
          watchRules: rules.map((r: any) => ({
            label: r.label,
            description: r.description,
            keywords: r.keywords,
          })),
          items: plausible,
        });
        for (const c of classified) {
          if (!c.relevant) continue;
          const item = plausible.find((i) => i.externalId === c.externalId);
          if (!item) continue;
          const signalId = await ctx.runMutation(internal.state.insertSignal, {
            company: company._id,
            source: item.source,
            sourceUrl: item.url,
            externalId: item.externalId,
            occurredAt: item.occurredAt,
            content: item.content,
            author: item.author,
            relevant: true,
            reason: c.reason,
            topics: c.topics,
            sentiment: c.sentiment,
            urgency: Math.round(clamp(c.urgency, 0, 100)),
            productArea: c.productArea,
            affectedSegment: c.affectedSegment,
          });
          if (signalId) {
            signalsFound++;
            // cluster at most one new signal per sweep (keeps LLM spend sane)
            if (signalsFound === 1) {
              await ctx.scheduler.runAfter(0, internal.agent.processSignal, { signalId });
            }
          }
        }
      }
    }

    await ctx.runMutation(internal.research.bumpStats, {
      iteration,
      itemsSeen: items.length + hits.length,
      signalsFound,
    });

    // 4) chain while the window is open
    if (s.endsAt > now() + SWEEP_GAP_MS) {
      await ctx.scheduler.runAfter(SWEEP_GAP_MS, internal.research.sweep, {});
    } else {
      await ctx.runMutation(internal.research.finalize, {});
    }
  },
});

export const bumpStats = internalMutation({
  args: { iteration: v.number(), itemsSeen: v.number(), signalsFound: v.number() },
  handler: async (ctx, args) => {
    const company = await ctx.db.query("companies").first();
    if (!company?.researchSession) return;
    const s = company.researchSession;
    await ctx.db.patch(company._id, {
      researchSession: {
        ...s,
        iterations: args.iteration,
        itemsSeen: s.itemsSeen + args.itemsSeen,
        signalsFound: s.signalsFound + args.signalsFound,
      },
    });
  },
});

export const finalize = internalMutation({
  args: {},
  handler: async (ctx) => {
    const company = await ctx.db.query("companies").first();
    if (!company?.researchSession?.running) return;
    const s = company.researchSession;
    await ctx.db.patch(company._id, { researchSession: { ...s, running: false } });
    await ctx.db.insert("agentTasks", {
      company: company._id,
      type: "observe",
      status: "complete",
      label: `Live research complete — ${s.iterations} sweeps`,
      detail: `${s.itemsSeen} items seen · ${s.signalsFound} new signals`,
      startedAt: now(),
      completedAt: now(),
    });
  },
});
