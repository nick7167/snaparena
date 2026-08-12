"use client";

import type { ReactNode } from "react";
import { useDailyStreak, useMe, useMyStanding } from "../db";
import { rankForElo } from "@/engine/ranks";
import { levelForXp } from "@/engine/xp";
import { PLACEMENT_MATCHES } from "@/engine/config";
import { RankEmblem } from "@/ui/RankEmblem";
import { Meter, Skeleton } from "@/ui/Surface";
import { Avatar } from "@/game/ui";
import { CountUp } from "./motion";
import { GlobalRank } from "./global-rank";
import { StreakRow } from "./streak-row";
import { useConfig } from "../config";

/**
 * The career card.
 *
 * Everything that answers "who am I here" in one struck object, rather than a greeting
 * and three separate cards each stating a fraction of it.
 *
 * Three zones, and the arrangement is the whole design: identity pinned LEFT, the emblem
 * pinned RIGHT, and the numbers spread across the full width beneath them. Centring the
 * pair instead — which is what this did before — fails at both ends of the range at once:
 * on a wide card it leaves a third of the width empty, and on a phone it jams two large
 * objects together in the middle with nowhere for either to breathe. Pushing them to the
 * edges is one rule that fixes both.
 *
 * The plate is the app's own geometry — the same asymmetric chamfer as the rank emblem,
 * drawn as two stacked fills because `clip-path` would cut a border away at the two cut
 * corners. Its hairline carries the tier accent, which is the only colour on the object.
 */
