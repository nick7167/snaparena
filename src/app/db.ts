"use client";

import { useTable, useReducer, useSpacetimeDB } from "spacetimedb/react";
import { useEffect, useMemo } from "react";
import { reducers, tables } from "@/module_bindings";
import { computeStreak } from "@/engine/streak";
import { sortBadges } from "@/engine/badges";
import { matchupLabel, rankForElo } from "@/engine/ranks";
import { damageMultiplier, wonRound } from "@/engine/duel";
import { revealBeatAt } from "@/engine/scoring";
import type { ResolvedConfig } from "@/engine/config-merge";
import {
  ROOM_MAX_PLAYERS,
  ROOM_MIN_PLAYERS,
  VETO_BANS_PER_PLAYER,
} from "@/engine/config";

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
  const [users, usersReady] = useTable(tables.user);

  return useMemo(() => {
    if (!ready || !usersReady) return undefined;

    const byId = new Map(users.map((row) => [row.id, row]));

    return [...rows]
      .filter((row) => !row.isGuest)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit)
      .map((row, index) => {
        const user = byId.get(row.userId);
        return {
          ...row,
          rank: index + 1,
          handle: user?.handle ?? "player",
          displayName: user?.displayName ?? "Player",
          avatarUrl: user ? publicAvatarUrl(user) : undefined,
          level: user?.level ?? 1,
        };
      });
  }, [ready, rows, users, usersReady, limit]);
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
 * REPLACES `api.matches.history`, INCLUDING ITS SHAPE. The query returned a payload the
 * cards render directly — `won`, `drawn`, a resolved opponent, a millisecond timestamp —
 * and rebuilding that at six call sites would be six chances to disagree about what a
 * draw is. So the shaping stays in one place and moves here.
 *
 * It reads `match_player` and the opponent's user row, never the matches themselves: the
 * port denormalised mode, outcome, opponent and completion onto that row precisely so
 * this list costs one subscription instead of one read per match.
 */
export function useMatchHistory(userId: bigint | undefined, limit = 8) {
  const [rows, ready] = useTable(
    tables.matchPlayer.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );
  const [users, usersReady] = useTable(tables.user, { enabled: userId !== undefined });

  return useMemo(() => {
    if (userId === undefined) return [];
    if (!ready || !usersReady) return undefined;

    const byId = new Map(users.map((row) => [row.id, row]));

    return [...rows]
      .filter((row) => row.completedAt !== undefined)
      .sort((a, b) => {
        const at = a.completedAt?.microsSinceUnixEpoch ?? 0n;
        const bt = b.completedAt?.microsSinceUnixEpoch ?? 0n;
        return at < bt ? 1 : at > bt ? -1 : 0;
      })
      .slice(0, limit)
      .map((row) => {
        const opponent = row.opponentId === undefined ? null : byId.get(row.opponentId);

        return {
          ...row,
          // The engine and the cards deal in milliseconds; the column is a Timestamp.
          completedAtMs: Number(
            (row.completedAt?.microsSinceUnixEpoch ?? 0n) / 1_000n,
          ),
          won: row.outcome === "win",
          drawn: row.outcome === "draw",
          opponent: opponent
            ? {
                id: opponent.id,
                handle: opponent.handle,
                displayName: opponent.displayName,
                avatarUrl: publicAvatarUrl(opponent),
                elo: opponent.elo,
                isBot: opponent.isBot,
              }
            : null,
        };
      });
  }, [userId, ready, rows, users, usersReady, limit]);
}

/**
 * The avatar as everyone else should see it. Mirrors the module's own helper, because a
 * hidden picture must not survive on a surface that reads the user row directly.
 */
function publicAvatarUrl(user: { avatarHidden: boolean; avatarUrl: string | undefined }) {
  return user.avatarHidden ? undefined : user.avatarUrl;
}

/**
 * The player's daily streak.
 *
 * REPLACES `api.users.dailyStreak`, which walked the run rows server-side. The rows are
 * already subscribed for the results card, so the walk moves to the client and runs
 * against `computeStreak` — the same engine function the query used, so the forgiveness
 * rule cannot drift between the two.
 */
export function useDailyStreak(userId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.dailyRun.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );

  return useMemo(() => {
    if (userId === undefined) return null;
    if (!ready) return undefined;
    return computeStreak(new Set(rows.map((row) => row.date)), Date.now());
  }, [userId, ready, rows]);
}

/**
 * Where the player stands: rating, games, and global position.
 *
 * REPLACES `api.users.myStanding`. `position` is `null` rather than a number until the
 * ladder has been built at least once, and `approximate` marks a placing past the depth
 * the board carries exactly — both the same meanings the query gave them.
 */
export function useMyStanding(me: ReturnType<typeof useMe>) {
  const entry = useLadderEntry(me?.id);

  return useMemo(() => {
    if (me === undefined || entry === undefined) return undefined;
    if (me === null) return null;

    return {
      elo: me.elo,
      gamesPlayed: me.gamesPlayed,
      placementsRemaining: me.placementsRemaining,
      position: entry?.rank ?? null,
      approximate: entry?.approximate ?? false,
    };
  }, [me, entry]);
}

