"use client";

import { SignedIn, SignedOut } from "../auth-gate";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { DuelMatch } from "@/game/DuelMatch";
import { BotBadge } from "@/game/ui";
import { play } from "@/audio/sfx";
import { DUEL_STARTING_HP, VETO_BANS_PER_PLAYER } from "@/engine/config";
import { Button, ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Surface";
import { AuthDialogButton } from "@/auth/AuthDialogButton";

/**
 * Practice.
 *
 * Previously a card buried on /ranked with no URL of its own, which made it invisible to
 * the navigation and impossible to link to. It is a mode — the one you play when you want
 * the full duel without putting a rating at risk — so it gets a route.
 *
 * Sign-in only, like ranked: practice pays XP and badges, and both need somewhere to
 * land. The daily is the mode open to everyone.
 */
export default function PracticePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <SignedOut>
        <div className="flex flex-col items-start gap-4 px-4">
          <h1 className="font-display text-display-1 font-extrabold">Practice</h1>
          <p className="text-body-lg text-secondary">
            Sign in to practice against a bot — it pays XP and badges, so it needs an
            account to pay them into.
          </p>
          <AuthDialogButton mode="sign-up" size="lg">
            Create an account
          </AuthDialogButton>
          <p className="text-body-sm text-muted">
            Want to play right now without one? Today&rsquo;s challenge is open to
            everyone.
          </p>
          <ButtonLink variant="secondary" href="/daily">
            Play today&rsquo;s challenge
          </ButtonLink>
        </div>
      </SignedOut>

      <SignedIn>
        <PracticeHome />
      </SignedIn>
    </div>
  );
}

/**
 * Split out from the page so `activeMatch` is only subscribed inside the SignedIn gate —
 * called above it, the query throws "Not signed in" for every signed-out visitor.
 */
function PracticeHome() {
  const [joined, setJoined] = useState<Id<"matches"> | null>(null);
  // A reload mid-match drops you back into it rather than losing it. Derived rather than
  // copied into state, so it falls back to null on its own once the match completes.
  const existing = useQuery(api.ranked.activeMatch, {});
  const matchId = joined ?? existing ?? null;

  return matchId ? (
    <DuelMatch matchId={matchId} onLeave={() => setJoined(null)} />
  ) : (
    <Start onStarted={setJoined} />
  );
}

/**
 * Kept strictly separate from ranked so nobody is ever surprised by a synthetic opponent
 * in a rated match — the trade is stated up front, and you choose it.
 */
function Start({ onStarted }: { onStarted: (id: Id<"matches">) => void }) {
  const startPractice = useMutation(api.bots.startPractice);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-display-1 font-extrabold">Practice</h1>
        <BotBadge size="md" />
      </div>

      <p className="text-body text-secondary">
        No queue — a bot near your rating, right now. Both players start on{" "}
        {DUEL_STARTING_HP} HP and you each ban {VETO_BANS_PER_PLAYER} categories first,
        exactly as in ranked.
      </p>

      <Card className="flex flex-col items-start gap-3 p-5">
        <p className="text-body text-secondary">
          <span className="text-paper font-medium">XP and badges count.</span> Your rating
          does not move, win or lose.
        </p>
        <Button
          size="lg"
          loading={starting}
          onClick={async () => {
            setStarting(true);
            setError(null);
            const result = await startPractice({});
            if (result.status === "started" && result.matchId) {
              play("whoosh");
              onStarted(result.matchId);
            } else {
              setError(
                result.status === "no-bots-seeded"
                  ? "No bots seeded yet — run `npm run seed-bots`."
                  : "Not enough tracks in the catalogue.",
              );
              setStarting(false);
            }
          }}
        >
          Play a bot
        </Button>
        {error && (
          <p className="text-body-sm text-signal-text" role="alert">
            {error}
          </p>
        )}
      </Card>

      <p className="text-body-sm text-muted">
        Ready for a rating?{" "}
        <ButtonLink variant="ghost" size="sm" href="/ranked">
          Play ranked
        </ButtonLink>
      </p>
    </div>
  );
}
