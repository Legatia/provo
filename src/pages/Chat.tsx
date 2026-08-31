import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../lib/convex";
import { Card, Button } from "../components/ui";

const SUGGESTIONS = [
  "What is the desk seeing this week?",
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
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-brass/50 font-display text-[24px] font-semibold italic text-brass-bright">
                P
              </div>
              <p className="mt-4 text-sm font-medium text-paper/90">
                Ask the desk
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-paper-dim">
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
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-rule-strong font-display text-[14px] italic text-brass">
                  P
                </span>
              )}
              <div
                className={`max-w-[78%] whitespace-pre-line rounded-xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-md bg-brass/90 text-white shadow-[0_0_20px_rgba(201,162,75,0.2)]"
                    : "rounded-bl-md border border-rule bg-paper/[0.025] text-paper"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper/[0.045] text-[11px]">
                  🧑
                </span>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-end gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-brass/40 font-display text-[14px] italic text-brass-bright">
                P
              </span>
              <div className="flex items-center gap-1.5 rounded-xl rounded-bl-md border border-rule bg-paper/[0.025] px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brass-bright"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* composer */}
        <div className="border-t border-rule bg-black/20 p-4">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                disabled={busy}
                className="rounded-full border border-rule bg-paper/[0.015] px-3 py-1 text-[11px] text-paper-dim transition-all hover:border-brass/40 hover:bg-brass/10 hover:text-brass-bright disabled:opacity-40"
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
              placeholder="Ask about findings, signals, trends…"
              className="flex-1 rounded-xl border border-rule bg-black/30 px-4 py-2.5 text-[13px] text-paper placeholder-zinc-600 outline-none transition focus:border-brass/50 focus:bg-black/50"
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
