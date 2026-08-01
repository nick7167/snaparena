"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "./auth-gate";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { api } from "../../convex/_generated/api";
import { rankForElo } from "@/engine/ranks";
import { levelForXp } from "@/engine/xp";
import { RankBadge } from "@/game/ui";
import {
  getMuteServerSnapshot,
  getMuteSnapshot,
  setMuted,
  subscribeMute,
} from "@/audio/sfx";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <Link href="/" className="font-semibold tracking-tight">
        Song Race
      </Link>

      <nav className="flex items-center gap-4 text-sm text-white/70">
        <Link href="/daily" className="hover:text-white">Daily</Link>
        <Link href="/ranked" className="hover:text-white">Ranked</Link>
        <Link href="/rooms" className="hover:text-white">Rooms</Link>
        <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>

        <SignedOut>
          <SignInButton mode="modal">
            <button className="rounded bg-white px-3 py-1.5 font-medium text-black">
              Sign in
            </button>
          </SignInButton>
        </SignedOut>

        <MuteToggle />

        <SignedIn>
          <RatingBadge />
          <UserButton />
        </SignedIn>
      </nav>
    </header>
  );
}

/**
 * Also performs first-sign-in provisioning: Clerk owns identity, but the game needs
 * its own user row for rating and history, and this is the first client render where
 * we know who the player is.
 */
function RatingBadge() {
  const { user, isLoaded } = useUser();
  const me = useQuery(api.users.me, {});
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (me !== null) return; // already provisioned, or still loading

    void ensureUser({
      displayName: user.username ?? user.firstName ?? "Player",
      avatarUrl: user.imageUrl,
    });
  }, [isLoaded, user, me, ensureUser]);

  if (!me) return null;

  const rank = rankForElo(me.elo);
  const level = levelForXp(me.xp ?? 0);

  return (
    <span className="flex items-center gap-2">
      <span className="hidden text-xs text-white/40 sm:inline">L{level.level}</span>
      <RankBadge
        label={rank.label}
        accent={rank.tier.accent}
        placements={me.placementsRemaining}
        size="sm"
      />
    </span>
  );
}

/** Persisted mute toggle. A music game that can't be silenced is one nobody keeps open. */
function MuteToggle() {
  // Subscribed rather than copied into state: the preference lives in the sfx
  // module and is shared by every surface that plays a sound.
  const muted = useSyncExternalStore(
    subscribeMute,
    getMuteSnapshot,
    getMuteServerSnapshot,
  );

  return (
    <button
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      className="text-white/40 transition hover:text-white"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
