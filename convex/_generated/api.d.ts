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
import type * as bots from "../bots.js";
import type * as crons from "../crons.js";
import type * as daily from "../daily.js";
import type * as draft from "../draft.js";
import type * as guests from "../guests.js";
import type * as matches from "../matches.js";
import type * as phases from "../phases.js";
import type * as progression from "../progression.js";
import type * as ranked from "../ranked.js";
import type * as rooms from "../rooms.js";
import type * as tracks from "../tracks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  bots: typeof bots;
  crons: typeof crons;
  daily: typeof daily;
  draft: typeof draft;
  guests: typeof guests;
  matches: typeof matches;
  phases: typeof phases;
  progression: typeof progression;
  ranked: typeof ranked;
  rooms: typeof rooms;
  tracks: typeof tracks;
  users: typeof users;
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
