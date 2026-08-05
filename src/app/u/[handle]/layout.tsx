import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { rankForElo } from "@/engine/ranks";

/**
 * A profile that names the player it is about.
 *
 * This is one of the two routes where per-route metadata earns real money rather than
 * tidiness. The app already ships `metadataBase` and an Open Graph image, so the machinery
 * for good link previews was entirely in place — every shared profile just previewed as
 * "SNAP — One second of a song", identical to the homepage and to every other link.
 *
 * A ladder game grows by people posting their rank. Putting the rank in the preview is the
 * cheapest growth work available here.
 *
 * `users.profile` is a public query — it takes a handle and calls no `requireUser` — so it
 * is safe to read from the server with no session.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;

  try {
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const profile = await client.query(api.users.profile, { handle });

    // An unknown handle still renders a page (the route handles it), so the metadata has
    // to degrade rather than throw.
    if (!profile) return { title: `@${handle}` };

    const placing = profile.placementsRemaining > 0;
    const standing = placing
      ? "Unranked"
      : `${rankForElo(profile.elo).label} · ${profile.elo}`;

    return {
      title: `@${profile.handle}`,
      description: `${standing} · ${profile.gamesPlayed} matches played on SNAP.`,
      openGraph: {
        title: `@${profile.handle} — ${standing}`,
        description: "One second of a song. Name it before they do.",
      },
    };
  } catch {
    /**
     * Never let metadata take the page down.
     *
     * This runs on every profile render, and it is the only network call in the app whose
     * failure would produce a 500 for something purely decorative. A missing title is a
     * cosmetic loss; a missing page is not.
     */
    return { title: `@${handle}` };
  }
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
