"use client";

import { RANK_TIERS, PLACEMENT_MATCHES } from "@/engine/config";
import { RankEmblem } from "@/ui/RankEmblem";
import { EMBLEM_PLATE_WIDTH, EMBLEM_SIZES } from "@/ui/rank-emblems.generated";
import { ButtonLink } from "@/ui/Button";
import { AuthDialogButton } from "@/auth/AuthDialogButton";
import { Beat } from "../dashboard/motion";

/**
 * The signed-out pitch.
 *
 * This was a heading, one sentence and two buttons — a conversion dead end on the door to
 * the app's main mode. It shows the thing being sold instead: the ladder, all six tiers of
 * it, which nothing else in the app renders at once.
 *
 * ASSET WEIGHT IS THE REASON THESE ARE SMALL. The full-art set runs 300KB–1.1MB per
 * emblem and this is the one page reaching people who have never been here, so the strip
 * uses `md`, which draws from `public/ranks/sm/` — around 110KB for all six. Legend alone
 * steps up, because a destination that looks like everything else on the row is not a
 * destination.
 */
export function RankedPitch() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 py-10 text-center">
      <Beat index={0} className="flex flex-col items-center gap-3">
        <h1 className="font-display text-display-2 sm:text-display-1 font-extrabold tracking-tight uppercase">
          Ranked 1v1
        </h1>
        <p className="text-body-lg text-secondary max-w-md">
          One rating. Six tiers. The faster player takes the round, and everybody can see
          where you landed.
        </p>
      </Beat>

      <Beat index={1} className="w-full">
        <TierLadder />
      </Beat>

      <Beat index={2} className="flex flex-col items-center gap-3">
        <p className="text-body text-secondary">
          Everyone starts unranked.{" "}
          <span className="text-paper font-semibold">
            {PLACEMENT_MATCHES} matches to find your place.
          </span>
        </p>

        {/* `auth.spec.ts` finds this control in <main> by the name "Create an account" and
            asserts it opens a dialog that Escape closes. The name is load-bearing. */}
        <AuthDialogButton mode="sign-up" size="lg">
          Create an account
        </AuthDialogButton>
      </Beat>

      <Beat index={3} className="flex flex-col items-center gap-2">
        <p className="text-body-sm text-muted">
          Want to play right now without an account?
        </p>
        <ButtonLink variant="secondary" href="/daily">
          Play today&rsquo;s challenge
        </ButtonLink>
      </Beat>
    </div>
  );
}

/**
 * How wide each tier's PLATE is drawn, ascending.
 *
 * Plate width, not box size, and that distinction is the whole reason this looks like a
 * climb. Every emblem is the same chamfered plate with structure accreting around it as
 * rank rises — Silver hangs a plinth, Diamond and Legend add a crown — so normalising on
 * the plate keeps the core constant and lets the artwork grow. It is the rule RankEmblem
 * already applies at `lg` and above, and the reason its docblock says a Legend physically
 * occupies more room than a Bronze.
 *
 * The first version of this row used `md` for five tiers and `lg` for Legend, which meant
 * a fixed SQUARE box and `object-contain`. That squashes by whichever dimension is
 * longest, so Diamond — the tallest artwork in the set at 576×904 — was scaled down until
 * its height fitted and rendered visibly narrower than Bronze, which is nearly square and
 * filled its box. The tier ranked second from the top looked like the smallest thing on
 * the ladder.
 *
 * Legend's ceiling is set by the mobile grid rather than by taste: its artwork is 896 wide
 * against a 480 plate, so a 56px plate draws 105px — and a three-column grid at 390px
 * gives each cell about 111px. That is as large as it can be down there. Desktop has room
 * to spare, so Legend alone takes a multiplier from `sm` up (see `sized`) rather than the
 * whole ladder being rescaled — the other five are sized correctly at both widths.
 *
 * WHICH IS WHY DIAMOND IS CAPPED WHERE IT IS, and it is not obvious. Legend is the only
 * landscape emblem in the set (896×760); Diamond is the most portrait (576×904). Sizing
 * the ladder on plate width alone, Diamond at plate 52 drew 62×98 against Legend's
 * 105×89 — narrower, but four pixels TALLER, and on a phone, where Legend cannot grow to
 * compensate, the second-best tier read as the biggest thing on the ladder. Height is what
 * these shapes are judged by. Every plate below is chosen so the rendered HEIGHT ascends
 * as well as the width, which is the property the ladder is actually claiming.
 */
