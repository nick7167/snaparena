"use client";

import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
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
import { enter } from "@/ui/motion";
import { usePrefersReducedMotion } from "@/game/usePrefersReducedMotion";
import { useQueue } from "../queue-driver";
import { GlobalRank } from "../dashboard/global-rank";
import { Beat, CountUp } from "../dashboard/motion";
import { RankProgress } from "./rank-progress";
import { SearchPanel } from "./search-panel";
import { useConfig } from "../config";

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
 *
 * TWO STATES, ONE SCREEN. Idle and searching are separate compositions rather than one
 * stack with a swapped slot, and both are bound to the viewport by `HeroViewport`. The
 * contract is that neither ever needs scrolling to reach its controls: idle must show the
 * button, searching must show Cancel. See `QueueControl` for what that replaced and why.
 */
export function RankedHero() {
  const me = useQuery(api.users.me, {});
  const standing = useQuery(api.users.myStanding, {});
  // Only for the "within one win of passing @rival" claim. Returns null during
  // placements, which `stakesFor` already handles by ignoring the gap entirely.
  const neighbours = useQuery(api.users.ladderNeighbours, {});

  /**
   * The queue is read HERE rather than down in `QueueControl`, because it now decides the
   * whole composition rather than one child. It is a context read — `useQueue` returns a
   * dormant state when no provider is mounted — so this costs nothing and keeps the design
   * gallery and unit tests renderable without the shell.
   */
  const queue = useQueue();
  const reduced = usePrefersReducedMotion();
  const config = useConfig();

  // Shaped like what is coming, at the width it will arrive at, inside the same viewport
  // box — so the card and button do not jump sideways or upward on settle.
  if (me === undefined) {
    return (
      <HeroViewport>
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <Skeleton className="min-h-0 w-full flex-1" />
          {/* The rank track, which now sits with the emblem rather than in a card. */}
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-14 w-48 self-center" />
          <Skeleton className="h-16 w-full" />
        </div>
      </HeroViewport>
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

  const stakes = stakesFor(
    {
      elo: me.elo,
      gamesPlayed: me.gamesPlayed,
      placementsRemaining: me.placementsRemaining,
      rivalGap: rival?.gap,
      rivalHandle: rival?.handle,
    },
    config,
  );

  return (
    <HeroViewport>
      {/**
       * `initial={false}` matters more than the crossfade does: a player can arrive on
       * /ranked ALREADY searching — the queue outlives navigation (see queue-driver) and a
       * match found elsewhere pushes here — and without it that arrival would play a fade
       * from nothing on first paint.
       */}
      <AnimatePresence mode="wait" initial={false}>
        {queue.inQueue ? (
          <Phase key="searching" keyName="searching" reduced={reduced}>
            <RankStrip
              elo={me.elo}
              placing={placing}
              remaining={me.placementsRemaining}
            />
            <SearchPanel />
          </Phase>
        ) : (
          <Phase key="idle" keyName="idle" reduced={reduced}>
            {/**
             * The emblem block is the only child allowed to grow, and therefore the only
             * one that gives height back on a short screen. Everything below it is either
             * a number you came here to read or the control you came here to press, and
             * all of it stops working the moment it loses pixels.
             */}
            <Beat index={0} className="flex min-h-0 flex-1 flex-col gap-3">
              {placing ? <PlacementMark /> : <RankMark elo={me.elo} />}
              {/* Attached to the emblem rather than given a beat of its own: this is a
                  property of the rank above it, and the artwork is what it measures. */}
              {!placing && <RankProgress elo={me.elo} stakes={stakes} />}
            </Beat>

            <Beat index={1} className="flex flex-col items-center gap-2 text-center">
              {placing ? (
                <PlacementRun remaining={me.placementsRemaining} />
              ) : (
                <Rating elo={me.elo} standing={standing} evenSwing={stakes.evenSwing} />
              )}
            </Beat>

            {placing && (
              <Beat index={2}>
                <PlacementStakes
                  remaining={me.placementsRemaining}
                  evenSwing={stakes.evenSwing}
                />
              </Beat>
            )}

            <Beat index={3}>
              <QueueControl elo={me.elo} placing={placing} />
            </Beat>
          </Phase>
        )}
      </AnimatePresence>
    </HeroViewport>
  );
}

/**
 * The one screen both states are composed into.
 *
 * The height budget is `100dvh` minus `--shell-chrome`, declared once in globals.css and
 * read by the two screens that promise to fit in one: this and `landing.tsx`. Below `md`
 * it is 8.5rem — the mobile top bar (3.5rem) plus the fixed tab bar `<main>` reserves with
 * `pb-20` (5rem). From `md` up the navigation is a sidebar beside the content instead, so
 * there is no vertical chrome and the budget is the whole viewport.
 *
 * It was a literal in both files before, which meant the tablet band inherited the phone's
 * arithmetic and left 136px of dead space under a hero that had promised to fill the screen.
 *
 * `h-*` AND `max-h-*`, the pair `Stage`'s `fit` uses, rather than the `min-h-*` landing
 * settles for. The difference is the whole mechanism: `min-h` lets the box grow to fit its
 * content, which means nothing is ever asked to shrink and a tall rank simply pushes the
 * button off the bottom again. A definite height is what gives `flex-1` something to
 * resolve against.
 *
 * `overflow-hidden` is the backstop, not the plan — if content is being clipped here the
 * composition is wrong, not the container.
 *
 * `max-w-2xl` with `px-4` is not an approximation of LobbyColumn, it is the same
 * arithmetic. That column is `max-w-2xl` and its children apply their own `px-4`, so its
 * content is 640px wide; matching only the max-width would land this 32px wider than the
 * Form strip underneath, which reads as a misalignment rather than as two different widths.
 */
function HeroViewport({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--shell-chrome))] max-h-[calc(100dvh-var(--shell-chrome))] w-full max-w-2xl flex-col overflow-hidden px-4 py-6 lg:py-10">
      {children}
    </div>
  );
}

