import type { Metadata, Viewport } from "next";
import { auth } from "@clerk/nextjs/server";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CLERK_JWT_TEMPLATE, Providers } from "./providers";
import { AppShell, MobileTopBar, UserProvisioner } from "./app-shell";
import { ImmersiveProvider } from "./immersive";
import { WelcomeGate } from "./welcome-gate";
import { DevPanel } from "./dev-panel";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Display face: the numerals are the emotional content of this game, and Geist's
 * heaviest weight has no authority at 96px.
 *
 * Variable, wght axis only. Archivo also carries a wdth axis (62–125) which would give
 * condensed broadcast numerals from the same family — deliberately not loaded, because
 * it grows the woff2 and the plain version needs to be seen on the real reveal and
 * standings screens first.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

/**
 * `metadataBase` is what turns the generated Open Graph images into absolute URLs.
 * Without it Next falls back to http://localhost:3000, and every social preview in
 * production points at a machine nobody else can reach.
 *
 * Set NEXT_PUBLIC_SITE_URL for a custom domain; VERCEL_PROJECT_PRODUCTION_URL covers a
 * default Vercel deployment.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  /**
   * A template, not a string.
   *
   * Every route in the app used to render as "SNAP" because this was the only metadata
   * export anywhere — so browser history was a wall of identical entries, several open
   * tabs were indistinguishable, and a shared profile or match link previewed as the
   * homepage. Each route now names itself and this appends the brand.
   *
   * `default` is what the home page keeps, and what any route that forgets falls back to.
   *
   * Worth knowing when adding a route: these pages are almost all `"use client"`, which
   * cannot export `metadata`. That is why the titles live in per-route `layout.tsx` files
   * rather than beside the components they describe.
   */
  title: { default: "SNAP", template: "%s — SNAP" },
  description: "One second of a song. Name it before they do.",
  openGraph: {
    title: "SNAP",
    description: "One second of a song. Name it before they do.",
    siteName: "SNAP",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

/**
 * ink-900, matching the icon's background and the manifest's splash colour, so mobile
 * browser chrome blends into the app instead of framing it. Declared here rather than in
 * `metadata` because Next moved viewport-affecting fields out of it.
 */
export const viewport: Viewport = {
  themeColor: "#0e1017",
};

/**
 * The connection token, minted on the server so the FIRST socket is already the
 * player's.
 *
 * A Clerk token can otherwise only be had asynchronously, in the browser, after
 * Clerk's script loads — while `SpacetimeDBProvider` opens its socket the moment it
 * mounts. So the first connection was necessarily anonymous, and since SpacetimeDB
 * settles identity at connect and a live socket cannot be upgraded, it then had to
 * be torn down and rebuilt. Every subscription ran twice and the tree unmounted in
 * between, which is exactly as smooth as it sounds.
 *
 * THE COST, stated because it is not local: reading a cookie here opts the whole
 * route tree out of static prerendering, so every page is server-rendered on demand.
 * That was a deliberate trade — a small, uniform latency cost against a visible
 * reconnect on every load.
 *
 * The token is short-lived (about a minute) and belongs to the person receiving it,
 * so putting it in their own HTML is the same exposure as the session cookie Clerk
 * already sets. It is safe only because this render is per-request and uncacheable,
 * which the `auth()` call itself guarantees.
 */
async function connectionToken(): Promise<string | undefined> {
  const { userId, getToken } = await auth();

  /**
   * Signed out, as far as the server can tell. Correct and common — a stranger
   * connects anonymously — so this is not worth a log line.
   */
  if (!userId) return undefined;

  try {
    const token = await getToken({ template: CLERK_JWT_TEMPLATE });

    /**
     * Signed in, but no token. Almost always one thing: no Clerk JWT template named
     * `spacetimedb`. Said out loud, because silently returning undefined here costs
     * a reconnect on every page load and looks like a client bug.
     */
    if (!token) {
      console.warn(
        `[snap] no "${CLERK_JWT_TEMPLATE}" token for a signed-in session —` +
          " check the JWT template exists in the Clerk dashboard",
      );
      return undefined;
    }

    return token;
  } catch (error) {
    /**
     * NOT swallowed. The first version caught this and returned undefined, which
     * degraded correctly — the client still connects, just anonymously first — but
     * made the resulting double connection impossible to tell apart from a signed-out
     * visitor. The whole point of minting here is to avoid that reconnect, so a
     * failure to mint is the thing worth knowing about.
     */
    console.error("[snap] could not mint a SpacetimeDB token on the server", error);
    return undefined;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialToken = await connectionToken();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="bg-ink-800 text-paper min-h-full">
        <Providers initialToken={initialToken}>
          <ImmersiveProvider>
            {/* Creates the user row on first sign-in. Mounted at the root so it does
                not depend on which piece of chrome happens to be visible. */}
            <UserProvisioner />
            <AppShell>
              <MobileTopBar />
              {children}
            </AppShell>
            {/* Redirects a new account to /welcome until it has a username. Renders
                nothing, and stops firing the moment one is committed. */}
            <WelcomeGate />
            {/* Dev-only, twice over: absent unless DEV_RANK_BOTS is set on the deployment,
                and every tool inside it is off until switched on in this browser. Mounted
                at the root so it survives immersive mode, where the shell is hidden. */}
            <DevPanel />
          </ImmersiveProvider>
        </Providers>
      </body>
    </html>
  );
}
