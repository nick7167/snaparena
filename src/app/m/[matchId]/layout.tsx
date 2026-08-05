import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * A match that names its players.
 *
 * The other route where a shared link should say something. "@alice vs @bob" is the whole
 * of what a recipient needs to decide whether to click.
 *
 * `matches.recap` resolves the viewer through `currentUser` and tolerates a null one, so
 * this works without a session — it simply comes back with no "me" perspective, which is
 * exactly right for a link being previewed by a crawler.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}): Promise<Metadata> {
  const { matchId } = await params;

  try {
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const recap = await client.query(api.matches.recap, {
      matchId: matchId as Id<"matches">,
    });

    // Recap returns null for a match that is unfinished, daily, or simply not there.
    if (!recap || recap.players.length === 0) return { title: "Match" };

    const names = recap.players.map((player) => `@${player.handle}`);
    const title = names.length === 2 ? `${names[0]} vs ${names[1]}` : names.join(" · ");

    const winner = recap.players.find((player) => player.userId === recap.winnerId);

    return {
      title,
      description: winner
        ? `@${winner.handle} won. See how the rounds went.`
        : "See how the rounds went.",
      openGraph: { title: `${title} — SNAP`, description: "One second of a song." },
    };
  } catch {
    // An invalid id in the URL reaches `client.query` as a malformed argument and throws.
    // A bare title is the right outcome; a 500 on a decorative lookup is not.
    return { title: "Match" };
  }
}

export default function MatchLayout({ children }: { children: ReactNode }) {
  return children;
}
