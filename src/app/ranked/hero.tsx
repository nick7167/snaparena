"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { rankForElo } from "@/engine/ranks";
import { openingRange, stakesFor } from "@/engine/stakes";
import {
  DUEL_STARTING_HP,
  PLACEMENT_MATCHES,
  VETO_BANS_PER_PLAYER,
} from "@/engine/config";
import { RankEmblem } from "@/ui/RankEmblem";
import { Button } from "@/ui/Button";
import { Skeleton } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { useQueue } from "../queue-driver";
import { GlobalRank } from "../dashboard/global-rank";
import { Beat, CountUp } from "../dashboard/motion";
import { StakesCard } from "./stakes-card";
import { SearchPanel } from "./search-panel";

/**
 * The ranked hero.
 *
 * Full-bleed on purpose, and rendered outside `LobbyColumn` — see that file, which exists
 * precisely to separate "the reading column" from "things that need the viewport".
 *
 * The page this replaces was the dashboard again, narrower: the same rank, the same
 * rating, the same progress bar and the same form strip, with the one control it exists
 * for sitting at default size more than half a screen down. The sidebar's gold PLAY button
 * was more dramatic than the page it opened.
 *
 * The order is the argument — rank, then what the next match can change, then the control.
 * Everything above the button is a reason to press it.
 */
