import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { agentmail } from "./email";

const http = httpRouter();

// AgentMail webhook ingest — Svix-verified and deduped by the component.
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => agentmail.handleWebhook(ctx as any, req)),
});

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => new Response("ok", { status: 200 })),
});

// ── x402: metered doors (PLAN.md "Billing model") ───────────────────────────
//   GET /api/credits?credits=N  → 402 terms → pay → N engine credits minted
//   GET /api/trust?slug=...     → 402 terms → pay → full dossier JSON (Trust API)
// Settlement: official facilitator (X402_FACILITATOR_URL) or dev settlement
// (X402_DEV_SETTLE=1 with a "dev-" X-PAYMENT header) for demos.

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const USDC_DECIMALS = 6;

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function x402(
  url: URL,
  priceUsd: number,
  description: string,
  paymentHeader: string | null
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const payTo = process.env.X402_PAYTO_ADDRESS;
  if (!payTo) return { ok: false, response: json({ error: "x402 not configured (X402_PAYTO_ADDRESS missing)" }, 500) };

  const requirements = {
    scheme: "exact",
    network: "base",
    maxAmountRequired: String(Math.round(priceUsd * 10 ** USDC_DECIMALS)),
    resource: `${url.origin}${url.pathname}${url.search}`,
    description,
    mimeType: "application/json",
    payTo,
    asset: USDC_BASE,
    maxTimeoutSeconds: 60,
    extra: { name: "USD Coin", version: "2" },
  };
  if (!paymentHeader) {
    return {
      ok: false,
      response: json({ x402Version: 1, error: "X-PAYMENT header is required", accepts: [requirements] }, 402),
    };
  }

  const devSettle = process.env.X402_DEV_SETTLE === "1" && paymentHeader.startsWith("dev-");
  const facilitator = process.env.X402_FACILITATOR_URL;
  if (devSettle) return { ok: true };
  if (!facilitator) {
    return {
      ok: false,
      response: json(
        { error: "payment verification not configured", hint: "set X402_FACILITATOR_URL (production) or X402_DEV_SETTLE=1 (demo)" },
        501
      ),
    };
  }
  // synchronous settlement via the facilitator
  try {
    const res = await fetch(`${facilitator.replace(/\/$/, "")}/settle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ x402Version: 1, paymentHeader, paymentRequirements: requirements }),
      signal: AbortSignal.timeout(20_000),
    });
    const out = (await res.json()) as { success?: boolean; transaction?: string; error?: string };
    if (out.success) return { ok: true };
    return { ok: false, response: json({ error: "payment settlement failed", detail: out.error ?? null }, 402) };
  } catch (e: any) {
    return { ok: false, response: json({ error: "facilitator unreachable", detail: e.message }, 502) };
  }
}

http.route({
  path: "/api/credits",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const credits = Math.max(1, Math.min(Number(url.searchParams.get("credits") ?? 100), 100_000));
    const guard = await x402(url, credits * 0.01, `Provo Monitor: ${credits} engine credits`, req.headers.get("X-PAYMENT"));
    if (!guard.ok) return guard.response;
    const balance = await ctx.runMutation(internal.credits.settle, {
      credits,
      detail: `x402 settlement (${url.searchParams.get("credits")} credits)`,
    });
    return json({ ok: true, creditsAdded: credits, balance, settlement: "x402" });
  }),
});

http.route({
  path: "/api/trust",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) return json({ error: "missing ?slug= parameter" }, 422);
    const guard = await x402(url, 0.05, `Provo Trust API: full dossier for "${slug}"`, req.headers.get("X-PAYMENT"));
    if (!guard.ok) return guard.response;
    const project = await ctx.runQuery(api.projects.getProjectBySlug, { slug });
    if (!project) return json({ error: `no such project: ${slug}` }, 404);
    return json({
      ok: true,
      project: {
        name: project.name,
        slug: project.slug,
        chain: project.chain,
        tagline: project.tagline,
        status: project.status,
        verdict: project.verdict,
        verdictSummary: project.verdictSummary,
        sentimentScore: project.sentimentScore,
        riskTags: project.riskTags,
        recalledMemories: project.recalledMemories,
        evidence: project.evidence,
        links: project.links,
        decidedAt: project.decidedAt,
      },
      note: "verdicts are desk pipeline output with receipts — not editorial claims",
    });
  }),
});

export default http;
