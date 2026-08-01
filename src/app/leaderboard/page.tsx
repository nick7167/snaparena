"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PLACEMENT_MATCHES } from "@/engine/config";

export default function LeaderboardPage() {
  const board = useQuery(api.users.leaderboard, { limit: 100 });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold">Leaderboard</h1>

      {board === undefined && <p className="text-white/50">Loading…</p>}

      {board?.length === 0 && (
        <p className="text-white/60">
          Nobody has finished their {PLACEMENT_MATCHES} placement matches yet. Ratings
          appear here once a player is calibrated.
        </p>
      )}

      {board && board.length > 0 && (
        <ol className="flex flex-col gap-1">
          {board.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center justify-between rounded bg-white/5 px-4 py-3"
            >
              <span className="flex items-baseline gap-3">
                <span className="w-8 tabular-nums text-white/40">{entry.rank}</span>
                <span>{entry.displayName}</span>
                <span className="text-sm text-white/30">@{entry.handle}</span>
              </span>
              <span className="flex items-baseline gap-4">
                <span className="text-sm text-white/40">{entry.gamesPlayed} games</span>
                <span className="tabular-nums font-medium">{entry.elo}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
