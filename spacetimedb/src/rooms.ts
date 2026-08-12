import { t } from "spacetimedb/server";
import { spacetimedb } from "./schema";
import type { ReducerCtx } from "./ctx";
import { reject } from "./lib";
import { requireFullAccount } from "./users";
import { currentVersionId } from "./config";
import { difficultyTierForElo, pickTracksForMatch } from "./catalogue";
import { startCountdown } from "./phases";
import {
  MAX_DUEL_ROUNDS,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS,
  ROOM_STARTING_HP,
  STARTING_ELO,
} from "../../src/engine/config";

/**
 * Private rooms.
 *
 * A code you read aloud, a lobby, and a match the host starts. The reads Convex had
 * here — `state` and `recent` — are gone: `room` is a public table the client
 * subscribes to by code or by membership, which is also why `state` had to denormalise
 * member handles and this does not.
 */

const ROOM_TRACK_COUNT = MAX_DUEL_ROUNDS;

/** Ambiguity-free alphabet: no O/0, no I/1/L. Room codes get read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

function allocateCode(ctx: ReducerCtx): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[ctx.random.integerInRange(0, CODE_ALPHABET.length - 1)];
    }
    if (!ctx.db.room.code.find(code)) return code;
  }
  reject("Could not allocate a room code");
}

export const createRoom = spacetimedb.reducer({}, (ctx) => {
  const host = requireFullAccount(ctx);

  ctx.db.room.insert({
    id: 0n,
    code: allocateCode(ctx),
    hostId: host.id,
    memberIds: [host.id],
    status: "lobby",
    activeMatchId: undefined,
    readyIds: [],
    createdAt: ctx.timestamp,
  });
});

export const joinRoom = spacetimedb.reducer({ code: t.string() }, (ctx, { code }) => {
  const player = requireFullAccount(ctx);

  const room = ctx.db.room.code.find(code.toUpperCase().trim());
  if (!room) reject("No such room");
  if (room.status === "closed") reject("That room is closed");
  if (room.memberIds.includes(player.id)) return;
  if (room.memberIds.length >= ROOM_MAX_PLAYERS) reject("That room is full");
  if (room.status === "in_match") reject("That room is already in a match");

  // Ready resets when the roster changes: what everyone agreed to was a room with a
  // different set of people in it.
  ctx.db.room.id.update({
    ...room,
    memberIds: [...room.memberIds, player.id],
    readyIds: [],
  });
});

/**
 * Mark yourself ready, or take it back.
 *
 * Deliberately not a gate on starting — this is a signal to the host, not a lock on
 * the door.
 */
export const setRoomReady = spacetimedb.reducer(
  { roomId: t.u64(), ready: t.bool() },
  (ctx, { roomId, ready }) => {
    const player = requireFullAccount(ctx);

    const room = ctx.db.room.id.find(roomId);
    if (!room) return;
    if (!room.memberIds.includes(player.id)) return;
    // Nothing to be ready for while a match is running.
    if (room.status !== "lobby") return;

    const readyIds = ready
      ? room.readyIds.includes(player.id)
        ? room.readyIds
        : [...room.readyIds, player.id]
      : room.readyIds.filter((id) => id !== player.id);

    ctx.db.room.id.update({ ...room, readyIds });
  },
);

export const leaveRoom = spacetimedb.reducer({ roomId: t.u64() }, (ctx, { roomId }) => {
  const player = requireFullAccount(ctx);

  const room = ctx.db.room.id.find(roomId);
  if (!room) return;
  if (!room.memberIds.includes(player.id)) return;

  const remaining = room.memberIds.filter((id) => id !== player.id);
  const stillReady = room.readyIds.filter((id) => id !== player.id);

  if (remaining.length === 0) {
    ctx.db.room.id.update({
      ...room,
      memberIds: [],
      status: "closed",
      readyIds: [],
    });
    return;
  }

  ctx.db.room.id.update({
    ...room,
    memberIds: remaining,
    // Hosting passes to whoever has been there longest rather than closing the room.
    hostId: room.hostId === player.id ? remaining[0] : room.hostId,
    readyIds: stillReady,
  });
});

