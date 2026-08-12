"use client";

import { SignedIn, SignedOut } from "../auth-gate";
import { useReducer as useStdbReducer } from "spacetimedb/react";
import { useState } from "react";
import { reducers } from "@/module_bindings";
import { useActiveMatch, useMe } from "../db";
import { DuelMatch } from "@/game/DuelMatch";
import { BotBadge } from "@/game/ui";
import { play } from "@/audio/sfx";
import { DUEL_STARTING_HP, VETO_BANS_PER_PLAYER } from "@/engine/config";
import { Button, ButtonLink } from "@/ui/Button";
import { Panel, Skeleton } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { AuthDialogButton } from "@/auth/AuthDialogButton";
import { LobbyColumn } from "../lobby-column";
import { Beat } from "../dashboard/motion";
import { Form, RecentMatches } from "../standing";
import { Roster, Shortlist } from "./roster";

/**
 * Practice.
 *
 * Sign-in only, like ranked: practice pays XP and badges, and both need somewhere to land.
 * The daily is the mode open to everyone.
 */
export default function PracticePage() {
  return (
    <>
      <SignedOut>
        <LobbyColumn>
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
        </LobbyColumn>
      </SignedOut>

      <SignedIn>
        <PracticeHome />
      </SignedIn>
    </>
  );
}

/**
 * Split out from the page so `activeMatch` is only subscribed inside the SignedIn gate —
 * called above it, the query throws "Not signed in" for every signed-out visitor.
 */
function PracticeHome() {
  const [joined, setJoined] = useState<bigint | null>(null);
  // A reload mid-match drops you back into it rather than losing it.
  const me = useMe();
  const existingMatch = useActiveMatch(me?.id);
  const existing = existingMatch?.id ?? null;
  const matchId = joined ?? existing ?? null;

  /**
   * `undefined` is a third state, and it used to be rendered as the second.
   *
   * `existing ?? null` collapsed "still asking" into "no match", so reloading mid-match
   * painted the whole lobby — heading, roster, the lot — before snapping into the arena.
   */
  if (existing === undefined && joined === null) {
    return (
      <LobbyColumn>
        <div className="flex flex-col gap-4 px-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      </LobbyColumn>
    );
  }

  // The match renders outside the lobby column on purpose — see LobbyColumn.
  return matchId ? (
    <DuelMatch matchId={matchId} onLeave={() => setJoined(null)} />
  ) : (
    <LobbyColumn>
      <Start onStarted={setJoined} />
    </LobbyColumn>
  );
}

function Start({ onStarted }: { onStarted: (id: bigint) => void }) {
  const startPractice = useStdbReducer(reducers.startPractice);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Beat index={0} className="flex items-center gap-3 px-4">
        <h1 className="font-display text-display-1 font-extrabold">Practice</h1>
        <BotBadge size="md" />
      </Beat>

      <Beat index={1} className="px-4">
        <Panel title="You'll face one of these">
          <Shortlist />

          <div className="border-line flex flex-col gap-3 border-t pt-4">
            <Button
              size="lg"
              block
              loading={starting}
              onClick={async () => {
                setStarting(true);
                setError(null);
                try {
                  /**
                   * A reducer returns nothing, so the match id does not come back. The
                   * new practice match appears in `activeMatch` a moment later and the
                   * page routes into it from there — the same path a reload takes.
                   */
                  await startPractice();
                  play("whoosh");
                  return;
                  /**
                   * Both failures are the catalogue being unready, which is nothing a
                   * player did and nothing they can fix. The old copy told them to run
                   * `npm run seed-bots` — a developer instruction shipped to players.
                   */
                  setError("Practice isn't available right now. Try again shortly.");
                } catch {
                  setError("Something went wrong starting that match.");
                }
                setStarting(false);
              }}
            >
              <Glyph name="bot" />
              Play a bot
            </Button>

            <p className="text-label text-muted text-center">
              Both start on {DUEL_STARTING_HP} HP · ban {VETO_BANS_PER_PLAYER} categories
              each ·{" "}
              <span className="text-secondary font-semibold">
                XP and badges count, rating never moves
              </span>
            </p>

            {error && (
              <p className="text-body-sm text-signal-text text-center" role="alert">
                {error}
              </p>
            )}
          </div>
        </Panel>
      </Beat>

      {/* Both read `matches.history`, which Convex dedupes to one subscription. `Form`
          filters practice out — it is a RATED form strip — so it says how the ladder is
          going, while the roster below says how the cast is going. */}
      <Beat index={2}>
        <Form />
      </Beat>

      <Beat index={3} className="px-4">
        <Roster />
      </Beat>

      <Beat index={4}>
        <RecentMatches />
      </Beat>

      <Beat index={5} className="px-4">
        <p className="text-body-sm text-muted text-center">
          Ready for a rating?{" "}
          <ButtonLink variant="ghost" size="sm" href="/ranked">
            Play ranked
          </ButtonLink>
        </p>
      </Beat>
    </div>
  );
}
