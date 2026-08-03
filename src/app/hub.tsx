"use client";

import { ButtonLink } from "@/ui/Button";
import { Glyph } from "@/ui/Glyph";
import { Form, RecentMatches } from "./standing";
import { Beat } from "./dashboard/motion";
import { PlayerBanner } from "./dashboard/player-banner";
import { DailyCard } from "./dashboard/daily-card";
import { LastResult } from "./dashboard/last-result";
import { Neighbours } from "./dashboard/neighbours";
import { Categories } from "./dashboard/categories";
import { BadgeCase } from "./dashboard/badge-case";

/**
 * The signed-in dashboard.
 *
 * Composition only — every panel owns its own queries and its own empty state, which is
 * what lets one layout serve a first-week player and a two-hundred-match regular without
 * branching on either. A panel with nothing to say renders nothing at all rather than an
 * "no activity yet" box arguing for its own existence.
 *
 * The order is the argument: standing, then the thing with a deadline, then what you just
 * earned, then the long game. `/` is deliberately NOT a launcher — the gold Play button is
 * on screen at all times on both form factors, so a mode list here would be the same
 * action twice within one viewport, and the duller of the two. The `Welcome back` heading
 * went with it: the handle is on the banner, where it sits next to the rank it belongs to.
 *
 * `Beat` indexes stage the entrance. They are positions in a sequence, not delays — see
 * dashboard/motion.tsx for why that distinction is enforced rather than trusted.
 */
export function Hub() {
  return (
    <div className="flex flex-col gap-6">
      <Beat index={0} className="px-4">
        <PlayerBanner />
      </Beat>

      <Beat index={1} className="px-4">
        <DailyCard />
      </Beat>

      <Beat index={2} className="px-4">
        <LastResult />
      </Beat>

      <Beat index={3}>
        <Form />
      </Beat>

      {/* Two panels side by side, unless only one of them has anything to say — during
          placements there are no neighbours — in which case the survivor takes the full
          width rather than sitting in half a row next to nothing. Done in CSS so neither
          panel has to know whether the other rendered. */}
      <Beat
        index={4}
        className="grid gap-4 px-4 lg:grid-cols-2 [&>*:only-child]:lg:col-span-2"
      >
        <Neighbours />
        <Categories />
      </Beat>

      <Beat index={5} className="px-4">
        <BadgeCase />
      </Beat>

      <Beat index={6}>
        <RecentMatches />
      </Beat>

      {/* The two modes the Play button does not cover. Quiet, and last: someone who came
          here to play a room already knows they can. */}
      <Beat index={7} className="grid gap-3 px-4 sm:grid-cols-2">
        <ButtonLink variant="secondary" size="lg" href="/practice" className="justify-start">
          <Glyph name="bot" />
          Practice a bot
        </ButtonLink>
        <ButtonLink variant="secondary" size="lg" href="/rooms" className="justify-start">
          <Glyph name="timer" />
          Play with friends
        </ButtonLink>
      </Beat>
    </div>
  );
}
