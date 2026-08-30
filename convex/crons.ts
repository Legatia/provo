import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// NOTE: the web-source monitor cycle is intentionally NOT on a cron —
// it costs Firecrawl credits every run. Trigger it manually from the
// dashboard ("Run monitor" via chat:runMonitorNow) or re-enable here on
// a paid Firecrawl plan:
//
// crons.interval("monitor-cycle", { minutes: 30 }, internal.agent.runMonitorCycle, {});

// Inbound mail backup: pure AgentMail REST (no Firecrawl cost), catches
// anything the webhook missed. The webhook remains the primary path.
crons.interval(
  "poll-inbound",
  { minutes: 2 },
  internal.monitor.pollInbound,
  {}
);

export default crons;
