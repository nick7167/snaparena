"use client";

import { SignedIn, SignedOut } from "../auth-gate";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { MAX_DUEL_ROUNDS, ROOM_MAX_PLAYERS, ROOM_MIN_PLAYERS } from "@/engine/config";
import { useNow } from "@/game/usePrefersReducedMotion";
import { Button } from "@/ui/Button";
import { Field, Input } from "@/ui/Input";
import { Panel, Skeleton } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { AuthDialogButton } from "@/auth/AuthDialogButton";
import { LobbyColumn } from "../lobby-column";
import { Beat } from "../dashboard/motion";
import { timeAgo } from "@/ui/relative-time";

/** Codes are read aloud, so the alphabet excludes O/0 and I/1/L. Typing them is futile. */
const NOT_CODE = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;
const CODE_LENGTH = 5;

function joinError(status: string): string {
  if (status === "no-such-room") return "No room with that code.";
  if (status === "full") return "That room is full.";
  if (status === "in-progress") return "That room is mid-match — try again shortly.";
  if (status === "closed") return "That room has closed.";
  return "Could not join.";
}

export default function RoomsPage() {
  return (
    <LobbyColumn>
      <div className="flex flex-col gap-6">
        <Beat index={0} className="flex flex-col gap-2 px-4">
          <h1 className="font-display text-display-1 font-extrabold">Rooms</h1>
          {/* The old copy said "five songs". A room draws MAX_DUEL_ROUNDS and runs until
              one player survives, which is a different game and a longer evening. */}
          <p className="text-body-lg text-secondary">
            {ROOM_MIN_PLAYERS}–{ROOM_MAX_PLAYERS} players · up to {MAX_DUEL_ROUNDS} songs ·
            last one standing. No rating at stake.
          </p>
        </Beat>

        <SignedOut>
          <Beat index={1} className="px-4">
            <AuthDialogButton mode="sign-up" size="lg" className="w-fit">
              Sign in to play
            </AuthDialogButton>
          </Beat>
        </SignedOut>

        <SignedIn>
          <Beat index={1} className="px-4">
            <CreateAndJoin />
          </Beat>
          <Beat index={2} className="px-4">
            <RecentRooms />
          </Beat>
        </SignedIn>
      </div>
    </LobbyColumn>
  );
}

function CreateAndJoin() {
  const create = useMutation(api.rooms.create);
  const join = useMutation(api.rooms.join);
  const router = useRouter();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  /**
   * Both actions used to run bare — no pending flag, no disable, no catch. On a slow
   * connection the page was visually inert between tap and route change, so the honest
   * reading was "that did not work" and a second tap made a second room.
   */
  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const room = await create({});
      router.push(`/rooms/${room.code}`);
    } catch {
      setError("Could not create a room. Try again.");
      setCreating(false);
    }
  }

  async function handleJoin() {
    setJoining(true);
    setError(null);
    try {
      const result = await join({ code });
      if (result.status === "joined") {
        router.push(`/rooms/${code}`);
        return;
      }
      setError(joinError(result.status));
    } catch {
      setError("Could not join.");
    }
    setJoining(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <Button size="lg" block loading={creating} onClick={() => void handleCreate()}>
        <Glyph name="timer" filled />
        Create a room
      </Button>

      <Field label="Or join with a code" htmlFor="room-code" error={error}>
        <div className="flex gap-2">
          <Input
            id="room-code"
            size="lg"
            maxLength={CODE_LENGTH}
            placeholder="ABC12"
            value={code}
            invalid={error !== null}
            // Filtered to the alphabet the server allocates from, so a typed O or I is
            // rejected at the keystroke rather than as "No room with that code".
            onChange={(event) =>
              setCode(event.target.value.toUpperCase().replace(NOT_CODE, ""))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && code.length === CODE_LENGTH) void handleJoin();
            }}
            className="flex-1 font-mono tracking-[0.3em]"
          />
          <Button
            size="lg"
            variant="secondary"
            loading={joining}
            disabled={code.length < CODE_LENGTH}
            onClick={() => void handleJoin()}
          >
            Join
          </Button>
        </div>
      </Field>
    </div>
  );
}

/**
 * Rooms you have played in.
 *
 * The thing this page most needed. A room was unrecoverable the moment its code left the
 * screen — no membership index, no listing, nothing. See `rooms.recent` for why this reads
 * match history rather than the rooms table, and what that costs.
 */
function RecentRooms() {
  const rooms = useQuery(api.rooms.recent, {});
  const now = useNow(60_000);

  if (rooms === undefined) return <Skeleton className="h-32 w-full" />;
  // Nothing to say until you have played one. A "no rooms yet" box would be a panel
  // arguing for its own existence.
  if (rooms.length === 0) return null;

  return (
    <Panel title="Rooms you've played">
      <ul className="flex flex-col">
        {rooms.map((room) => (
          <li key={room.roomId} className="border-line border-b last:border-b-0">
            <Link
              href={`/rooms/${room.code}`}
              className="hover:bg-ink-700 group flex items-center gap-3 rounded-sm px-2 py-3 transition-colors"
            >
              <span className="text-muted shrink-0 text-lg leading-none">
                <Glyph name="timer" />
              </span>

              <span className="font-display text-body-lg text-paper shrink-0 font-bold tracking-[0.2em]">
                {room.code}
              </span>

              <span className="text-body-sm text-muted min-w-0 flex-1 truncate tabular-nums">
                {room.status === "closed"
                  ? "closed"
                  : `${room.memberCount} ${room.memberCount === 1 ? "player" : "players"}`}
                {" · "}
                {timeAgo(room.lastPlayedAt, now)}
              </span>

              <span className="text-muted group-hover:text-paper shrink-0 -rotate-90 text-lg leading-none transition-colors">
                <Glyph name="chevron" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
