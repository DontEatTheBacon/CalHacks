/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as counseling from "../counseling.js";
import type * as crons from "../crons.js";
import type * as discovery from "../discovery.js";
import type * as extraction from "../extraction.js";
import type * as files from "../files.js";
import type * as fx from "../fx.js";
import type * as http from "../http.js";
import type * as ingestion from "../ingestion.js";
import type * as jobs from "../jobs.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_brightdata from "../lib/brightdata.js";
import type * as lib_catalog_programs from "../lib/catalog/programs.js";
import type * as lib_extract_rules from "../lib/extract/rules.js";
import type * as lib_fileSignature from "../lib/fileSignature.js";
import type * as lib_rules_climate from "../lib/rules/climate.js";
import type * as lib_rules_cost from "../lib/rules/cost.js";
import type * as lib_rules_deadline from "../lib/rules/deadline.js";
import type * as lib_rules_domains from "../lib/rules/domains.js";
import type * as lib_rules_grade from "../lib/rules/grade.js";
import type * as lib_rules_index from "../lib/rules/index.js";
import type * as lib_rules_major from "../lib/rules/major.js";
import type * as lib_rules_ranking from "../lib/rules/ranking.js";
import type * as lib_rules_roundRobin from "../lib/rules/roundRobin.js";
import type * as lib_rules_setting from "../lib/rules/setting.js";
import type * as lib_rules_types from "../lib/rules/types.js";
import type * as messages from "../messages.js";
import type * as profiles from "../profiles.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  catalog: typeof catalog;
  counseling: typeof counseling;
  crons: typeof crons;
  discovery: typeof discovery;
  extraction: typeof extraction;
  files: typeof files;
  fx: typeof fx;
  http: typeof http;
  ingestion: typeof ingestion;
  jobs: typeof jobs;
  "lib/access": typeof lib_access;
  "lib/brightdata": typeof lib_brightdata;
  "lib/catalog/programs": typeof lib_catalog_programs;
  "lib/extract/rules": typeof lib_extract_rules;
  "lib/fileSignature": typeof lib_fileSignature;
  "lib/rules/climate": typeof lib_rules_climate;
  "lib/rules/cost": typeof lib_rules_cost;
  "lib/rules/deadline": typeof lib_rules_deadline;
  "lib/rules/domains": typeof lib_rules_domains;
  "lib/rules/grade": typeof lib_rules_grade;
  "lib/rules/index": typeof lib_rules_index;
  "lib/rules/major": typeof lib_rules_major;
  "lib/rules/ranking": typeof lib_rules_ranking;
  "lib/rules/roundRobin": typeof lib_rules_roundRobin;
  "lib/rules/setting": typeof lib_rules_setting;
  "lib/rules/types": typeof lib_rules_types;
  messages: typeof messages;
  profiles: typeof profiles;
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

export declare const components: {};
