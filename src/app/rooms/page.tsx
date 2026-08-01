"use client";

import { SignInButton } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "../auth-gate";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/ui/Button";
import { Field, Input } from "@/ui/Input";

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
      <h1 className="font-display text-display-1 font-extrabold">Rooms</h1>
      <p className="text-body-lg text-secondary">
        Play with 2&ndash;8 friends. Same five songs for everyone, no rating at stake.
      </p>

      <SignedOut>
        <SignInButton mode="modal">
          <Button size="lg" className="w-fit">Sign in to play</Button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <Button
          size="lg"
          block
          onClick={async () => {
            const room = await create({});
            router.push(`/rooms/${room.code}`);
          }}
        >
          Create a room
        </Button>

        <Field label="Or join with a code" htmlFor="room-code" error={error}>
          <div className="flex gap-2">
            <Input
              id="room-code"
              size="lg"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={5}
              placeholder="ABC12"
              invalid={error !== null}
              className="flex-1 font-mono tracking-[0.3em]"
            />
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void handleJoin()}
              disabled={code.length < 5}
            >
              Join
            </Button>
          </div>
        </Field>
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
