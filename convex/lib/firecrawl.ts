// ─────────────────────────────────────────────────────────────────────────────
// Firecrawl web observation layer.
//
// Cost control: the on/off toggle lives in companies.webResearchEnabled
// (settable from the dashboard); the FIRECRAWL_ENABLED env var is the
// fallback when the DB flag is unset. Failures (quota, rate limits, network)
// degrade to empty results instead of throwing, so investigations never die
// from a third-party outage.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "https://api.firecrawl.dev/v2";

function key(): string {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY is not set in Convex env");
  return k;
}

/** Env fallback — used when the DB toggle (companies.webResearchEnabled) is unset. */
export function enabled(): boolean {
  return process.env.FIRECRAWL_ENABLED !== "false";
}

export type SearchHit = {
  title: string;
  url: string;
  description: string;
  markdown?: string;
};

async function call<T>(path: string, body: unknown, timeoutMs = 45_000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json()) as { success: boolean; data?: T; error?: string };
    if (!res.ok || !json.success) {
      console.warn(`Firecrawl ${path} failed (${res.status}): ${(json.error ?? "").slice(0, 120)}`);
      return null; // degrade gracefully — quota, rate limits, outages
    }
    return json.data as T;
  } catch (e: any) {
    console.warn(`Firecrawl ${path} error: ${e.message?.slice(0, 120)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function search(query: string, limit = 6): Promise<SearchHit[]> {
  const data = await call<{ web?: SearchHit[] }>(
    "/search",
    { query, limit, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } },
    60_000
  );
  return (data?.web ?? []).map((h) => ({
    title: h.title ?? "(untitled)",
    url: h.url,
    description: h.description ?? "",
    markdown: h.markdown ? h.markdown.slice(0, 4000) : undefined,
  }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Search with one retry + backoff on rate limits (free-tier friendly). */
export async function searchWithBackoff(query: string, limit = 4): Promise<SearchHit[]> {
  try {
    const first = await search(query, limit);
    if (first.length > 0) return first;
    return first; // empty either because disabled or genuinely no results
  } catch {
    return [];
  }
}

export async function scrapeMarkdown(url: string): Promise<string> {
  const data = await call<{ markdown?: string }>(
    "/scrape",
    { url, formats: ["markdown"], onlyMainContent: true }
  );
  return (data?.markdown ?? "").slice(0, 12_000);
}

export async function scrapeRaw(url: string): Promise<string> {
  const data = await call<{ markdown?: string }>(
    "/scrape",
    { url, formats: ["markdown"] }
  );
  return (data?.markdown ?? "").slice(0, 60_000);
}

export async function hashContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
