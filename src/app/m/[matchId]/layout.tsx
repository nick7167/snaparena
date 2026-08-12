import type { Metadata } from "next";
import type { ReactNode } from "react";
import { publicRows } from "@/app/sql";

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
    /**
     * Two public tables and a join the SQL does itself, rather than a query that shaped
     * the answer. `match_player` names who was in it and `user` names them; both are
     * public, which is what makes an unauthenticated read of them legitimate.
     */
    const id = BigInt(matchId);

    const players = await publicRows<{ handle: string; user_id: string }>(
      `SELECT u.handle AS handle, mp.user_id AS user_id
         FROM match_player mp JOIN user u ON mp.user_id = u.id
        WHERE mp.match_id = ${id}`,
    );

    if (players.length === 0) return { title: "Match" };

    const match = await publicRows<{ winner_id: string | null }>(
      `SELECT winner_id FROM match WHERE id = ${id}`,
    );

    const names = players.map((player) => `@${player.handle}`);
    const title = names.length === 2 ? `${names[0]} vs ${names[1]}` : names.join(" · ");

    const winnerId = match[0]?.winner_id;
    const winner = players.find((player) => String(player.user_id) === String(winnerId));

    return {
      title,
      description: winner
        ? `@${winner.handle} won. See how the rounds went.`
        : "See how the rounds went.",
      openGraph: { title: `${title} — SNAP`, description: "One second of a song." },
    };
  } catch {
    // A malformed id in the URL throws at `BigInt`, and a database that does not answer
    // throws in the read. A bare title is the right outcome for both; a 500 on a
    // decorative lookup is not.
    return { title: "Match" };
  }
}

export default function MatchLayout({ children }: { children: ReactNode }) {
  return children;
}
