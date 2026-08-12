/**
 * Module entry point.
 *
 * SpacetimeDB requires the entry file to export the schema as default, and it
 * discovers reducers, views and lifecycle hooks through this module's exports —
 * so every domain module is re-exported here.
 *
 * `./schedules` is imported FIRST, deliberately. It and `./schema` form a cycle
 * (the schema names the scheduled reducers; the reducers need the schema), and
 * evaluating the reducer side first is what lets the schema's deferred
 * `(): any => …` thunks resolve. See the note at the top of schedules.ts.
 */
export * from "./schedules";

export { default } from "./schema";
