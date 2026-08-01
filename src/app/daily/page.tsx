"use client";

import { SignInButton } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "../auth-gate";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { RoundRunner } from "@/game/RoundRunner";

/**
 * The daily challenge: five tracks, identical worldwide, one attempt per day.
 *
 * This is the growth surface — the shared song set is what makes scores comparable
 * and therefore what makes a result card worth posting.
 */
export default function DailyPage() {
  const myRun = useQuery(api.daily.myRun, {});
  const start = useMutation(api.daily.start);
  const complete = useMutation(api.daily.complete);

  const [matchId, setMatchId] = useState<Id<"matches"> | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const match = useQuery(api.matches.state, matchId ? { matchId } : "skip");

  // Record the run once the final round closes.
  useEffect(() => {
    if (!matchId || match?.status !== "complete") return;
    void complete({ matchId });
  }, [matchId, match?.status, complete]);

  async function begin() {
    const result = await start({});
    if (result.status === "started") setMatchId(result.matchId);
    else if (result.status === "already-played") setStatus("already-played");
    else setStatus("catalogue-too-small");
  }

  if (matchId) return <RoundRunner matchId={matchId} />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold">Today&rsquo;s challenge</h1>

      <SignedOut>
        <p className="text-white/60">Sign in to play — your score goes on the daily board.</p>
        <SignInButton mode="modal">
          <button className="w-fit rounded-lg bg-white px-5 py-3 font-medium text-black">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        {myRun ? (
          <ResultCard run={myRun} />
        ) : status === "catalogue-too-small" ? (
          <p className="text-white/60">
            Not enough tracks in the catalogue yet. Run <code>npm run ingest</code> and{" "}
            <code>npm run import-tracks</code>.
          </p>
        ) : (
          <>
            <p className="text-white/60">
              Five songs. Everyone in the world gets the same five today. One attempt.
            </p>
            <button
              onClick={() => void begin()}
              className="w-fit rounded-lg bg-emerald-500 px-5 py-3 font-medium text-black hover:bg-emerald-400"
            >
              Start
            </button>
          </>
        )}
      </SignedIn>

      <DailyLeaderboard />
    </div>
  );
}

function ResultCard({
  run,
}: {
  run: { totalPoints: number; perRoundMs: number[]; rank: number; totalPlayers: number };
}) {
  const [copied, setCopied] = useState(false);

  // Times, not tiers: with continuous scoring there is no "I got it in the 1s tier"
  // to brag about, so the shareable unit is how fast you were.
  const shareText = [
    `Song Race — ${run.totalPoints} pts`,
    run.perRoundMs.map((ms) => (ms < 0 ? "⬜" : ms < 2000 ? "🟩" : ms < 8000 ? "🟨" : "🟧")).join(""),
    `#${run.rank} of ${run.totalPlayers}`,
  ].join("\n");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 p-6">
      <p className="text-2xl font-semibold">{run.totalPoints} points</p>
      <p className="text-white/60">
        Rank {run.rank} of {run.totalPlayers} today
      </p>
      <ul className="flex flex-col gap-1 text-sm text-white/70">
        {run.perRoundMs.map((ms, index) => (
          <li key={index} className="tabular-nums">
            Round {index + 1}: {ms < 0 ? "missed" : `${(ms / 1000).toFixed(2)}s`}
          </li>
        ))}
      </ul>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(shareText);
          setCopied(true);
        }}
        className="w-fit rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
      >
        {copied ? "Copied" : "Copy result"}
      </button>
      <p className="text-sm text-white/40">Come back tomorrow for a new set.</p>
    </div>
  );
}

function DailyLeaderboard() {
  const board = useQuery(api.daily.leaderboard, { limit: 25 });
  if (!board || board.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-white/40">Today&rsquo;s board</h2>
      <ol className="flex flex-col gap-1 text-sm">
        {board.map((entry) => (
          <li
            key={entry.handle}
            className="flex justify-between rounded bg-white/5 px-3 py-2"
          >
            <span>
              {entry.rank}. {entry.displayName}
            </span>
            <span className="tabular-nums">{entry.totalPoints}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