/**
 * The players ranked immediately above and below you.
 *
 * REPLACES `api.users.ladderNeighbours`. The Convex version walked outward from the
 * player's position in the stored field; here the board is rows with a `rank` index, so
 * it is a range subscription — and a narrow one, because a window is exactly what the
 * panel draws.
 *
 * Returns `null` for an unranked player rather than an empty list: "still placing" and
 * "nobody near you" are different states and the panel says different things about them.
 */
export function useLadderNeighbours(userId: bigint | undefined, spread = 2) {
  const mine = useLadderEntry(userId);
  const rank = mine?.rank;

  const [rows, ready] = useTable(
    tables.ladderEntry.where((row) => row.rank.gte((rank ?? 1) - spread)),
    { enabled: rank !== undefined },
  );

  return useMemo(() => {
    if (userId === undefined) return null;
    if (mine === undefined) return undefined;
    if (mine === null) return null;
    if (!ready) return undefined;

    const window = [...rows]
      .filter((row) => Math.abs(row.rank - mine.rank) <= spread)
      .sort((a, b) => a.rank - b.rank);

    // Split rather than handed over flat, because the panel draws the two sides
    // differently — above you is what to chase, below is what is chasing you.
    return {
      above: window.filter((row) => row.rank < mine.rank),
      below: window.filter((row) => row.rank > mine.rank),
      me: { elo: mine.elo, position: mine.rank, approximate: mine.approximate },
    };
  }, [userId, mine, ready, rows, spread]);
}

/** Everyone holding the admin role. For the roles panel. */
export function useAdmins() {
  const [rows, ready] = useTable(tables.user.where((row) => row.role.eq("admin")));
  if (!ready) return undefined;
  return rows;
}

/**
 * Saved config versions, newest first.
 *
 * The admin console is the only surface that wants the history — every player screen
 * reads the one current version through `ConfigProvider` — so subscribing to the whole
 * table is right here and wrong everywhere else.
 */
export function useConfigHistory(limit = 25) {
  const [rows, ready] = useTable(tables.configVersion);

  const [pointers, pointerReady] = useTable(tables.currentConfigVersion);
  const currentId = pointers[0]?.versionId;

  return useMemo(() => {
    if (!ready || !pointerReady) return undefined;

    return [...rows]
      .sort((a, b) =>
        a.createdAt.microsSinceUnixEpoch < b.createdAt.microsSinceUnixEpoch ? 1 : -1,
      )
      .slice(0, limit)
      .map((row) => ({
        versionId: row.id,
        createdAtMs: Number(row.createdAt.microsSinceUnixEpoch / 1_000n),
        // The author's handle needs a user row; the id alone is what the column holds,
        // and the panel falls back to "system" for a version nobody is named on.
        author: row.createdBy,
        note: row.note,
        isCurrent: currentId !== undefined && row.id === currentId,
        // `null` is the shape the editor and the diff both speak: an override that
        // deliberately clears a value, as distinct from one that is absent.
        values: row.values.map((entry) => ({
          key: entry.key,
          value: entry.value ?? null,
        })),
      }));
  }, [ready, rows, limit, pointerReady, currentId]);
}

/** The overrides stored on the current version, as the editor's starting values. */
export function useStoredOverrides() {
  const [pointers, pointerReady] = useTable(tables.currentConfigVersion);
  const versionId = pointers[0]?.versionId;

  const [versions, versionsReady] = useTable(
    tables.configVersion.where((row) => row.id.eq(versionId ?? 0n)),
    { enabled: versionId !== undefined },
  );

  return useMemo(() => {
    if (!pointerReady) return undefined;
    if (versionId === undefined) return {};
    if (!versionsReady) return undefined;

    const version = versions.find((row) => row.id === versionId);
    if (!version) return {};

    const overrides: Record<string, number | null> = {};
    for (const entry of version.values) overrides[entry.key] = entry.value ?? null;
    return overrides;
  }, [pointerReady, versionId, versions, versionsReady]);
}

/**
 * A public profile, by handle.
 *
 * REPLACES `api.users.profile` and `api.matches.card` together. The two were separate
 * because a Convex query paid for everything it returned and only the profile page
 * wanted the per-category breakdown; a subscription is already open on the rows either
 * way, so splitting them here would buy nothing and cost a second shape to keep in step.
 *
 * `avatarUrl` goes through the same hiding rule the module applies. A profile page is
 * exactly the surface a reported picture must not survive on.
 */
