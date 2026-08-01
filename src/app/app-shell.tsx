"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "./auth-gate";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { rankForElo } from "@/engine/ranks";
import { levelForXp } from "@/engine/xp";
import { RankEmblem } from "@/ui/RankEmblem";
import { Button } from "@/ui/Button";
import { Glyph, type GlyphName } from "@/ui/Glyph";
import { useImmersiveState } from "./immersive";
import { clearGuestToken, getGuestToken } from "./guest";
import {
  getMuteServerSnapshot,
  getMuteSnapshot,
  setMuted,
  subscribeMute,
} from "@/audio/sfx";

/**
 * The application shell.
 *
 * Sidebar from `lg` up, bottom tab bar below it. Same four destinations and the same
 * four routes as the header it replaces — this is chrome, not information architecture.
 *
 * Both disappear during a match: the arena wants the whole screen, and a navigation bar
 * within thumb reach of the guess field is a way to lose a round by accident.
 */

const NAV: { href: string; label: string; glyph: GlyphName }[] = [
  { href: "/daily", label: "Daily", glyph: "song" },
  { href: "/ranked", label: "Ranked", glyph: "rank" },
  { href: "/rooms", label: "Rooms", glyph: "timer" },
  { href: "/leaderboard", label: "Board", glyph: "win" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const immersive = useImmersiveState();

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {!immersive && <Sidebar />}

      <main
        className={`min-w-0 flex-1 ${
          // Clears the fixed tab bar. Only needed when the tab bar is actually there.
          immersive ? "" : "pb-20 lg:pb-0"
        }`}
      >
        {children}
      </main>

      {!immersive && <TabBar />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop                                                                     */
/* -------------------------------------------------------------------------- */

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-ink-900 border-line sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r lg:flex">
      <div className="p-5">
        <Wordmark />
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`text-body flex items-center gap-3 rounded-sm px-3 py-2.5 font-medium transition-colors ${
                active
                  ? "bg-ink-600 text-paper"
                  : "text-secondary hover:bg-ink-700 hover:text-paper"
              }`}
            >
              <span className="text-lg">
                <Glyph name={item.glyph} filled={active && item.glyph === "win"} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="border-line flex flex-col gap-3 border-t p-4">
        <SignedIn>
          <RankBlock />
          <div className="flex items-center justify-between">
            <UserButton />
            <div className="flex items-center gap-1">
              <Link
                href="/settings"
                aria-label="Settings"
                title="Settings"
                className="text-muted hover:text-paper rounded-xs p-1 text-xl transition-colors"
              >
                <Glyph name="settings" />
              </Link>
              <MuteToggle />
            </div>
          </div>
        </SignedIn>

        <SignedOut>
          <MuteToggle />
          <SignInButton mode="modal">
            <Button block>Sign in</Button>
          </SignInButton>
        </SignedOut>
      </div>
    </aside>
  );
}

/**
 * Persistent standing.
 *
 * Your rank is visible on every page, which is what makes a ladder feel like a ladder
 * rather than a screen you visit.
 *
 * Shows rating, level and placement progress — every value straight off the existing
 * `users.me` query. Deliberately no win/loss record: the user row carries `rankedWins`
 * and `gamesPlayed`, but `gamesPlayed` counts daily and room matches too, so a losses
 * figure derived by subtraction would be wrong. Better to omit a stat than invent one.
 */
