import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { publicAvatarUrl, requireUser } from "./users";
import { difficultyTierForElo, pickTracksForMatch } from "./tracks";
import {
  MAX_DUEL_ROUNDS,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS,
  ROOM_STARTING_HP,
  STARTING_ELO,
} from "../src/engine/config";
import { startCountdown } from "./phases";

/**
 * Rooms run until one player survives, so reserve the worst case rather than a
 * fixed song count.
 */
const ROOM_TRACK_COUNT = MAX_DUEL_ROUNDS;

/** Ambiguity-free alphabet: no O/0, no I/1/L. Room codes get read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

async function allocateCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }

    const taken = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (!taken) return code;
  }
  throw new Error("Could not allocate a room code");
}

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const code = await allocateCode(ctx);

    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId: user._id,
      memberIds: [user._id],
      status: "lobby",
      createdAt: Date.now(),
    });

    return { roomId, code };
  },
});

export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase().trim()))
      .unique();

    if (!room) return { status: "no-such-room" as const };
    if (room.status === "closed") return { status: "closed" as const };
    if (room.memberIds.some((id) => id === user._id)) {
      return { status: "joined" as const, roomId: room._id };
    }
    if (room.memberIds.length >= ROOM_MAX_PLAYERS) return { status: "full" as const };
    if (room.status === "in_match") return { status: "in-progress" as const };

    await ctx.db.patch(room._id, { memberIds: [...room.memberIds, user._id] });
    return { status: "joined" as const, roomId: room._id };
  },
});

export const leave = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    const remaining = room.memberIds.filter((id) => id !== user._id);

    if (remaining.length === 0) {
      await ctx.db.patch(room._id, { memberIds: [], status: "closed" });
      return;
    }

    await ctx.db.patch(room._id, {
      memberIds: remaining,
      // Hosting passes to whoever has been there longest rather than closing the room.
      hostId: room.hostId === user._id ? remaining[0] : room.hostId,
    });
  },
});

export const state = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase().trim()))
      .unique();

    if (!room) return null;

    const members = await Promise.all(room.memberIds.map((id) => ctx.db.get(id)));

    return {
      roomId: room._id,
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      activeMatchId: room.activeMatchId,
      canStart: room.memberIds.length >= ROOM_MIN_PLAYERS,
      minPlayers: ROOM_MIN_PLAYERS,
      maxPlayers: ROOM_MAX_PLAYERS,
      members: members
        .filter((member) => member !== null)
        .map((member) => ({
          userId: member!._id,
          handle: member!.handle,
          displayName: member!.displayName,
          avatarUrl: publicAvatarUrl(member!),
          isHost: member!._id === room.hostId,
        })),
    };
  },
});

/**
 * Starts a room match. Rooms never affect Elo, and skip the veto phase — the ban
 * draft only makes sense head-to-head, and would stall a party of eight.
 */
export const start = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(args.roomId);

    if (!room) throw new Error("No such room");
    if (room.hostId !== user._id) throw new Error("Only the host can start");
    if (room.memberIds.length < ROOM_MIN_PLAYERS) {
      throw new Error(`Need at least ${ROOM_MIN_PLAYERS} players`);
    }

    const members = await Promise.all(room.memberIds.map((id) => ctx.db.get(id)));
    const ratings = members.map((member) => member?.elo ?? STARTING_ELO);
    const averageElo = ratings.reduce((sum, value) => sum + value, 0) / (ratings.length || 1);

    const trackIds = await pickTracksForMatch(ctx, {
      targetTier: difficultyTierForElo(averageElo),
      bannedCategoryIds: [],
      count: ROOM_TRACK_COUNT,
    });

    if (trackIds.length < ROOM_TRACK_COUNT) throw new Error("Not enough tracks in the catalogue");

    const matchId = await ctx.db.insert("matches", {
      mode: "room",
      status: "active",
      playerIds: room.memberIds,
      trackIds,
      bannedCategoryIds: [],
      currentRound: 0,
      roomId: room._id,
      createdAt: Date.now(),
    });

    for (const member of members) {
      if (!member) continue;
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId: member._id,
        totalPoints: 0,
        hp: ROOM_STARTING_HP,
        ratingBefore: member.elo,
        forfeited: false,
        lastSeenAt: Date.now(),
      });
    }

    await ctx.db.patch(room._id, { status: "in_match", activeMatchId: matchId });

    // Rooms skip the VS slam — an eight-way head-to-head does not read — and go
    // straight into the countdown. The server drives every beat from here.
    await startCountdown(ctx, matchId, 0);

    return { matchId };
  },
});

/** Returns the room to its lobby so the group can play again. */
export const returnToLobby = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;
    await ctx.db.patch(room._id, { status: "lobby", activeMatchId: undefined });
  },
});
