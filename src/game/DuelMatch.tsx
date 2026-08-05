"use client";

import { motion } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getDevToolsServerSnapshot,
  getDevToolsSnapshot,
  subscribeDevTools,
} from "@/ui/dev-tools";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { VETO_PHASE_MS } from "@/engine/config";
import { play } from "@/audio/sfx";
import { Avatar, BotBadge, PhaseTimer, nameFor } from "./ui";
import { Button } from "@/ui/Button";
import { RoundRunner } from "./RoundRunner";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useImmersive } from "@/app/immersive";
import { snap } from "@/ui/motion";

/**
 * A duel, from the ban draft to the final round.
 *
 * Shared by /ranked and /practice, which differ only in how the match was created —
 * every mode that produces a two-player match plays out through exactly this component,
 * so the draft, the presence heartbeat and the forfeit rule can never drift between
 * them. Lifted out of ranked/page.tsx when practice got its own route.
 */
export function DuelMatch({ matchId, onLeave }: { matchId: Id<"matches">; onLeave: () => void }) {
  const match = useQuery(api.matches.state, { matchId });
  const heartbeat = useMutation(api.ranked.heartbeat);

  /**
   * Presence: silence past the grace period forfeits, which is what stops a losing
   * player from simply closing the tab.
   *
   * Gated on the match still being live. Hooks cannot sit below the `if (!match)` return
   * further down, so the guard goes inside the effect instead — without it this kept
   * firing twice every five seconds for as long as the results screen stayed open, which
   * is unbounded: nothing makes you leave it. Presence past the final round is read by
   * nobody, since `claimForfeit` itself returns early unless the match is active.
   *
   * `status`, not `phase` — the draft runs under `status: "veto"`, and `match_end` is
   * also the phase an abandoned match is left in.
   *
   * One call, not two: `heartbeat` runs the forfeit sweep itself now. Reporting that you
   * are here and noticing that your opponent is not are the same moment, and splitting
   * them across two mutations doubled the traffic to say it.
   */
  const live = match?.status === "veto" || match?.status === "active";
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => void heartbeat({ matchId }), 5000);
    return () => clearInterval(id);
  }, [live, matchId, heartbeat]);

  if (!match) return <p className="text-body text-muted px-4">Loading…</p>;

  return (
    <>
      <DevResolveBar matchId={matchId} />
      {match.phase === "veto" ? (
        <VetoPhase matchId={matchId} />
      ) : match.phase === "veto_reveal" ? (
        <VetoResult matchId={matchId} />
      ) : (
        <RoundRunner matchId={matchId} onPlayAgain={onLeave} />
      )}
    </>
  );
}

/**
 * DEV ONLY — delete with convex/devbots.ts.
 *
 * A duel runs nine to twelve songs, so clearing five placement matches is the better
 * part of an hour. This ends the current one instantly through the real `finishMatch`
 * path, so rating, placements, XP, badges and the results screen all behave exactly as
 * if it had been played out.
 *
 * Renders nothing at all unless DEV_RANK_BOTS is set on the Convex deployment — the flag
 * is read from the server rather than a NEXT_PUBLIC_ variable, so there is nothing to
 * keep in sync with Vercel.
 */
function DevResolveBar({ matchId }: { matchId: Id<"matches"> }) {
  const dev = useQuery(api.devbots.enabled, {});
  const resolveNow = useMutation(api.devbots.resolveNow);
  /**
   * The second gate.
   *
   * The deployment flag licenses this bar to exist; the per-browser toggle decides whether
   * it is actually on. It used to appear over every duel for as long as DEV_RANK_BOTS was
   * set — which, on a shared deployment, meant it sat on top of the match screen whether or
   * not anyone was currently using it. Flip it from the dev panel (Ctrl+.).
   */
  const tools = useSyncExternalStore(
    subscribeDevTools,
    getDevToolsSnapshot,
    getDevToolsServerSnapshot,
  );

  if (!dev?.enabled || !tools.resolveBar) return null;

  return (
    // Top right, clear of the guess combobox and the HP bars — this is a scaffold, and a
    // scaffold that covers the thing you are testing is worse than no scaffold.
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full border border-dashed border-white/25 bg-black/80 px-3 py-2 backdrop-blur">
      <span className="text-body-sm text-muted px-1 font-mono uppercase">dev</span>
      {(["win", "loss", "random"] as const).map((outcome) => (
        <Button
          key={outcome}
          variant="secondary"
          size="sm"
          onClick={() => void resolveNow({ matchId, outcome })}
        >
          {outcome === "win" ? "Win" : outcome === "loss" ? "Lose" : "Random"}
        </Button>
      ))}
    </div>
  );
}

/**
 * Turn-based ban draft.
 *
 * Alternating rather than simultaneous, so each ban is a read on your opponent.
 * The lower-rated player bans first.
 */
