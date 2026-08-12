/**
 * The Clerk JWT template minted for this database.
 *
 * Must exist in the Clerk dashboard under this exact name. It replaces the template
 * named "convex", and the issuer it declares has to be registered on the module with
 * `npm run stdb:auth` — the module refuses tokens from issuers it does not know,
 * which is the same deliberate loud failure `auth.config.ts` had.
 *
 * ITS OWN FILE, AND DELIBERATELY NOT `"use client"`. Both halves of the app need
 * this string: `providers.tsx` to mint a token in the browser, and `layout.tsx` to
 * mint one on the server so the first socket is already authenticated.
 *
 * It briefly lived in `providers.tsx` and was exported from there, which failed in a
 * way worth recording. Next replaces every export of a `"use client"` module with a
 * client REFERENCE — for a non-component export, a stub that throws if called. The
 * server did not receive `"spacetimedb"`; it received that stub, stringified it into
 * the template name, and Clerk answered:
 *
 *     No JWT template exists with name: function()%7Bthrow%20Error(%22Attempted%20to
 *     %20call%20CLERK_JWT_TEMPLATE()%20from%20the%20server…
 *
 * Which is the error saying precisely what happened, in the one place nobody was
 * looking. There was no type error and no build warning: the import typechecks as a
 * string on both sides, and only the runtime value differs.
 *
 * So: a constant shared across the server/client boundary belongs in a module that
 * declares neither. Do not re-export it from a client component.
 */
export const CLERK_JWT_TEMPLATE = "spacetimedb";