export function useProfile(handle: string | undefined) {
  const user = useUserByHandle(handle);
  const record = useMatchRecord(user?.id);
  const ratings = useCategoryRatings(user?.id);
  const badges = useUserBadges(user?.id);
  const entry = useLadderEntry(user?.id);
  const categories = useCategories();

  const [preferences, preferencesReady] = useTable(
    tables.userPreference.where((row) => row.userId.eq(user?.id ?? 0n)),
    { enabled: user != null },
  );

  return useMemo(() => {
    if (handle === undefined) return null;
    if (user === undefined) return undefined;
    if (user === null) return null;
    if (
      ratings === undefined ||
      badges === undefined ||
      entry === undefined ||
      categories === undefined ||
      record === undefined ||
      !preferencesReady
    ) {
      return undefined;
    }

    // Derived here rather than stored, because a tier is a pure function of a rating and
    // storing it would be a second copy that can fall behind the first.
    const rank = rankForElo(user.elo);

    const byId = new Map(categories.map((row) => [row.id, row]));
    const preferredIds = preferences[0]?.preferredCategoryIds ?? [];

    return {
      userId: user.id,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: publicAvatarUrl(user),
      bio: user.bioHidden ? undefined : user.bio,
      elo: user.elo,
      level: user.level,
      xp: user.xp,
      gamesPlayed: user.gamesPlayed,
      placementsRemaining: user.placementsRemaining,
      isBot: user.isBot,
      position: entry?.rank ?? null,
      approximate: entry?.approximate ?? false,
      globalRank: entry?.rank ?? null,
      globalRankApproximate: entry?.approximate ?? false,
      rankTierId: rank.tier.id,
      rankDivision: rank.division,
      rankAccent: rank.tier.accent,
      rankLabel: rank.label,
      wins: record.wins,
      losses: record.losses,
      badges: badges.map((row) => ({ id: row.badgeId, earnedAt: row.earnedAt })),
      /**
       * What they SAY they like, kept distinct from what they are measured to be good
       * at below. Conflating the two would be a lie in both directions.
       */
      preferred: preferredIds
        .map((id) => byId.get(id))
        .filter((row) => row !== undefined)
        .map((row) => ({ slug: row.slug, name: row.name })),
      categories: ratings
        .map((rating) => {
          const category = byId.get(rating.categoryId);
          return category
            ? {
                slug: category.slug,
                name: category.name,
                rating: rating.rating,
                games: rating.games,
              }
            : null;
        })
        .filter((row) => row !== null)
        .sort((a, b) => b.rating - a.rating),
    };
  }, [handle, user, ratings, badges, entry, categories, record, preferences, preferencesReady]);
}

/** Today's headline number for the landing page: how many have played. */
export function useTodayStats() {
  const players = useDailyCount();
  return useMemo(
    () => (players === undefined ? undefined : { players }),
    [players],
  );
}

/**
 * A player's win/loss record across finished matches.
 *
 * `matches.card` counted these server-side; the outcome is denormalised onto
 * `match_player`, so it is a tally over rows the profile already subscribes to.
 */
export function useMatchRecord(userId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.matchPlayer.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );

  return useMemo(() => {
    if (userId === undefined) return { wins: 0, losses: 0, draws: 0 };
    if (!ready) return undefined;

    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const row of rows) {
      if (row.outcome === "win") wins++;
      else if (row.outcome === "loss") losses++;
      else if (row.outcome === "draw") draws++;
    }
    return { wins, losses, draws };
  }, [userId, ready, rows]);
}

/**
 * Everything a live match screen renders, composed from subscriptions.
 *
 * REPLACES `api.matches.state`, which was the largest query in the Convex backend and the
 * one that shaped this whole port. Five screens read it; rebuilding its shape at each
 * would be five chances to disagree about what "the round just played" means, so it stays
 * one shape and moves here.
 *
 * WHAT IT CANNOT DO, AND WHY THAT IS THE POINT. The query decided what the client was
 * allowed to see — it withheld the current track until the reveal beat. A subscription
 * cannot withhold anything, so the module writes the answer progressively instead:
 * `round_reveal` carries only `previewUrl` while guessing is open and gains the title,
 * artist and artwork when it closes. This hook therefore does not choose to hide the
 * track; it renders what has been published, and nothing more has been.
 *
 * The frozen `globalRankAtStart` is read off `match_player` rather than the ladder, for
 * the same reason the query froze it: this recomputes on every guess and every phase
 * change, and touching the ladder here would make one rating change anywhere invalidate
 * every live duel.
 */
