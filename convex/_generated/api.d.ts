/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as alerts from "../alerts.js";
import type * as chat from "../chat.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as demo from "../demo.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as lib_agentmailApi from "../lib/agentmailApi.js";
import type * as lib_analysis from "../lib/analysis.js";
import type * as lib_firecrawl from "../lib/firecrawl.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_scenarios from "../lib/scenarios.js";
import type * as lib_sibyl from "../lib/sibyl.js";
import type * as lib_util from "../lib/util.js";
import type * as memory from "../memory.js";
import type * as monitor from "../monitor.js";
import type * as projects from "../projects.js";
import type * as queries from "../queries.js";
import type * as research from "../research.js";
import type * as settings from "../settings.js";
import type * as setup from "../setup.js";
import type * as state from "../state.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  alerts: typeof alerts;
  chat: typeof chat;
  credits: typeof credits;
  crons: typeof crons;
  debug: typeof debug;
  demo: typeof demo;
  email: typeof email;
  http: typeof http;
  "lib/agentmailApi": typeof lib_agentmailApi;
  "lib/analysis": typeof lib_analysis;
  "lib/firecrawl": typeof lib_firecrawl;
  "lib/openai": typeof lib_openai;
  "lib/scenarios": typeof lib_scenarios;
  "lib/sibyl": typeof lib_sibyl;
  "lib/util": typeof lib_util;
  memory: typeof memory;
  monitor: typeof monitor;
  projects: typeof projects;
  queries: typeof queries;
  research: typeof research;
  settings: typeof settings;
  setup: typeof setup;
  state: typeof state;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
};
