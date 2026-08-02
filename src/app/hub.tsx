"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { rankForElo } from "@/engine/ranks";
import { levelForXp } from "@/engine/xp";
import { ButtonLink } from "@/ui/Button";
import { Card, Skeleton } from "@/ui/Surface";
import { RankEmblem } from "@/ui/RankEmblem";
import { Glyph } from "@/ui/Glyph";

/**
 * The signed-in dashboard.
 *
 * Where you stand, whether today's challenge is still waiting, then the one control that
 * matters. Everything here comes from `users.me` and `daily.myRun` — no queries were
 * added for it.
 *
 * Split out of page.tsx so the route can choose between this and the landing page on the
 * server — see landing.tsx for why that matters.
 */
export function Hub() {
  const me = useQuery(api.users.me, {});
  const myRun = useQuery(api.daily.myRun, {});
  const dailyPlayed = myRun !== undefined && myRun !== null;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-display-2 font-extrabold">
        Welcome back{me?.handle ? `, @${me.handle}` : ""}
      </h1>

      {me === undefined ? (
        <Skeleton className="h-28 w-full" />
      ) : me ? (
        <Standing me={me} />
      ) : null}

      {/* The recurring hook. Loud while unplayed, quiet once it's done. */}
      <ButtonLink
        variant={dailyPlayed ? "secondary" : "primary"}
        size="lg"
        block
        href="/daily"
        className="justify-between"
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

      <div className="flex flex-col gap-3">
        <ButtonLink size="lg" block href="/ranked">
          Find a match
        </ButtonLink>

        <div className="grid gap-3 sm:grid-cols-2">
          <ButtonLink variant="secondary" size="lg" href="/practice">
            Practice a bot
          </ButtonLink>
          <ButtonLink variant="secondary" size="lg" href="/rooms">
            Play with friends
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

function Standing({
  me,
}: {
  me: NonNullable<ReturnType<typeof useQuery<typeof api.users.me>>>;
}) {
  const rank = rankForElo(me.elo);
  const level = levelForXp(me.xp ?? 0);
  const placing = me.placementsRemaining > 0;

  return (
    <Card className="flex items-center gap-4 p-5">
      <RankEmblem
        tierId={rank.tier.id}
        division={rank.tier.divisions > 1 ? rank.division : 1}
        unranked={placing}
        size="lg"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className="font-display text-display-2 truncate font-extrabold"
          style={{ color: placing ? undefined : rank.tier.accent }}
        >
          {placing ? "Unranked" : rank.label}
        </span>
        <span className="text-body text-secondary tabular-nums">
          {placing
            ? `${me.placementsRemaining} placement match${me.placementsRemaining === 1 ? "" : "es"} to go`
            : `${me.elo} rating · Level ${level.level}`}
        </span>
        <span className="text-body-sm text-muted tabular-nums">
          {me.gamesPlayed} {me.gamesPlayed === 1 ? "match" : "matches"} played
        </span>
      </div>
    </Card>
  );
}