export function useMatchState(matchId: bigint | undefined, config: ResolvedConfig) {
  const me = useMe();
  const match = useMatch(matchId);
  const players = useMatchPlayers(matchId);
  const results = useRoundResults(matchId);
  const [users, usersReady] = useTable(tables.user, { enabled: matchId !== undefined });
  const [reveals, revealsReady] = useTable(
    tables.roundReveal.where((row) => row.matchId.eq(matchId ?? 0n)),
    { enabled: matchId !== undefined },
  );
  const [logs, logsReady] = useTable(
    tables.roundLog.where((row) => row.matchId.eq(matchId ?? 0n)),
    { enabled: matchId !== undefined },
  );
  /**
   * The opponent-card extras below need both tables in full, unfiltered like `users`
   * above: `user_badge` and `category_rating` are keyed by userId, not matchId, so
   * there is no server-side filter that narrows to "this match's roster" — the client
   * does that the same way it already does for `users`.
   */
  const [badges, badgesReady] = useTable(tables.userBadge, { enabled: matchId !== undefined });
  const [ratings, ratingsReady] = useTable(tables.categoryRating, {
    enabled: matchId !== undefined,
  });
  const categories = useCategories();

  return useMemo(() => {
    if (matchId === undefined) return null;
    if (match === undefined || players === undefined || results === undefined) {
      return undefined;
    }
    if (!usersReady || !revealsReady || !logsReady) return undefined;
    if (!badgesReady || !ratingsReady || categories === undefined) return undefined;
    if (match === null) return null;

    const byId = new Map(users.map((row) => [row.id, row]));
    const categoryById = new Map(categories.map((row) => [row.id, row]));
    const round = match.currentRound;

    /** The genre a player's rating is highest in — `null` until they have any rated games. */
    const bestCategoryFor = (userId: bigint): string | null => {
      const mine = ratings.filter((row) => row.userId === userId);
      if (mine.length === 0) return null;
      const top = mine.reduce((best, row) => (row.rating > best.rating ? row : best));
      return categoryById.get(top.categoryId)?.name ?? null;
    };

    const revealFor = (index: number) =>
      reveals.find((row) => row.roundIndex === index) ?? null;

    const current = revealFor(round);
    const next = revealFor(round + 1);

    const lastLog = [...logs].sort((a, b) => a.roundIndex - b.roundIndex).at(-1)?.entry;

    const roundStartedAtMs =
      match.roundStartedAt === undefined
        ? null
        : Number(match.roundStartedAt.microsSinceUnixEpoch / 1_000n);

    const roundElapsedMs =
      roundStartedAtMs === null ? 0 : Math.max(0, Date.now() - roundStartedAtMs);

    const forRound = (index: number) =>
      results.filter((row) => row.roundIndex === index);

    const thisRound = forRound(round);

    /** Per-player totals across the match, for the streak and best-time stats. */
    const statsFor = (userId: bigint) => {
      let roundsWon = 0;
      let streak = 0;
      let bestMs: number | null = null;
      let solved = 0;

      for (let index = 0; index <= round; index++) {
        const rows = forRound(index);
        const mine = rows.find((row) => row.userId === userId);
        const points = mine?.solved ? mine.points : 0;
        const others = rows
          .filter((row) => row.userId !== userId)
          .map((row) => (row.solved ? row.points : 0));

        if (mine?.solved) {
          solved++;
          const elapsed = mine.elapsedMs;
          if (elapsed !== undefined && (bestMs === null || elapsed < bestMs)) {
            bestMs = elapsed;
          }
        }

        if (wonRound(points, others)) {
          roundsWon++;
          streak++;
        } else if (others.some((value) => value > points)) {
          streak = 0;
        }
      }

      return { roundsWon, streak, bestMs, solved };
    };

    const scoreboard = players
      .map((player) => {
        const user = byId.get(player.userId);
        // Derived from the rating rather than stored, exactly as the profile does it.
        const rank = rankForElo(user?.elo ?? player.ratingBefore);
        return {
          userId: player.userId,
          rankLabel: rank.label,
          rankTierId: rank.tier.id,
          rankDivision: rank.division,
          rankAccent: rank.tier.accent,
          placementsRemaining: user?.placementsRemaining ?? 0,
          /**
           * The opponent-card extras. `playerCard` resolved these per player on every
           * state read; here they come off rows the screen is already subscribed to, and
           * the record is a tally rather than a query.
           *
           * `losses` is derived rather than stored: the schema keeps `rankedWins` but no
           * `rankedLosses`, so every non-win ranked match is a loss by elimination.
           */
          wins: user?.rankedWins ?? 0,
          losses: user ? Math.max(0, user.gamesPlayed - user.rankedWins) : 0,
          bestCategory: bestCategoryFor(player.userId),
          badges: sortBadges(
            badges.filter((row) => row.userId === player.userId).map((row) => row.badgeId),
          ),
          bio: user?.bioHidden ? undefined : user?.bio,
          handle: user?.handle ?? "player",
          displayName: user?.displayName ?? "Player",
          avatarUrl: user ? publicAvatarUrl(user) : undefined,
          elo: user?.elo ?? player.ratingBefore,
          level: user?.level ?? 1,
          isBot: user?.isBot ?? false,
          globalRank: player.globalRankAtStart ?? null,
          ...statsFor(player.userId),
          totalPoints: player.totalPoints,
          hp: player.hp,
          eliminatedAtRound: player.eliminatedAtRound ?? null,
          passedRound: player.passedRound ?? null,
          ratingBefore: player.ratingBefore,
          ratingAfter: player.ratingAfter ?? null,
          ratingDelta: player.ratingDelta ?? null,
          xpEarned: player.xpEarned,
          xpBreakdown: player.xpBreakdown,
          // Null until the finalize reducer has run. The results screen treats that as
          // "still settling" rather than as a level of zero.
          levelBefore: player.levelBefore ?? null,
          levelAfter: player.levelAfter ?? null,
          xpAfter: player.xpAfter ?? null,
          badgesEarned: player.badgesEarned,
          forfeited: player.forfeited,
          vsReady: player.vsReadyAt !== undefined,
          isMe: me?.id === player.userId,
        };
      })
      /**
       * The viewer first, always.
       *
       * Sorting by HP would swap the duel header's sides the moment the lead changed —
       * your bar on the left while ahead, jumping right when behind, mid-match, with
       * nothing explaining it. A health bar you have to re-find is worse than none.
       */
      .sort((a, b) => Number(b.isMe) - Number(a.isMe));

    return {
      matchId: match.id,
      mode: match.mode,
      status: match.status,
      phase: match.phase,
      phaseEndsAt:
        match.phaseEndsAt === undefined
          ? null
          : Number(match.phaseEndsAt.microsSinceUnixEpoch / 1_000n),
      currentRound: round,
      totalRounds: match.totalRounds,
      /** Derived from the log so it can never disagree with the recorded history. */
      lastRoundDamage: lastLog?.damage ?? [],
      lastRoundOutcome: lastLog?.outcome ?? null,
      lastRoundTimeGapMs: lastLog?.timeGapMs ?? null,
      multiplier: damageMultiplier(round, config),
      nextMultiplier: damageMultiplier(round + 1, config),
      suddenDeath: match.suddenDeath,
      roundStartedAt: roundStartedAtMs,
      roundElapsedMs,
      revealBeat: revealBeatAt(roundElapsedMs, config),
      winnerId: match.winnerId ?? null,
      completedAtMs:
        match.completedAt === undefined
          ? null
          : Number(match.completedAt.microsSinceUnixEpoch / 1_000n),
      bannedCategoryIds: match.bannedCategoryIds,
      vetoPoolIds: match.vetoPoolIds,
      banOrder: match.banOrder,
      banTurn: match.banTurn,
      vetoDeadline:
        match.vetoDeadline === undefined
          ? null
          : Number(match.vetoDeadline.microsSinceUnixEpoch / 1_000n),

      /** Audio is published when the round opens; the title only when it closes. */
      currentAudioUrl: current?.previewUrl ?? null,
      /**
       * The next round's clip, so the client can buffer before the countdown. Without it
       * the client first learns the URL when the countdown starts and has 3s for ~1MB.
       */
      nextAudioUrl: next?.previewUrl ?? null,
      currentTrack:
        current?.title !== undefined
          ? {
              title: current.title,
              artist: current.artist ?? "",
              artworkUrl: current.artworkUrl ?? "",
              categoryName: current.categoryName ?? null,
            }
          : null,

      /** Per-player results for the round just played, for the head-to-head reveal. */
      roundResults: players.map((player) => {
        const row = thisRound.find((entry) => entry.userId === player.userId);
        return {
          userId: player.userId,
          solved: row?.solved ?? false,
          elapsedMs: row?.elapsedMs ?? null,
          points: row?.solved ? row.points : 0,
        };
      }),

      /** Who took the round just played, for the standings callout. */
      roundWinnerId: (() => {
        const scored = players
          .map((player) => {
            const row = thisRound.find((entry) => entry.userId === player.userId);
            return { userId: player.userId, points: row?.solved ? row.points : 0 };
          })
          .sort((a, b) => b.points - a.points);
        if (scored.length === 0 || scored[0].points === 0) return null;
        if (scored[1] && scored[1].points === scored[0].points) return null;
        return scored[0].userId;
      })(),

      scoreboard,

      /**
       * Matchup framing for the VS screen. Qualitative only — the projected rating swing
       * is withheld until match_end so the reward is not spent before the match starts.
       */
      matchup:
        match.mode === "ranked" && me && scoreboard.length === 2
          ? matchupLabel(scoreboard[0].elo, scoreboard[1].elo)
          : null,
    };
  }, [
    matchId, match, players, results, users, usersReady,
    reveals, revealsReady, logs, logsReady, me, config,
    badges, badgesReady, ratings, ratingsReady, categories,
  ]);
}

