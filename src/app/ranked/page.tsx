"use client";

import { SignedIn, SignedOut } from "../auth-gate";
import { motion } from "motion/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { DuelMatch } from "@/game/DuelMatch";
import { DUEL_STARTING_HP, VETO_BANS_PER_PLAYER } from "@/engine/config";
import { BOT_FALLBACK_MS } from "@/engine/matchmaking";
import { BotBadge } from "@/game/ui";
import { Button, ButtonLink } from "@/ui/Button";
import { Card, Meter, SectionLabel } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { AuthDialogButton } from "@/auth/AuthDialogButton";
import { LobbyColumn } from "../lobby-column";
import { useQueue } from "../queue-driver";
import { Form, RecentMatches, StandingHero } from "../standing";

/**
 * Ranked is sign-in only, and always will be — a ladder needs a persistent identity to
 * mean anything. Only the daily is open to anonymous players.
 */
export default function RankedPage() {
  return (
    <>
      <SignedOut>
        <LobbyColumn>
          <div className="flex flex-col items-start gap-4 px-4">
            <h1 className="font-display text-display-1 font-extrabold">Ranked 1v1</h1>
            <p className="text-body-lg text-secondary">
              Sign in to play ranked and earn a rating.
            </p>
            <AuthDialogButton mode="sign-up" size="lg">
              Create an account
            </AuthDialogButton>
            <p className="text-body-sm text-muted">
              Want to play right now without an account? Today&rsquo;s challenge is open
              to everyone.
            </p>
            <ButtonLink variant="secondary" href="/daily">
              Play today&rsquo;s challenge
            </ButtonLink>
          </div>
        </LobbyColumn>
      </SignedOut>

      <SignedIn>
        <RankedHome />
      </SignedIn>
    </>
  );
}

/**
 * Split out from the page so `activeMatch` is only subscribed inside the SignedIn
 * gate. Called above it, the query threw "Not signed in" for every signed-out
 * visitor — harmless to the render but a real error in the console on every load.
 */
function RankedHome() {
  // A reload mid-match must drop you back in, not lose the match. Derived rather
  // than copied into state via an effect — `activeMatch` only returns live
  // matches, so it falls back to null on its own once a match completes.
  const existing = useQuery(api.ranked.activeMatch, {});
  // The driver's id covers the gap between a match being created and `activeMatch`
  // propagating, and is the only source when the match was found on another route.
  const queue = useQueue();
  const matchId = queue.matchId ?? existing ?? null;

  // The match renders outside the lobby column on purpose — see LobbyColumn.
  return matchId ? (
    <DuelMatch matchId={matchId} onLeave={queue.clearMatch} />
  ) : (
    <LobbyColumn>
      <Queue />
    </LobbyColumn>
  );
}

/**
 * The ranked lobby.
 *
 * Searching happens IN PLACE. The old version replaced the whole page with a heading and
 * a bar, so pressing the button threw away the standing you had just been looking at and
 * gave you a blank screen in exchange — the one moment a player is most invested in their
 * rank was the moment it disappeared. The hero and the progress bar hold their positions
 * now; only the control beneath them changes.
 *
 * The queue itself lives in the shell (see queue-driver.tsx) so it survives navigation.
 * Everything here is presentation.
 */
function Queue() {
  const queue = useQueue();

  return (
    <div className="flex flex-col gap-7">
      <StandingHero />

      <Form />

      {queue.inQueue ? <SearchPanel /> : <FindMatch />}

      <RecentMatches />

      {/* Practice, demoted. It used to be a card with its own heading and button, which
          gave the un-rated mode roughly equal billing on the ranked page. It is one
          sentence now — the route itself is untouched. */}
      <p className="text-body-sm text-muted px-4 text-center">
        Not feeling rated?{" "}
        <Link href="/practice" className="text-secondary hover:text-paper rounded-xs underline">
          Practice against a bot
        </Link>
        .
      </p>
    </div>
  );
}

function FindMatch() {
  const queue = useQueue();

  return (
    <div className="flex flex-col gap-2 px-4">
      <Button size="lg" block onClick={queue.enqueue}>
        <Glyph name="tier" filled />
        Find a match
      </Button>
      {/* The rules, compressed to one line and put under the button rather than above
          it. Someone who has played knows them; someone who has not can read them
          while the queue spins. */}
      <p className="text-label text-muted text-center">
        Both start on {DUEL_STARTING_HP} HP · ban {VETO_BANS_PER_PLAYER} categories each ·
        the slower player loses health equal to the gap
      </p>
    </div>
  );
}

