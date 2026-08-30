import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../lib/convex";
import { Card, Button } from "../components/ui";

const SUGGESTIONS = [
  "What are customers complaining about this week?",
  "Which issue is most urgent?",
  "Investigate the checkout issue.",
  "Are competitors seeing the same thing?",
  "Email me the findings.",
];

export default function Chat() {
  const messages = useQuery(api.queries.listChat, {});
  const send = useAction(api.chat.send);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, busy]);

  const submit = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    try {
      await send({ message: q });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* messages */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          {(!messages || messages.length === 0) && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/80 to-violet-600/80 text-xl shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                🛰️
              </div>
              <p className="mt-4 text-sm font-medium text-zinc-300">
                Ask your customer-intelligence agent
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">
                It answers from live Convex state — issues, signals, evidence and investigations —
                and can trigger real investigations or email findings.
              </p>
            </div>
          )}
          {messages?.map((m: any) => (
            <div
              key={m._id}
              className={`animate-fade-up flex items-end gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "agent" && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/70 to-violet-600/70 text-[11px]">
                  🛰️
                </span>
              )}
              <div
                className={`max-w-[78%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-md bg-indigo-500/90 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                    : "rounded-bl-md border border-white/[0.07] bg-white/[0.04] text-zinc-200"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px]">
                  🧑
                </span>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-end gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/70 to-violet-600/70 text-[11px]">
                🛰️
              </span>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-indigo-300"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* composer */}
        <div className="border-t border-white/[0.06] bg-black/20 p-4">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                disabled={busy}
                className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[11px] text-zinc-400 transition-all hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-indigo-200 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about customer signals, issues, trends…"
              className="flex-1 rounded-xl border border-white/[0.09] bg-black/30 px-4 py-2.5 text-[13px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-indigo-400/50 focus:bg-black/50"
            />
            <Button type="submit" variant="primary" disabled={busy || !input.trim()}>
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
