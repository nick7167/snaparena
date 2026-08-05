import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { currentUser, publicAvatarUrl, requireUser } from "./users";
import { difficultyTierForElo, pickTracksForMatch } from "./tracks";
import {
  MAX_DUEL_ROUNDS,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS,
  ROOM_STARTING_HP,
  STARTING_ELO,
} from "../src/engine/config";
import { startCountdown } from "./phases";
import { rankForElo } from "../src/engine/ranks";
import { levelForXp } from "../src/engine/xp";

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

    // Ready resets when the roster changes: what everyone agreed to was a room with a
    // different set of people in it.
    await ctx.db.patch(room._id, {
      memberIds: [...room.memberIds, user._id],
      readyIds: [],
    });
    return { status: "joined" as const, roomId: room._id };
  },
});

/**
 * Mark yourself ready, or take it back.
 *
 * Deliberately not a gate on `start` — see the schema note on `readyIds`. This is a signal
 * to the host, not a lock on the door.
 */
export const setReady = mutation({
  args: { roomId: v.id("rooms"), ready: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return;
    if (!room.memberIds.some((id) => id === user._id)) return;
    // Nothing to be ready for while a match is running.
    if (room.status !== "lobby") return;

    const current = room.readyIds ?? [];
    const next = args.ready
      ? current.some((id) => id === user._id)
        ? current
        : [...current, user._id]
      : current.filter((id) => id !== user._id);

    await ctx.db.patch(room._id, { readyIds: next });
  },
});

export const leave = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    // Membership was never checked. Leaving a room you were not in did nothing visible,
    // but it is the same shape of hole as `returnToLobby` and worth closing with it.
    if (!room.memberIds.some((id) => id === user._id)) return;

    const remaining = room.memberIds.filter((id) => id !== user._id);
    const stillReady = (room.readyIds ?? []).filter((id) => id !== user._id);

    if (remaining.length === 0) {
      await ctx.db.patch(room._id, { memberIds: [], status: "closed", readyIds: [] });
      return;
    }

    await ctx.db.patch(room._id, {
      memberIds: remaining,
      // Hosting passes to whoever has been there longest rather than closing the room.
      hostId: room.hostId === user._id ? remaining[0] : room.hostId,
      readyIds: stillReady,
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
    const ready = new Set(room.readyIds ?? []);

    return {
      roomId: room._id,
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      activeMatchId: room.activeMatchId,
      canStart: room.memberIds.length >= ROOM_MIN_PLAYERS,
      allReady:
        room.memberIds.length > 0 && room.memberIds.every((id) => ready.has(id)),
      minPlayers: ROOM_MIN_PLAYERS,
      maxPlayers: ROOM_MAX_PLAYERS,
      members: members
        .filter((member) => member !== null)
        .map((member) => {
          /**
           * Each member's OWN rank.
           *
           * The lobby drew every row in the viewer's accent, which is information about
           * nobody — eight rows, one colour, no signal. A room does not stake rating, but
           * who you are up against is still the first thing anyone wants from a lobby.
           */
          const rank = rankForElo(member!.elo);
          return {
            userId: member!._id,
            handle: member!.handle,
            displayName: member!.displayName,
            avatarUrl: publicAvatarUrl(member!),
            isHost: member!._id === room.hostId,
            isReady: ready.has(member!._id),
            elo: member!.elo,
            level: levelForXp(member!.xp ?? 0).level,
            placementsRemaining: member!.placementsRemaining,
            rankLabel: rank.label,
            rankTierId: rank.tier.id,
            rankDivision: rank.division,
            rankAccent: rank.tier.accent,
          };
        }),
    };
  },
});

/** How many `matchPlayers` rows the recent-rooms scan reads. */
const RECENT_ROOM_SCAN = 60;

/** How many rooms it reports. */
const RECENT_ROOM_LIMIT = 5;

/**
 * Rooms you have played in.
 *
 * A room used to be unrecoverable the moment its code left your screen: `rooms` is indexed
 * only `by_code`, nothing lists membership, and refreshing at the wrong moment lost the
 * room permanently. This is the cheapest honest fix — room matches already record `roomId`
 * and `matches` already has a `by_room` index that nothing used, so the trail exists and
 * was simply never read.
 *
 * The limitation is inherent and worth stating: this lists rooms you have PLAYED, so a
 * lobby you are sitting in but have not started does not appear. Fixing that needs a
 * membership index, which is a schema change; this needs none.
 */
export const recent = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];

    const rows = await ctx.db
      .query("matchPlayers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(RECENT_ROOM_SCAN);

    const seen = new Set<string>();
    const out: {
      code: string;
      roomId: string;
      status: "lobby" | "in_match" | "closed";
      memberCount: number;
      lastPlayedAt: number;
    }[] = [];

    for (const row of rows) {
      if (out.length >= RECENT_ROOM_LIMIT) break;

      const match = await ctx.db.get(row.matchId);
      if (!match || match.mode !== "room" || !match.roomId) continue;
      if (seen.has(match.roomId)) continue;
      seen.add(match.roomId);

      const room = await ctx.db.get(match.roomId);
      // A closed room is still worth listing — it says what happened to it, and rejoining
      // reports "That room has closed" rather than a dead link.
      if (!room) continue;

      out.push({
        code: room.code,
        roomId: room._id,
        status: room.status,
        memberCount: room.memberIds.length,
        lastPlayedAt: match.completedAt ?? match.createdAt,
      });
    }

    return out;
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
    // A second Start while one is already running built a whole extra match and pointed
    // the room at it, orphaning the first mid-song. Two hosts' tabs, or one double-tap.
    if (room.status === "in_match") throw new Error("That room is already in a match");
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
      });
    }

    // Ready state belonged to this lobby round and dies with it.
    await ctx.db.patch(room._id, {
      status: "in_match",
      activeMatchId: matchId,
      readyIds: [],
    });

    // Rooms skip the VS slam — an eight-way head-to-head does not read — and go
    // straight into the countdown. The server drives every beat from here.
    await startCountdown(ctx, matchId, 0);

    return { matchId };
  },
});

/**
 * Returns the room to its lobby so the group can play again.
 *
 * Gated three ways, none of which existed before: this took no `requireUser`, checked no
 * host and checked no membership, so the "only the host" rule was the `me._id ===
 * room.hostId` expression on the page and nothing else. Anyone who could guess a room id
 * could pull eight people out of a live match mid-song. The client-side check is a
 * courtesy; this is the rule.
 */
export const returnToLobby = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    if (!room.memberIds.some((id) => id === user._id)) {
      throw new Error("Not a member of this room");
    }
    if (room.hostId !== user._id) throw new Error("Only the host can return to the lobby");

    await ctx.db.patch(room._id, {
      status: "lobby",
      activeMatchId: undefined,
      // One of four clear-points. A ready that survives the match it was for would have
      // the next lobby round open with everyone already ready.
      readyIds: [],
    });
  },
});
