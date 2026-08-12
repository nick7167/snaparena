"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMatchState } from "@/app/db";
import { useConfig } from "@/app/config";
import { MatchEnd, type MatchEndPlayer } from "@/game/MatchEnd";
import { DUEL_STARTING_HP, ROOM_STARTING_HP } from "@/engine/config";
import { Empty, Skeleton } from "@/ui/Surface";
import { PageHeader } from "../../page-header";
import { timeAgoCapitalized } from "@/ui/relative-time";
import { useNow } from "@/game/usePrefersReducedMotion";

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
  /**
   * The id arrives as a string in the URL and every id is a u64 now, so this is where
   * the route parameter becomes one. A malformed id yields a match nobody has, which
   * the empty state below already handles.
   */
  const matchId = (() => {
    try {
      return BigInt(params.matchId);
    } catch {
      return undefined;
    }
  })();
  // Shared formatter, so this match reads the same here as it does in the dashboard strip
  // and on the profile that linked here — it previously read three different ways.
  const now = useNow(60_000);

  const perspectiveParam = search.get("p");
  const perspectiveUserId = (() => {
    if (!perspectiveParam) return undefined;
    try {
      return BigInt(perspectiveParam);
    } catch {
      return undefined;
    }
  })();
  /**
   * `matches.recap` is gone: it rebuilt a finished match from nothing but an id, and
   * `useMatchState` already composes exactly that from the same rows. One shape for a
   * live match and a finished one, rather than two that could disagree about a draw.
   */
  const config = useConfig();
  const recap = useMatchState(matchId, config);

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
  const players = recap.scoreboard as unknown as MatchEndPlayer[];

  /**
   * The declared parent is the subject's profile — the page a match record hangs off, and
   * where the history list that links here lives. PageHeader overrides it with wherever
   * you actually came from; this is what a shared link lands on.
   */
  const subject =
    players.find(
      (player) => String(player.userId) === String(perspectiveUserId ?? ""),
    ) ?? players[0];

  return (
    <>
      <PageHeader
        parent={
          subject
            ? { href: `/u/${subject.handle}`, label: `@${subject.handle}` }
            : { href: "/leaderboard", label: "Leaderboard" }
        }
        title="Match record"
      />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <p className="text-body-sm text-muted text-center">
          {timeAgoCapitalized(recap.completedAtMs ?? Date.now(), now)}
          {recap.mode === "practice" && " · practice"}
          {recap.suddenDeath && " · sudden death"}
        </p>

        {/* No "Play again" here — this is a record, not a lobby. The way back used to be
            a lone underlined link at the bottom of the page; it is the header now. */}
        <MatchEnd
          matchId={matchId!}
          players={players}
          winnerId={recap.winnerId ? String(recap.winnerId) : null}
          maxHp={recap.mode === "room" ? ROOM_STARTING_HP : DUEL_STARTING_HP}
          perspectiveUserId={
            perspectiveUserId ? String(perspectiveUserId) : undefined
          }
        />
      </div>
    </>
  );
}

