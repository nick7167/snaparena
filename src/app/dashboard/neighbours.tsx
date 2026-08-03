"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { rankForElo } from "@/engine/ranks";
import { Avatar } from "@/game/ui";
import { RankEmblem } from "@/ui/RankEmblem";
import { SectionLabel } from "@/ui/Surface";

/**
 * The ladder either side of you.
 *
 * "#142 global" is a fact about a population; "17 rating behind @kilo" is a target you
 * can close in one match. The board already exists and already ranks everyone — what it
 * cannot do from the dashboard is answer the only question a competitive player actually
 * has when they look at their position, which is *who is next*.
 *
 * Renders nothing during placements: a player with no rank has no neighbours, and an
 * invented slot would be worse than an absent panel.
 */
export function Neighbours() {
  const board = useQuery(api.users.ladderNeighbours, {});

  if (!board) return null;

  const rows = [
    ...board.above.map((row) => ({ ...row, isMe: false })),
    {
      userId: null,
      handle: "you",
      displayName: "You",
      avatarUrl: undefined,
      elo: board.elo,
      position: board.position,
      gap: 0,
      isMe: true,
    },
    ...board.below.map((row) => ({ ...row, isMe: false })),
  ];

  return (
    // `min-w-0` because a grid item defaults to `min-width: auto` and will happily grow
    // past its track to fit the widest thing inside it — here the fixed-width position,
    // avatar, emblem and gap columns of a row. Without it the panel is a pixel wider than
    // the phone it is on.
    <section className="border-line bg-ink-800 flex min-w-0 flex-col gap-3 rounded-md border p-5">
      <SectionLabel>Around you</SectionLabel>

      <ul className="flex flex-col gap-1">
        {rows.map((row) => {
          const rank = rankForElo(row.elo);

          const inner = (
            <>
              <span
                className={`text-label w-10 shrink-0 tabular-nums ${
                  row.isMe ? "text-paper font-bold" : "text-muted"
                }`}
              >
                #{row.position}
              </span>

              {row.isMe ? (
                <span className="size-6 shrink-0" aria-hidden="true" />
              ) : (
                <Avatar
                  url={row.avatarUrl}
                  name={row.handle}
                  className="size-6 shrink-0 text-[10px]"
                />
              )}

              <RankEmblem
                tierId={rank.tier.id}
                division={rank.tier.divisions > 1 ? rank.division : 1}
                size="sm"
                className="shrink-0"
              />

              <span
                className={`text-body-sm min-w-0 flex-1 truncate ${
                  row.isMe ? "text-paper font-bold" : "text-secondary"
                }`}
              >
                {row.isMe ? "You" : `@${row.handle}`}
              </span>

              <span
                className="text-body-sm shrink-0 font-semibold tabular-nums"
                style={{ color: row.isMe ? undefined : rank.tier.accent }}
              >
                {row.elo}
              </span>

              {/* The gap, signed from your point of view — the number that says how much
                  work the row above is, and how much cushion the row below leaves. */}
              <span
                className={`text-label w-10 shrink-0 text-right tabular-nums ${
                  row.gap > 0 ? "text-signal-text" : row.gap < 0 ? "text-teal" : "text-faint"
                }`}
              >
                {row.isMe ? "—" : `${row.gap > 0 ? "+" : ""}${row.gap}`}
              </span>
            </>
          );

          return (
            <li key={row.isMe ? "me" : String(row.userId)}>
              {row.isMe ? (
                // Your own row is struck in your tier accent, the same device the
                // leaderboard uses to find you in a list of five hundred.
                <div
                  className="bg-ink-700 flex items-center gap-2.5 rounded-sm px-2.5 py-2"
                  style={{ boxShadow: `inset 2px 0 0 0 ${rank.tier.accent}` }}
                >
                  {inner}
                </div>
              ) : (
                <Link
                  href={`/u/${row.handle}`}
                  className="hover:bg-ink-700 flex items-center gap-2.5 rounded-sm px-2.5 py-2 transition-colors"
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