export function PlayerBanner() {
  const me = useMe();
  const standing = useMyStanding(me);
  const streak = useDailyStreak(me?.id);
  const config = useConfig();

  if (me === undefined) return <Skeleton className="h-56 w-full" />;
  if (!me) return null;

  const rank = rankForElo(me.elo);
  const placing = me.placementsRemaining > 0;
  const level = levelForXp(me.xp, config);
  const played = Math.max(0, PLACEMENT_MATCHES - me.placementsRemaining);

  return (
    <div className="relative isolate px-4 py-5 sm:px-6 sm:py-6">
      <span
        aria-hidden="true"
        className="plate absolute inset-0 -z-10"
        style={{
          ["--plate-cut" as string]: "20px",
          backgroundColor: placing ? "var(--color-line-strong)" : rank.tier.accent,
        }}
      />
      <span
        aria-hidden="true"
        className="plate bg-ink-800 absolute inset-[1.5px] -z-10"
        style={{ ["--plate-cut" as string]: "20px" }}
      />

      <div className="flex flex-col gap-5">
        {/**
         * Zone 1 — identity.
         *
         * `flex-wrap` with `order` rather than two layouts: below `sm` the name block
         * carries `w-full`, so it wraps onto its own row beneath the portrait and emblem;
         * from `sm` it sits between them and absorbs the slack. One DOM, two compositions,
         * and nothing is rendered twice.
         */}
        <div className="flex items-end justify-between gap-3 sm:gap-6">
          {/* Left unit: the person. Portrait and name read as one object rather than a
              picture with a caption somewhere below it. */}
          <div className="flex min-w-0 flex-1 items-end gap-3 sm:gap-5">
            <span
              className="relative isolate flex size-16 shrink-0 items-center justify-center sm:size-28"
              style={{ ["--plate-cut" as string]: "14px" }}
            >
              <span
                aria-hidden="true"
                className="plate absolute inset-0 -z-10"
                style={{
                  backgroundColor: placing
                    ? "var(--color-line-strong)"
                    : rank.tier.accent,
                }}
              />
              {/* Inset rather than sized: the frame IS the gap this leaves, so stating it
                  as a gap is more direct than sizing the portrait and trusting it to
                  centre. Same construction as the profile hero. */}
              <Avatar
                plate
                url={me.avatarUrl}
                name={me.handle}
                className="absolute inset-[3px] text-2xl sm:text-4xl"
              />
            </span>

            {/* Position above the name, name below it. The ladder slot is the thing that
                changes and the handle is the thing that does not, so the volatile figure
                gets the glance and the constant one anchors it. */}
            <div className="flex min-w-0 flex-col gap-0.5">
              {!placing && (
                <GlobalRank
                  position={standing?.position}
                  approximate={standing?.approximate}
                />
              )}

              {/* The name leads the card. It was `body-lg` under a rank heading, which
                  made the one string that is actually the player's own the smallest thing
                  on their own card.

                  One step down the scale from where that landed, because a handle can be
                  twelve characters and a display size that only suits short ones is a
                  display size that truncates most of them. HANDLE_MAX_LENGTH now fits
                  without clipping at both breakpoints. */}
              <p className="font-display text-numeral sm:text-display-2 text-paper min-w-0 truncate font-extrabold tracking-tight">
                @{me.handle}
              </p>
            </div>
          </div>

          {/* Right unit: the rank. The label runs up the emblem's left edge like a spine,
              so the two read as one object and the name is left alone with the width it
              needs. Horizontal, it competed with the name for the same line. */}
          {/* `items-end`, and it is load-bearing. Under `items-stretch` a flex item with a
              definite cross size is not stretched — it is placed at flex-START. The
              emblem carries inline pixel dimensions, so it was pinned to the top of this
              unit, and on mobile the unit is taller than the emblem because the vertical
              rank label is what drives its height. The emblem hung 26px above the line
              everything else stands on. */}
          <div className="flex shrink-0 items-end gap-2 sm:gap-3">
            {/* Sized so it cannot tower over the emblem it labels. Vertical text is as
                tall as the string is long, so at 18px "SILVER I" ran 99px against a 73px
                emblem on mobile and drove the whole row's height — the label, not the
                artwork, was setting how tall the identity zone was. */}
            <h1
              className="font-display text-label sm:text-numeral flex items-center font-extrabold tracking-label whitespace-nowrap uppercase [writing-mode:vertical-rl] rotate-180 sm:tracking-label"
              style={{ color: placing ? undefined : rank.tier.accent }}
            >
              {placing ? "Unranked" : rank.label}
            </h1>

            {/**
             * No bloom.
             *
             * Two reasons, and either alone would do. `--bloom-tier` is one of three
             * licensed exceptions to the no-glow rule and it belongs to the screens that
             * make the emblem the subject — the profile hero and the VS reveal — where
             * here it is one half of a card. And mechanically it cannot work in this
             * position: `.bloom-tier::before` is `inset: -35%`, so an emblem pinned to
             * the card's right edge throws roughly 70px of halo past the viewport and the
             * page scrolls sideways. Nothing in the DOM reports overflowing, because a
             * pseudo-element does not.
             *
             * Rendered at two sizes rather than sized responsively: RankEmblem takes a
             * discrete `size` and writes pixel dimensions inline, which no breakpoint can
             * reach. Same `src`, so the browser fetches once.
             */}
            {/**
             * Wrapped, because passing `hidden` through `className` does not reliably
             * hide this.
             *
             * RankEmblem's UNRANKED branch writes its own `inline-flex`, which lands in
             * the same class attribute as the `hidden` above — and Tailwind emits
             * `.inline-flex` after `.hidden`, so at equal specificity `inline-flex` wins
             * and both sizes render, stacked. It only bites during placements, because
             * the ranked branch renders a bare <img> with no display utility of its own,
             * which is why a placed account never showed it.
             */}
            <span className="shrink-0 sm:hidden">
              <RankEmblem
                tierId={rank.tier.id}
                division={rank.tier.divisions > 1 ? rank.division : 1}
                size="lg"
                unranked={placing}
              />
            </span>
            <span className="hidden shrink-0 sm:block">
              <RankEmblem
                tierId={rank.tier.id}
                division={rank.tier.divisions > 1 ? rank.division : 1}
                size="xl"
                unranked={placing}
              />
            </span>
          </div>
        </div>

        {/**
         * Zone 2 — the numbers, every one at the same size.
         *
         * Borrowed from the profile's stat strip, which solved this already: four figures
         * on one line read faster than four labelled meters stacked, and they fill a wide
         * card without needing anything invented to fill it. During placements there is no
         * rating or ladder position to state, so the strip is three cells instead of four
         * rather than showing two dashes.
         */}
        {/* Three cells, not four. Global moved up beside the avatar, and printing a
            position twice on one card is the duplication this page already shed once. The
            survivors get a third of the width each, which a 390px phone notices. */}
        <dl className="border-line grid grid-cols-3 gap-2 border-t pt-4">
          {placing ? (
            <Stat value={<CountUp value={me.placementsRemaining} />} label="To place" />
          ) : (
            <Stat value={<CountUp value={me.elo} />} label="Rating" />
          )}
          <Stat value={<CountUp value={level.level} />} label="Level" />
          {/* "Streak", not "Day streak" — the row beneath is already labelled "This week". */}
          <Stat
            value={<CountUp value={streak?.current ?? 0} />}
            label="Streak"
            tone={(streak?.current ?? 0) > 0 ? "text-gold" : undefined}
          />
        </dl>

        {/**
         * Zone 3 — progress, as thin bars rather than headline figures.
         *
         * Everything here is already named by the strip above it, so the bars carry their
         * own captions and nothing else. Side by side from `sm`, stacked below it.
         */}
        <div className="border-line flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-start sm:gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <TierProgress elo={me.elo} placing={placing} played={played} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Meter
              value={level.xpIntoLevel}
              max={level.xpForNextLevel}
              tone="teal"
              height="sm"
              label={`Level ${level.level}: ${level.xpIntoLevel} of ${level.xpForNextLevel} XP`}
            />
            <p className="text-label text-muted tabular-nums">
              {level.xpIntoLevel} / {level.xpForNextLevel} XP
            </p>
          </div>

          {streak && <StreakRow streak={streak} />}
        </div>
      </div>
    </div>
  );
}

