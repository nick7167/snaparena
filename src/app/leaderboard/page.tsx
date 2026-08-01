"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { PLACEMENT_MATCHES } from "@/engine/config";
import { rankForElo } from "@/engine/ranks";
import { Button } from "@/ui/Button";
import { Card, Empty, SectionLabel, Skeleton } from "@/ui/Surface";
import { RankEmblem } from "@/ui/RankEmblem";

const PAGE = 25;

/**
 * The global ladder.
 *
 * "Where am I?" is the first question a ladder has to answer, and this screen could not
 * answer it — it printed a flat top-100 and stopped. Your own row is now pinned below
 * the page whenever you are not already visible in it.
 */
export default function LeaderboardPage() {
  const [shown, setShown] = useState(PAGE);

  // The query caps at 200 internally; asking for more returns 200 anyway.
  const board = useQuery(api.users.leaderboard, { limit: 200 });
  const me = useQuery(api.users.me, {});

  const visible = board?.slice(0, shown) ?? [];
  const myRow = board?.find((entry) => entry.userId === me?._id);
  const inView = visible.some((entry) => entry.userId === me?._id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-display-1 font-extrabold">Leaderboard</h1>

      {board === undefined && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      )}

      {board?.length === 0 && (
        <Empty
          title="Nobody has placed yet"
          body={`Ratings appear here once a player finishes their ${PLACEMENT_MATCHES} placement matches.`}
        />
      )}

      {board && board.length > 0 && (
        <>
          <ol className="flex flex-col gap-2">
            {visible.map((entry) => (
              <Row key={entry.userId} entry={entry} isMe={entry.userId === me?._id} />
            ))}
          </ol>

          {shown < board.length && (
            <Button
              variant="secondary"
              block
              onClick={() => setShown((current) => current + PAGE)}
            >
              Load more
            </Button>
          )}

          {/* Pinned standing, only when you are not already in the list above — the
              same row must never appear twice.

              Deliberately does not invent a position for someone outside the loaded
              set: `playerCard` only reports a global rank inside the top 100, so a
              number here would be a guess. It states the truth instead. */}
          {me && !inView && (
            <div className="flex flex-col gap-2">
              <SectionLabel>Your standing</SectionLabel>
              {myRow ? (
                <Row entry={myRow} isMe />
              ) : (
                <Card className="flex flex-col gap-1 p-4">
                  <p className="text-body text-paper font-semibold">
                    {me.placementsRemaining > 0
                      ? "Not placed yet"
                      : `Outside the top ${board.length}`}
                  </p>
                  <p className="text-body-sm text-muted tabular-nums">
                    {me.placementsRemaining > 0
                      ? `${me.placementsRemaining} placement match${
                          me.placementsRemaining === 1 ? "" : "es"
                        } to go`
                      : `Rating ${me.elo}`}
                  </p>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  entry,
  isMe,
}: {
  entry: {
    rank: number;
    userId: string;
    handle: string;
    displayName: string;
    elo: number;
    gamesPlayed: number;
  };
  isMe: boolean;
}) {
  const rank = rankForElo(entry.elo);

  return (
    <Card as="li" emphasis={isMe} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <span className="font-display text-secondary w-7 shrink-0 text-right font-bold tabular-nums">
        {entry.rank}
      </span>
      <RankEmblem
        accent={rank.tier.accent}
        divisions={rank.tier.divisions > 1 ? rank.division : 1}
        size="sm"
      />
      {/* Every name on the ladder is a route into a profile — the page that had no
          entry points at all until now. */}
      <Link
        href={`/u/${entry.handle}`}
        className="flex min-w-0 flex-1 flex-col rounded-xs hover:underline"
      >
        <span className="text-body truncate font-semibold">{entry.displayName}</span>
        <span className="text-body-sm text-muted truncate">@{entry.handle}</span>
      </Link>
      <span className="flex shrink-0 flex-col items-end">
        <span className="font-display text-body text-paper font-bold tabular-nums">
          {entry.elo}
        </span>
        <span className="text-label text-muted tabular-nums">
          {entry.gamesPlayed} games
        </span>
      </span>
    </Card>
  );
}
