"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  useLadderStatus,
  useLeaderboard,
  useMe,
  useMyStanding,
  useTierCounts,
} from "../db";
import { PLACEMENT_MATCHES, RANK_TIERS } from "@/engine/config";
import { rankForElo } from "@/engine/ranks";
import { levelForXp } from "@/engine/xp";
import { timeAgo, timeUntil } from "@/ui/relative-time";
import { useNow } from "@/game/usePrefersReducedMotion";
import { GlobalRank } from "../dashboard/global-rank";
import { Button } from "@/ui/Button";
import { Card, Empty, SectionLabel, Skeleton } from "@/ui/Surface";
import { RankEmblem } from "@/ui/RankEmblem";
import { Avatar } from "@/game/ui";
import { useConfig } from "../config";
import type { ResolvedConfig } from "@/engine/config-merge";

/** Matches LADDER_INTERVAL_MS in the module. The board says when it next rebuilds. */
const LADDER_INTERVAL_MS = 5 * 60 * 1000;

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
  const stored = useLeaderboard(500);
  const me = useMe();
  /**
   * Lifted from the pinned rail so the splice below can use it.
   *
   * `position` is computed from your LIVE rating against the stored field, so it is the
   * one number on this page that is never stale — which is exactly what makes it the right
   * index to insert yourself at.
   */
  const standing = useMyStanding(useMe());
  const config = useConfig();

  /**
   * Your own row, placed by your live rating rather than by the snapshot's.
   *
   * The board is a five-minute-old field; you are not. Splicing here rather than on the
   * server keeps `leaderboard` free of `currentUser`, so it stays ONE cache entry shared
   * by every viewer instead of forking per identity on the heaviest read in the app.
   *
   * Indexed by `standing.position` rather than by finding-and-replacing your existing row:
   * that also covers a player who climbed INTO the top 500 since the last build and so has
   * no row to replace. Because the insert index is the position, your rendered row number
   * IS your position — the same figure the pinned rail, the dashboard chip and your profile
   * all show.
   */
  const board = spliceOwnRow(stored, me, standing?.position ?? null, config);

  const myRow = board?.find((entry) => entry.userId === me?.id);
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
      {/*
        The heading and its freshness line move together, so the line cannot be scrolled
        under the band headers below — those are `sticky top-0`. Rendered unconditionally
        with a reserved line height so the board does not jump when the timestamp lands.
      */}
      <div className="mb-6 flex min-h-[3lh] flex-col gap-1">
        <h1 className="font-display text-display-1 font-extrabold">Leaderboard</h1>
        <BoardFreshness />
      </div>

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
              myUserId={me?.id}
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
  entries: BoardRow[];
  myUserId?: bigint;
  myAccent?: string;
  /** Reports whether the viewer's own row was actually drawn, so the rail can hide. */
  onMeVisible: (visible: boolean) => void;
}) {
  const counts = useTierCounts();
  // Keyed by tier, holding how many rows that band is currently showing. Absent means
  // the default ten — so the initial state is genuinely empty rather than seeded.
  const [expanded, setExpanded] = useState<Record<string, number>>({});

  const bands: { tierId: string; entries: BoardRow[] }[] = [];
  for (const entry of entries) {
    const tierId = rankForElo(entry.elo).tier.id;
    const last = bands[bands.length - 1];
    if (last?.tierId === tierId) last.entries.push(entry);
    else bands.push({ tierId, entries: [entry] });
  }

  const shownFor = (band: { tierId: string; entries: BoardRow[] }) =>
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
                  {population.count}{" "}
                  {population.count === 1 ? "player" : "players"}
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
              (false || population.count > band.entries.length) && (
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
  const standing = useMyStanding(useMe());

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
  entry: BoardRow;
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

/**
 * How old the field is, and when it moves next.
 *
 * The staleness being disclosed is the FIELD's, not the viewer's — your own rank is
 * computed from your live rating and is current everywhere in the app. That is why this
 * line lives only here and says "board", rather than appearing beside every rank in the
 * app and wrongly implying your number is old.
 *
 * Renders nothing where there is nothing to disclose: before the first build, and in dev
 * where the rank bots bypass the snapshot and the board really is live.
 */
function BoardFreshness() {
  const status = useLadderStatus();
  const now = useNow(60_000);

  if (!status) return null;

  /**
   * The rebuild cadence is a client-side constant now.
   *
   * `ladder.status` returned it because the cron interval lived beside the query; the
   * module's schedule owns it, and shipping it in every status row to render one line
   * would be a column that never changes.
   */
  const builtAtMs = Number(status.builtAt.microsSinceUnixEpoch / 1_000n);

  return (
    <p className="text-label text-muted tabular-nums">
      Board updated {timeAgo(builtAtMs, now)}
      <span className="text-faint" aria-hidden="true">
        {" · "}
      </span>
      next in {timeUntil(builtAtMs + LADDER_INTERVAL_MS, now)}
    </p>
  );
}

type BoardRow = NonNullable<ReturnType<typeof useLeaderboard>>[number];
type Me = NonNullable<ReturnType<typeof useMe>>;

/**
 * Places the viewer's own row by their LIVE rating rather than the snapshot's.
 *
 * The board is a field that is up to five minutes old; the viewer is not. Their position
 * comes from `myStanding`, which measures their current rating against that same field —
 * so inserting at `position - 1` makes the rendered row number equal the position shown on
 * the pinned rail, the dashboard chip and their profile. That agreement is the invariant
 * the ladder e2e suite exists to protect.
 *
 * Indexing by position rather than replacing an existing row also covers the player who
 * climbed INTO the top 500 since the last build, and therefore has no row to replace.
 *
 * Done on the client on purpose: `users.leaderboard` takes no auth, so it stays one cache
 * entry shared by every viewer. Splicing server-side would fork that cache per identity on
 * the heaviest read in the app.
 */
function spliceOwnRow(
  stored: BoardRow[] | undefined,
  me: Me | null | undefined,
  position: number | null,
  config: ResolvedConfig,
): BoardRow[] | undefined {
  if (!stored || !me || !position) return stored;
  if (position > stored.length) return stored;

  const without = stored.filter((entry) => entry.userId !== me.id);

  const mine: BoardRow = stored.find((entry) => entry.userId === me.id) ?? {
    rank: position,
    userId: me.id,
    handle: me.handle,
    displayName: me.displayName,
    avatarUrl: me.avatarUrl,
    elo: me.elo,
    gamesPlayed: me.gamesPlayed,
    level: levelForXp(me.xp, config).level,
    // The two fields a ladder row carries that `me` does not: the tier is derived from
    // the same rating, and a synthesised row is never a bucket floor — it is the
    // player's own exact position.
    tierId: rankForElo(me.elo).tier.id,
    approximate: false,
  };

  const spliced = [...without];
  spliced.splice(Math.min(position - 1, without.length), 0, { ...mine, elo: me.elo });

  // Renumbering the whole list is correct: moving one entry within an ordered list leaves
  // it ordered, so sequential numbering is still the field's numbering.
  return spliced.slice(0, stored.length).map((entry, index) => ({ ...entry, rank: index + 1 }));
}
