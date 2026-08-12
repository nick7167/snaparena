import type { InferSchema, ReducerCtx as SdkReducerCtx, ViewCtx as SdkViewCtx, AnonymousViewCtx as SdkAnonymousViewCtx } from "spacetimedb/server";
import type { spacetimedb } from "./schema";

/**
 * Context aliases, so helper functions can be typed without every one of them
 * repeating `ReducerCtx<InferSchema<typeof spacetimedb>>`.
 *
 * A reducer's own callback gets its context inferred, so these are only needed by
 * the helpers those callbacks delegate to — which, in this module, is most of the
 * interesting code.
 */
type Schema = InferSchema<typeof spacetimedb>;

/** Read-write. Reducers and the helpers they call. */
export type ReducerCtx = SdkReducerCtx<Schema>;

/** Read-only, knows the caller. Per-viewer views. */
export type ViewCtx = SdkViewCtx<Schema>;

/** Read-only, caller-independent. Shared views, materialised once for everyone. */
export type AnonymousViewCtx = SdkAnonymousViewCtx<Schema>;
