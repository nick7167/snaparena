"use client";

import { SignInButton } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "../auth-gate";
import { motion } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { RoundRunner } from "@/game/RoundRunner";
import { VETO_BANS_PER_PLAYER } from "@/engine/config";
import { play } from "@/audio/sfx";

export default function RankedPage() {
  const [joined, setJoined] = useState<Id<"matches"> | null>(null);
  // A reload mid-match must drop you back in, not lose the match. Derived rather
  // than copied into state via an effect — `activeMatch` only returns live
  // matches, so it falls back to null on its own once a match completes.
  const existing = useQuery(api.ranked.activeMatch, {});
  const matchId = joined ?? existing ?? null;
  const setMatchId = setJoined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <SignedOut>
        <div className="px-4">
          <h1 className="text-3xl font-black">Ranked 1v1</h1>
          <p className="mt-2 text-white/60">Sign in to play ranked and earn a rating.</p>
          <SignInButton mode="modal">
            <button className="mt-4 rounded-lg bg-white px-5 py-3 font-medium text-black">
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {matchId ? (
          <RankedMatch matchId={matchId} onLeave={() => setMatchId(null)} />
        ) : (
          <Queue onMatched={setMatchId} />
        )}
      </SignedIn>
    </div>
  );
}

/**
 * Matchmaking queue.
 *
 * Deliberately honest about an empty pool: ranked shipped before there is a
 * population to match against, so an empty queue says so and points at the daily
 * rather than spinning forever.
 */
function Queue({ onMatched }: { onMatched: (id: Id<"matches">) => void }) {
  const status = useQuery(api.ranked.queueStatus, {});
  const enqueue = useMutation(api.ranked.enqueue);
  const dequeue = useMutation(api.ranked.dequeue);
  const tryMatchmake = useMutation(api.ranked.tryMatchmake);

  useEffect(() => {
    if (!status?.inQueue) return;
    const id = setInterval(async () => {
      const result = await tryMatchmake({});
      if (result.matched) {
        play("whoosh");
        onMatched(result.matchId);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [status?.inQueue, tryMatchmake, onMatched]);

  if (!status) return <p className="px-4 text-white/50">Loading…</p>;

  if (status.inQueue) {
    const waitingSeconds = Math.floor(status.waitingMs / 1000);
    const alone = status.playersWaiting <= 1;

    return (
      <div className="flex flex-col gap-4 px-4">
        <h1 className="text-3xl font-black">Searching…</h1>
        <p className="tabular-nums text-white/60">
          {waitingSeconds}s — widening the rating range
        </p>

        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          />
        </div>

        {alone && waitingSeconds > 15 && (
          <div className="rounded-lg border border-white/10 p-4 text-sm text-white/60">
            <p className="mb-2">
              Nobody else is queued right now. The ladder is new — it fills up at peak hours.
            </p>
            <Link href="/daily" className="text-cyan-400 hover:underline">
              Play today&rsquo;s challenge instead →
            </Link>
          </div>
        )}

        <button
          onClick={() => void dequeue({})}
          className="w-fit rounded-lg border border-white/20 px-4 py-2 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      <h1 className="text-3xl font-black">Ranked 1v1</h1>
      <p className="text-white/60">
        Best of three sets. Both players ban {VETO_BANS_PER_PLAYER} categories, then race
        through three songs a set. First to two sets takes the match.
      </p>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => void enqueue({})}
        className="w-fit rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-6 py-3
                   font-semibold text-black"
      >
        Find a match
      </motion.button>
    </div>
  );
}

function RankedMatch({ matchId, onLeave }: { matchId: Id<"matches">; onLeave: () => void }) {
  const match = useQuery(api.matches.state, { matchId });
  const heartbeat = useMutation(api.ranked.heartbeat);
  const claimForfeit = useMutation(api.ranked.claimForfeit);

  // Presence: silence past the grace period forfeits, which is what stops a losing
  // player from simply closing the tab.
  useEffect(() => {
    const id = setInterval(() => {
      void heartbeat({ matchId });
      void claimForfeit({ matchId });
    }, 5000);
    return () => clearInterval(id);
  }, [matchId, heartbeat, claimForfeit]);

  if (!match) return <p className="px-4 text-white/50">Loading…</p>;
  if (match.phase === "veto") return <VetoPhase matchId={matchId} />;

  return <RoundRunner matchId={matchId} onPlayAgain={onLeave} />;
}

/** Symmetric ban phase — both players ban the same number, so ranked stays fair. */
function VetoPhase({ matchId }: { matchId: Id<"matches"> }) {
  const categories = useQuery(api.tracks.categories, {});
  const submitBans = useMutation(api.ranked.submitBans);
  const expireVeto = useMutation(api.ranked.expireVeto);

  const [selected, setSelected] = useState<Id<"categories">[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Someone has to close the phase if the opponent idles; the client drives it.
  useEffect(() => {
    const id = setInterval(() => void expireVeto({ matchId }), 2000);
    return () => clearInterval(id);
  }, [matchId, expireVeto]);

  function toggle(id: Id<"categories">) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < VETO_BANS_PER_PLAYER
          ? [...current, id]
          : current,
    );
  }

  if (!categories) return <p className="px-4 text-white/50">Loading…</p>;

  return (
    <div className="flex flex-col gap-4 px-4">
      <h1 className="text-2xl font-black">Ban {VETO_BANS_PER_PLAYER} categories</h1>
      <p className="text-white/60">
        Your opponent bans too. Whatever survives is what you&rsquo;ll be playing.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {categories.map((category) => {
          const banned = selected.includes(category._id);
          return (
            <motion.button
              key={category._id}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                play(banned ? "tick" : "wrong");
                toggle(category._id);
              }}
              disabled={submitted}
              className={`rounded-lg border px-3 py-4 text-sm transition ${
                banned
                  ? "border-rose-500 bg-rose-500/20 text-rose-200 line-through"
                  : "border-white/15 hover:bg-white/10"
              } disabled:opacity-50`}
            >
              {category.name}
            </motion.button>
          );
        })}
      </div>

      <button
        disabled={selected.length !== VETO_BANS_PER_PLAYER || submitted}
        onClick={async () => {
          setSubmitted(true);
          await submitBans({ matchId, categoryIds: selected });
        }}
        className="w-fit rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-6 py-3
                   font-semibold text-black disabled:opacity-40"
      >
        {submitted ? "Waiting for opponent…" : "Confirm bans"}
      </button>
    </div>
  );
}
