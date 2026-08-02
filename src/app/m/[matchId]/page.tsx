"use client";

import { useQuery } from "convex/react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MatchEnd, type MatchEndPlayer } from "@/game/MatchEnd";
import { DUEL_STARTING_HP, ROOM_STARTING_HP } from "@/engine/config";
import { Empty, Skeleton } from "@/ui/Surface";

/**
 * A finished match, reopened.
 *
 * `MatchEnd` used to be reachable only from inside a live duel, mounted by `RoundRunner`
 * off the `state` subscription — so the moment a match ended, its result was gone. Every
 * field that screen reads is persisted on `matchPlayers`, though, which is what lets
 * `matches.recap` rebuild it from nothing but an id.
 *
 * `?p=` names whose side to read the verdict from. It is set by the history list on a
 * profile, so opening a bot-vs-bot match from someone's page tells you how *they* did,
 * rather than defaulting to the losing half of a match you were never in.
 */
export default function MatchRecapPage() {
  const params = useParams<{ matchId: string }>();
  const search = useSearchParams();
  const matchId = params.matchId as Id<"matches">;

  const perspectiveUserId = search.get("p") ?? undefined;
  const recap = useQuery(api.matches.recap, {
    matchId,
    perspectiveUserId: perspectiveUserId as Id<"users"> | undefined,
  });

  if (recap === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-12">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (recap === null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <Empty
          title="No match here"
          body="This match either never finished or no longer exists."
        />
      </div>
    );
  }

  // The shape MatchEnd wants is exactly what recap returns; the cast is only to satisfy
  // the branded id types, which arrive as strings on the wire.
  const players = recap.players as unknown as MatchEndPlayer[];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <p className="text-body-sm text-muted text-center">
        {formatWhen(recap.completedAt)}
        {recap.mode === "practice" && " · practice"}
        {recap.suddenDeath && " · sudden death"}
      </p>

      <MatchEnd
        matchId={matchId}
        players={players}
        winnerId={recap.winnerId ? String(recap.winnerId) : null}
        maxHp={recap.mode === "room" ? ROOM_STARTING_HP : DUEL_STARTING_HP}
        perspectiveUserId={
          recap.perspectiveUserId ? String(recap.perspectiveUserId) : undefined
        }
      />

      {/* No "Play again" here — this is a record, not a lobby. The way back is to the
          player whose page you came from. */}
      <BackToProfile players={players} perspectiveUserId={recap.perspectiveUserId} />
    </div>
  );
}

function BackToProfile({
  players,
  perspectiveUserId,
}: {
  players: MatchEndPlayer[];
  perspectiveUserId: string | null;
}) {
  const subject =
    players.find((player) => player.userId === perspectiveUserId) ?? players[0];
  if (!subject) return null;

  return (
    <Link
      href={`/u/${subject.handle}`}
      className="text-body-sm text-muted hover:text-paper mx-auto underline underline-offset-4"
    >
      Back to @{subject.handle}
    </Link>
  );
}

/** "3 days ago" down to the hour, then a plain date. Matches the history list. */
function formatWhen(completedAt: number): string {
  const days = Math.floor((Date.now() - completedAt) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(completedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
