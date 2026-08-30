// ─────────────────────────────────────────────────────────────────────────────
// Direct AgentMail REST helpers.
// Used where the Convex component's client can't reach internal component
// functions (inbox provisioning) and for the polling fallback that backs up
// the webhook ingest.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "https://api.agentmail.to/v0";

function key(): string {
  const k = process.env.AGENTMAIL_API_KEY;
  if (!k) throw new Error("AGENTMAIL_API_KEY is not set in Convex env");
  return k;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (!res.ok) throw new Error(`AgentMail GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function listInboxes(): Promise<{ email: string; inbox_id: string }[]> {
  const data = await get<{ inboxes: { email: string; inbox_id: string }[] }>(
    "/inboxes?limit=100"
  );
  return data.inboxes ?? [];
}

export async function createInbox(username: string, displayName: string) {
  const res = await fetch(`${BASE}/inboxes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, display_name: displayName }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AgentMail createInbox failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as { inbox_id: string; email: string };
}

export type RemoteMessage = {
  message_id: string;
  thread_id: string;
  inbox_id: string;
  from: string;
  to: string[] | string;
  subject?: string;
  text?: string;
  preview?: string;
  labels?: string[];
  timestamp: string | number;
};

export async function listMessages(inboxId: string, limit = 25): Promise<RemoteMessage[]> {
  const data = await get<{ messages: RemoteMessage[] }>(
    `/inboxes/${encodeURIComponent(inboxId)}/messages?limit=${limit}`
  );
  return data.messages ?? [];
}

export async function sendMessage(
  inboxId: string,
  args: { to: string; subject: string; text: string; labels?: string[] }
): Promise<{ message_id: string; thread_id: string }> {
  const res = await fetch(`${BASE}/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AgentMail send failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as { message_id: string; thread_id: string };
}

export async function replyMessage(
  inboxId: string,
  parentMessageId: string,
  args: { text: string }
): Promise<{ message_id: string; thread_id: string }> {
  const res = await fetch(
    `${BASE}/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(parentMessageId)}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AgentMail reply failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as { message_id: string; thread_id: string };
}
