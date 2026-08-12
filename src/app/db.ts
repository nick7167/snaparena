"use client";

import { useTable, useSpacetimeDB } from "spacetimedb/react";
import { useMemo } from "react";
import { tables } from "@/module_bindings";

/**
 * The client's read layer.
 *
 * WHAT REPLACED WHAT. Convex answered `useQuery(api.users.me)` with a computed
 * payload; SpacetimeDB answers a subscription with rows, and anything derived from
 * more than one table is derived HERE. So this module is where the old queries went:
 * each hook below is one of them, rebuilt as a subscription plus composition.
 *
 * Three rules it follows, because 45 screens depend on getting them consistent:
 *
 *   1. LOADING IS `undefined`, ABSENT IS `null`. Convex's `useQuery` returned
 *      `undefined` until it resolved and every screen already branches on that. A
 *      subscription has a separate ready flag, so it is folded back into the same
 *      shape rather than making every caller learn a new one.
 *   2. SUBSCRIBE NARROWLY. A hook that takes a match id filters server-side rather
 *      than pulling the table and finding the row — the whole reason the ladder and
 *      config were reshaped for this port.
 *   3. NO AUTHORITY. Everything here is presentation. The server decides outcomes;
 *      these hooks decide what to draw while it does.
 */

/** Whether the socket is up. Screens use it to tell "empty" from "not yet". */
export function useConnected(): boolean {
  const connection = useSpacetimeDB();
  return connection.isActive;
}

/**
 * The signed-in player's own row, or `null` when there is no account yet.
 *
 * REPLACES `api.users.me`, which 29 screens called. It is a view rather than a
 * filter on `user`, because the caller's row carries fields nobody else may read —
 * the guest claim token above all — and a view is the only thing that can hand a
 * player their own private columns without publishing everyone's.
 */
export function useMe() {
  const [rows, ready] = useTable(tables.me);
  if (!ready) return undefined;
  return rows[0] ?? null;
}

/** True once the caller is known to be an admin. `undefined` while loading. */
export function useIsAdmin(): boolean | undefined {
  const me = useMe();
  if (me === undefined) return undefined;
  return me?.role === "admin";
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

/**
 * One match, by id.
 *
 * REPLACES `api.matches.state`, minus the parts that were never the client's to
 * see. The Convex query chose what to return and could therefore withhold the
 * current track; a subscription cannot, which is why the module writes
 * `round_reveal` progressively instead. See `spacetimedb/src/phases.ts`.
 */
export function useMatch(matchId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.match.where((row) => row.id.eq(matchId ?? 0n)),
    { enabled: matchId !== undefined },
  );
  if (matchId === undefined) return null;
  if (!ready) return undefined;
  return rows[0] ?? null;
}

/** Every player in a match, in a stable order so the scoreboard does not jump. */
export function useMatchPlayers(matchId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.matchPlayer.where((row) => row.matchId.eq(matchId ?? 0n)),
    { enabled: matchId !== undefined },
  );

  return useMemo(() => {
    if (matchId === undefined) return [];
    if (!ready) return undefined;
    // By id: insertion order, which is the order they were paired in.
    return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }, [matchId, ready, rows]);
}

/** What the player is allowed to know about the round they are playing. */
export function useMyRoundStatus(matchId: bigint | undefined) {
  const [rows, ready] = useTable(tables.myRoundStatus, {
    enabled: matchId !== undefined,
  });
  if (matchId === undefined) return null;
  if (!ready) return undefined;
  return rows.find((row) => row.matchId === matchId) ?? null;
}

/**
 * The reveal row for a round: the clip while guessing, the answer once it closes.
 *
 * The fields arrive in two waves and that is deliberate — `previewUrl` is written
 * when the round opens, and title, artist and artwork only when guessing ends.
 */
export function useRoundReveal(matchId: bigint | undefined, roundIndex: number) {
  const [rows, ready] = useTable(
    tables.roundReveal.where((row) => row.matchId.eq(matchId ?? 0n)),
    { enabled: matchId !== undefined },
  );
  if (matchId === undefined) return null;
  if (!ready) return undefined;
  return rows.find((row) => row.roundIndex === roundIndex) ?? null;
}