/**
 * One of the two compositions, and the crossfade between them.
 *
 * Opacity only, and short. The two states differ by several hundred pixels of height, so
 * anything that animates position — a slide, a layout transition — spends its whole
 * duration showing the reflow rather than covering it.
 *
 * `justify-center` is what centres the searching state, which has no growing child. In the
 * idle state the emblem's `flex-1` has already eaten the slack and this is inert.
 */
function Phase({
  children,
  keyName,
  reduced,
}: {
  children: ReactNode;
  keyName: string;
  reduced: boolean;
}) {
  return (
    <motion.div
      key={keyName}
      initial={enter(reduced, { opacity: 0 })}
      animate={{ opacity: 1 }}
      exit={reduced ? undefined : { opacity: 0 }}
      transition={{ duration: 0.14 }}
      className="flex min-h-0 flex-1 flex-col justify-center gap-4"
    >
      {children}
    </motion.div>
  );
}

/**
 * The emblem, as the subject.
 *
 * Two renders rather than a responsive class: `RankEmblem` takes a discrete `size` and
 * writes pixel dimensions inline, which no breakpoint can reach. Same `src` at both, so
 * the browser fetches once.
 *
 * `fit` is what lets this screen keep its promise. It holds the plate-normalised size as a
 * CEILING and puts a real floor under it, so a Legend still renders physically larger than
 * a Bronze on a tall screen and a 360×640 simply fits them both. Read the prop's own
 * docblock before touching it — the obvious version, a natural height with
 * `max-height: 100%`, silently does nothing.
 *
 * The bloom is one of the three exceptions globals.css licenses, reserved for screens that
 * make the emblem the subject — this is one of them, while the player is looking at it.
 * It is also mechanically safe HERE in a way it was not on the dashboard:
 * `.bloom-tier::before` is `inset: -35%`, so an emblem pinned to a card's right edge threw
 * ~70px of halo past the viewport and scrolled the page sideways with nothing in the DOM
 * reporting an overflow, because a pseudo-element does not. Centred in a column with room
 * either side, it has somewhere to go.
 */
function RankMark({ elo }: { elo: number }) {
  const rank = rankForElo(elo);
  const division = rank.tier.divisions > 1 ? rank.division : 1;

  return (
    <>
      {/**
       * Wrapped rather than given `hidden` / `sm:block` directly.
       *
       * RankEmblem's bloom and fit branches both hardcode a display on their own wrapper,
       * and a `hidden` passed through `className` lands in the same class attribute — so
       * which one wins is decided by the order Tailwind emits the two display utilities,
       * not by the order they are written. It lost, and BOTH emblems rendered on mobile,
       * stacked. Owning the display on an element the component does not write is
       * unambiguous.
       *
       * The wrapper carries the growth (`min-h-0 flex-1`) and the emblem fills it. That
       * keeps the emblem a direct flex item of a box with a definite height, which is what
       * `fit` needs — nested inside a shrink-to-fit centring div it has no height to
       * resolve against and the artwork collapses to nothing.
       */}
      <span className="flex min-h-0 flex-1 sm:hidden">
        <RankEmblem
          tierId={rank.tier.id}
          division={division}
          size="xl"
          bloom={rank.tier.accent}
          fit
          className="min-h-0 w-full flex-1"
        />
      </span>
      <span className="hidden min-h-0 flex-1 sm:flex">
        <RankEmblem
          tierId={rank.tier.id}
          division={division}
          size="hero"
          bloom={rank.tier.accent}
          fit
          className="min-h-0 w-full flex-1"
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
          own display, so a `hidden` passed through className is a coin toss. */}
      <span className="flex min-h-0 flex-1 items-center justify-center sm:hidden">
        <RankEmblem tierId="silver" division={1} size="xl" unranked fit />
      </span>
      <span className="hidden min-h-0 flex-1 items-center justify-center sm:flex">
        <RankEmblem tierId="silver" division={1} size="hero" unranked fit />
      </span>
      <h1 className="font-display text-display-2 sm:text-display-1 text-secondary text-center font-extrabold tracking-tight uppercase">
        Unranked
      </h1>
    </>
  );
}

