import { v } from "convex/values";

// Small shared helpers.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

export function now(): number {
  return Date.now();
}

export function daysAgo(days: number): number {
  return Date.now() - days * DAY_MS;
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Reusable value validators for message payloads passed through schedulers.
export const emailMessageFields = {
  messageId: v.string(),
  threadId: v.string(),
  inboxId: v.string(),
  from: v.string(),
  to: v.string(),
  subject: v.string(),
  text: v.string(),
  timestamp: v.number(),
};