/** Per-round scores for a match, oldest round first. */
export function useRoundResults(matchId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.roundResult.where((row) => row.matchId.eq(matchId ?? 0n)),
    { enabled: matchId !== undefined },
  );

  return useMemo(() => {
    if (matchId === undefined) return [];
    if (!ready) return undefined;
    return [...rows].sort((a, b) => a.roundIndex - b.roundIndex);
  }, [matchId, ready, rows]);
}

/**
 * The verdict on a guess this player just made.
 *
 * `guess_feedback` is the event table that carries an outcome back to one player —
 * a reducer returns nothing, so this is how "wrong, try again" reaches the person
 * who typed it. Filtered to the caller because the table is public.
 */
export function useGuessFeedback(matchId: bigint | undefined, userId: bigint | undefined) {
  const [rows, ready] = useTable(tables.guessFeedback, {
    enabled: matchId !== undefined && userId !== undefined,
  });
  if (matchId === undefined || userId === undefined) return null;
  if (!ready) return undefined;
  return rows.find((row) => row.matchId === matchId && row.userId === userId) ?? null;
}

/**
 * The match this player should be dropped back into on a reload.
 *
 * REPLACES `api.ranked.activeMatch`. Practice counts too — a reload mid-bot-match
 * should resume it — and the daily does not, because it has its own resume path.
 */
export function useActiveMatch(userId: bigint | undefined) {
  const [memberships, membershipsReady] = useTable(
    tables.matchPlayer.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );
  const [matches, matchesReady] = useTable(tables.match, {
    enabled: userId !== undefined,
  });

  return useMemo(() => {
    if (userId === undefined) return null;
    if (!membershipsReady || !matchesReady) return undefined;

    const mine = new Set(memberships.map((row) => row.matchId));

    const live = matches.filter(
      (match) =>
        mine.has(match.id) &&
        (match.mode === "ranked" || match.mode === "practice") &&
        (match.status === "veto" || match.status === "active"),
    );

    // Newest first, so a stale corpse never wins over a live match.
    live.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    return live[0] ?? null;
  }, [userId, memberships, membershipsReady, matches, matchesReady]);
}

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

/**
 * The top of the board.
 *
 * Subscribes to a rank range rather than the table, which is the entire reason the
 * ladder was rebuilt as rows for this port — see `spacetimedb/src/ladder.ts`.
 */
export function useLeaderboard(limit = 100) {
  const [rows, ready] = useTable(tables.ladderEntry.where((row) => row.rank.lte(limit)));

  return useMemo(() => {
    if (!ready) return undefined;
    return [...rows].sort((a, b) => a.rank - b.rank);
  }, [ready, rows]);
}

/** One player's ladder position, by a single lookup rather than a walk. */
export function useLadderEntry(userId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.ladderEntry.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );
  if (userId === undefined) return null;
  if (!ready) return undefined;
  return rows[0] ?? null;
}

/** Freshness and size of the board. `builtAt` is what "updated 2m ago" means. */
export function useLadderStatus() {
  const [rows, ready] = useTable(tables.ladderStatus);
  if (!ready) return undefined;
  return rows[0] ?? null;
}

/** How many players sit in each rank tier. */
export function useTierCounts() {
  const [rows, ready] = useTable(tables.ladderTierCount);
  if (!ready) return undefined;
  return rows;
}

// ---------------------------------------------------------------------------
// The daily
// ---------------------------------------------------------------------------

/** The UTC date key the module uses. Kept identical to `daily.todayKey`. */
export function todayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** This player's recorded run for a date, or `null` if they have not played it. */
export function useMyDailyRun(userId: bigint | undefined, date = todayKey()) {
  const [rows, ready] = useTable(
    tables.dailyRun.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );
  if (userId === undefined) return null;
  if (!ready) return undefined;
  return rows.find((row) => row.date === date) ?? null;
}

/** How many people have played a date. One row, not a count over a thousand. */
export function useDailyCount(date = todayKey()) {
  const [rows, ready] = useTable(tables.dailyCount.where((row) => row.date.eq(date)));
  if (!ready) return undefined;
  return rows[0]?.players ?? 0;
}