/**
 * The rank, reduced to a line, for the searching state.
 *
 * The screen belongs to the search now, but arriving at it should not feel like leaving
 * your rank behind — so the identity survives as one row instead of vanishing.
 *
 * `size="lg"`, and the boundary is not cosmetic: `RankEmblem` switches ASSET SETS below
 * it, with `sm`/`md` drawing the light 96px plate from /ranks/sm/ and `lg` and up drawing
 * the full artwork. `lg` therefore shares its `src` with the `xl`/`hero` emblem the player
 * was looking at a frame ago and comes straight from cache. `md` would be a fresh network
 * request at the exact moment the layout is already moving, which is a flash of nothing
 * where the rank used to be.
 *
 * No bloom. The licensed exception is for screens that make the emblem the subject, and
 * this state deliberately does not — that is the entire point of the change.
 */
function RankStrip({
  elo,
  placing,
  remaining,
}: {
  elo: number;
  placing: boolean;
  remaining: number;
}) {
  if (placing) {
    const played = Math.max(0, PLACEMENT_MATCHES - remaining);
    return (
      <div className="flex items-center justify-center gap-3">
        <RankEmblem tierId="silver" division={1} size="lg" unranked />
        <span className="font-display text-body-lg text-secondary font-extrabold tracking-tight uppercase">
          Unranked
        </span>
        <span className="text-faint" aria-hidden="true">
          ·
        </span>
        <span className="text-body-sm text-secondary tabular-nums">
          {played} of {PLACEMENT_MATCHES} played
        </span>
      </div>
    );
  }

  const rank = rankForElo(elo);
  const division = rank.tier.divisions > 1 ? rank.division : 1;

  return (
    <div className="flex items-center justify-center gap-3">
      {/* `plateAligned` because the plate, not the bounding box, is what has to read level
          with the text beside it — see PLATE_NUDGE for why that is one constant. */}
      <RankEmblem tierId={rank.tier.id} division={division} size="lg" plateAligned />
      <span
        className="font-display text-body-lg font-extrabold tracking-tight uppercase"
        style={{ color: rank.tier.accent }}
      >
        {rank.label}
      </span>
      <span className="text-faint" aria-hidden="true">
        ·
      </span>
      <span className="font-display text-numeral text-paper font-extrabold tabular-nums">
        {elo}
      </span>
    </div>
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
        <span className="text-label text-secondary font-bold tracking-label tabular-nums">
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
 * The control. Idle only — the search is a separate composition now.
 *
 * Searching used to happen IN PLACE, with the emblem, the rating and the card above all
 * holding their positions, so that pressing the button did not throw away the standing you
 * were just looking at. The intent was right and the arithmetic was not. `SearchPanel` is
 * roughly 2.5× the height of the block it replaced, mounted at the bottom of a stack that
 * gave up nothing, and the budget is `100dvh` minus 8.5rem of chrome: 708px on a 390×844
 * phone against a searching state that measured 708px, 531px on a 375×667 against 730px,
 * and 768px on a 1024×768 laptop against 985px. So the two controls a searching player
 * actually needs — Cancel, and the bot offer — sat below the fold on every phone smaller
 * than a 390 and on every laptop. A standing you can still see is worth less than a search
 * you can call off.
 *
 * The rank is not thrown away, it is demoted: see `RankStrip`.
 *
 * The accessible name is exactly "Find a match". `dev-rank-bots.spec.ts` locates this
 * control by that string, so the wide lettering has to come from CSS tracking — spaces in
 * the markup would land in the accessible name and break the locator.
 */
function QueueControl({ elo, placing }: { elo: number; placing: boolean }) {
  const queue = useQueue();
  const range = openingRange(elo);

  return (
    <div className="flex flex-col gap-2.5">
      <Button
        size="lg"
        block
        loading={queue.pending === "enqueue"}
        onClick={queue.enqueue}
        className="min-h-16 text-xl tracking-label uppercase"
      >
        <Glyph name="tier" filled />
        Find a match
      </Button>

      {/* The one thing this screen could not previously say. A rejected enqueue left the
          loudest control in the app inert, which reads as a broken button rather than a
          failed request. */}
      {queue.error && (
        <p className="text-body-sm text-signal-text text-center" role="alert">
          {queue.error}
        </p>
      )}

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