/** Bans placed across the whole draft, both players combined. Mirrors the module. */
const TOTAL_BANS = VETO_BANS_PER_PLAYER * 2;

/**
 * The ban draft: the pool, whose turn it is, and who you are drafting against.
 *
 * REPLACES `api.ranked.draftState`. Everything it needs is on the match row — the pool,
 * the bans placed, the turn order and the deadline — so this resolves category names and
 * the opponent and does the turn arithmetic the module does, from the same fields.
 *
 * The opponent is NAMED rather than called "your opponent": watching a specific player
 * take away country is a read on who you are about to play, which is the point of a draft.
 */
export function useDraftState(matchId: bigint | undefined) {
  const me = useMe();
  const match = useMatch(matchId);
  const categories = useCategories();
  const [users, usersReady] = useTable(tables.user, { enabled: matchId !== undefined });

  return useMemo(() => {
    if (matchId === undefined) return null;
    if (match === undefined || categories === undefined || me === undefined) {
      return undefined;
    }
    if (!usersReady) return undefined;
    if (match === null || me === null) return null;

    const byId = new Map(categories.map((row) => [row.id, row]));
    const banned = new Set(match.bannedCategoryIds);

    const opponentId = match.playerIds.find((id) => id !== me.id);
    const opponent = opponentId === undefined ? null : users.find((row) => row.id === opponentId);

    /**
     * Whose turn it is. The order alternates through `banOrder`, wrapping for the second
     * round of bans — the same arithmetic `draftTurnOwner` does in the module, because
     * two copies of a turn rule is how a draft starts disagreeing with itself.
     */
    const turnOwner =
      match.banOrder.length === 0 || match.banTurn >= TOTAL_BANS
        ? undefined
        : match.banOrder[match.banTurn % match.banOrder.length];

    return {
      pool: match.vetoPoolIds
        .map((id) => byId.get(id))
        .filter((row) => row !== undefined)
        .map((row) => ({ id: row.id, name: row.name, banned: banned.has(row.id) })),
      bansPlaced: match.banTurn,
      totalBans: TOTAL_BANS,
      isMyTurn: turnOwner === me.id,
      deadline:
        match.vetoDeadline === undefined
          ? null
          : Number(match.vetoDeadline.microsSinceUnixEpoch / 1_000n),
      opponent: opponent
        ? {
            displayName: opponent.displayName,
            handle: opponent.handle,
            avatarUrl: publicAvatarUrl(opponent) ?? null,
            elo: opponent.elo,
            isBot: opponent.isBot,
          }
        : null,
    };
  }, [matchId, match, categories, me, users, usersReady]);
}