/** The day's board, best first. Guests are excluded the way the old query was. */
export function useDailyLeaderboard(date = todayKey(), limit = 50) {
  const [rows, ready] = useTable(tables.dailyRun.where((row) => row.date.eq(date)));

  return useMemo(() => {
    if (!ready) return undefined;
    return [...rows]
      .filter((row) => !row.isGuest)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);
  }, [ready, rows, limit]);
}

// ---------------------------------------------------------------------------
// Catalogue and rooms
// ---------------------------------------------------------------------------

/** Every category, in the order the admin console arranged them. */
export function useCategories() {
  const [rows, ready] = useTable(tables.category);

  return useMemo(() => {
    if (!ready) return undefined;
    return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [ready, rows]);
}

/** The autocomplete corpus. One row carrying every playable title. */
export function useTrackIndexRow() {
  const [rows, ready] = useTable(tables.trackIndex);
  if (!ready) return undefined;
  return rows[0] ?? null;
}

/** Catalogue health, for the admin dashboard. */
export function useCatalogueStats() {
  const [rows, ready] = useTable(tables.catalogueStats);
  if (!ready) return undefined;
  return rows[0] ?? null;
}

/** A room by its code, which is what a player types to join one. */
export function useRoomByCode(code: string | undefined) {
  const normalized = code?.toUpperCase().trim();
  const [rows, ready] = useTable(
    tables.room.where((row) => row.code.eq(normalized ?? "")),
    { enabled: normalized !== undefined && normalized.length > 0 },
  );
  if (!normalized) return null;
  if (!ready) return undefined;
  return rows[0] ?? null;
}

/** Every player named by a set of ids, for rosters and scoreboards. */
export function useUsersById(ids: readonly bigint[]) {
  const [rows, ready] = useTable(tables.user);

  return useMemo(() => {
    if (!ready) return undefined;
    const wanted = new Set(ids);
    const found = new Map<bigint, (typeof rows)[number]>();
    for (const row of rows) if (wanted.has(row.id)) found.set(row.id, row);
    return found;
  }, [ready, rows, ids]);
}

/** A player's public profile by handle, for `/u/[handle]`. */
export function useUserByHandle(handle: string | undefined) {
  const [rows, ready] = useTable(
    tables.user.where((row) => row.handle.eq(handle ?? "")),
    { enabled: handle !== undefined && handle.length > 0 },
  );
  if (!handle) return null;
  if (!ready) return undefined;
  return rows[0] ?? null;
}

/** Badges a player holds, newest first. */
export function useUserBadges(userId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.userBadge.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );

  return useMemo(() => {
    if (userId === undefined) return [];
    if (!ready) return undefined;
    return [...rows].sort((a, b) =>
      a.earnedAt.microsSinceUnixEpoch < b.earnedAt.microsSinceUnixEpoch ? 1 : -1,
    );
  }, [userId, ready, rows]);
}

/** A player's per-category ratings, for the strengths panel. */
export function useCategoryRatings(userId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.categoryRating.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );
  if (userId === undefined) return [];
  if (!ready) return undefined;
  return rows;
}

/**
 * A player's finished matches, newest first.
 *
 * REPLACES `api.matches.history`. It reads only `match_player`, never the matches
 * themselves — the port denormalised mode, outcome, opponent and completion onto
 * that row precisely so this list costs one subscription instead of one read per
 * match. See the note on those fields in the module schema.
 */
export function useMatchHistory(userId: bigint | undefined, limit = 8) {
  const [rows, ready] = useTable(
    tables.matchPlayer.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );

  return useMemo(() => {
    if (userId === undefined) return [];
    if (!ready) return undefined;
    return [...rows]
      .filter((row) => row.completedAt !== undefined)
      .sort((a, b) => {
        const at = a.completedAt?.microsSinceUnixEpoch ?? 0n;
        const bt = b.completedAt?.microsSinceUnixEpoch ?? 0n;
        return at < bt ? 1 : at > bt ? -1 : 0;
      })
      .slice(0, limit);
  }, [userId, ready, rows, limit]);
}