export const startRoomMatch = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    const host = requireFullAccount(ctx);

    const room = ctx.db.room.id.find(roomId);
    if (!room) reject("No such room");
    if (room.hostId !== host.id) reject("Only the host can start");
    /**
     * A second start while one is already running built a whole extra match and
     * pointed the room at it, orphaning the first mid-song. Two host tabs, or one
     * double-tap.
     */
    if (room.status === "in_match") reject("That room is already in a match");
    if (room.memberIds.length < ROOM_MIN_PLAYERS) {
      reject(`Need at least ${ROOM_MIN_PLAYERS} players`);
    }

    const members = room.memberIds
      .map((id) => ctx.db.user.id.find(id))
      .filter((member) => member !== null);

    const ratings = members.map((member) => member?.elo ?? STARTING_ELO);
    const averageElo =
      ratings.reduce((sum, value) => sum + value, 0) / (ratings.length || 1);

    const trackIds = pickTracksForMatch(ctx, {
      targetTier: difficultyTierForElo(averageElo),
      bannedCategoryIds: [],
      count: ROOM_TRACK_COUNT,
    });

    if (trackIds.length < ROOM_TRACK_COUNT) reject("Not enough tracks in the catalogue");

    const match = ctx.db.match.insert({
      id: 0n,
      mode: "room",
      status: "active",
      playerIds: room.memberIds,
      totalRounds: ROOM_TRACK_COUNT,
      bannedCategoryIds: [],
      vetoPoolIds: [],
      vetoDeadline: undefined,
      banOrder: [],
      banTurn: 0,
      currentRound: 0,
      roundStartedAt: undefined,
      phase: "countdown",
      phaseEndsAt: undefined,
      suddenDeath: false,
      roomId: room.id,
      winnerId: undefined,
      createdAt: ctx.timestamp,
      completedAt: undefined,
      /**
       * Freeze the rules this match will be played under, so a config saved mid-match
       * cannot change the game underneath eight people at once.
       */
      configVersionId: currentVersionId(ctx),
    });

    trackIds.forEach((trackId, roundIndex) => {
      ctx.db.match_track.insert({ id: 0n, matchId: match.id, roundIndex, trackId });
    });

    for (const member of members) {
      if (!member) continue;
      ctx.db.match_player.insert({
        id: 0n,
        matchId: match.id,
        userId: member.id,
        totalPoints: 0,
        ratingBefore: member.elo,
        globalRankAtStart: undefined,
        ratingAfter: undefined,
        ratingDelta: undefined,
        bannedCategoryIds: [],
        hasBanned: false,
        hp: ROOM_STARTING_HP,
        lowestHp: ROOM_STARTING_HP,
        eliminatedAtRound: undefined,
        readyForRound: -1,
        vsReadyAt: undefined,
        passedRound: undefined,
        xpEarned: 0,
        xpBreakdown: [],
        levelBefore: undefined,
        levelAfter: undefined,
        xpAfter: undefined,
        badgesEarned: [],
        forfeited: false,
        mode: "room",
        completedAt: undefined,
        outcome: undefined,
        // Several opponents, so no single one to name.
        opponentId: undefined,
      });
    }

    // Ready state belonged to this lobby round and dies with it.
    ctx.db.room.id.update({
      ...room,
      status: "in_match",
      activeMatchId: match.id,
      readyIds: [],
    });

    // Rooms skip the VS slam — an eight-way head-to-head does not read — and go
    // straight into the countdown. The server drives every beat from here.
    startCountdown(ctx, match.id, 0);
  },
);

/**
 * Returns the room to its lobby so the group can play again.
 *
 * Gated three ways, and all three matter: the Convex original took no authenticated
 * user, checked no host and checked no membership, so "only the host" was an expression
 * on the page and nothing else. Anyone who could guess a room id could pull eight people
 * out of a live match mid-song. The client-side check is a courtesy; this is the rule.
 */
export const returnToLobby = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    const player = requireFullAccount(ctx);

    const room = ctx.db.room.id.find(roomId);
    if (!room) return;
    if (!room.memberIds.includes(player.id)) reject("Not a member of this room");
    if (room.hostId !== player.id) reject("Only the host can return to the lobby");

    ctx.db.room.id.update({
      ...room,
      status: "lobby",
      activeMatchId: undefined,
      // A ready that survived the match it was for would have the next lobby round
      // open with everyone already ready.
      readyIds: [],
    });
  },
);