/**
 * The search, as a readout rather than a spinner.
 *
 * A spinner says "wait"; this says what is being done. Both figures on it are real and
 * were already being computed and discarded — `playersWaiting` came back from
 * `queueStatus` and was only ever read as a boolean, and `eloBandFor` is the exact
 * function the server matches on, imported rather than reimplemented so the range drawn
 * here cannot drift from the range being searched.
 *
 * The shape follows the two matchmaking screens that get this right: a meter counting
 * down to whatever happens next (Destiny), and your rating in the centre with the
 * opponent band opening either side of it (chess.com).
 */
function SearchPanel() {
  const queue = useQueue();
  const me = useQuery(api.users.me, {});

  const seconds = Math.floor(queue.waitingMs / 1000);
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  // Placements have no rating to open a band around, so the range is simply not shown —
  // the same rule the hero uses to decide whether to print a rating at all.
  const placed = me !== undefined && me !== null && me.placementsRemaining === 0;
  const band = Math.round(queue.band);

  const botIn = Math.max(0, BOT_FALLBACK_MS - queue.waitingMs);
  const botSeconds = Math.ceil(botIn / 1000);

  return (
    <div className="px-4">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel>{queue.fallingBack ? "No humans found" : "Searching"}</SectionLabel>
          <span className="font-display text-numeral text-paper font-extrabold tabular-nums">
            {elapsed}
          </span>
        </div>

        {/* The one thing on the panel that exists purely to say "this is alive". */}
        <div className="bg-ink-inset h-1 overflow-hidden rounded-full">
          <motion.div
            className="bg-gold h-full w-1/3 rounded-full"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          />
        </div>

        {queue.fallingBack ? (
          <p className="text-body text-secondary" role="status">
            Matching you with a bot —{" "}
            <span className="text-paper font-medium">this one won&rsquo;t affect your rating.</span>
          </p>
        ) : (
          <>
            {placed && (
              <div className="flex flex-col gap-1.5">
                <div className="font-display flex items-center justify-between gap-3 font-extrabold tabular-nums">
                  <span className="text-body-lg text-secondary">{me.elo - band}</span>
                  <span className="text-label text-muted tracking-[0.14em] uppercase">
                    Rating range
                  </span>
                  <span className="text-body-lg text-secondary">{me.elo + band}</span>
                </div>
                {/* The band as a proportion of its own ceiling: it fills as the search
                    reaches further, which is the honest picture of what widening means. */}
                <Meter
                  value={band}
                  max={1000}
                  tone="gold"
                  height="sm"
                  label={`Searching ±${band} rating`}
                />
                <p className="text-label text-muted text-center tabular-nums">
                  ±{band} and widening
                </p>
              </div>
            )}

            <div className="text-body-sm text-secondary flex flex-wrap items-center justify-between gap-x-4 gap-y-2 tabular-nums">
              <span className="flex items-center gap-2" role="status">
                <span className="bg-teal size-2 rounded-full" aria-hidden="true" />
                {queue.playersWaiting} {queue.playersWaiting === 1 ? "player" : "players"} in
                queue
              </span>
              <span className="text-muted">
                {botSeconds > 0 ? `bot offered in ${botSeconds}s` : "offering a bot"}
              </span>
            </div>
          </>
        )}

        {/* Offered from the first second rather than after an arbitrary wait: an empty
            ladder should hand you a game immediately, not make you earn one by waiting.
            The automatic fallback is the safety net for someone who walks away, not the
            primary route. */}
        <div className="border-line flex flex-wrap items-center gap-3 border-t pt-4">
          {!queue.fallingBack && (
            <Button variant="secondary" onClick={queue.startBot}>
              <BotBadge />
              Play a bot instead
            </Button>
          )}
          <Button variant="ghost" onClick={queue.dequeue}>
            Cancel
          </Button>
          <Link
            href="/daily"
            className="text-secondary hover:text-paper text-body-sm ml-auto rounded-xs underline"
          >
            Today&rsquo;s challenge
          </Link>
        </div>
      </Card>
    </div>
  );
}
