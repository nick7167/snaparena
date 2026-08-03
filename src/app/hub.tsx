"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ButtonLink } from "@/ui/Button";
import { Glyph } from "@/ui/Glyph";
import { Form, RecentMatches, StandingHero } from "./standing";

/**
 * The signed-in dashboard.
 *
 * Leads with the ladder now. It used to be a greeting, a small card that named a rating
 * without saying what it was near, and four stacked buttons — the top one of which said
 * "Find a match" while a gold Play button offering the same thing sat on screen beside it
 * the whole time. A player opening the app wants to know two things: where am I, and is
 * there anything waiting for me. So: standing, form, the daily, and the modes the Play
 * button does not already cover.
 *
 * The standing block is the same component /ranked leads with (see standing.tsx), one
 * size down. Nothing here adds a query.
 */
export function Hub() {
  const me = useQuery(api.users.me, {});
  const myRun = useQuery(api.daily.myRun, {});
  const dailyPlayed = myRun !== undefined && myRun !== null;

  return (
    <div className="flex flex-col gap-8">
      {/* Kept as the h1 and kept word for word — it is the only thing on the page that
          addresses the player by name, and StandingHero steps down to a <p> beneath it
          rather than competing for the heading. */}
      <h1 className="font-display text-display-2 px-4 font-extrabold">
        Welcome back{me?.handle ? `, @${me.handle}` : ""}
      </h1>

      <StandingHero size="lg" />

      <Form />

      {/* The recurring hook. Loud while unplayed, quiet once it's done. */}
      <ButtonLink
        variant={dailyPlayed ? "secondary" : "primary"}
        size="lg"
        block
        href="/daily"
        className="mx-4 w-auto justify-between"
      >
        <span className="flex items-center gap-2">
          <Glyph name="song" />
          Today&rsquo;s challenge
        </span>
        <span className="text-body-sm font-normal opacity-80">
          {myRun === undefined
            ? ""
            : dailyPlayed
              ? `${myRun.totalPoints} pts · #${myRun.rank}`
              : "Not played yet"}
        </span>
      </ButtonLink>

      {/* No "Find a match" here. The gold Play control is on screen at all times on both
          form factors — the sidebar on desktop, the raised centre button on mobile — so
          this was the same action twice within one viewport, and the duller of the two.
          These are the modes it does NOT cover. */}
      <div className="grid gap-3 px-4 sm:grid-cols-2">
        <ButtonLink variant="secondary" size="lg" href="/practice" className="justify-start">
          <Glyph name="bot" />
          Practice a bot
        </ButtonLink>
        <ButtonLink variant="secondary" size="lg" href="/rooms" className="justify-start">
          <Glyph name="timer" />
          Play with friends
        </ButtonLink>
      </div>

      <RecentMatches />
    </div>
  );
}
