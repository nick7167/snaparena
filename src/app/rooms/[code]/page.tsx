"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { RoundRunner } from "@/game/RoundRunner";

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
          <button
            onClick={() => void returnToLobby({ roomId: room.roomId })}
            className="mx-auto w-fit rounded-lg border border-white/20 px-4 py-2 hover:bg-white/10"
          >
            Back to lobby
          </button>
        )}
      </div>
    );
  }

  const isHost = me?._id === room.hostId;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-mono text-4xl tracking-[0.3em]">{room.code}</h1>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
          }}
          className="w-fit rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
        >
          {copied ? "Link copied" : "Copy invite link"}
        </button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm uppercase tracking-wide text-white/40">
          Players ({room.members.length}/{room.maxPlayers})
        </h2>
        <ul className="flex flex-col gap-1">
          {room.members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between rounded bg-white/5 px-3 py-2"
            >
              <span>{member.displayName}</span>
              {member.isHost && <span className="text-xs text-white/40">host</span>}
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <button
          disabled={!room.canStart}
          onClick={() => void start({ roomId: room.roomId })}
          className="rounded-lg bg-emerald-500 px-5 py-3 font-medium text-black
                     hover:bg-emerald-400 disabled:opacity-40"
        >
          {room.canStart ? "Start match" : `Need ${room.minPlayers} players`}
        </button>
      ) : (
        <p className="text-white/50">Waiting for the host to start…</p>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] items-center justify-center">{children}</div>;
}
