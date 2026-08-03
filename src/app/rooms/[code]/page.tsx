"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { RoundRunner } from "@/game/RoundRunner";
import { Avatar } from "@/game/ui";
import { Button, ButtonLink } from "@/ui/Button";
import { Card, Chip, Empty, Panel, SectionLabel, Skeleton } from "@/ui/Surface";
import { RankEmblem } from "@/ui/RankEmblem";
import { Glyph } from "@/ui/Glyph";
import { AuthDialogButton } from "@/auth/AuthDialogButton";
import { SignedOut } from "../../auth-gate";
import { PageHeader } from "../../page-header";
import { Beat } from "../../dashboard/motion";

const PARENT = { href: "/rooms", label: "Rooms" };

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const room = useQuery(api.rooms.state, { code });
  const me = useQuery(api.users.me, {});
  const join = useMutation(api.rooms.join);
  const start = useMutation(api.rooms.start);
  const returnToLobby = useMutation(api.rooms.returnToLobby);

  // Arriving via a shared link should put you in the room, not just show it to you.
  // Deliberately not attempted for a closed room, which cannot be joined.
  useEffect(() => {
    if (!room || !me) return;
    if (room.status === "closed") return;
    if (room.members.some((member) => member.userId === me._id)) return;
    void join({ code });
  }, [room, me, join, code]);

  if (room === undefined) {
    return (
      <>
        <PageHeader parent={PARENT} />
        <Shell>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </Shell>
      </>
    );
  }

  /**
   * Two dead ends that used to be a bare centred sentence with no way back.
   *
   * A missing room and a closed one are different facts and deserve different copy — but
   * both need the header, because the browser back button was the only exit from either.
   */
  if (room === null) {
    return (
      <>
        <PageHeader parent={PARENT} />
        <Shell>
          <Empty
            title="No room with that code"
            body={`Nothing here goes by ${code}. Codes are five characters and expire when everyone leaves.`}
            action={<ButtonLink href="/rooms">Back to rooms</ButtonLink>}
          />
        </Shell>
      </>
    );
  }

  if (room.status === "closed") {
    return (
      <>
        <PageHeader parent={PARENT} title={`Room ${room.code}`} />
        <Shell>
          <Empty
            title="This room has closed"
            body="Rooms close when the last player leaves. Make a new one and share the code."
            action={<ButtonLink href="/rooms">Back to rooms</ButtonLink>}
          />
        </Shell>
      </>
    );
  }

  const isHost = me?._id === room.hostId;
  const isMember = me ? room.members.some((member) => member.userId === me._id) : false;

  if (room.status === "in_match" && room.activeMatchId) {
    return (
      <div className="flex flex-col gap-4">
        <RoundRunner matchId={room.activeMatchId} />
        {/*
         * Non-hosts had no exit at all: no `onPlayAgain`, no button, nothing but the tab
         * close. The host returns the whole room; everyone else at least gets a door.
         */}
        <div className="mx-auto flex w-fit gap-2">
          {isHost ? (
            <Button
              variant="secondary"
              onClick={() => void returnToLobby({ roomId: room.roomId })}
            >
              Back to lobby
            </Button>
          ) : (
            <ButtonLink variant="secondary" href="/rooms">
              Leave to rooms
            </ButtonLink>
          )}
        </div>
      </div>
    );
  }

  const notReady = room.members.length - room.members.filter((m) => m.isReady).length;
  const emptySeats = Math.max(0, room.maxPlayers - room.members.length);

  return (
    <>
      <PageHeader parent={PARENT} title={`Room ${room.code}`} />

      <Shell>
        <Beat index={0}>
          <RoomCode code={room.code} />
        </Beat>

        <Beat index={1}>
          <Panel
            title="Players"
            aside={`${room.members.length} / ${room.maxPlayers}`}
          >
            <ul className="flex flex-col gap-1.5">
              {room.members.map((member) => {
                const placing = member.placementsRemaining > 0;
                return (
                  <Card
                    as="li"
                    key={member.userId}
                    you={member.userId === me?._id}
                    // Each member's OWN accent. Every row used to carry the viewer's,
                    // which is eight rows of one colour saying nothing about anyone.
                    accent={placing ? undefined : member.rankAccent}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <Avatar
                      url={member.avatarUrl}
                      name={member.handle}
                      className="size-9 shrink-0"
                    />

                    <RankEmblem
                      tierId={member.rankTierId}
                      division={member.rankDivision}
                      size="sm"
                      unranked={placing}
                      className="shrink-0"
                    />

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body truncate font-medium">
                        @{member.handle}
                      </span>
                      <span className="text-label text-muted truncate tabular-nums">
                        {placing ? "Unranked" : member.rankLabel} · L{member.level}
                      </span>
                    </span>

                    {member.isHost && (
                      <Chip size="sm" className="shrink-0">
                        host
                      </Chip>
                    )}

                    <span
                      title={member.isReady ? "Ready" : "Not ready yet"}
                      className={`shrink-0 text-base leading-none ${
                        member.isReady ? "text-teal" : "text-faint"
                      }`}
                    >
                      <Glyph name={member.isReady ? "win" : "timer"} filled={member.isReady} />
                    </span>
                  </Card>
                );
              })}

              {/* Seats to CAPACITY, not to the two-player minimum. A room is an eight-seat
                  table and the empty chairs are what make its size legible. */}
              {emptySeats > 0 && (
                <li
                  className="border-line text-label text-muted flex items-center gap-2
                             rounded-md border border-dashed px-3 py-3"
                >
                  <span className="flex gap-1" aria-hidden="true">
                    {Array.from({ length: Math.min(emptySeats, 6) }, (_, index) => (
                      <span
                        key={index}
                        className="border-line-strong size-2.5 rounded-full border border-dashed"
                      />
                    ))}
                  </span>
                  {emptySeats} {emptySeats === 1 ? "seat" : "seats"} free
                </li>
              )}
            </ul>
          </Panel>
        </Beat>

        <Beat index={2} className="flex flex-col gap-3">
          {isMember && <ReadyToggle roomId={room.roomId} ready={!!me && room.members.find((m) => m.userId === me._id)?.isReady} />}

          {isHost ? (
            <Button
              size="lg"
              block
              // Advisory, never a gate: one player who wandered off must not be able to
              // hold seven others hostage, and there is no kick.
              variant={room.allReady ? "primary" : "secondary"}
              disabled={!room.canStart}
              onClick={() => void start({ roomId: room.roomId })}
            >
              {!room.canStart
                ? `Need ${room.minPlayers - room.members.length} more`
                : room.allReady
                  ? "Start match"
                  : `Start anyway · ${notReady} not ready`}
            </Button>
          ) : (
            <p className="text-body text-muted text-center" role="status">
              Waiting for the host to start…
            </p>
          )}

          {/* A visitor who followed a shared link while signed out saw the roster and was
              offered nothing at all — no join, no sign-in. */}
          <SignedOut>
            <div className="flex flex-col items-center gap-2">
              <p className="text-body-sm text-muted text-center">
                Sign in to take a seat in this room.
              </p>
              <AuthDialogButton mode="sign-up" size="lg">
                Sign in to play
              </AuthDialogButton>
            </div>
          </SignedOut>

          {isMember && <LeaveRoom roomId={room.roomId} isHost={isHost} />}
        </Beat>
      </Shell>
    </>
  );
}