function VetoPhase({ matchId }: { matchId: Id<"matches"> }) {
  // The draft is part of the match, and used to be the one screen that did not say so —
  // the mobile tab bar reappeared for its fifteen seconds and then vanished again.
  useImmersive();

  const draft = useQuery(api.ranked.draftState, { matchId });
  const submitBan = useMutation(api.ranked.submitBan);
  const expireVeto = useMutation(api.ranked.expireVeto);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  /**
   * Someone has to close the phase if a player idles; the client drives it.
   *
   * Recovery only, matching the round-phase nudge in `useRoundLifecycle`: the server
   * refuses to close the draft before the deadline anyway, so every earlier call was a
   * round trip that could only ever no-op — two players' worth, every two seconds, for
   * the whole draft.
   */
  const vetoDeadline = draft?.deadline ?? null;
  useEffect(() => {
    if (!vetoDeadline) return;
    const id = setInterval(() => {
      if (Date.now() > vetoDeadline + 1_500) void expireVeto({ matchId });
    }, 2000);
    return () => clearInterval(id);
  }, [vetoDeadline, matchId, expireVeto]);

  if (!draft) return <p className="text-body text-muted px-4">Loading draft…</p>;

  const opponentName = draft.opponent ? nameFor(draft.opponent) : "Opponent";

  async function ban(categoryId: Id<"categories">) {
    setPlacing(true);
    setError(null);
    try {
      // Awaited BEFORE any optimistic UI change. Flipping state first is what left
      // the old build stuck on "Waiting for opponent…" with the error invisible.
      await submitBan({ matchId, categoryId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not place that ban");
    } finally {
      setPlacing(false);
    }
  }

  return (
    // Carries its own column. It used to inherit one from the page wrapper, which was
    // removed so the VS reveal could have the width it asks for — the draft is a grid of
    // category cards and still wants the narrow measure.
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {!draft.isMyTurn && draft.opponent && (
            <Avatar url={draft.opponent.avatarUrl} name={opponentName} className="h-8 w-8" />
          )}
          <h1 className="font-display text-display-2 truncate font-extrabold">
            {draft.isMyTurn ? "Ban a category" : `${opponentName} is banning…`}
          </h1>
          {!draft.isMyTurn && draft.opponent?.isBot && <BotBadge />}
        </div>
        <span className="font-display text-body text-secondary shrink-0 font-bold tabular-nums">
          {draft.bansPlaced}/{draft.totalBans}
        </span>
      </div>

      {/* The turn clock, so "their turn ends automatically" is something you can
          watch rather than something we promise. */}
      <PhaseTimer endsAt={draft.deadline} durationMs={VETO_PHASE_MS} />

      <p className="text-body text-secondary">
        {draft.isMyTurn
          ? "Take away something they are good at. Whatever survives is what you both play."
          : "Watch what they take — you ban next."}
      </p>

      {/* Grouped and named: eight bare buttons with no container announce as eight
          unrelated controls, and which pool they belong to is the whole context. */}
      <div
        role="group"
        aria-label="Category pool"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {draft.pool.map((category) => {
          const banned = category.banned;
          return (
            <motion.button
              key={category.id}
              whileTap={draft.isMyTurn && !banned ? { scale: 0.95 } : undefined}
              onClick={() => {
                play("wrong");
                void ban(category.id);
              }}
              disabled={!draft.isMyTurn || banned || placing}
              className={`text-body min-h-16 rounded-md border px-3 py-4 font-medium
                          transition-colors disabled:cursor-not-allowed ${
                            banned
                              ? "border-signal bg-ink-700 text-muted line-through"
                              : draft.isMyTurn
                                ? "border-line-strong bg-ink-700 hover:bg-ink-600 text-paper"
                                : "border-line text-muted"
                          }`}
            >
              {category.name}
            </motion.button>
          );
        })}
      </div>

      {error && (
        <p className="text-body-sm text-signal-text" role="alert">
          {error}
        </p>
      )}

      {!draft.isMyTurn && (
        <p className="text-body-sm text-muted">
          Their turn ends automatically if they take too long.
        </p>
      )}

      {draft.opponent?.isBot && (
        <p className="text-body-sm text-muted">
          Bots draft too — they take away the categories they are worst at.
        </p>
      )}
    </div>
  );
}

/**
 * What the draft produced.
 *
 * Four of eight categories survive the bans, and until now nothing ever showed which —
 * the draft cut straight to a countdown, so the one decision both players made together
 * had no visible result. This is the payoff: the banned four strike through and fall
 * away, and what is left settles into the set you are about to play.
 *
 * Reads the same `draftState` the draft does, so no new query and no new server data —
 * the `banned` flags were already on the wire.
 */
function VetoResult({ matchId }: { matchId: Id<"matches"> }) {
  useImmersive();

  const draft = useQuery(api.ranked.draftState, { matchId });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("reveal");
  }, []);

  if (!draft) return <p className="text-body text-muted px-4">Loading…</p>;

  const surviving = draft.pool.filter((category) => !category.banned);
  const banned = draft.pool.filter((category) => category.banned);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-10">
      <p className="text-label text-muted tracking-[0.14em]">THE SET</p>
      <h1 className="font-display text-display-2 text-center font-extrabold tracking-tight">
        You&rsquo;re playing these {surviving.length}
      </h1>

      <ul className="grid w-full grid-cols-2 gap-2">
        {surviving.map((category, index) => (
          <motion.li
            key={category.id}
            initial={reduced ? false : { opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            // Staggered, so four names arrive as a sequence you can read rather than a
            // block that appears all at once and has to be re-scanned.
            transition={{ ...snap, delay: reduced ? 0 : index * 0.07 }}
            className="border-line-strong bg-ink-700 text-paper text-body flex min-h-16
                       items-center justify-center rounded-md border px-3 py-4 text-center
                       font-medium"
          >
            {category.name}
          </motion.li>
        ))}
      </ul>

      {banned.length > 0 && (
        <p className="text-body-sm text-muted text-center">
          Banned:{" "}
          <span className="line-through">
            {banned.map((category) => category.name).join(" · ")}
          </span>
        </p>
      )}
    </div>
  );
}
