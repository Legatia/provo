import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
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

// ── x402: engine credits, metered (PLAN.md "Billing model") ─────────────────
// GET /api/credits?credits=100 → 402 + USDC payment terms on Base. Pay with any
// x402 client (scripts/x402-buy.mjs) and retry with the X-PAYMENT header; the
// settlement mints engine credits. Verification paths: the official facilitator
// (X402_FACILITATOR_URL) or dev settlement (X402_DEV_SETTLE=1, "dev-" header).

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const USDC_DECIMALS = 6;

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function paymentRequirements(origin: string, credits: number, payTo: string) {
  return {
    scheme: "exact",
    network: "base",
    maxAmountRequired: String(credits * 10 ** (USDC_DECIMALS - 2)), // 1 credit = $0.01
    resource: `${origin}/api/credits?credits=${credits}`,
    description: `Provo Monitor: ${credits} engine credits`,
    mimeType: "application/json",
    payTo,
    asset: USDC_BASE,
    maxTimeoutSeconds: 60,
    extra: { name: "USD Coin", version: "2" },
  };
}

http.route({
  path: "/api/credits",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const credits = Math.max(1, Math.min(Number(url.searchParams.get("credits") ?? 100), 100_000));
    const payTo = process.env.X402_PAYTO_ADDRESS;
    if (!payTo) return json({ error: "x402 not configured (X402_PAYTO_ADDRESS missing)" }, 500);

    const requirements = paymentRequirements(url.origin, credits, payTo);
    const paymentHeader = req.headers.get("X-PAYMENT");
    if (!paymentHeader) {
      return json({ x402Version: 1, error: "X-PAYMENT header is required", accepts: [requirements] }, 402);
    }

    // settlement: facilitator if configured, else dev settlement for demos
    const devSettle = process.env.X402_DEV_SETTLE === "1" && paymentHeader.startsWith("dev-");
    const facilitator = process.env.X402_FACILITATOR_URL;
    let settled = false;
    let detail = "";
    if (devSettle) {
      settled = true;
      detail = `dev settlement (${paymentHeader})`;
    } else if (facilitator) {
      try {
        const res = await fetch(`${facilitator.replace(/\/$/, "")}/settle`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ x402Version: 1, paymentHeader, paymentRequirements: requirements }),
          signal: AbortSignal.timeout(20_000),
        });
        const out = (await res.json()) as { success?: boolean; transaction?: string; error?: string };
        if (out.success) {
          settled = true;
          detail = `tx ${out.transaction ?? "settled"}`;
        } else {
          return json({ error: "payment settlement failed", detail: out.error ?? null }, 402);
        }
      } catch (e: any) {
        return json({ error: "facilitator unreachable", detail: e.message }, 502);
      }
    } else {
      return json(
        {
          error: "payment verification not configured",
          hint: "set X402_FACILITATOR_URL (production) or X402_DEV_SETTLE=1 (demo)",
        },
        501
      );
    }

    const balance = await ctx.runMutation(internal.credits.settle, { credits, detail });
    return json({ ok: true, creditsAdded: credits, balance, settlement: detail });
  }),
});

export default http;
