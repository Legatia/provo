// HTTP client for sibyl-bridge (FastAPI in front of the local Sibyl Memory
// SQLite file). The agent's long-term memory lives behind this bridge; Convex
// keeps only operational state. Env: SIBYL_BRIDGE_URL, SIBYL_BRIDGE_TOKEN.

const BRIDGE_TIMEOUT_MS = 15_000;

export type RecalledMemory = {
  kind: string; // "entity" | "journal" | "reference" | "state"
  category?: string;
  name: string;
  text: string;
  ts?: string;
  rank?: number;
};

function bridgeUrl(): string {
  const url = process.env.SIBYL_BRIDGE_URL;
  if (!url) throw new Error("SIBYL_BRIDGE_URL env var not set");
  return url.replace(/\/$/, "");
}

function headers(): Record<string, string> {
  const token = process.env.SIBYL_BRIDGE_TOKEN;
  if (!token) throw new Error("SIBYL_BRIDGE_TOKEN env var not set");
  return {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${bridgeUrl()}${path}`, {
    ...init,
    headers: headers(),
    signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`sibyl-bridge ${path} → ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export type SaveArgs = {
  kind: "entity" | "event" | "reference";
  category?: string;
  name?: string;
  text?: string;
  body?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  status?: string;
  tenant?: string;
};

export async function save(args: SaveArgs): Promise<void> {
  await call("/save", { method: "POST", body: JSON.stringify(args) });
}

export async function recall(args: {
  query: string;
  k?: number;
  tenant?: string;
}): Promise<RecalledMemory[]> {
  const out = await call<{ count: number; memories: RecalledMemory[] }>("/recall", {
    method: "POST",
    body: JSON.stringify({ query: args.query, k: args.k ?? 5, tenant: args.tenant }),
  });
  return out.memories ?? [];
}

export async function health(): Promise<{
  ok: boolean;
  db?: string;
  tenant?: string;
  tier?: string;
  schema_version?: number | null;
}> {
  return call("/health", { method: "GET" });
}

/** Sibyl identifiers are validated (no control chars / path traversal, ≤1024). */
export function slug(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s || "untitled";
}
