import type { Metadata } from "next";
import type { ReactNode } from "react";
import { rankForElo } from "@/engine/ranks";
import { publicRow } from "@/app/sql";

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
 * PORTED WITHOUT LOSING IT. There is no server-side subscription — a WebSocket is the
 * wrong tool for one read during a render — so this goes through SpacetimeDB's HTTP SQL
 * endpoint instead of `ConvexHttpClient`. `user` is a public table, which is what makes an
 * unauthenticated read of it legitimate rather than a hole; nothing private is reachable
 * this way even if the query asked.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;

  try {
    const profile = await publicRow<{
      handle: string;
      elo: number;
      games_played: number;
      placements_remaining: number;
    }>(
      `SELECT handle, elo, games_played, placements_remaining FROM user WHERE handle = '${escapeHandle(handle)}'`,
    );

    // An unknown handle still renders a page (the route handles it), so the metadata has
    // to degrade rather than throw.
    if (!profile) return { title: `@${handle}` };

    const placing = profile.placements_remaining > 0;
    const standing = placing
      ? "Unranked"
      : `${rankForElo(profile.elo).label} · ${profile.elo}`;

    return {
      title: `@${profile.handle}`,
      description: `${standing} · ${profile.games_played} matches played on SNAP.`,
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

/**
 * Handles are `[a-z0-9_]{3,12}` at every write path, so anything else cannot name a row.
 *
 * Stripping rather than quoting: this builds a SQL string, and the only safe way to do
 * that with a value from a URL is to make the value incapable of carrying syntax.
 */
function escapeHandle(handle: string): string {
  return handle.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 12);
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
