"use client";

import { SignInButton } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "../auth-gate";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

export default function RoomsPage() {
  const router = useRouter();
  const create = useMutation(api.rooms.create);
  const join = useMutation(api.rooms.join);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setError(null);
    const result = await join({ code });
    if (result.status === "joined") router.push(`/rooms/${code.toUpperCase()}`);
    else setError(joinError(result.status));
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold">Rooms</h1>
      <p className="text-white/60">
        Play with 2&ndash;8 friends. Same five songs for everyone, no rating at stake.
      </p>

      <SignedOut>
        <SignInButton mode="modal">
          <button className="w-fit rounded-lg bg-white px-5 py-3 font-medium text-black">
            Sign in to play
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <button
          onClick={async () => {
            const room = await create({});
            router.push(`/rooms/${room.code}`);
          }}
          className="rounded-lg bg-emerald-500 px-5 py-3 font-medium text-black hover:bg-emerald-400"
        >
          Create a room
        </button>

        <div className="flex flex-col gap-2">
          <label htmlFor="room-code" className="text-sm text-white/50">
            Or join with a code
          </label>
          <div className="flex gap-2">
            <input
              id="room-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={5}
              placeholder="ABC12"
              className="flex-1 rounded-lg border border-white/15 bg-black/40 px-4 py-3
                         font-mono tracking-widest outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => void handleJoin()}
              disabled={code.length < 5}
              className="rounded-lg border border-white/20 px-4 hover:bg-white/10 disabled:opacity-40"
            >
              Join
            </button>
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
      </SignedIn>
    </div>
  );
}

function joinError(status: string): string {
  switch (status) {
    case "no-such-room":
      return "No room with that code.";
    case "full":
      return "That room is full.";
    case "in-progress":
      return "That room is mid-match — try again shortly.";
    case "closed":
      return "That room has closed.";
    default:
      return "Could not join.";
  }
}