/**
 * The round-by-round timeline of a finished match.
 *
 * REPLACES `api.matches.summary`. The module already writes a `round_log` row per round
 * carrying the outcome, the winner, the time gap, the multiplier and the per-player
 * damage and points — the query assembled the same thing from guesses on every read, so
 * this is the cheaper half of the same shape.
 */
export function useMatchSummary(matchId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.roundLog.where((row) => row.matchId.eq(matchId ?? 0n)),
    { enabled: matchId !== undefined },
  );
  const [reveals, revealsReady] = useTable(
    tables.roundReveal.where((row) => row.matchId.eq(matchId ?? 0n)),
    { enabled: matchId !== undefined },
  );

  return useMemo(() => {
    if (matchId === undefined) return null;
    if (!ready || !revealsReady) return undefined;

    const rounds = [...rows]
      .sort((a, b) => a.roundIndex - b.roundIndex)
      .map((row) => {
        // The track is safe to name here: every round in the log has closed, so its
        // reveal row already carries the answer.
        const reveal = reveals.find((entry) => entry.roundIndex === row.roundIndex);

        return {
          roundIndex: row.entry.roundIndex,
          outcome: row.entry.outcome,
          winnerId: row.entry.winnerId ?? null,
          timeGapMs: row.entry.timeGapMs ?? null,
          multiplier: row.entry.multiplier,
          damage: row.entry.damage,
          results: row.entry.results,
          track:
            reveal?.title === undefined
              ? null
              : {
                  title: reveal.title,
                  artist: reveal.artist ?? "",
                  artworkUrl: reveal.artworkUrl ?? "",
                },
        };
      });

    /** The quickest solve of the match, across everyone who solved anything. */
    let fastest: { roundIndex: number; elapsedMs: number } | null = null;
    for (const round of rounds) {
      for (const result of round.results) {
        if (!result.solved || result.elapsedMs === undefined) continue;
        if (fastest === null || result.elapsedMs < fastest.elapsedMs) {
          fastest = { roundIndex: round.roundIndex, elapsedMs: result.elapsedMs };
        }
      }
    }

    /** The single heaviest hit anyone took. */
    let costliest: { roundIndex: number; damage: number } | null = null;
    for (const round of rounds) {
      for (const hit of round.damage) {
        if (hit.damage <= 0) continue;
        if (costliest === null || hit.damage > costliest.damage) {
          costliest = { roundIndex: round.roundIndex, damage: Math.round(hit.damage) };
        }
      }
    }

    return { rounds, fastest, costliest };
  }, [matchId, ready, rows, reveals, revealsReady]);
}

/**
 * Whether the caller is searching, and how many others are.
 *
 * REPLACES `api.ranked.myQueueEntry` and `api.ranked.queueSize` together, because one
 * panel read both. `queue_entry` is private — the rows carry every waiting player's
 * rating — so this comes through a view that publishes the two facts and nothing that
 * identifies anyone.
 */
export function useQueueStatus() {
  const [rows, ready] = useTable(tables.myQueueStatus);
  if (!ready) return undefined;
  const row = rows[0];
  return {
    queued: row?.queued ?? false,
    enqueuedAtMs:
      row?.enqueuedAt === undefined
        ? null
        : Number(row.enqueuedAt.microsSinceUnixEpoch / 1_000n),
    playersWaiting: row?.playersWaiting ?? 0,
  };
}

/**
 * Which practice bots this player has ever beaten.
 *
 * REPLACES `api.bots.beaten`, which scanned match rows server-side. The outcome and the
 * opponent are denormalised onto `match_player`, so it is a set built from rows the
 * roster already subscribes to.
 *
 * A SET, not a tally: the roster reads as a collection to complete — "4 / 12" — and one
 * bit per bot is the honest claim.
 */