export function RankedHero() {
  const me = useQuery(api.users.me, {});
  const standing = useQuery(api.users.myStanding, {});
  // Only for the "within one win of passing @rival" claim. Returns null during
  // placements, which `stakesFor` already handles by ignoring the gap entirely.
  const neighbours = useQuery(api.users.ladderNeighbours, {});

  // Shaped like what is coming, at the width it will arrive at — same `max-w-2xl px-4`
  // the loaded hero uses, so the card and button do not jump sideways on settle.
  if (me === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 pt-6 sm:pt-10">
        <Skeleton className="size-28 sm:size-44" />
        <Skeleton className="h-14 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (!me) return null;

  const placing = me.placementsRemaining > 0;

  /**
   * The nearest player ahead.
   *
   * `above` is ordered furthest-ahead first and trimmed to a rolling window, so the last
   * entry is the one directly above — taking `[0]` would name whoever happens to sit at
   * the far end of the window and report a gap five places wide.
   */
  const rival = neighbours?.above.at(-1);

  const stakes = stakesFor({
    elo: me.elo,
    gamesPlayed: me.gamesPlayed,
    placementsRemaining: me.placementsRemaining,
    rivalGap: rival?.gap,
    rivalHandle: rival?.handle,
  });

  return (
    <div className="flex flex-col items-center gap-6 pt-6 sm:pt-10">
      <Beat index={0} className="flex flex-col items-center gap-3 px-4">
        {placing ? <PlacementMark /> : <RankMark elo={me.elo} />}
      </Beat>

      <Beat index={1} className="flex flex-col items-center gap-2 px-4 text-center">
        {placing ? (
          <PlacementRun remaining={me.placementsRemaining} />
        ) : (
          <Rating elo={me.elo} standing={standing} evenSwing={stakes.evenSwing} />
        )}
      </Beat>

      {/**
       * One column from here down, so the card, the control and everything the lobby
       * renders below the hero share one edge.
       *
       * `max-w-2xl` with `px-4` is not an approximation of LobbyColumn — it is the same
       * arithmetic. That column is `max-w-2xl` and its children apply their own `px-4`,
       * so its content is 640px wide; matching only the max-width would land this 32px
       * wider than the Form strip underneath, which reads as a misalignment rather than
       * as two different widths.
       */}
      <div className="flex w-full max-w-2xl flex-col gap-4 px-4">
        <Beat index={2}>
          {placing ? (
            <PlacementStakes remaining={me.placementsRemaining} evenSwing={stakes.evenSwing} />
          ) : (
            <StakesCard stakes={stakes} />
          )}
        </Beat>

        <Beat index={3}>
          <QueueControl elo={me.elo} placing={placing} />
        </Beat>
      </div>
    </div>
  );
}

/**
 * The emblem, as the subject.
 *
 * Two renders rather than a responsive class: `RankEmblem` takes a discrete `size` and
 * writes pixel dimensions inline, which no breakpoint can reach. Same `src` at both, so
 * the browser fetches once.
 *
 * The bloom is one of the three exceptions globals.css licenses, reserved for screens that
 * make the emblem the subject — this is now one of them. It is also mechanically safe HERE
 * in a way it was not on the dashboard: `.bloom-tier::before` is `inset: -35%`, so an
 * emblem pinned to a card's right edge threw ~70px of halo past the viewport and scrolled
 * the page sideways with nothing in the DOM reporting an overflow, because a
 * pseudo-element does not. Centred in a column with room either side, it has somewhere
 * to go.
 */
function RankMark({ elo }: { elo: number }) {
  const rank = rankForElo(elo);
  const division = rank.tier.divisions > 1 ? rank.division : 1;

  return (
    <>
      {/**
       * Wrapped rather than given `hidden` / `sm:block` directly.
       *
       * RankEmblem's bloom branch hardcodes `inline-flex` on its own wrapper, and a
       * `hidden` passed through `className` lands in the same class attribute — so which
       * one wins is decided by the order Tailwind emits the two display utilities, not by
       * the order they are written. It lost, and BOTH emblems rendered on mobile, stacked.
       * Owning the display on an element the component does not write is unambiguous.
       */}
      <span className="sm:hidden">
        <RankEmblem
          tierId={rank.tier.id}
          division={division}
          size="xl"
          bloom={rank.tier.accent}
        />
      </span>
      <span className="hidden sm:block">
        <RankEmblem
          tierId={rank.tier.id}
          division={division}
          size="hero"
          bloom={rank.tier.accent}
        />
      </span>

      <h1
        className="font-display text-display-2 sm:text-display-1 text-center font-extrabold tracking-tight uppercase"
        style={{ color: rank.tier.accent }}
      >
        {rank.label}
      </h1>
    </>
  );
}

/** No artwork to show yet — RankEmblem draws its ghosted plate for the unranked state. */
function PlacementMark() {
  return (
    <>
      {/* Wrapped for the same reason as RankMark — the unranked branch also writes its
          own `inline-flex`, so a `hidden` passed through className is a coin toss. */}
      <span className="sm:hidden">
        <RankEmblem tierId="silver" division={1} size="xl" unranked />
      </span>
      <span className="hidden sm:block">
        <RankEmblem tierId="silver" division={1} size="hero" unranked />
      </span>
      <h1 className="font-display text-display-2 sm:text-display-1 text-secondary text-center font-extrabold tracking-tight uppercase">
        Unranked
      </h1>
    </>
  );
}

/**
 * The rating, at the loudest size in the type scale.
 *
 * `display-hero` is 96px and was previously spent only on countdown digits, which made the
 * number a player actually cares about smaller everywhere than the number counting them
 * into a round. Stepped down at the small breakpoint: four digits of 96px Archivo
 * extrabold fit a 390px screen, but without enough margin to trust it across fonts.
 */
function Rating({
  elo,
  standing,
  evenSwing,
}: {
  elo: number;
  standing: { position: number | null; approximate: boolean } | null | undefined;
  evenSwing: number;
}) {
  return (
    <>
      <p className="font-display text-display-1 sm:text-display-hero text-paper font-extrabold tracking-tight">
        <CountUp value={elo} />
      </p>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <GlobalRank position={standing?.position} approximate={standing?.approximate} />
        {/* The honest headline stake: what an EVEN pairing moves you, which is the match
            the queue is actually trying to make. Not a projection of the next result —
            that needs an opponent who does not exist yet. */}
        <span className="text-label text-secondary font-bold tracking-[0.1em] tabular-nums">
          ±{evenSwing} A MATCH
        </span>
      </div>
    </>
  );
}

/**
 * The placement run.
 *
 * Five slots and a count. A player's first five ranked matches are the most consequential
 * of their career and this screen used to render them as the word "Unranked" above a thin
 * bar — the loudest page in the app at its dullest for the people who have seen the least
 * of it.
 */
function PlacementRun({ remaining }: { remaining: number }) {
  const played = Math.max(0, PLACEMENT_MATCHES - remaining);

  return (
    <>
      <div
        className="flex items-center gap-2.5"
        role="img"
        aria-label={`${played} of ${PLACEMENT_MATCHES} placement matches played`}
      >
        {Array.from({ length: PLACEMENT_MATCHES }, (_, index) => (
          <span
            key={index}
            className={`size-4 rounded-full sm:size-5 ${
              index < played ? "bg-gold" : "border-line-strong border-2 border-dashed"
            }`}
          />
        ))}
      </div>
      <p className="text-body-lg text-secondary tabular-nums">
        {played} of {PLACEMENT_MATCHES} played
      </p>
    </>
  );
}

/**
 * The placement stake.
 *
 * Stated without a multiplier on purpose. "2.5× normal" is only true against an
 * ESTABLISHED player's K — the moment placements end the factor drops to K_EARLY, not to
 * the established one, so the comparison a new player would carry away is the wrong one.
 */
function PlacementStakes({
  remaining,
  evenSwing,
}: {
  remaining: number;
  evenSwing: number;
}) {
  return (
    <div className="border-line-strong bg-ink-700 sheen flex flex-col gap-2 rounded-md border p-5">
      <p className="font-display text-body-lg text-paper flex items-start gap-2.5 font-extrabold tracking-tight uppercase">
        <span className="text-gold mt-0.5 shrink-0">
          <Glyph name="tier" filled />
        </span>
        <span className="min-w-0">
          {remaining} {remaining === 1 ? "match" : "matches"} to your rank
        </span>
      </p>
      <p className="text-body-sm text-secondary tabular-nums">
        ±{evenSwing} a match while you place — the widest your rating will ever swing.
        Nothing is locked in yet.
      </p>
    </div>
  );
}

/**
 * The control, and the search that replaces it.
 *
 * Searching happens IN PLACE and that is deliberate — the emblem, the rating and the card
 * above all hold their positions, so pressing the button does not throw away the standing
 * you were just looking at. An earlier version replaced the whole page with a heading and
 * a bar, which meant the one moment a player is most invested in their rank was the moment
 * it disappeared.
 *
 * The accessible name is exactly "Find a match". `dev-rank-bots.spec.ts` locates this
 * control by that string, so the wide lettering has to come from CSS tracking — spaces in
 * the markup would land in the accessible name and break the locator.
 */
function QueueControl({ elo, placing }: { elo: number; placing: boolean }) {
  const queue = useQueue();

  if (queue.inQueue) return <SearchPanel />;

  const range = openingRange(elo);

  return (
    <div className="flex flex-col gap-2.5">
      <Button
        size="lg"
        block
        onClick={queue.enqueue}
        className="min-h-16 text-xl tracking-[0.14em] uppercase"
      >
        <Glyph name="tier" filled />
        Find a match
      </Button>

      <p className="text-label text-muted text-center tabular-nums">
        {/* The band is real: `openingRange` reads the same `eloBandFor` the server matches
            on, so this is the range being searched rather than an illustration of one.
            Withheld during placements, which have no rating to open a band around. */}
        {!placing && (
          <>
            Opponents {range.low}–{range.high} ·{" "}
          </>
        )}
        Both start on {DUEL_STARTING_HP} HP · ban {VETO_BANS_PER_PLAYER} categories each
      </p>
    </div>
  );
}
