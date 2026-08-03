"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { PLACEMENT_MATCHES, RANK_TIERS } from "@/engine/config";
import { formatGlobalRank, rankForElo } from "@/engine/ranks";
import { Button } from "@/ui/Button";
import { Card, Empty, SectionLabel, Skeleton } from "@/ui/Surface";
import { RankEmblem } from "@/ui/RankEmblem";
import { Avatar } from "@/game/ui";

const PAGE = 25;

/**
 * The global ladder.
 *
 * A ladder is a thing you climb, and this screen used to be a flat run of identical rows
 * that happened to be sorted — every player from first to two-hundredth wearing the same
 * surface, so the only thing separating Legend from Bronze was a number in a column. It is
 * banded by rank tier now: the emblem artwork heads each band, the band says how many
 * people are in it, and climbing means crossing a visible line rather than watching an
 * integer tick down.
 *
 * "Where am I?" is still the first question it has to answer, so your own row is pinned
 * whenever you are not already visible in the page.
 */
export default function LeaderboardPage() {
  const [shown, setShown] = useState(PAGE);

  // The query caps at 200 internally; asking for more returns 200 anyway.
  const board = useQuery(api.users.leaderboard, { limit: 200 });
  const me = useQuery(api.users.me, {});

  const visible = board?.slice(0, shown) ?? [];
  const myRow = board?.find((entry) => entry.userId === me?._id);
  const inView = visible.some((entry) => entry.userId === me?._id);
  const myAccent = me ? rankForElo(me.elo).tier.accent : undefined;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <h1 className="font-display text-display-1 mb-6 font-extrabold">Leaderboard</h1>

      {board === undefined && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
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
        /**
         * Two columns from `xl` up, one below it. The ladder is the first page in the app
         * to leave the shared 672px column, and it earns that: a band header, an emblem, a
         * handle and a rating is more row than a phone-width column wants, and the standing
         * rail has nowhere to live otherwise.
         */
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-10">
          <div className="min-w-0 flex-1">
            <Bands
              entries={visible}
              myUserId={me?._id}
              myAccent={myAccent}
            />

            {shown < board.length && (
              <Button
                variant="secondary"
                block
                className="mt-4"
                onClick={() => setShown((current) => current + PAGE)}
              >
                Load more
              </Button>
            )}
          </div>

          {/* Pinned standing, only when you are not already in the list — the same row
              must never appear twice. On desktop it is a sticky rail; below `xl` it falls
              back underneath the board, which is where it used to live. */}
          {me && !inView && (
            <aside className="flex flex-col gap-2 xl:sticky xl:top-4 xl:w-64 xl:shrink-0">
              <SectionLabel>Your standing</SectionLabel>
              {/* `as="div"`: the pinned row is a copy of your standing, not an entry in
                  the ranked list. Emitting it as an `li` would put a second, detached
                  item into the board's structure. */}
              {myRow ? (
                <Row entry={myRow} isMe accent={myAccent} as="div" />
              ) : (
                <MyStanding accent={myAccent} />
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The board, cut into rank tiers.
 *
 * Bands are derived from the rows actually on screen rather than from RANK_TIERS directly,
 * so a tier nobody occupies never renders an empty header — and, more importantly, a band
 * whose members are all still behind "Load more" cannot render as a heading with nothing
 * under it.
 */
function Bands({
  entries,
  myUserId,
  myAccent,
}: {
  entries: LadderEntry[];
  myUserId?: string;
  myAccent?: string;
}) {
  const counts = useQuery(api.users.tierCounts, {});

  const bands: { tierId: string; entries: LadderEntry[] }[] = [];
  for (const entry of entries) {
    const tierId = rankForElo(entry.elo).tier.id;
    const last = bands[bands.length - 1];
    if (last?.tierId === tierId) last.entries.push(entry);
    else bands.push({ tierId, entries: [entry] });
  }

  return (
    <div className="flex flex-col gap-6">
      {bands.map((band) => {
        const tier = RANK_TIERS.find((candidate) => candidate.id === band.tierId);
        const population = counts?.find((entry) => entry.tierId === band.tierId);

        return (
          <section key={band.tierId} className="flex flex-col gap-2">
            {/* Sticky under the page header so you always know which band you are
                reading. `top-0` rather than an offset: the ladder is a top-level page and
                carries no PageHeader above it. */}
            <div className="bg-ink-800 border-line sticky top-0 z-10 flex items-center gap-3 border-b py-2">
              {tier && (
                <RankEmblem
                  tierId={tier.id}
                  // The band is the tier, not a division within it, so the mark is the
                  // tier's entry plate rather than whichever division tops the group.
                  division={1}
                  size="md"
                />
              )}
              <h2
                className="font-display text-body-lg font-extrabold tracking-wide uppercase"
                style={{ color: tier?.accent }}
              >
                {tier?.name ?? band.tierId}
              </h2>
              {population && population.count > 0 && (
                <span className="text-label text-muted ml-auto shrink-0 tabular-nums">
                  {population.count}
                  {population.approximate ? "+" : ""}{" "}
                  {population.count === 1 && !population.approximate ? "player" : "players"}
                </span>
              )}
            </div>

            {/* Still an `ol` of `li` with one link per row — the ladder spec walks this
                structure to reach each profile. */}
            <ol className="flex flex-col gap-2">
              {band.entries.map((entry) => (
                <Row
                  key={entry.userId}
                  entry={entry}
                  isMe={entry.userId === myUserId}
                  accent={myAccent}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

interface LadderEntry {
  rank: number;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  elo: number;
  gamesPlayed: number;
}

/**
 * Your position when you are nowhere near the loaded board.
 *
 * `users.myStanding` counts properly and reports whether the figure is exact, so a player
 * 1,847th reads "1,500+" — a real answer to "where am I?" rather than a statement of where
 * they are not.
 *
 * Its own query rather than a slice of `users.me`: this one can read thousands of rows, and
 * `me` is subscribed by the sidebar on every page in the app.
 */
function MyStanding({ accent }: { accent?: string }) {
  const standing = useQuery(api.users.myStanding, {});

  if (standing === undefined) return <Skeleton className="h-16 w-full" />;
  if (standing === null) return null;

  if (standing.placementsRemaining > 0) {
    return (
      <Card className="flex flex-col gap-1 p-4">
        <p className="text-body text-paper font-semibold">Not placed yet</p>
        <p className="text-body-sm text-muted tabular-nums">
          {standing.placementsRemaining} placement match
          {standing.placementsRemaining === 1 ? "" : "es"} to go
        </p>
      </Card>
    );
  }

  const rank = rankForElo(standing.elo);
  const position = formatGlobalRank(standing.position, standing.approximate);

  return (
    <Card you accent={accent} className="flex items-center gap-3 px-3 py-2.5">
      <span className="font-display text-secondary shrink-0 text-right font-bold tabular-nums">
        {position}
      </span>
      <RankEmblem
        tierId={rank.tier.id}
        division={rank.tier.divisions > 1 ? rank.division : 1}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="text-body font-semibold" style={{ color: rank.tier.accent }}>
          {rank.label}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="font-display text-body text-paper font-bold tabular-nums">
          {standing.elo}
        </span>
        <span className="text-label text-muted tabular-nums">
          {standing.gamesPlayed} games
        </span>
      </span>
    </Card>
  );
}

function Row({
  entry,
  isMe,
  accent,
  as = "li",
}: {
  entry: LadderEntry;
  isMe: boolean;
  /** The viewer's own tier accent, used for the plate hairline on their row. */
  accent?: string;
  as?: "li" | "div";
}) {
  const rank = rankForElo(entry.elo);

  return (
    <Card
      as={as}
      you={isMe}
      accent={accent}
      className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
    >
      <span className="font-display text-secondary w-7 shrink-0 text-right font-bold tabular-nums">
        {entry.rank}
      </span>

      {/* The board has always returned an avatar and nothing has ever drawn one. A ladder
          of handles is a spreadsheet; a ladder of faces is a population. */}
      <Avatar
        url={entry.avatarUrl}
        name={entry.handle}
        className="size-8 shrink-0 text-sm"
      />

      <RankEmblem
        tierId={rank.tier.id}
        division={rank.tier.divisions > 1 ? rank.division : 1}
        size="sm"
      />

      {/* Every name on the ladder is a route into a profile.

          The chosen username, not the Google display name that used to head this row:
          onboarding tells players the handle is "how you'll appear on leaderboards", and
          this is the leaderboard. */}
      <Link
        href={`/u/${entry.handle}`}
        className="flex min-w-0 flex-1 items-baseline gap-2 rounded-xs hover:underline"
      >
        <span className="text-body truncate font-semibold">@{entry.handle}</span>
      </Link>

      <span className="flex shrink-0 flex-col items-end">
        {/* Rating in the tier's own accent: the number and the band it puts you in are
            the same fact, so they should be the same colour. */}
        <span
          className="font-display text-body font-bold tabular-nums"
          style={{ color: rank.tier.accent }}
        >
          {entry.elo}
        </span>
        <span className="text-label text-muted tabular-nums">
          {entry.gamesPlayed} games
        </span>
      </span>
    </Card>
  );
}
