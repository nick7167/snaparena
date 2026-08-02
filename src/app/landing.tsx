"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { REVEAL_BEATS, SCORE_TIERS } from "@/engine/config";
import { ButtonLink } from "@/ui/Button";
import { Card, SectionLabel } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { AuthDialogButton } from "@/auth/AuthDialogButton";

/**
 * The signed-out landing page.
 *
 * A client component, but NOT behind an auth gate — that distinction is the whole reason
 * this file exists separately. "use client" only means this hydrates in the browser; Next
 * still renders its HTML on the server, so crawlers and link previews see the pitch.
 *
 * What does NOT work is deciding signed-in vs signed-out with `<SignedIn>`/`<SignedOut>`:
 * those resolve from `useUser()` and return null until Clerk loads, which is a runtime
 * condition rather than a rendering one — so the entire page was absent from the
 * server-rendered HTML. page.tsx makes that decision on the server instead.
 *
 * The layout requirement is literal: one screen, nothing that matters below the fold.
 * `min-h` rather than `h`, because a landing page that clips its own content to stay tidy
 * is worse than one that runs a little long.
 */
export function Landing() {
  return (
    /*
     * The height budget on a phone is 100dvh minus the top bar (3.5rem) and the fixed tab
     * bar that <main> reserves with pb-20 (5rem). Subtracting both is what makes "fits one
     * screen" true rather than nearly true — without it the page overflows by exactly the
     * chrome it forgot to account for.
     */
    <div className="mx-auto flex min-h-[calc(100dvh-8.5rem)] w-full max-w-5xl flex-col justify-center gap-6 px-4 py-6 sm:gap-8 sm:py-8 lg:min-h-dvh lg:py-12">
      <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-12">
        <Hero />
        <TodayCard />
      </div>

      <Rules />
    </div>
  );
}

/** Server-rendered. The first thing a stranger and a crawler both read. */
function Hero() {
  return (
    <section className="flex flex-col items-start gap-3 sm:gap-5">
      {/*
       * Tops out at `display-1`, not `display-hero`.
       *
       * Two separate reasons, at opposite ends. On a 390px screen `display-1` alone ate
       * half the viewport and pushed the challenge card — the entire point of the page —
       * below the fold, so it steps down to `display-2` there. And on desktop this sits in
       * a half-width column beside the card, where 96px wrapped the headline onto six
       * lines and shouted over the thing it is supposed to be selling. The hero size
       * belongs on a full-width hero, which this no longer is.
       */}
      <h1 className="font-display text-display-2 sm:text-display-1 font-extrabold tracking-tight text-balance">
        One second of a song.
        <br />
        <span className="text-muted">Name it before they do.</span>
      </h1>
      <p className="text-body sm:text-body-lg text-secondary max-w-md">
        You hear one second. Name the track. Every extra second you wait costs you points —
        and in a duel, the slower player loses health equal to the gap.
      </p>

      {/* The account pitch, compressed from a six-line list into one row. A stranger does
          not need the feature inventory before their first game; they need to know there
          is more here once they want it.

          Hidden on the narrowest screens rather than removed: it stays in the markup for
          crawlers, and a phone has no room for it above the fold. */}
      <ul className="text-body-sm text-muted hidden flex-wrap items-center gap-x-5 gap-y-2 sm:flex">
        <li className="flex items-center gap-1.5">
          <Glyph name="rank" /> Ranked 1v1
        </li>
        <li className="flex items-center gap-1.5">
          <Glyph name="bot" /> Practice bots
        </li>
        <li className="flex items-center gap-1.5">
          <Glyph name="timer" /> Private rooms
        </li>
        <li className="flex items-center gap-1.5">
          <Glyph name="win" /> Global ladder
        </li>
      </ul>
    </section>
  );
}

/**
 * The focal object, and the guest gate.
 *
 * Both paths are offered here rather than on /daily, so the choice is made once at the
 * front door: play now and decide later, or sign up first and never have to claim a
 * score. Guest is the primary because the fastest way to explain this game is to let
 * someone play it.
 */
function TodayCard() {
  const stats = useQuery(api.daily.todayStats, {});

  return (
    <Card emphasis className="flex flex-col gap-4 p-5 sm:gap-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>Today&rsquo;s challenge</SectionLabel>
        <span className="text-body-sm text-muted tabular-nums">
          {stats === undefined
            ? ""
            : stats.players === 0
              ? "Be the first today"
              : `${stats.players.toLocaleString()}${stats.atLeast ? "+" : ""} played today`}
        </span>
      </div>

      <WaveMark />

      <p className="text-body-lg text-secondary">
        Five songs. Everyone in the world gets the same five today. One attempt.
      </p>

      <div className="flex flex-col gap-3">
        <ButtonLink href="/daily" size="lg" block>
          <Glyph name="tier" filled />
          Play as guest
        </ButtonLink>

        <AuthDialogButton mode="sign-up" variant="secondary" size="lg" block>
          Sign up and save your score
        </AuthDialogButton>
      </div>

      <p className="text-body-sm text-muted">
        No account needed to play. A guest score lives in this browser only — signing up
        puts it on the board and keeps it.
      </p>
    </Card>
  );
}

/**
 * The waveform, as a static mark.
 *
 * The real one is a canvas driven by an analyser node (game/Waveform.tsx); there is no
 * audio on this page, so this is the same silhouette in markup — server-rendered, free,
 * and legible to a crawler. The leading bars are lit to read as "one second of it".
 */
const BARS = [
  3, 7, 12, 18, 26, 34, 30, 22, 15, 9, 5, 11, 19, 28, 36, 31, 24, 17, 10, 6, 4, 8, 14, 21,
  29, 33, 27, 20, 13, 7,
];

function WaveMark() {
  return (
    <div className="flex h-12 items-end gap-[3px]" aria-hidden="true">
      {BARS.map((height, index) => (
        <span
          key={index}
          className={`flex-1 rounded-full ${index < 10 ? "bg-gold" : "bg-ink-500"}`}
          style={{ height: `${(height / 36) * 100}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Everything that used to be three separate sections — how a round runs, the score tiers
 * and the duel — in one row.
 *
 * Kept because it is the only thing on the page that explains the game, and kept short
 * because a stranger reads roughly one line before deciding. Outside the auth gate, so it
 * is in the server-rendered HTML.
 */
function Rules() {
  const snap = SCORE_TIERS[0];

  return (
    // Hidden below `sm` for the same reason as the feature row: still in the HTML, off
    // the phone's single screen.
    <section className="border-line hidden gap-4 border-t pt-6 sm:grid sm:grid-cols-3">
      <Rule glyph="song" title={`${REVEAL_BEATS[0].playToMs / 1000}s to start`}>
        You hear one second, and the clip grows every few seconds until someone names it.
      </Rule>
      <Rule glyph="tier" title={`${snap.points} points for a ${snap.label}`}>
        Guess on the first clip and it&rsquo;s a SNAP. Waiting for more of the song costs
        you.
      </Rule>
      <Rule glyph="damage" title="Duels end at zero">
        Whoever is slower on a song loses health equal to the gap between you.
      </Rule>
    </section>
  );
}

function Rule({
  glyph,
  title,
  children,
}: {
  glyph: "song" | "tier" | "damage";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body text-paper flex items-center gap-2 font-semibold">
        <Glyph name={glyph} filled />
        {title}
      </p>
      <p className="text-body-sm text-muted">{children}</p>
    </div>
  );
}
