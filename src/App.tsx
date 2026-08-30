import { useEffect, useState } from "react";
import { ConvexProvider, useQuery } from "convex/react";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { convex, api } from "./lib/convex";
import { LiveDot, timeAgo } from "./components/ui";
import Overview from "./pages/Overview";
import Issues from "./pages/Issues";
import IssueDetail from "./pages/IssueDetail";
import Mail from "./pages/Mail";
import Chat from "./pages/Chat";
import DemoPanel from "./pages/DemoPanel";

const NAV = [
  { to: "/", label: "Overview", icon: "◈", end: true },
  { to: "/issues", label: "Issues", icon: "◉", badge: "issues" },
  { to: "/mail", label: "Mail", icon: "✉" },
  { to: "/chat", label: "Chat", icon: "◍" },
  { to: "/demo", label: "Demo", icon: "▶" },
];

const PAGE_TITLES: Record<string, [string, string]> = {
  "/": ["Overview", "what changed across the customer's voice"],
  "/issues": ["Issues", "normalized customer problems, ranked by priority"],
  "/mail": ["Agent inbox", "real email — routed, investigated, answered"],
  "/chat": ["Ask the agent", "answers from live state"],
  "/demo": ["Demo scenario", "deterministic walkthrough · every step is real"],
};

function Header() {
  const location = useLocation();
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const [title, subtitle] =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith("/issues")
      ? ["Issue", "evidence, timeline and investigation"]
      : ["Customer Intelligence", ""]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/[0.06] bg-zinc-950/70 px-8 backdrop-blur-xl">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[15px] font-semibold tracking-tight text-zinc-100">{title}</h1>
        <span className="hidden text-xs text-zinc-500 md:inline">{subtitle}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-wider text-zinc-500 sm:inline-flex">
          convex · firecrawl · openai · agentmail
        </span>
        <span className="font-mono text-xs tabular-nums text-zinc-500">
          {clock.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
    </header>
  );
}

function Sidebar() {
  const company = useQuery(api.queries.getCompany, {});
  const badges = useQuery(api.queries.getNavBadges, {});
  const activity = useQuery(api.queries.listActivity, {});
  const lastActivity = activity?.[0];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/[0.06]">
      {/* brand */}
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/80 to-violet-600/80 text-base shadow-[0_0_24px_rgba(99,102,241,0.35)]">
          🛰️
        </div>
        <div>
          <div className="text-[13px] font-semibold leading-tight tracking-tight">
            Customer Intelligence
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
            <LiveDot /> on duty
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="space-y-0.5 px-3">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end as any}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-all ${
                isActive
                  ? "bg-white/[0.07] font-medium text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
              }`
            }
          >
            <span className="w-4 text-center text-xs opacity-60">{n.icon}</span>
            <span className="flex-1">{n.label}</span>
            {n.badge === "issues" && badges && badges.critical + badges.emerging > 0 && (
              <span className="flex items-center gap-1">
                {badges.critical > 0 && (
                  <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-300">
                    {badges.critical}
                  </span>
                )}
                {badges.emerging > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                    {badges.emerging}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* agent card */}
      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Agent
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/70 to-violet-600/70 text-[10px]">
              🛰️
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-zinc-200">
                {company?.name ?? "—"}
              </div>
              <div className="truncate font-mono text-[10px] text-zinc-500">
                {company?.agentInbox ?? "not provisioned"}
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-white/[0.06] pt-2.5">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>last action</span>
              <span className="font-mono text-zinc-400">
                {lastActivity ? timeAgo(lastActivity.startedAt) + " ago" : "—"}
              </span>
            </div>
          </div>
        </div>
        <p className="px-1 text-[9px] leading-relaxed tracking-wide text-zinc-600">
          observes · investigates · remembers · reports
        </p>
      </div>
    </aside>
  );
}

function Shell() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Header />
        <div className="mx-auto max-w-6xl px-8 py-7">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/issues" element={<Issues />} />
            <Route path="/issues/:issueId" element={<IssueDetail />} />
            <Route path="/mail" element={<Mail />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/demo" element={<DemoPanel />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </ConvexProvider>
  );
}