export function useBeatenBots(userId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.matchPlayer.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );

  return useMemo(() => {
    if (userId === undefined) return new Set<bigint>();
    if (!ready) return undefined;

    const beaten = new Set<bigint>();
    for (const row of rows) {
      if (row.outcome !== "win") continue;
      if (row.opponentId !== undefined) beaten.add(row.opponentId);
    }
    return beaten;
  }, [userId, ready, rows]);
}

/**
 * A player's rooms, most recent first.
 *
 * REPLACES `api.rooms.recent`, which scanned match history for room memberships. `room`
 * is public and small, so membership is a filter over rows the lobby already holds.
 */
export function useMyRooms(userId: bigint | undefined, limit = 5) {
  const [rows, ready] = useTable(tables.room, { enabled: userId !== undefined });

  return useMemo(() => {
    if (userId === undefined) return [];
    if (!ready) return undefined;

    return [...rows]
      .filter((row) => row.status !== "closed" && row.memberIds.includes(userId))
      .sort((a, b) =>
        a.createdAt.microsSinceUnixEpoch < b.createdAt.microsSinceUnixEpoch ? 1 : -1,
      )
      .slice(0, limit)
      .map((row) => ({
        ...row,
        roomId: row.id,
        memberCount: row.memberIds.length,
        /**
         * When the room was made, not when it last played. `rooms.recent` derived a
         * last-played time by scanning match history; the lobby only orders and dates
         * the list with it, and creation time orders it identically for a room that has
         * not been reused.
         */
        lastPlayedAt: Number(row.createdAt.microsSinceUnixEpoch / 1_000n),
      }));
  }, [userId, ready, rows, limit]);
}

/** Players by handle, for the practice roster's fixed cast of personas. */
export function useUsersByHandles(handles: readonly string[]) {
  const [rows, ready] = useTable(tables.user);

  return useMemo(() => {
    if (!ready) return undefined;
    const wanted = new Set(handles);
    const found = new Map<bigint, (typeof rows)[number]>();
    for (const row of rows) if (wanted.has(row.handle)) found.set(row.id, row);
    return found;
  }, [ready, rows, handles]);
}

/** How many practice matches this player has finished. */
export function usePracticeCount(userId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.matchPlayer.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );

  return useMemo(() => {
    if (userId === undefined) return 0;
    if (!ready) return undefined;
    return rows.filter(
      (row) => row.mode === "practice" && row.completedAt !== undefined,
    ).length;
  }, [userId, ready, rows]);
}

/**
 * A room and the people in it, by code.
 *
 * REPLACES `api.rooms.state`, which denormalised every member's handle into its result
 * because a query returns one payload. `room` and `user` are both public, so the lobby
 * composes the roster from rows it already holds.
 */
export function useRoomState(code: string | undefined) {
  const me = useMe();
  const room = useRoomByCode(code);
  const [users, usersReady] = useTable(tables.user, { enabled: code !== undefined });

  return useMemo(() => {
    if (code === undefined) return null;
    if (room === undefined || me === undefined) return undefined;
    if (!usersReady) return undefined;
    if (room === null) return null;

    const byId = new Map(users.map((row) => [row.id, row]));

    const memberCount = room.memberIds.length;
    const readyCount = room.readyIds.filter((id) => room.memberIds.includes(id)).length;

    return {
      roomId: room.id,
      code: room.code,
      /** Everyone present has said yes. A signal to the host, not a lock on the door. */
      allReady: memberCount > 0 && readyCount === memberCount,
      /** Enough people, and not already playing. Readiness deliberately does not gate. */
      canStart: memberCount >= ROOM_MIN_PLAYERS && room.status === "lobby",
      status: room.status,
      hostId: room.hostId,
      activeMatchId: room.activeMatchId ?? null,
      isHost: me?.id === room.hostId,
      isMember: me !== null && room.memberIds.includes(me.id),
      maxPlayers: ROOM_MAX_PLAYERS,
      minPlayers: ROOM_MIN_PLAYERS,
      members: room.memberIds.map((id) => {
        const user = byId.get(id);
        // Derived from the rating, as everywhere else — a tier is a pure function of it.
        const rank = rankForElo(user?.elo ?? 0);
        return {
          userId: id,
          handle: user?.handle ?? "player",
          displayName: user?.displayName ?? "Player",
          avatarUrl: user ? publicAvatarUrl(user) : undefined,
          elo: user?.elo ?? 0,
          level: user?.level ?? 1,
          placementsRemaining: user?.placementsRemaining ?? 0,
          rankLabel: rank.label,
          rankTierId: rank.tier.id,
          rankDivision: rank.division,
          rankAccent: rank.tier.accent,
          isBot: user?.isBot ?? false,
          isHost: id === room.hostId,
          ready: room.readyIds.includes(id),
          isReady: room.readyIds.includes(id),
          isMe: me?.id === id,
        };
      }),
    };
  }, [code, room, me, users, usersReady]);
}

/**
 * This player's unfinished daily match, if there is one.
 *
 * REPLACES `api.daily.activeRun`. `startDaily` resumes rather than restarts, so the
 * client no longer needs this to decide what pressing Play does — but the page still
 * wants to know which match to mount once it has one.
 */
