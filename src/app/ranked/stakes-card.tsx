"use client";

import type { Stakes } from "@/engine/stakes";
import { Card } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";

/**
 * What the next match can change.
 *
 * The card this page was missing. /ranked used to state a rating and offer a button, with
 * nothing in between saying why pressing it mattered — so the most consequential control
 * in the app sat under a number that had not moved since the last time you looked at it.
 *
 * The obvious version of this shows the rating swing on the line: "win +18, lose −16". It
 * cannot. Elo delta is `k * (outcome − expected)` and `expected` needs an opponent rating,
 * which does not exist until matchmaking has run — so any figure here would be invented,
 * and would be wrong the moment a stronger or weaker player answered the queue.
 *
 * The stake is jeopardy instead: what is within reach and what is at risk. Every claim is
 * derived in `stakes.ts` from the player's own row and gated on `reach`, so none of them
 * describe something a single win cannot actually deliver. See that file for the maths and
 * the priority order.
 *
 * `variant="hero"` spends this screen's one licensed sheen — in the IDLE state, which is
 * the only state this card renders in. Searching is a separate composition that drops both
 * this and the hero emblem, and hands the sheen to `SearchPanel`; the budget is one per
 * screen, and the two are never on screen together. The emblem above takes the bloom, and
 * those are two different exceptions — the surface gets a hairline, the artwork gets
 * ambient light.
 */
export function StakesCard({ stakes }: { stakes: Stakes }) {
  const { headline, atRisk, evenSwing } = stakes;
  if (!headline) return null;

  return (
    <Card variant="hero" className="flex flex-col gap-2 p-5">
      <p className="font-display text-body-lg text-paper flex items-start gap-2.5 font-extrabold tracking-tight uppercase">
        {/* Flex with an explicit gap rather than a text space: Glyph is an inline-block
            sized in `em`, so it sits hard against the first letter otherwise. */}
        <span className={`mt-0.5 shrink-0 ${accentFor(headline.kind)}`}>
          <Glyph name={glyphFor(headline.kind)} filled />
        </span>
        <span className="min-w-0">{headlineText(headline)}</span>
      </p>

      <p className="text-body-sm text-secondary tabular-nums">
        {detailText(headline, evenSwing)}
      </p>

      {/**
       * What a loss could cost — a second line, never the headline.
       *
       * This page exists to get someone to press a button, and leading with what they
       * stand to lose is the wrong instrument. `stakes.ts` only fills this in when a
       * single loss could genuinely reach the floor, so it is absent for most players
       * most of the time rather than being a permanent warning nobody reads.
       */}
      {atRisk && (
        <p className="text-body-sm text-signal-text flex items-center gap-2 tabular-nums">
          <Glyph name="loss" />
          {atRisk.gap === 0
            ? `On the ${atRisk.label} line — a loss drops you.`
            : `${atRisk.gap} above the ${atRisk.label} line.`}
        </p>
      )}
    </Card>
  );
}

type Headline = NonNullable<Stakes["headline"]>;

/**
 * The copy.
 *
 * Deliberately here rather than in `stakes.ts`: the engine decides WHICH fact wins and
 * supplies its numbers, and the wording is a view concern that can be retuned without
 * re-running the tests that pin the priority order.
 */
function headlineText(headline: Headline): string {
  switch (headline.kind) {
    case "tier-promotion":
    case "division-promotion":
      return `Within one win of ${headline.label}`;
    case "pass-rival":
      return `Within one win of passing @${headline.handle}`;
    case "settling":
      return `${headline.games} ${headline.games === 1 ? "match" : "matches"} until your rating settles`;
    case "summit":
      return "Top of the ladder";
    case "baseline":
      return `${headline.away} to ${headline.label}`;
  }
}

/**
 * The second line, and where the honesty lives.
 *
 * "A good win covers it" is doing real work. `reach` is what you take from beating the
 * strongest opponent the opening band allows; an even pairing pays `evenSwing`, which is
 * less. Saying "one win and you're there" would promise the best case as though it were
 * the only case.
 */
function detailText(headline: Headline, evenSwing: number): string {
  switch (headline.kind) {
    case "tier-promotion":
    case "division-promotion":
      return `${headline.away} rating away — a good win covers it.`;
    case "pass-rival":
      return `${headline.away} rating between you — a good win covers it.`;
    case "settling":
      return `Swings drop to ±${evenSwing} once they do. Climb while they are wide.`;
    case "summit":
      return `There is nothing above this. ±${evenSwing} a match to hold it.`;
    case "baseline":
      return `±${evenSwing} a match against an even opponent.`;
  }
}

/** A promotion and a warning should not wear the same mark. */
function glyphFor(kind: Headline["kind"]) {
  if (kind === "settling") return "timer" as const;
  if (kind === "summit") return "tier" as const;
  return "win" as const;
}

function accentFor(kind: Headline["kind"]): string {
  if (kind === "tier-promotion" || kind === "summit") return "text-gold";
  if (kind === "division-promotion" || kind === "pass-rival") return "text-teal";
  return "text-muted";
}