function RankBlock() {
  const me = useQuery(api.users.me, {});
  if (!me) return null;

  const rank = rankForElo(me.elo);
  const level = levelForXp(me.xp ?? 0);
  const placing = me.placementsRemaining > 0;

  return (
    // The rank block is the natural way into your own profile — it is already the thing
    // on screen representing you.
    <Link
      href={`/u/${me.handle}`}
      className="hover:bg-ink-700 -mx-2 flex items-center gap-3 rounded-sm px-2 py-1.5 transition-colors"
    >
      <RankEmblem
        accent={rank.tier.accent}
        divisions={rank.tier.divisions > 1 ? rank.division : 1}
        size="md"
      />
      <div className="flex min-w-0 flex-col">
        <span
          className="font-display text-body truncate font-bold"
          style={{ color: rank.tier.accent }}
        >
          {placing ? "Unranked" : rank.label}
        </span>
        <span className="text-label text-muted tabular-nums">
          {placing
            ? `${me.placementsRemaining} placement${me.placementsRemaining === 1 ? "" : "s"} left`
            : `${me.elo} · L${level.level}`}
        </span>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile                                                                      */
/* -------------------------------------------------------------------------- */

function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="bg-ink-900 border-line fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            // min-h-14 keeps every tab above the 44px touch target.
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 ${
              active ? "text-paper" : "text-muted"
            }`}
          >
            <span className="text-xl">
              <Glyph name={item.glyph} filled={active && item.glyph === "win"} />
            </span>
            <span className="text-label font-semibold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Top bar on mobile only — the sidebar carries this on desktop. */
export function MobileTopBar() {
  const immersive = useImmersiveState();
  if (immersive) return null;

  return (
    <header className="border-line flex items-center justify-between border-b px-4 py-3 lg:hidden">
      <Wordmark />
      <div className="flex items-center gap-3">
        <MuteToggle />
        <SignedIn>
          {/* Mobile has no sidebar, so this is the only route to settings on a phone. */}
          <Link
            href="/settings"
            aria-label="Settings"
            className="text-muted hover:text-paper rounded-xs p-1 text-xl transition-colors"
          >
            <Glyph name="settings" />
          </Link>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button size="sm">Sign in</Button>
          </SignInButton>
        </SignedOut>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      {/* The mark is the same chamfered geometry as the rank emblem — the app's only
          sharp shapes, so the logo and the trophy read as one family. */}
      <span
        className="bg-paper inline-block size-5"
        style={{ clipPath: "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)" }}
        aria-hidden="true"
      />
      <span className="font-display text-paper text-xl font-extrabold tracking-tight">
        SNAP
      </span>
    </Link>
  );
}

/**
 * Also performs first-sign-in provisioning: Clerk owns identity, but the game needs
 * its own user row for rating and history, and this is the first client render where
 * we know who the player is.
 *
 * Moved verbatim from the old SiteHeader — the effect, its dependencies and its guard
 * conditions are unchanged.
 */
function Provisioner() {
  const { user, isLoaded } = useUser();
  const me = useQuery(api.users.me, {});
  const ensureUser = useMutation(api.users.ensureUser);
  const claimGuestRun = useMutation(api.daily.claimGuestRun);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (me !== null) return; // already provisioned, or still loading

    void ensureUser({
      displayName: user.username ?? user.firstName ?? "Player",
      avatarUrl: user.imageUrl,
    });
  }, [isLoaded, user, me, ensureUser]);

  /**
   * Carries an anonymous daily run onto the account that just signed in.
   *
   * Runs once the user row exists, because the claim re-points the run at it. Safe to
   * fire more than once — the mutation is idempotent — but the token is cleared on
   * success so it normally happens exactly once per browser.
   */
  useEffect(() => {
    if (!me) return;
    const token = getGuestToken();
    if (!token) return;

    void claimGuestRun({ guestToken: token }).then(clearGuestToken);
  }, [me, claimGuestRun]);

  return null;
}

/** Mounted once at the root so provisioning does not depend on which chrome is visible. */
export function UserProvisioner() {
  return (
    <SignedIn>
      <Provisioner />
    </SignedIn>
  );
}

/** Persisted mute toggle. A music game that can't be silenced is one nobody keeps open. */
function MuteToggle() {
  // Subscribed rather than copied into state: the preference lives in the sfx
  // module and is shared by every surface that plays a sound.
  const muted = useSyncExternalStore(subscribeMute, getMuteSnapshot, getMuteServerSnapshot);

  return (
    <button
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      aria-pressed={muted}
      className="text-muted hover:text-paper rounded-xs p-1 text-xl transition-colors"
    >
      <Glyph name={muted ? "mute" : "sound"} />
    </button>
  );
}
