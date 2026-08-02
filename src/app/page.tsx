"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignedIn, SignedOut } from "./auth-gate";
import { DUEL_STARTING_HP, REVEAL_BEATS, SCORE_TIERS } from "@/engine/config";
import { rankForElo } from "@/engine/ranks";
import { levelForXp } from "@/engine/xp";
import { ButtonLink } from "@/ui/Button";
import { Card, SectionLabel, Skeleton } from "@/ui/Surface";
import { RankEmblem } from "@/ui/RankEmblem";
import { Glyph } from "@/ui/Glyph";

/**
 * Home.
 *
 * The pitch renders for EVERYONE — it is not inside an auth gate. `SignedIn`/`SignedOut`
 * resolve on the client (auth-gate.tsx returns null until Clerk loads), so anything
 * inside them is absent from the server-rendered HTML. With the whole landing page in
 * there, crawlers, link previews and any JS-less client saw an empty document — on the
 * one page whose entire job is reaching people who have never been here.
 *
 * Only the action block is gated now, and it is small.
 */
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-4 py-12">
      <SignedIn>
        <Hub />
      </SignedIn>

      <SignedOut>
        <Hero />
        <Cta />
      </SignedOut>

      {/* Server-rendered for everyone. A signed-in player scrolling past the rules
          below their dashboard costs nothing; an empty page for a first-time visitor
          costs the visit. */}
      <RoundTiming />
      <TierTable />
      <TheDuel />

      <SignedOut>
        <WithAnAccount />
      </SignedOut>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Server-rendered. The first thing a stranger and a crawler both read. */
function Hero() {
  return (
    <section className="flex flex-col items-start gap-5">
      <h1 className="font-display text-display-1 sm:text-display-hero font-extrabold tracking-tight text-balance">
        One second of a song.
        <br />
        <span className="text-muted">Name it before they do.</span>
      </h1>
      <p className="text-body-lg text-secondary max-w-xl">
        You hear one second. Name the track. Every extra second you wait costs you
        points — and in a duel, the slower player loses health equal to the gap.
      </p>
    </section>
  );
}

function TheDuel() {
  return (
    <section className="flex flex-col gap-4">
      <SectionLabel>The duel</SectionLabel>
      <p className="text-body-lg text-secondary max-w-xl">
        {DUEL_STARTING_HP} HP each. Whoever is slower on a song loses health equal to the
        gap, the damage multiplier climbs as the duel runs on, and it ends when someone
        hits zero.
      </p>
    </section>
  );
}

function Cta() {
  return (
    <section className="flex flex-col items-start gap-3">
      <ButtonLink size="lg" href="/daily">
        Play today&rsquo;s challenge
      </ButtonLink>
      <p className="text-body-sm text-muted">
        Five songs, the same five for everyone today. No account needed.
      </p>
    </section>
  );
}

function WithAnAccount() {
  return (
    <section className="border-line flex flex-col gap-2 border-t pt-10">
      <SectionLabel>With an account</SectionLabel>
      <ul className="text-body text-secondary flex flex-col gap-1.5">
        <li className="flex items-center gap-2">
          <Glyph name="rank" /> Ranked 1v1 — a real rating and a place on the ladder
        </li>
        <li className="flex items-center gap-2">
          <Glyph name="bot" /> Practice duels against a bot near your level
        </li>
        <li className="flex items-center gap-2">
          <Glyph name="timer" /> Private rooms for 2–8 friends
        </li>
        <li className="flex items-center gap-2">
          <Glyph name="win" /> Your daily scores on the public board
        </li>
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The signed-in dashboard.
 *
 * Where you stand, whether today's challenge is still waiting, then the one control
 * that matters. Everything here comes from `users.me` and `daily.myRun` — no queries
 * were added for it.
 */
function Hub() {
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
          <ButtonLink variant="secondary" size="lg" href="/ranked">
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
        accent={rank.tier.accent}
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

/* -------------------------------------------------------------------------- */

function TierTable() {
  return (
    <section className="flex flex-col gap-4">
      <SectionLabel>Score by tier</SectionLabel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SCORE_TIERS.map((tier, index) => (
          <Card key={tier.id} className="flex flex-col gap-1 p-4">
            <span
              className={`text-body-sm flex items-center gap-1 font-bold tracking-wider ${
                tier.id === "snap" ? "text-paper" : "text-secondary"
              }`}
            >
              {tier.id === "snap" && <Glyph name="tier" filled />}
              {tier.label}
            </span>
            <span className="font-display text-display-2 font-extrabold tabular-nums">
              {tier.points}
            </span>
            <span className="text-body-sm text-muted">
              on the {REVEAL_BEATS[index].playToMs / 1000}s clip
            </span>
          </Card>
        ))}
      </div>
      <p className="text-body-sm text-muted">
        Guess on the one-second clip and it&rsquo;s a SNAP — the only call worth bragging
        about. Wait for more of the song and it costs you.
      </p>
    </section>
  );
}

function RoundTiming() {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>How a round runs</SectionLabel>
      <ol className="flex flex-col gap-2">
        {REVEAL_BEATS.map((beat, index) => (
          <li key={beat.atRoundMs} className="text-body text-secondary flex gap-4">
            <span className="font-display text-muted w-14 shrink-0 font-bold tabular-nums">
              {beat.atRoundMs / 1000}s
            </span>
            <span>
              {index === 0
                ? `You hear the first ${beat.playToMs / 1000} second`
                : `The clip grows to ${beat.playToMs / 1000} seconds`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