export function useActiveDailyMatch(userId: bigint | undefined, date = todayKey()) {
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
        match.mode === "daily" &&
        match.status === "active" &&
        todayKey(Number(match.createdAt.microsSinceUnixEpoch / 1_000n)) === date,
    );

    return live[0] ?? null;
  }, [userId, memberships, membershipsReady, matches, matchesReady, date]);
}

/**
 * This player's run for a date, with the placing it earned.
 *
 * `daily.myRun` returned a rank and a denominator because it could count the day's rows
 * server-side. The board on this page subscribes to those rows anyway, so the placing is
 * a position in a list the screen already holds — which is why the dashboard card, which
 * holds no such list, does without it.
 */
export function useMyDailyPlacing(userId: bigint | undefined, date = todayKey()) {
  const [rows, ready] = useTable(tables.dailyRun.where((row) => row.date.eq(date)));
  /**
   * `daily_run` has no `xpEarned` column — the port wrote the payout onto
   * `match_player`, keyed by match rather than by day, so it takes a join to find:
   * the daily match for this date, then this player's row on it.
   */
  const [memberships, membershipsReady] = useTable(
    tables.matchPlayer.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );
  const [matches, matchesReady] = useTable(tables.match, { enabled: userId !== undefined });

  return useMemo(() => {
    if (userId === undefined) return null;
    if (!ready) return undefined;

    const mine = rows.find((row) => row.userId === userId);
    if (!mine) return null;

    /**
     * The board excludes guests because they have no handle to list — that is a
     * board-MEMBERSHIP rule, not proof a guest has no placing. Ranking every non-guest
     * row plus the caller's own gives a guest a real position among the field they
     * would be shown alongside, rather than the `rank: 0` this used to return for them
     * (dropped by the `!row.isGuest` filter, then never found in the ranked list at
     * all) — which `DailyResult` printed as "Rank 0 of N today" and `ordinal(0)` turned
     * into "0th", including in the text a guest would share.
     */
    const ranked = rows
      .filter((row) => !row.isGuest || row.userId === userId)
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const index = ranked.findIndex((row) => row.userId === userId);

    /**
     * `null` for a guest — `applyProgression` never pays them XP, so their row's
     * figure is a real zero, not "none earned", and the results screen distinguishes
     * that from a signed-in player's payout by not printing a line at all — and
     * `null` until progression has settled, the same signal `useMatchHistory` reads
     * off this same `completedAt` for the duel results screen.
     */
    let xpEarned: number | null = null;
    if (!mine.isGuest && membershipsReady && matchesReady) {
      const finished = memberships.find((player) => {
        if (player.mode !== "daily" || player.completedAt === undefined) return false;
        const match = matches.find((row) => row.id === player.matchId);
        return (
          match !== undefined &&
          todayKey(Number(match.createdAt.microsSinceUnixEpoch / 1_000n)) === date
        );
      });
      if (finished) xpEarned = finished.xpEarned;
    }

    return {
      ...mine,
      rank: index + 1,
      totalPlayers: ranked.length,
      xpEarned,
    };
  }, [userId, ready, rows, date, memberships, membershipsReady, matches, matchesReady]);
}

/**
 * Whether a handle is free, and why not when it isn't.
 *
 * REPLACES `api.users.isHandleAvailable`, which took the candidate as an argument. A
 * view has no arguments, so the candidate is WRITTEN first — `probeHandle` records what
 * the caller is asking about — and `my_handle_probe` answers it. That indirection is
 * what lets the answer stay per-viewer without publishing anyone's attempts.
 */
export function useHandleProbe(candidate: string) {
  const probe = useStdbReducerForProbe();
  const [rows, ready] = useTable(tables.myHandleProbe);

  useEffect(() => {
    const trimmed = candidate.trim().toLowerCase();
    if (trimmed.length === 0) return;

    // Debounced: this fires per keystroke, and each call is a write.
    const id = setTimeout(() => void probe({ candidate: trimmed }).catch(() => {}), 250);
    return () => clearTimeout(id);
  }, [candidate, probe]);

  if (!ready) return undefined;

  const row = rows[0];
  if (!row) return undefined;
  // A stale answer is worse than none: it would show the previous candidate's verdict
  // against the text now in the box.
  if (row.handle !== candidate.trim().toLowerCase()) return undefined;

  return { available: row.available, reason: row.reason };
}

function useStdbReducerForProbe() {
  return useReducer(reducers.probeHandle);
}

/** The one track the welcome tutorial teaches on. A view, because `track` is private. */
export function useTutorialTrack() {
  const [rows, ready] = useTable(tables.tutorialTrack);
  if (!ready) return undefined;
  return rows[0] ?? null;
}

/** The genres this player said they liked. Their own row, so their own preference. */
export function useMyPreferences(userId: bigint | undefined) {
  const [rows, ready] = useTable(
    tables.userPreference.where((row) => row.userId.eq(userId ?? 0n)),
    { enabled: userId !== undefined },
  );
  if (userId === undefined) return [];
  if (!ready) return undefined;
  return rows[0]?.preferredCategoryIds ?? [];
}