const LADDER_PLATE: Record<string, number> = {
  bronze: 28,
  silver: 34,
  gold: 40,
  platinum: 44,
  diamond: 45,
  legend: 56,
};

/**
 * The one tier that grows again once there is room for it.
 *
 * How MUCH it grows lives in the `--top` custom property on the row below, not here,
 * because it has to change at a breakpoint. A variable rather than a second render:
 * `RankEmblem` writes pixel dimensions inline and no breakpoint can reach those, but a
 * `calc()` against a variable the breakpoint DOES set can. One element, one image, two
 * sizes.
 */
const TOP_TIER = "legend";

/**
 * Six tiers, ascending.
 *
 * Two rows of three below `sm`, one row of six above it.
 *
 * The first attempt scrolled horizontally instead, on the theory that a ladder which wraps
 * stops reading as a climb. At 390px that put Legend — the destination, the only reason
 * the row is here — off the right edge behind a scroll affordance this design system has
 * no way to draw, since a fade would be a gradient. Six visible tiers in two rows beats
 * five visible tiers and a secret, and the sequence still reads left to right, top to
 * bottom.
 *
 * `items-end` so the taller emblems hang above the shared baseline their labels sit on
 * rather than pushing their own labels out of line with the rest.
 */
function TierLadder() {
  return (
    <ol
      // `--top` is 1 on a phone, where the grid cell is the constraint, and grows from
      // `sm` where the row has width going spare. Only the top tier reads it.
      className="grid grid-cols-3 items-end justify-center gap-x-3 gap-y-6 [--top:1] sm:flex sm:gap-5 sm:[--top:1.5]"
    >
      {RANK_TIERS.map((tier) => {
        // The top division of each tier: structure accretes as you climb WITHIN a tier
        // too, so III is the one that shows a tier at its fullest.
        const asset = EMBLEM_SIZES[`${tier.id}-${tier.divisions}`];
        const scale = (LADDER_PLATE[tier.id] ?? 40) / EMBLEM_PLATE_WIDTH;
        const top = tier.id === TOP_TIER;

        return (
          <li key={tier.id} className="flex min-w-0 flex-col items-center gap-2">
            {/**
             * The box carries each emblem's own aspect ratio at an ascending plate scale,
             * and the image is forced to fill it.
             *
             * `[&_img]:size-full` rather than a class on RankEmblem itself: the small-size
             * branch writes `size-10` on the <img>, and a competing size utility passed
             * through `className` lands in the same attribute where the winner is decided
             * by Tailwind's emit order, not by what was written last. A descendant
             * selector outranks a single class outright, so this cannot be ambiguous.
             */}
            <span
              aria-hidden="true"
              className="flex items-end [&_img]:size-full"
              style={
                asset
                  ? {
                      width: sized(asset.w * scale, top),
                      height: sized(asset.h * scale, top),
                    }
                  : undefined
              }
            >
              {/* `md`, so all six draw from the light `sm/` asset set — see the weight
                  note above. At these plate widths that set is still a downscale. */}
              <RankEmblem tierId={tier.id} division={tier.divisions} size="md" />
            </span>

            <span
              className="text-label truncate font-bold tracking-label uppercase"
              style={{ color: tier.accent }}
            >
              {tier.name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A dimension in pixels, multiplied by `--top` for the tier that reads it.
 *
 * The variable is only referenced for the top tier, so the other five stay plain numbers
 * and are unaffected by the breakpoint that changes it.
 */
function sized(px: number, top: boolean): string | number {
  const rounded = Math.round(px);
  return top ? `calc(${rounded}px * var(--top))` : rounded;
}
