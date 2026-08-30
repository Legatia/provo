import { internalAction } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import * as analysis from "./lib/analysis";
import * as firecrawl from "./lib/firecrawl";
import * as sibyl from "./lib/sibyl";
import { clamp, now, WEEK_MS } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// The agent loop: OBSERVE → DETECT → INVESTIGATE → REMEMBER → PRIORITIZE →
// REPORT. Orchestration is deterministic Convex code; intelligence comes from
// OpenAI; observations come from Firecrawl + AgentMail.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SIGNALS_PER_CYCLE = 8;
const INVESTIGATE_SCORE_THRESHOLD = 40;
const REPORT_SCORE_THRESHOLD = 50;

// ── Source fetchers (Firecrawl observation layer) ───────────────────────────

type FetchedItem = analysis.RawItem;

async function fetchHNItems(query: string, limit = 25): Promise<FetchedItem[]> {
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
    query
  )}&tags=comment&hitsPerPage=${limit}`;
  // Direct fetch — the Algolia API is public JSON, no Firecrawl cost.
  let raw = "";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    raw = await res.text();
  } catch (e: any) {
    console.warn(`HN Algolia fetch failed: ${e.message}`);
    return [];
  }
  try {
    const data = JSON.parse(raw) as {
      hits: {
        objectID: string;
        comment_text?: string;
        story_title?: string;
        author?: string;
        created_at?: string;
      }[];
    };
    return (data.hits ?? [])
      .filter((h) => h.comment_text)
      .map((h) => ({
        externalId: `hn:${h.objectID}`,
        content: h.comment_text!.slice(0, 1200),
        author: h.author,
        url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        occurredAt: h.created_at ? Date.parse(h.created_at) : now(),
        source: "hacker_news",
      }));
  } catch {
    return [];
  }
}

async function fetchSearchItems(
  query: string,
  sourceName: string,
  limit = 8
): Promise<FetchedItem[]> {
  const hits = await firecrawl.search(query, limit);
  return hits.map((h) => ({
    externalId: `web:${h.url}`,
    title: h.title,
    content: [h.title, h.description, (h.markdown ?? "").slice(0, 800)]
      .filter(Boolean)
      .join("\n\n"),
    url: h.url,
    occurredAt: now(),
    source: sourceName,
  }));
}

export async function fetchSource(
  source: { name?: string; kind: string; config: any },
  webResearch: boolean
): Promise<FetchedItem[]> {
  switch (source.kind) {
    case "hn":
      return fetchHNItems(source.config.query); // free — always on
    case "web_search":
      return webResearch
        ? fetchSearchItems(source.config.query, source.name ?? "web")
        : []; // paid — skipped when paused
    case "reddit_search":
      return webResearch
        ? fetchSearchItems(`site:reddit.com ${source.config.query}`, "reddit")
        : []; // paid — skipped when paused
    default:
      return [];
  }
}

// ── OBSERVE + DETECT: the monitoring cycle (cron) ───────────────────────────

export const runMonitorCycle = internalAction({
  args: {},
  handler: async (ctx) => {
    const task = await ctx.runMutation(internal.state.logTask, {
      type: "observe",
      status: "running",
      label: "Checking monitored sources for new signals",
    });
    try {
      // the engine watches EVERY monitored entity — web3 or not (multi-entity)
      const entities = (await ctx.runQuery(internal.queries.listMonitoredInternal, {})) as any[];
      if (entities.length === 0) {
        await ctx.runMutation(internal.state.completeTask, { taskId: task, detail: "No monitored entities configured" });
        return;
      }

      let totalSources = 0;
      let totalFetched = 0;
      let totalSignals = 0;
      const paused: string[] = [];

      for (const company of entities) {
        const sources = (await ctx.runQuery(internal.queries.listSourcesInternal, {
          company: company._id,
        })) as any[];
        totalSources += sources.length;

        // METER: source sweep per entity (credits.ts) — entities is a pricing axis
        const meter = await ctx.runMutation(internal.credits.burn, {
          company: company._id,
          action: "monitor_cycle",
          detail: `source sweep · ${company.name} · ${sources.length} sources`,
        });
        if (!meter.ok) {
          paused.push(company.name);
          continue;
        }

        let fetched = 0;
        let newSignals = 0;
        for (const source of sources) {
          let items: FetchedItem[] = [];
          try {
            items = await fetchSource(
              source,
              company.webResearchEnabled ?? firecrawl.enabled()
            );
          } catch (e: any) {
            await ctx.runMutation(internal.state.completeTask, {
              taskId: task,
              status: "complete",
              detail: `Source ${source.name} failed: ${e.message}`,
            });
            continue;
          }
          fetched += items.length;

          // change detection: hash of item ids — skip if nothing new
          const hash = await firecrawl.hashContent(items.map((i) => i.externalId).join(","));
          if (hash === source.lastContentHash) continue;

          // dedupe against already-stored signals
          const seen = new Set(
            ((await ctx.runQuery(internal.queries.listExternalIdsInternal, {
              externalIds: items.map((i) => i.externalId),
            })) as string[]) ?? []
          );
          const fresh = items.filter((i) => !seen.has(i.externalId)).slice(0, MAX_SIGNALS_PER_CYCLE);

          await ctx.runMutation(internal.state.updateSource, {
            source: source._id,
            lastContentHash: hash,
            lastItemCount: items.length,
          });

          if (fresh.length === 0) continue;

          // deterministic pre-filter: web/hn items must mention the entity by
          // name — fuzzy search matches are noise the LLM shouldn't even see.
          const keywords = (company.productKeywords ?? []).map((k: string) => k.toLowerCase());
          const plausible = fresh.filter((i) => {
            if (i.source === "email") return true; // email is addressed to us
            const hay = `${i.title ?? ""} ${i.content}`.toLowerCase();
            return keywords.some((k: string) => hay.includes(k));
          });
          if (plausible.length === 0) continue;

          // DETECT: classify against this entity's watch rules
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
            const item = fresh.find((i) => i.externalId === c.externalId);
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
              newSignals++;
              await ctx.runMutation(internal.state.logTask, {
                company: company._id,
                type: "detect",
                status: "complete",
                label: `Detected signal: ${c.productArea} (${company.name})`,
                detail: item.content.slice(0, 200),
              });
              // cluster into issues (sequential to keep LLM usage sane)
              await ctx.runAction(internal.agent.processSignal, { signalId });
            }
          }
        }
        totalFetched += fetched;
        totalSignals += newSignals;
      }

      await ctx.runMutation(internal.state.completeTask, {
        taskId: task,
        detail: `Swept ${entities.length} entities · ${totalSources} sources · ${totalFetched} items · ${totalSignals} new signals${
          paused.length ? ` · paused (no credits): ${paused.join(", ")}` : ""
        }`,
      });
    } catch (e: any) {
      await ctx.runMutation(internal.state.completeTask, {
        taskId: task,
        status: "failed",
        detail: e.message,
      });
      throw e;
    }
  },
});

// ── Cluster a signal into issues (with memory of resolved issues) ───────────

export const processSignal = internalAction({
  args: { signalId: v.id("signals") },
  handler: async (ctx, args) => {
    const signal = (await ctx.runQuery(internal.queries.getSignalInternal, {
      signalId: args.signalId,
    })) as any;
    if (!signal) return;

    // METER: signal classification (credits.ts) — silent: blocked signals don't
    // each get a ledger row
    const meter = await ctx.runMutation(internal.credits.burn, {
      company: signal.company,
      action: "signal",
      silent: true,
    });
    if (!meter.ok) return;
    const company = (await ctx.runQuery(internal.queries.getCompanyByIdInternal, {
      id: signal.company,
    })) as any;

    const openIssues = (await ctx.runQuery(internal.queries.listIssuesInternal, {
      company: signal.company,
      statuses: ["emerging", "confirmed", "critical", "watching"],
    })) as any[];

    // REMEMBER: decision-time history. When memory is on, this comes from
    // Sibyl recall over the bridge — never from the Convex resolved-issues
    // table (memory is load-bearing: bridge down ⇒ decide with NO history,
    // visibly logged, never a silent fallback).
    const memoryOn = company?.memoryEnabled ?? false;
    let resolvedIssues: any[] = [];
    if (memoryOn) {
      try {
        const memories = await sibyl.recall({
          query: [signal.content, ...(signal.topics ?? [])].join(" ").slice(0, 400),
          k: 5,
        });
        resolvedIssues = memories.map((m) => ({
          // prefixed ids can never collide with Convex issue ids
          id: `sibyl:${m.category ?? "memory"}/${m.name}`,
          title: m.name,
          description: m.text.slice(0, 600),
          status: "resolved",
        }));
        await ctx.runMutation(internal.state.logTask, {
          company: signal.company,
          type: "remember",
          status: "complete",
          label: `Sibyl recall: ${memories.length} memor${memories.length === 1 ? "y" : "ies"} fed into clustering`,
          detail:
            memories
              .slice(0, 3)
              .map((m) => `${m.name} (${m.kind}): ${m.text.slice(0, 110)}`)
              .join("\n") || "no matching memories — treating as new",
        });
      } catch (e: any) {
        await ctx.runMutation(internal.state.logTask, {
          company: signal.company,
          type: "remember",
          status: "failed",
          label: "Sibyl recall failed — deciding without historical context",
          detail: String(e.message ?? e).slice(0, 200),
        });
      }
    } else {
      resolvedIssues = (await ctx.runQuery(internal.queries.listIssuesInternal, {
        company: signal.company,
        statuses: ["resolved"],
      })) as any[];
    }

    const match = await analysis.matchSignalToIssue({
      signal: {
        content: signal.content,
        topics: signal.topics,
        productArea: signal.productArea ?? "",
        affectedSegment: signal.affectedSegment,
      },
      openIssues: openIssues.map((i: any) => ({
        id: i._id,
        title: i.title,
        description: i.description,
        status: i.status,
        affectedSegment: i.affectedSegment,
      })),
      resolvedIssues: resolvedIssues.map((i: any) => ({
        id: i._id,
        title: i.title,
        description: i.description,
        status: i.status,
        affectedSegment: i.affectedSegment,
      })),
    });

    let issueId: any = null;
    if (
      match.action === "existing" &&
      match.issueId &&
      !String(match.issueId).startsWith("sibyl:") // Sibyl memories are history, not open issues
    ) {
      issueId = match.issueId;
      await ctx.runMutation(internal.state.linkSignalToIssue, {
        signalId: args.signalId,
        issue: issueId,
      });
    } else {
      // new issue — possibly a recurrence of a historical one
      const draft = await analysis.draftNewIssue({
        signal: {
          content: signal.content,
          topics: signal.topics,
          productArea: signal.productArea ?? "",
          affectedSegment: signal.affectedSegment,
        },
      });
      issueId = await ctx.runMutation(internal.state.createIssue, {
        company: signal.company,
        title: draft.title,
        description: draft.description,
        severity: draft.severity,
        affectedSegment: signal.affectedSegment,
        detectedAt: signal.occurredAt,
        historicalNote: match.action === "historical" ? match.rationale : undefined,
      });
      await ctx.runMutation(internal.state.linkSignalToIssue, {
        signalId: args.signalId,
        issue: issueId,
      });
      await ctx.runMutation(internal.state.logTask, {
        company: signal.company,
        type: "remember",
        status: "complete",
        label: `Opened new issue: ${draft.title}`,
        detail: match.action === "historical" ? match.rationale : undefined,
        issue: issueId,
      });
    }

    // evidence: every signal backing an issue is traceable
    await ctx.runMutation(internal.state.addEvidence, {
      issue: issueId,
      source: signal.source,
      url: signal.sourceUrl,
      excerpt: signal.content.slice(0, 300),
      occurredAt: signal.occurredAt,
      relevance: signal.urgency,
      kind: signal.source === "email" ? "email" : "signal",
      signalId: args.signalId,
    });

    const metrics = await ctx.runMutation(internal.state.recomputeIssue, { issue: issueId });

    // PRIORITIZE: escalate to investigation when warranted
    if (
      metrics.priorityScore >= INVESTIGATE_SCORE_THRESHOLD &&
      metrics.mentionsThisWeek >= 3
    ) {
      const recent = (await ctx.runQuery(internal.queries.recentInvestigationInternal, {
        issue: issueId,
        sinceMs: 30 * 60 * 1000,
      })) as boolean;
      if (!recent) {
        await ctx.scheduler.runAfter(0, internal.agent.investigateIssue, {
          issue: issueId,
          triggeredBy: "threshold",
        });
      }
    }
  },
});

// ── INVESTIGATE: targeted web research with visible progress ────────────────

export const investigateIssue = internalAction({
  args: {
    issue: v.id("issues"),
    triggeredBy: v.string(),
    question: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // atomic guard: skip if an investigation already ran recently
    const investigationId = await ctx.runMutation(internal.state.tryBeginInvestigation, {
      issue: args.issue,
      triggeredBy: args.triggeredBy,
      question: args.question,
    });
    if (!investigationId) return;

    const issue = (await ctx.runQuery(internal.queries.getIssueInternal, {
      issue: args.issue,
    })) as any;
    if (!issue) throw new Error("Issue not found");
    const company = (await ctx.runQuery(internal.queries.getCompanyByIdInternal, {
      id: issue.company,
    })) as any;

    const task = await ctx.runMutation(internal.state.logTask, {
      company: issue.company,
      type: "investigate",
      status: "running",
      label: args.question
        ? `Investigating: ${args.question.slice(0, 80)}`
        : `Investigating "${issue.title}"`,
      issue: args.issue,
    });

    // METER: deep dig (credits.ts)
    const meter = await ctx.runMutation(internal.credits.burn, {
      company: issue.company,
      action: "investigation",
      detail: issue.title,
    });
    if (!meter.ok) {
      await ctx.runMutation(internal.state.patchInvestigation, {
        investigation: investigationId,
        patch: { status: "failed", completedAt: now() },
      });
      await ctx.runMutation(internal.state.completeTask, {
        taskId: task,
        detail: `investigation blocked — ${meter.reason}`,
      });
      return;
    }

    // 1. plan
    const fcEnabled = company?.webResearchEnabled ?? firecrawl.enabled();
    const plan = await analysis.planInvestigation({
      issue: {
        title: issue.title,
        description: issue.description,
        affectedSegment: issue.affectedSegment,
      },
      question: args.question,
      product: company?.product ?? "",
      realProduct: company?.realProduct ?? false,
    });
    const queries = fcEnabled ? plan.queries.slice(0, 2) : [];
    await ctx.runMutation(internal.state.patchInvestigation, {
      investigation: investigationId,
      patch: {
        status: "running",
        plan: fcEnabled
          ? queries.map((q) => `Search: "${q}"`)
          : ["Web research paused (Firecrawl budget) — analyzing existing evidence"],
      },
    });

    try {
      // 2. search (sequentially so progress is visible in the UI)
      const hits: { title: string; url: string; description: string; markdown?: string }[] = [];
      const seenUrls = new Set<string>();
      for (let i = 0; i < queries.length; i++) {
        const results = await firecrawl.searchWithBackoff(queries[i], 4);
        for (const r of results) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            hits.push(r);
          }
        }
        await ctx.runMutation(internal.state.patchInvestigation, {
          investigation: investigationId,
          patch: { stepIndex: i + 1 },
        });
        await ctx.runMutation(internal.state.completeTask, {
          taskId: task,
          detail: `Searched "${queries[i]}" — ${results.length} results`,
        });
      }

      // 3. extract evidence
      const evidence = await analysis.extractEvidence({
        issue: {
          title: issue.title,
          description: issue.description,
          affectedSegment: issue.affectedSegment,
        },
        question: args.question,
        results: hits.slice(0, 10),
      });
      let added = 0;
      for (const e of evidence) {
        const ok = await ctx.runMutation(internal.state.addEvidence, {
          issue: args.issue,
          source: "web",
          url: e.url,
          excerpt: e.excerpt,
          occurredAt: now(),
          relevance: Math.round(clamp(e.relevance, 0, 100)),
          kind: "web",
        });
        if (ok) added++;
      }

      // 4. REMEMBER: compare with historical issues — Sibyl recall when memory
      // is on (fail-closed), Convex resolved-issues only when it's off.
      let resolvedIssues: any[] = [];
      if (company?.memoryEnabled ?? false) {
        try {
          const memories = await sibyl.recall({
            query: `${issue.title} ${issue.description}`.slice(0, 400),
            k: 5,
          });
          resolvedIssues = memories.map((m) => ({
            title: m.name,
            description: m.text.slice(0, 600),
            resolvedAt: 0,
          }));
          await ctx.runMutation(internal.state.logTask, {
            company: issue.company,
            type: "remember",
            status: "complete",
            label: `Sibyl recall: ${memories.length} memories for historical comparison`,
            detail:
              memories
                .slice(0, 3)
                .map((m) => `${m.name} (${m.kind}): ${m.text.slice(0, 110)}`)
                .join("\n") || "no matching memories",
          });
        } catch (e: any) {
          await ctx.runMutation(internal.state.logTask, {
            company: issue.company,
            type: "remember",
            status: "failed",
            label: "Sibyl recall failed — comparing with no historical context",
            detail: String(e.message ?? e).slice(0, 200),
          });
        }
      } else {
        resolvedIssues = (await ctx.runQuery(internal.queries.listIssuesInternal, {
          company: issue.company,
          statuses: ["resolved"],
        })) as any[];
      }
      const history = await analysis.compareWithHistory({
        issue: {
          title: issue.title,
          description: issue.description,
          affectedSegment: issue.affectedSegment,
        },
        resolvedIssues: resolvedIssues.map((i: any) => ({
          title: i.title,
          description: i.description,
          resolvedAt: i.resolvedAt ?? 0,
          resolutionNote: i.resolutionNote,
          affectedSegment: i.affectedSegment,
        })),
      });

      // 5. assess + update the issue
      const assessment = await analysis.assessIssue({
        issue: {
          title: issue.title,
          description: issue.description,
          status: issue.status,
          affectedSegment: issue.affectedSegment,
        },
        evidence: evidence.map((e) => ({ excerpt: e.excerpt, source: e.url, note: e.note })),
        stats: {
          mentionsThisWeek: issue.mentionsThisWeek,
          mentionsPrevWeek: issue.mentionsPrevWeek,
        },
      });

      // confidence from evidence volume + source diversity
      const allEvidence = (await ctx.runQuery(internal.queries.listEvidenceInternal, {
        issue: args.issue,
      })) as any[];
      const distinctKinds = new Set(allEvidence.map((e: any) => e.kind)).size;
      const confidence = Math.round(
        clamp(35 + allEvidence.length * 5 + distinctKinds * 10, 35, 92)
      );

      const metrics = await ctx.runMutation(internal.state.recomputeIssue, {
        issue: args.issue,
        impact: assessment.impact,
        novelty: assessment.novelty,
      });
      const newStatus =
        metrics.priorityScore >= 75
          ? "critical"
          : allEvidence.filter((e: any) => e.kind === "web").length >= 2
            ? "confirmed"
            : issue.status;
      await ctx.runMutation(internal.state.patchIssue, {
        issue: args.issue,
        patch: {
          confidence,
          status: newStatus,
          recommendedAction: assessment.recommendedAction,
          reasoningSummary: assessment.reasoningSummary,
          historicalNote: history.historicalNote ?? issue.historicalNote,
        },
      });

      // REMEMBER (write-through): the conclusion lands in Sibyl so future
      // decisions recall it even after a full Convex wipe.
      if ((company?.memoryEnabled ?? false) && assessment.reasoningSummary) {
        const memName = sibyl.slug(issue.title);
        try {
          await sibyl.save({
            kind: "entity",
            category: "issue_conclusion",
            name: memName,
            body: {
              title: issue.title,
              status: newStatus,
              affectedSegment: issue.affectedSegment ?? null,
              recommendedAction: assessment.recommendedAction ?? null,
              reasoningSummary: assessment.reasoningSummary,
              historicalNote: history.historicalNote ?? null,
            },
            meta: { issueId: String(args.issue) },
          });
          await sibyl.save({
            kind: "event",
            text: `Investigated "${issue.title}" — status ${newStatus}, confidence ${confidence}%. ${assessment.reasoningSummary}`,
            meta: { issueId: String(args.issue) },
          });
          await ctx.runMutation(internal.state.logTask, {
            company: issue.company,
            type: "remember",
            status: "complete",
            label: `Saved conclusion to Sibyl memory: ${issue.title}`,
            detail: `issue_conclusion/${memName} + journal event`,
          });
        } catch (e: any) {
          await ctx.runMutation(internal.state.logTask, {
            company: issue.company,
            type: "remember",
            status: "failed",
            label: "Sibyl write-through failed",
            detail: String(e.message ?? e).slice(0, 200),
          });
        }
      }

      await ctx.runMutation(internal.state.patchInvestigation, {
        investigation: investigationId,
        patch: {
          status: "complete",
          completedAt: now(),
          findings: [
            fcEnabled
              ? `${added} new evidence items from ${seenUrls.size} sources.`
              : "Web research paused (Firecrawl budget exhausted) — analysis based on stored email and discussion evidence.",
            history.historicalNote ?? "No similar historical issue found.",
            assessment.reasoningSummary,
          ].join("\n\n"),
        },
      });
      await ctx.runMutation(internal.state.completeTask, {
        taskId: task,
        detail: `Found ${added} corroborating evidence items · confidence ${confidence}%`,
      });

      // ALERT: Monitor subscription — escalation or recurrence fires an alert
      // (recurrence copy comes from Sibyl recall)
      if (newStatus !== issue.status || history.historicalNote) {
        await ctx.runAction(internal.alerts.sendAlert, {
          company: issue.company,
          kind: "finding",
          title: `${issue.title} — now ${newStatus}`,
          body: assessment.reasoningSummary ?? issue.description,
          recurrence: history.historicalNote ?? undefined,
        });
      }

      // 6. REPORT if important enough (employee questions are answered by
      // the thread reply itself — no extra report email needed)
      if (metrics.priorityScore >= REPORT_SCORE_THRESHOLD && args.triggeredBy !== "employee_reply") {
        await ctx.runAction(internal.agent.reportIssue, {
          issue: args.issue,
          kind: "alert",
        });
      }
    } catch (e: any) {
      await ctx.runMutation(internal.state.patchInvestigation, {
        investigation: investigationId,
        patch: { status: "failed", completedAt: now() },
      });
      await ctx.runMutation(internal.state.completeTask, {
        taskId: task,
        status: "failed",
        detail: e.message,
      });
      throw e;
    }
  },
});

// ── REPORT: draft + send the internal email ─────────────────────────────────

export const reportIssue = internalAction({
  args: { issue: v.id("issues"), kind: v.string() },
  handler: async (ctx, args) => {
    const issue = (await ctx.runQuery(internal.queries.getIssueInternal, {
      issue: args.issue,
    })) as any;
    if (!issue) return;

    // throttle: don't email the team about the same issue twice within 10 min
    if (
      args.kind !== "followup" &&
      issue.lastReportedAt &&
      issue.lastReportedAt > now() - 10 * 60 * 1000
    ) {
      return;
    }
    const company = (await ctx.runQuery(internal.queries.getCompanyByIdInternal, {
      id: issue.company,
    })) as any;    const evidence = (await ctx.runQuery(internal.queries.listEvidenceInternal, {
      issue: args.issue,
    })) as any[];

    const task = await ctx.runMutation(internal.state.logTask, {
      company: issue.company,
      type: "report",
      status: "running",
      label: `Emailing internal report: ${issue.title}`,
      issue: args.issue,
    });

    const draft = await analysis.draftIssueReport({
      issue: {
        title: issue.title,
        description: issue.description,
        mentionsThisWeek: issue.mentionsThisWeek,
        mentionsPrevWeek: issue.mentionsPrevWeek,
        affectedSegment: issue.affectedSegment,
        confidence: issue.confidence,
        historicalNote: issue.historicalNote,
        recommendedAction: issue.recommendedAction,
        reasoningSummary: issue.reasoningSummary,
      },
      evidence: evidence
        .filter((e: any) => e.kind !== "historical")
        .slice(0, 6)
        .map((e: any) => ({ excerpt: e.excerpt, url: e.url, source: e.source })),
      company: company?.name ?? "",
    });

    const to = company?.employeeEmail;
    const inbox = company?.agentInbox;
    if (!to || !inbox) throw new Error("Company email config missing");

    const sent = await ctx.runAction(internal.email.sendEmail, {
      inboxId: inbox,
      to,
      subject: draft.subject,
      text: draft.body,
      labels: ["intelligence-report"],
    });
    await ctx.runMutation(internal.state.insertReport, {
      issue: args.issue,
      company: issue.company,
      kind: args.kind,
      subject: draft.subject,
      bodyText: draft.body,
      sentTo: to,
      scenario: company?.scenario ?? "desk",
      agentmailMessageId: sent?.message_id,
      threadId: sent?.thread_id,
    });
    await ctx.runMutation(internal.state.completeTask, {
      taskId: task,
      detail: `Sent to ${to}: "${draft.subject}"`,
    });
  },
});
