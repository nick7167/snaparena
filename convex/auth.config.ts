/**
 * Tells Convex how to verify the Clerk JWT attached to each request.
 *
 * `applicationID` must match the name of the JWT template created in the Clerk
 * dashboard — the template must be called exactly "convex".
 *
 * CLERK_JWT_ISSUER_DOMAIN is read from the *deployment* environment, not from
 * .env.local, because verification happens inside Convex rather than in Next.js:
 *
 *   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
 *
 * Until that is set, `npx convex dev` will report this config as invalid — which
 * is the intended failure mode, since auth silently not working is far worse.
 */
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