/** The room's own column. Wider than it was — the roster carries a rank per row now. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">{children}</div>
  );
}

/**
 * The code, and the link.
 *
 * `copied` resets now. It used to latch on the first press, so the button read "Link
 * copied" for the rest of the session and stopped confirming anything.
 */
function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <section className="flex flex-col items-center gap-3">
      <SectionLabel>Room code</SectionLabel>
      <p className="font-mono text-display-1 text-paper font-bold tracking-[0.25em]">
        {code}
      </p>
      <Button
        variant="secondary"
        onClick={async () => {
          // Unguarded before: `writeText` rejects on an insecure origin or a denied
          // permission, and the failure was an unhandled rejection with no feedback.
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setFailed(false);
          } catch {
            setFailed(true);
          }
        }}
      >
        <Glyph name="song" />
        {copied ? "Link copied" : failed ? "Copy failed — select the code" : "Copy invite link"}
      </Button>
    </section>
  );
}

/** Advisory readiness. See the `readyIds` note in the schema for why it is not a gate. */
function ReadyToggle({ roomId, ready }: { roomId: Id<"rooms">; ready?: boolean }) {
  const setReady = useMutation(api.rooms.setReady);

  return (
    <Button
      variant={ready ? "secondary" : "primary"}
      size="lg"
      block
      onClick={() => void setReady({ roomId, ready: !ready })}
    >
      <Glyph name={ready ? "win" : "timer"} filled={ready} />
      {ready ? "Ready — tap to undo" : "I'm ready"}
    </Button>
  );
}

function LeaveRoom({ roomId, isHost }: { roomId: Id<"rooms">; isHost: boolean }) {
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