/** One figure and the word for what it is. Same shape as the profile's stat strip. */
function Stat({
  value,
  label,
  tone = "text-paper",
}: {
  value: ReactNode;
  label: string;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <dd
        className={`font-display text-numeral sm:text-display-2 truncate font-extrabold tabular-nums ${tone}`}
      >
        {value}
      </dd>
      <dt className="text-label text-muted truncate tracking-label uppercase">
        {label}
      </dt>
    </div>
  );
}

/**
 * Progress to the next division, or through placements.
 *
 * Same three states `RankProgress` handles on /ranked, restated here rather than reused
 * because that one is a centred block sized for a hero and this is a bar in a footer.
 */
function TierProgress({
  elo,
  placing,
  played,
}: {
  elo: number;
  placing: boolean;
  played: number;
}) {
  const rank = rankForElo(elo);

  if (placing) {
    return (
      <>
        <Meter
          value={played}
          max={PLACEMENT_MATCHES}
          tone="gold"
          height="sm"
          label={`${played} of ${PLACEMENT_MATCHES} placement matches played`}
        />
        <p className="text-label text-muted tabular-nums">
          {played} of {PLACEMENT_MATCHES} placements played
        </p>
      </>
    );
  }

  // Legend has no ceiling, so there is nothing to progress toward.
  if (rank.nextAt === null) {
    return (
      <p className="text-label text-gold tracking-label uppercase">Top of the ladder</p>
    );
  }

  const remaining = Math.max(0, rank.nextAt - elo);
  const next = rankForElo(rank.nextAt);

  return (
    <>
      <Meter
        value={rank.progress}
        max={1}
        tone="paper"
        height="sm"
        label={`${remaining} rating to ${next.label}`}
      />
      <p className="text-label text-muted tabular-nums">
        {remaining} to <span className="text-secondary font-semibold">{next.label}</span>
      </p>
    </>
  );
}
