"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { PLACEMENT_MATCHES, RANK_TIERS } from "@/engine/config";
import { rankForElo } from "@/engine/ranks";
import { GlobalRank } from "../dashboard/global-rank";
import { Button } from "@/ui/Button";
import { Card, Empty, SectionLabel, Skeleton } from "@/ui/Surface";
import { RankEmblem } from "@/ui/RankEmblem";
import { Avatar } from "@/game/ui";

/** Rows each tier band shows before it has to be expanded. */
const PER_BAND = 10;

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
 * Every band is present from the first paint, each showing its best ten. A single global
 * "Load more" meant Bronze was several clicks below the fold and most players never saw
 * their own tier at all; expanding is per band now, so scrolling passes through the whole
 * ladder and you open only the part you care about.
 *
 * "Where am I?" is still the first question it has to answer, so your own row is pinned
 * whenever you are not already visible in the page.
 */
export default function LeaderboardPage() {
  const board = useQuery(api.users.leaderboard, { limit: 500 });
  const me = useQuery(api.users.me, {});

  const myRow = board?.find((entry) => entry.userId === me?._id);
  const myAccent = me ? rankForElo(me.elo).tier.accent : undefined;

  /**
   * Whether your own row appears in what is actually rendered.
   *
   * Bands collapse to ten, so being in the fetched 500 is not the same as being on
   * screen — a player ranked 40th in Gold is loaded but hidden until that band is
   * expanded. Computed inside `Bands`, which is the only thing that knows what it drew,
   * and lifted here so the pinned rail can react to it.
   */
  const [meVisible, setMeVisible] = useState(false);

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
              entries={board}
              myUserId={me?._id}
              myAccent={myAccent}
              onMeVisible={setMeVisible}
            />
          </div>

          {/* Pinned standing, only when you are not already in the list — the same row
              must never appear twice. On desktop it is a sticky rail; below `xl` it falls
              back underneath the board, which is where it used to live. */}
          {me && !meVisible && (
            /**
             * Sticky at BOTH ends of the range, not just the top.
             *
             * Below `xl` this fell back to sitting underneath the board — beneath five
             * hundred rows, which is not a fallback, it is a place nobody will ever
             * scroll to. A player at #142 on a phone had no way at all to find
             * themselves. It pins to the bottom of the viewport instead, clear of the
             * tab bar, and returns to the desktop rail from `xl`.
             */
            <aside
              className="bg-ink-900/95 border-line fixed inset-x-0 bottom-20 z-30 flex flex-col
                         gap-2 border-t px-4 py-3 backdrop-blur
                         xl:static xl:inset-auto xl:z-auto xl:w-64 xl:shrink-0 xl:border-t-0
                         xl:bg-transparent xl:px-0 xl:py-0 xl:backdrop-blur-none
                         xl:sticky xl:top-4"
            >
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
 * Bands are derived from the rows fetched rather than from RANK_TIERS directly, so a tier
 * nobody occupies never renders an empty header.
 *
 * Each band shows its best ten and expands on its own. That is the difference between a
 * board you read and a board you page through: every tier is on screen from the first
 * paint, and opening Diamond does not push Bronze further away.
 */
function Bands({
  entries,
  myUserId,
  myAccent,
  onMeVisible,
}: {
  entries: LadderEntry[];
  myUserId?: string;
  myAccent?: string;
  /** Reports whether the viewer's own row was actually drawn, so the rail can hide. */
  onMeVisible: (visible: boolean) => void;
}) {
  const counts = useQuery(api.users.tierCounts, {});
  // Keyed by tier, holding how many rows that band is currently showing. Absent means
  // the default ten — so the initial state is genuinely empty rather than seeded.
  const [expanded, setExpanded] = useState<Record<string, number>>({});

  const bands: { tierId: string; entries: LadderEntry[] }[] = [];
  for (const entry of entries) {
    const tierId = rankForElo(entry.elo).tier.id;
    const last = bands[bands.length - 1];
    if (last?.tierId === tierId) last.entries.push(entry);
    else bands.push({ tierId, entries: [entry] });
  }

  const shownFor = (band: { tierId: string; entries: LadderEntry[] }) =>
    band.entries.slice(0, expanded[band.tierId] ?? PER_BAND);

  /**
   * Reported through an effect rather than during render.
   *
   * Whether your row is drawn depends on which bands are expanded, so it changes as the
   * user clicks — and calling the parent's setState while rendering is exactly the
   * cascading-render pattern the lint rules reject.
   */
  const meDrawn = myUserId
    ? bands.some((band) => shownFor(band).some((entry) => entry.userId === myUserId))
    : false;

  useEffect(() => {
    onMeVisible(meDrawn);
  }, [meDrawn, onMeVisible]);

  return (
    <div className="flex flex-col gap-6">
      {bands.map((band) => {
        const tier = RANK_TIERS.find((candidate) => candidate.id === band.tierId);
        const population = counts?.find((entry) => entry.tierId === band.tierId);
        const shown = shownFor(band);
        const hidden = band.entries.length - shown.length;

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
              {shown.map((entry) => (
                <Row
                  key={entry.userId}
                  entry={entry}
                  isMe={entry.userId === myUserId}
                  accent={myAccent}
                />
              ))}
            </ol>

            {hidden > 0 && (
              <Button
                variant="secondary"
                block
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [band.tierId]: band.entries.length,
                  }))
                }
              >
                Show {hidden} more in {tier?.name ?? band.tierId}
              </Button>
            )}

            {/* The band holds more players than the page fetched. Said plainly rather
                than hidden: the count in the header is the truth, and the list simply
                cannot reach that far. */}
            {hidden === 0 &&
              population &&
              (population.approximate || population.count > band.entries.length) && (
                <p className="text-label text-muted text-center">
                  Showing the top {band.entries.length} of {tier?.name ?? band.tierId}
                </p>
              )}
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
  level: number;
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

  return (
    <Card you accent={accent} className="flex flex-col gap-2 px-3 py-2.5">
      {/* The same struck chip the dashboard and the VS reveal use, so "notable" means one
          thing across the app — and it is what carries the percentile. */}
      <GlobalRank position={standing.position} approximate={standing.approximate} />

      <div className="flex items-center gap-3">
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
      </div>
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
          L{entry.level} · {entry.gamesPlayed} games
        </span>
      </span>
    </Card>
  );
}
