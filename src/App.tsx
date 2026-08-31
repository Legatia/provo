import { useEffect, useState } from "react";
import { ConvexProvider, useQuery } from "convex/react";
import {
  BrowserRouter,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { convex, api } from "./lib/convex";
import { LiveDot, timeAgo } from "./components/ui";
import Landing from "./pages/Landing";
import Board from "./pages/Board";
import ProjectDetail from "./pages/ProjectDetail";
import IssueDetail from "./pages/IssueDetail";
import Chat from "./pages/Chat";
import DemoPanel from "./pages/DemoPanel";

const NAV = [
  { to: "/board", label: "Board", icon: "◈" },
  { to: "/chat", label: "Ask the desk", icon: "◍" },
  { to: "/demo", label: "Demo", icon: "▶" },
];

const PAGE_TITLES: Record<string, [string, string]> = {
  "/board": ["Project board", "every project has a past — Provo keeps the record"],
  "/chat": ["Ask the desk", "answers from live state"],
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
      ? ["Finding", "evidence, timeline and investigation"]
      : location.pathname.startsWith("/project")
        ? ["Project", "dossier · engine · findings"]
        : ["Provo", ""]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-rule bg-ink/70 px-8 backdrop-blur-xl">
      <div className="flex items-baseline gap-3">
        <h1 className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-paper">{title}</h1>
        <span className="hidden text-xs text-paper-dim md:inline">{subtitle}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-rule bg-paper/[0.02] px-2.5 py-1 text-[10px] uppercase tracking-wider text-paper-dim sm:inline-flex">
          convex · sibyl · firecrawl · base
        </span>
        <span className="font-mono text-xs tabular-nums text-paper-dim">
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
    <aside className="flex w-60 shrink-0 flex-col border-r border-rule">
      {/* brand */}
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brass/50 bg-ink font-display text-[19px] font-semibold italic leading-none text-brass-bright">
          P
        </div>
        <div>
          <div className="font-display text-[17px] font-semibold leading-tight tracking-tight">
            Provo
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-verdigris">
            <LiveDot /> on duty
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="space-y-0.5">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 border-l-2 py-2 pl-3.5 pr-2 font-mono text-[11.5px] uppercase tracking-[0.08em] transition-all ${
                isActive
                  ? "border-brass bg-brass/[0.07] font-semibold text-brass-bright"
                  : "border-transparent text-paper-dim hover:border-rule-strong hover:bg-paper/[0.02] hover:text-paper"
              }`
            }
          >
            <span className="w-4 text-center text-[10px] opacity-70">{n.icon}</span>
            <span className="flex-1">{n.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* agent card */}
      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-xl border border-rule bg-paper/[0.015] p-3.5">
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-paper-dim/70">
            Agent
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-rule-strong font-display text-[13px] italic leading-none text-brass">
              P
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-paper">
                {company?.name ?? "—"}
              </div>
              <div className="truncate font-mono text-[10px] text-paper-dim">
                {company?.agentInbox ?? "not provisioned"}
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-rule pt-2.5">
            <div className="flex items-center justify-between text-[10px] text-paper-dim">
              <span>last action</span>
              <span className="font-mono text-paper-dim">
                {lastActivity ? timeAgo(lastActivity.startedAt) + " ago" : "—"}
              </span>
            </div>
          </div>
        </div>
        <p className="px-1 text-[9px] leading-relaxed tracking-wide text-paper-dim/70">
          watches · vets · remembers · sells its intel
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
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<Shell />}>
            <Route path="/board" element={<Board />} />
            <Route path="/project/:slug" element={<ProjectDetail />} />
            <Route path="/issues/:issueId" element={<IssueDetail />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/demo" element={<DemoPanel />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConvexProvider>
  );
}
