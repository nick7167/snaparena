"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { RoundRunner } from "@/game/RoundRunner";
import { Button } from "@/ui/Button";
import { Card, Chip, SectionLabel } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { Avatar } from "@/game/ui";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const room = useQuery(api.rooms.state, { code });
  const me = useQuery(api.users.me, {});
  const join = useMutation(api.rooms.join);
  const start = useMutation(api.rooms.start);
  const returnToLobby = useMutation(api.rooms.returnToLobby);

  const [copied, setCopied] = useState(false);

  // Arriving via a shared link should put you in the room, not just show it to you.
  useEffect(() => {
    if (!room || !me) return;
    if (room.members.some((member) => member.userId === me._id)) return;
    void join({ code });
  }, [room, me, join, code]);

  if (room === undefined) return <Centered>Loading…</Centered>;
  if (room === null) return <Centered>No room with code {code}.</Centered>;

  if (room.status === "in_match" && room.activeMatchId) {
    return (
      <div className="flex flex-col gap-4">
        <RoundRunner matchId={room.activeMatchId} />
        {me?._id === room.hostId && (
          <Button
            variant="secondary"
            className="mx-auto w-fit"
            onClick={() => void returnToLobby({ roomId: room.roomId })}
          >
            Back to lobby
          </Button>
        )}
      </div>
    );
  }

  const isHost = me?._id === room.hostId;

  // Empty seats up to the minimum, so "we need one more" is something you can see
  // rather than a sentence you have to read.
  const emptySlots = Math.max(0, room.minPlayers - room.members.length);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-12">
      {/* The code is the whole point of the screen — it is what you read out loud. */}
      <section className="flex flex-col items-center gap-3">
        <SectionLabel>Room code</SectionLabel>
        <p className="font-mono text-display-1 text-paper font-bold tracking-[0.25em]">
          {room.code}
        </p>
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
          }}
        >
          <Glyph name="song" />
          {copied ? "Link copied" : "Copy invite link"}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Players</SectionLabel>
          <span className="text-body-sm text-muted tabular-nums">
            {room.members.length} / {room.maxPlayers}
          </span>
        </div>

        <ul className="flex flex-col gap-1.5">
          {room.members.map((member) => (
            <Card
              as="li"
              key={member.userId}
              emphasis={member.userId === me?._id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <Avatar
                url={member.avatarUrl}
                name={member.displayName}
                className="size-9"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body truncate font-medium">
                  {member.displayName}
                </span>
                <span className="text-body-sm text-muted truncate">@{member.handle}</span>
              </span>
              {member.isHost && <Chip size="sm">host</Chip>}
            </Card>
          ))}

          {Array.from({ length: emptySlots }, (_, index) => (
            <li
              key={`empty-${index}`}
              className="border-line text-body-sm text-muted flex items-center gap-3
                         rounded-md border border-dashed px-3 py-2.5"
            >
              <span className="bg-ink-700 size-9 shrink-0 rounded-md" aria-hidden="true" />
              Waiting for a player…
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        {isHost ? (
          <Button
            size="lg"
            block
            disabled={!room.canStart}
            onClick={() => void start({ roomId: room.roomId })}
          >
            {room.canStart
              ? "Start match"
              : `Need ${room.minPlayers - room.members.length} more`}
          </Button>
        ) : (
          <p className="text-body text-muted text-center" role="status">
            Waiting for the host to start…
          </p>
        )}

        {/* rooms.leave was built and unreachable — the only way out was closing the tab.
            Host transfer is handled server-side, so leaving as host is safe. */}
        {me && room.members.some((member) => member.userId === me._id) && (
          <LeaveRoom roomId={room.roomId} isHost={isHost} />
        )}
      </div>
    </div>
  );
}

function LeaveRoom({
  roomId,
  isHost,
}: {
  roomId: Id<"rooms">;
  isHost: boolean;
}) {
  const leave = useMutation(api.rooms.leave);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-body-sm text-muted hover:text-paper mx-auto flex items-center gap-1.5 rounded-xs px-3 py-2 transition-colors"
      >
        <Glyph name="leave" />
        Leave room
      </button>
    );
  }

  return (
    <Card className="flex flex-col items-center gap-3 p-4">
      <p className="text-body-sm text-secondary text-center">
        {isHost
          ? "You're the host — hosting passes to whoever joined next."
          : "Leave this room?"}
      </p>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          loading={leaving}
          onClick={async () => {
            setLeaving(true);
            await leave({ roomId });
            router.push("/rooms");
          }}
        >
          Leave
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Stay
        </Button>
      </div>
    </Card>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-body text-secondary flex min-h-[50vh] items-center justify-center px-4 text-center">
      {children}
    </div>
  );
}
