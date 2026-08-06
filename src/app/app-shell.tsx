"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "./auth-gate";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { rankForElo } from "@/engine/ranks";
import { levelForXp } from "@/engine/xp";
import { RankEmblem } from "@/ui/RankEmblem";
import { ButtonLink } from "@/ui/Button";
import { Glyph, type GlyphName } from "@/ui/Glyph";
import { AuthDialogButton } from "@/auth/AuthDialogButton";
import { Menu, MenuItem, MenuSeparator } from "@/ui/Menu";
import { Meter } from "@/ui/Surface";
import { useImmersiveState } from "./immersive";
import { QueueProvider, useQueue } from "./queue-driver";
import { recordVisit } from "./nav-history";
import { installAudioUnlock } from "@/audio/unlock";
import { clearGuestToken, getGuestToken } from "./guest";
import {
  getMuteServerSnapshot,
  getMuteSnapshot,
  setMuted,
  subscribeMute,
} from "@/audio/sfx";
import { MuteToggle } from "@/ui/MuteToggle";
import { snap } from "@/ui/motion";
import { track } from "@/analytics";
import {
  getSidebarCollapsedServerSnapshot,
  getSidebarCollapsedSnapshot,
  setSidebarCollapsed,
  subscribeSidebarCollapsed,
} from "@/ui/sidebar-collapsed";

/**
 * The application shell.
 *
 * Sidebar from `lg` up, bottom tab bar below it. This is chrome, not information
 * architecture.
 *
 * They behave differently during a match, and the asymmetry is the point. The tab bar goes:
 * it sits within thumb reach of the guess field, so leaving it up is a way to walk out of a
 * rated duel by accident. The sidebar stays: it is nowhere near anything you tap mid-round,
 * and taking it away only cost people their way around — most visibly on the ban draft,
 * which never opted into immersive mode and so flashed the whole chrome back mid-match.
 * The sidebar collapses to a rail on request instead, and remembers.
 */

type NavItem = {
  href: string;
  label: string;
  glyph: GlyphName;
  /**
   * Used by the tab bar in place of `label`, where a 59px column has to hold a word.
   * "Home" is right for a sidebar row; on a phone the same destination reads better as
   * "Me", because what is actually there is your rank, your streak and your last result.
   */
  shortLabel?: string;
};

/**
 * The nav, in two groups.
 *
 * Ways to duel above the rule, everything else below it. The split is the point: five
 * flat rows made Daily — a solo mode against a fixed puzzle — sit in the same list as
 * the three modes where you play a person, and nothing on screen said they were
 * different kinds of thing.
 *
 * Home leads, and used to be absent entirely: the dashboard was reachable only by
 * clicking the wordmark, which is a convention people know but not one anything on the
 * screen advertises. It sits above the rule because it is not a mode.
 */
const NAV_MODES: NavItem[] = [
  { href: "/", label: "Home", glyph: "user", shortLabel: "Me" },
  { href: "/ranked", label: "Ranked", glyph: "rank" },
  { href: "/rooms", label: "Rooms", glyph: "timer" },
  { href: "/practice", label: "Practice", glyph: "bot" },
];

const NAV_MORE: NavItem[] = [
  { href: "/daily", label: "Daily", glyph: "song" },
  { href: "/leaderboard", label: "Board", glyph: "win" },
];

/** Every destination, for anything that wants the flat list. */
const NAV: NavItem[] = [...NAV_MODES, ...NAV_MORE];

/**
 * The mobile tab bar, with a hole in the middle for the Play button.
 *
 * Two either side of the raised centre control. Ranked and Practice are both absent
 * because Play now offers them — listing a mode twice would make the big gold button look
 * like a shortcut to something ordinary rather than the primary action.
 *
 * Me leads, on the left, where a thumb reaches first.
 *
 * Written out rather than filtered from NAV: a filter takes its order from whatever order
 * NAV happens to be in, so regrouping the sidebar would silently reshuffle the tab bar.
 */
const byHref = (href: string): NavItem => {
  const item = NAV.find((candidate) => candidate.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item;
};

const TABS_LEFT: NavItem[] = [byHref("/"), byHref("/daily")];
const TABS_RIGHT: NavItem[] = [byHref("/rooms"), byHref("/leaderboard")];

export function AppShell({ children }: { children: ReactNode }) {
  const immersive = useImmersiveState();

  return (
    // QueueProvider wraps everything, including the chrome: the Play button reports the
    // search and the pages read it, so both have to be inside. Mounted here for the same
    // reason NavRecorder is — the shell is the only thing on every route.
    <QueueProvider>
      <div className="flex min-h-full flex-col lg:flex-row">
        <NavRecorder />
        <AudioUnlock />
        {/*
         * Unconditional, unlike the two mobile bars below.
         *
         * Immersive mode used to take this away for the duration of a match, which made
         * the ban draft — the one match screen that never opted in — flicker the whole
         * chrome back for fifteen seconds and then lose it again. On a desktop there is
         * nothing to protect: the sidebar is nowhere near the guess field, and hiding it
         * only cost people their way around. It collapses to a rail on request instead.
         */}
        <Sidebar />

        <main
          className={`min-w-0 flex-1 ${
            // Clears the fixed tab bar. Only needed when the tab bar is actually there.
            immersive ? "" : "pb-20 lg:pb-0"
          }`}
        >
          {children}
        </main>

        {/* The tab bar still goes. It sits directly under the guess field on a phone, so
            leaving it up means a mis-tap mid-round walks out of a rated duel. */}
        {!immersive && <TabBar />}
      </div>
    </QueueProvider>
  );
}

/**
 * Records every route change so the back control on sub-pages knows where you came from.
 *
 * Mounted in the shell rather than in PageHeader: the header only exists on the pages
 * that HAVE a way back, so if it did the recording it would never see the ladder or the
 * home page — the two routes people most often arrive from.
 *
 * Renders nothing, and runs in an effect so it never touches storage during render.
 */
function NavRecorder() {
  const pathname = usePathname();

  useEffect(() => {
    recordVisit(pathname);
  }, [pathname]);

  return null;
}

/**
 * Turns every tap in the app into an audio unlock.
 *
 * Here for the same reason NavRecorder is: the shell is the only thing on every route, and
 * the unlock has to be listening before the first gesture — which on the ranked path is
 * the queue button, long before any audio code has mounted. Renders nothing.
 */
function AudioUnlock() {
  useEffect(() => installAudioUnlock(), []);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Desktop                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The desktop navigation.
 *
 * Present on every screen, matches included. It used to unmount for the duration of a
 * duel, which made the ban draft — the one match screen that never opted into that —
 * flicker the chrome back for fifteen seconds and then lose it again.
 *
 * Getting out of the way is the player's call rather than the app's, so it collapses to a
 * rail of glyphs and stays however it was left. The mobile tab bar still hides itself
 * during a match, and that asymmetry is deliberate: it sits directly under the guess
 * field, where a mis-tap costs a rated duel. A sidebar has no thumb zone to intrude on.
 */
function Sidebar() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  );

  return (
    <aside
      className={`bg-ink-900 border-line sticky top-0 hidden h-dvh shrink-0 flex-col border-r
                  transition-[width] lg:flex ${collapsed ? "w-16" : "w-60"}`}
    >
      <div
        className={`flex items-center pt-6 pb-5 ${
          collapsed ? "justify-center px-2" : "justify-between px-5"
        }`}
      >
        {collapsed ? <Wordmark size="mark" /> : <Wordmark size="brand" />}
        {!collapsed && <CollapseToggle collapsed={collapsed} />}
      </div>

      {collapsed && (
        <div className="flex justify-center pb-2">
          <CollapseToggle collapsed={collapsed} />
        </div>
      )}

      <nav
        aria-label="Main"
        className={`flex flex-col gap-1 ${collapsed ? "px-2" : "px-3"}`}
      >
        {NAV_MODES.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}

        {/* Same hairline as MenuSeparator. Decorative, so `line` rather than
            `line-strong` — it groups, it does not divide. */}
        <div role="separator" className="bg-line my-2 h-px" />

        {NAV_MORE.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>

      <div className="flex-1" />

      {/*
       * Play sits at the bottom, directly above progression and identity, rather than at
       * the top under the wordmark. The nav is a list of places; this is the thing you
       * came to do, and it belongs in the corner your hand already rests in — next to the
       * account menu, above the level bar it fills.
       */}
      <div className={`flex flex-col gap-3 pb-0 ${collapsed ? "items-center p-2" : "p-4"}`}>
        {collapsed ? (
          // The rail keeps Play. It is the primary action, and a collapse that costs you
          // the thing you came for is a collapse nobody uses twice.
          <>
            <SignedIn>
              <RailPlayButton href="/ranked" />
            </SignedIn>
            <SignedOut>
              <RailPlayButton href="/daily" />
            </SignedOut>
          </>
        ) : (
          <>
            <SignedIn>
              <PlayButton href="/ranked" caption="Ranked duel" />
            </SignedIn>
            <SignedOut>
              {/* The daily is the only mode a guest can actually play, so that is where the
                  button goes. Sending them at ranked would be a wall wearing the costume of
                  a game. */}
              <PlayButton href="/daily" caption="Today's challenge" />
            </SignedOut>
          </>
        )}
      </div>

      <div
        className={`border-line mt-4 flex flex-col gap-3 border-t ${
          collapsed ? "items-center p-2" : "p-4"
        }`}
      >
        <SignedIn>
          {/* The level bar needs its numbers to mean anything, and there is no room for
              them on a rail. It is still in the account menu. */}
          {!collapsed && <LevelBlock />}
          <UserMenu side="top" align="start" compact={collapsed} includeLevel={collapsed} />
        </SignedIn>

        <SignedOut>
          <MuteToggle />
          {!collapsed && (
            <AuthDialogButton mode="sign-in" variant="secondary" block>
              Sign in
            </AuthDialogButton>
          )}
        </SignedOut>
      </div>
    </aside>
  );
}

/** Expands or collapses the sidebar. The preference outlives the session. */
function CollapseToggle({ collapsed }: { collapsed: boolean }) {
  return (
    <button
      onClick={() => setSidebarCollapsed(!collapsed)}
      aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
      aria-expanded={!collapsed}
      className="text-muted hover:text-paper hover:bg-ink-700 rounded-sm p-1.5 text-lg transition-colors"
    >
      {/* One glyph, rotated, so the control reads as the same object in both states — and
          rotated onto the HORIZONTAL axis, because that is the direction the sidebar
          actually moves. Pointing it up and down read as a dropdown. */}
      <span
        className={`inline-block transition-transform ${collapsed ? "-rotate-90" : "rotate-90"}`}
      >
        <Glyph name="chevron" />
      </span>
    </button>
  );
}

/** Play, as a glyph. The rail's one gold thing, so it stays findable at 64px. */
function RailPlayButton({ href }: { href: string }) {
  const queue = useQueue();

  return (
    <Link
      href={href}
      aria-label={queue.inQueue ? "Searching for a match" : "Play"}
      style={{ ["--press-edge" as string]: "#9E7414" }}
      className="press bg-gold text-ink-900 flex size-11 items-center justify-center rounded-md text-xl"
    >
      <span className={queue.inQueue ? "animate-pulse" : ""}>
        <Glyph name={queue.inQueue ? "timer" : "tier"} filled />
      </span>
    </Link>
  );
}

/**
 * One sidebar row. Extracted when the nav split into two groups so both `.map()`s
 * render exactly the same thing — the active treatment is the kind of detail that
 * drifts the moment it is written twice.
 */
function NavLink({
  item,
  pathname,
  collapsed = false,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
}) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      /**
       * The label moves into the accessible name when it is not on screen, rather than
       * simply vanishing. A rail of unlabelled glyphs is not navigation to anyone using a
       * screen reader, and `title` gives sighted users the same word on hover.
       */
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`text-body flex items-center rounded-sm py-2.5 font-medium transition-colors ${
        collapsed ? "justify-center px-2" : "gap-3 px-3"
      } ${active ? "bg-ink-600 text-paper" : "text-secondary hover:bg-ink-700 hover:text-paper"}`}
    >
      <span className="text-lg">
        <Glyph name={item.glyph} filled={active && item.glyph === "win"} />
      </span>
      {!collapsed && item.label}
    </Link>
  );
}

/**
 * The primary action, and the only control in the app allowed to be this loud.
 *
 * Two shapes behind one name, because a guest and a ranked player are not looking at the
 * same thing. Signed in it is a standing plus a door — rank, rating, last swing, each
 * named. Signed out there is no rank to state, so it stays the plain control it was.
 */
function PlayButton({ href, caption }: { href: string; caption: string }) {
  return (
    <>
      <SignedIn>
        <RankedPlayButton href={href} />
      </SignedIn>
      <SignedOut>
        {/* A guest has no rank, so there is nothing to label — the daily control stays
            the simple one it always was. */}
        <ButtonLink href={href} size="lg" block className="justify-between">
          <span className="flex flex-col items-start">
            <span className="flex items-center gap-1.5 text-xl leading-none font-extrabold tracking-wide">
              <Glyph name="tier" filled />
              PLAY
            </span>
            <span className="text-label mt-0.5 font-medium opacity-70">{caption}</span>
          </span>
        </ButtonLink>
      </SignedOut>
    </>
  );
}

/**
 * The signed-in Play control.
 *
 * Every number on it is labelled. It used to read `941  ▲ +12` with nothing to say what
 * either figure was — you had to already know that one was your rating and the other was
 * the last match's swing. The rank comes along too, so the control states what it is a
 * door to rather than relying on the word PLAY alone.
 *
 * Built as a `Link` with the `.press` utility rather than through `ButtonLink`, which
 * bakes in `px-7` — 28px of padding a side leaves 152px of a 240px sidebar, and three
 * rows of labelled information need the width. The mobile tab bar's Play control is built
 * the same way for the same reason.
 */
function RankedPlayButton({ href }: { href: string }) {
  const me = useQuery(api.users.me, {});
  const delta = useQuery(api.users.lastRatingChange, {});
  const queue = useQueue();

  const rank = me ? rankForElo(me.elo) : null;
  const placing = (me?.placementsRemaining ?? 0) > 0;

  if (queue.inQueue) return <SearchingPlayButton href={href} />;

  return (
    <Link
      href={href}
      style={{ ["--press-edge" as string]: "#9E7414" }}
      className="press bg-gold text-ink-900 flex flex-col gap-1.5 rounded-md px-3.5 py-3
                 transition-[filter] hover:brightness-110"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-lg leading-none font-extrabold tracking-wide">
          <Glyph name="tier" filled />
          PLAY
        </span>
        {rank && !placing && (
          <span className="text-label font-bold tracking-[0.12em] uppercase opacity-80">
            {rank.label}
          </span>
        )}
      </span>

      {me && (
        <span className="border-ink-900/15 flex items-end justify-between gap-2 border-t pt-1.5">
          {placing ? (
            <Labelled value={String(me.placementsRemaining)} label="to place" />
          ) : (
            <Labelled value={String(me.elo)} label="rating" />
          )}

          {/* Zero is its own case, not a small win. A loss at the rating floor reports a
              delta of 0 — `applyMatchResult` deliberately reports the drop actually taken
              — and colouring that as a gain would be a lie told by a symbol. */}
          {!placing && delta !== null && delta !== undefined && (
            <Labelled
              align="end"
              label="last match"
              value={
                <span className="flex items-center gap-0.5">
                  {delta !== 0 && (
                    <span className={delta > 0 ? "" : "rotate-180"}>
                      <Glyph name="win" filled />
                    </span>
                  )}
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
              }
            />
          )}
        </span>
      )}
    </Link>
  );
}

/**
 * The Play control while a search is running.
 *
 * The search outlives the page that started it, so this is the only thing on screen
 * saying it is still happening once you have navigated away — which makes it a status
 * readout as much as a control, and it has two jobs rather than one.
 *
 * Split into a Link and a sibling button rather than one clickable block: a <button>
 * nested inside an <a> is invalid HTML, and browsers recover from it by inventing a DOM
 * shape nobody wrote. The body goes back to the search panel, the ✕ leaves the queue.
 */
function SearchingPlayButton({ href }: { href: string }) {
  const queue = useQueue();
  const seconds = Math.floor(queue.waitingMs / 1000);

  return (
    <div
      style={{ ["--press-edge" as string]: "#9E7414" }}
      className="press bg-gold text-ink-900 flex flex-col gap-1.5 rounded-md px-3.5 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-lg leading-none font-extrabold tracking-wide"
        >
          {/* The only pulsing thing in the sidebar. It is doing the job the sweeping bar
              on /ranked does — saying the search is alive — in the space available. */}
          <span className="bg-ink-900 size-2 shrink-0 animate-pulse rounded-full" />
          <span className="truncate">SEARCHING</span>
        </Link>

        {/* No spinner: a 24px target has no room for one. Disabled while the leave is in
            flight so a second press cannot fire a second mutation — the failure itself is
            reported on /ranked, which is where this control links to. */}
        <button
          type="button"
          onClick={queue.dequeue}
          disabled={queue.pending === "dequeue"}
          aria-label="Cancel search"
          className="text-ink-900/70 hover:bg-ink-900/10 hover:text-ink-900 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-xs transition-colors disabled:opacity-40"
        >
          <Glyph name="leave" />
        </button>
      </div>

      <div className="border-ink-900/15 flex items-end justify-between gap-2 border-t pt-1.5">
        <Labelled
          value={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
          label="searching"
        />
        <Labelled align="end" value={String(queue.playersWaiting)} label="in queue" />
      </div>
    </div>
  );
}

/**
 * A figure with the word for what it is underneath.
 *
 * Sits on the gold fill, so both tones come from the ink end of the palette — the usual
 * `muted` would disappear against it.
 */
function Labelled({
  value,
  label,
  align = "start",
}: {
  value: React.ReactNode;
  label: string;
  align?: "start" | "end";
}) {
  return (
    <span className={`flex flex-col ${align === "end" ? "items-end" : "items-start"}`}>
      <span className="font-display text-body leading-none font-extrabold tabular-nums">
        {value}
      </span>
      <span className="text-label mt-0.5 leading-none font-semibold tracking-wide uppercase opacity-70">
        {label}
      </span>
    </span>
  );
}


/**
 * Progression, and only progression.
 *
 * Level is XP — it comes from every mode, never decreases, and measures time invested.
 * Rank is Elo, lives on the user menu below this, and measures standing against other
 * players. They are separate systems, so they get separate blocks; the old footer
 * printed `1000 · L4` on one line and invited exactly the confusion that implies.
 *
 * Renders during placements too. The old block hid level entirely until a player had
 * placed, which meant the one number a new player IS accumulating was invisible for
 * their first five matches.
 */
function LevelBlock() {
  const me = useQuery(api.users.me, {});
  if (!me) return null;

  const level = levelForXp(me.xp ?? 0);
  const remaining = Math.max(0, level.xpForNextLevel - level.xpIntoLevel);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-body-sm text-paper font-bold tracking-wider">
          LVL {level.level}
        </span>
        <span className="text-label text-muted tabular-nums">
          {level.xpIntoLevel} / {level.xpForNextLevel}
        </span>
      </div>
      <Meter
        value={level.xpIntoLevel}
        max={level.xpForNextLevel}
        tone="gold"
        height="sm"
        label={`Level ${level.level}: ${level.xpIntoLevel} of ${level.xpForNextLevel} XP`}
      />
      <span className="text-label text-muted tabular-nums">
        {remaining} XP to Level {level.level + 1}
      </span>
    </div>
  );
}

/**
 * Identity and standing, in one control.
 *
 * Replaces four separate things that used to share this corner — the rank link, Clerk's
 * `<UserButton>`, a settings gear and a mute toggle. Anchored at the bottom-left on
 * desktop and top-right on mobile, which is where every app of this shape puts it.
 *
 * `Profile` and `Manage account` are deliberately different entries: the first is the
 * in-game `/u/{handle}` page, the second is Clerk's own modal for email, password,
 * connected accounts and MFA. Dropping `<UserButton>` removed the only route to the
 * latter, so it has to be re-exposed rather than assumed.
 */
function UserMenu({
  side,
  align,
  includeLevel = false,
  compact = false,
}: {
  side: "top" | "bottom";
  align: "start" | "end";
  /** Mobile has no sidebar, so the level bar rides inside the menu instead. */
  includeLevel?: boolean;
  /** The collapsed rail: emblem only, since 64px has no room for a handle or a rank. */
  compact?: boolean;
}) {
  const me = useQuery(api.users.me, {});
  const { openUserProfile, signOut } = useClerk();
  const muted = useSyncExternalStore(subscribeMute, getMuteSnapshot, getMuteServerSnapshot);

  if (!me) return null;

  const rank = rankForElo(me.elo);
  const placing = me.placementsRemaining > 0;

  return (
    <Menu
      label="Account menu"
      side={side}
      align={align}
      triggerClassName={`hover:bg-ink-700 flex items-center rounded-sm transition-colors ${
        compact ? "justify-center p-1.5" : "w-full gap-2 px-2 py-1.5"
      }`}
      trigger={
        <>
          {/**
           * `sm`, not `md`. The sidebar is 240px wide and this row also carries a
           * chevron, so a 30px emblem left roughly 130px for the name — enough to
           * truncate a 16-character handle, which is the longest one onboarding
           * allows. The emblem is decorative here; the rank is named in text beside it.
           */}
          <RankEmblem
            tierId={rank.tier.id}
            division={rank.tier.divisions > 1 ? rank.division : 1}
            unranked={placing}
            size="sm"
          />
          {/* The rail shows the emblem alone. Everything below is the same information the
              menu itself opens with, so nothing is lost by collapsing — only repeated. */}
          {!compact && (
            <>
          <span className="flex min-w-0 flex-1 flex-col text-left">
            <span className="text-body text-paper truncate font-semibold">
              @{me.handle}
            </span>
            {/**
             * "Unranked · 5 placements left" did not fit and rendered as
             * "Unranked · 5 placeme…" on every page. The count is the useful half, and
             * the profile and home cards both still spell the full sentence out.
             */}
            <span
              className="text-label truncate tabular-nums"
              style={{ color: placing ? undefined : rank.tier.accent }}
            >
              {placing
                ? `Unranked · ${me.placementsRemaining} to place`
                : `${rank.label} · ${me.elo}`}
            </span>
          </span>
          <span
            className={`text-muted shrink-0 text-base leading-none ${
              side === "top" ? "rotate-180" : ""
            }`}
          >
            <Glyph name="chevron" />
          </span>
            </>
          )}
        </>
      }
    >
      {includeLevel && (
        <>
          <div className="px-3 py-2">
            <LevelBlock />
          </div>
          <MenuSeparator />
        </>
      )}

      <MenuItem glyph="user" href={`/u/${me.handle}`}>
        Profile
      </MenuItem>
      <MenuItem glyph="settings" href="/settings">
        Settings
      </MenuItem>
      <MenuItem glyph="rank" onSelect={() => openUserProfile()}>
        Manage account
      </MenuItem>

      <MenuSeparator />

      <MenuItem
        glyph={muted ? "mute" : "sound"}
        onSelect={() => setMuted(!muted)}
      >
        Sound {muted ? "off" : "on"}
      </MenuItem>

      <MenuSeparator />

      <MenuItem glyph="leave" tone="danger" onSelect={() => void signOut()}>
        Sign out
      </MenuItem>
    </Menu>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile                                                                      */
/* -------------------------------------------------------------------------- */

function TabBar() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const [choosing, setChoosing] = useState(false);

  return (
    <nav
      aria-label="Main"
      className="bg-ink-900 border-line fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {/**
       * The dismiss layer, and it is deliberately invisible.
       *
       * This was a modal with a blurred backdrop, which is the wrong instrument: choosing a
       * mode is a menu, not a decision that needs the rest of the app taken away. Nothing
       * is dimmed — the page stays exactly as it was — but a tap anywhere outside still
       * closes, which is the behaviour that makes it feel like a menu rather than a screen.
       *
       * Rendered FIRST so it paints behind the tabs: a tap on the page closes the menu, and
       * a tap on another tab navigates, which is what someone reaching for Daily meant.
       */}
      {choosing && (
        <button
          type="button"
          /**
           * Out of the accessibility tree entirely, and not focusable.
           *
           * It is a pointer convenience, not a control: Escape closes the menu and the
           * trigger toggles it, so announcing a second unlabelled "close" button would be
           * noise. Safe to hide precisely because `tabIndex={-1}` means nothing can land
           * on it — hiding something focusable is the version of this that is a bug.
           */
          aria-hidden
          tabIndex={-1}
          onClick={() => setChoosing(false)}
          className="fixed inset-0 cursor-default"
        />
      )}

      {TABS_LEFT.map((item) => (
        <Tab key={item.href} item={item} pathname={pathname} />
      ))}

      {/*
       * The same primary action as the sidebar, in the one place a thumb reaches without
       * moving. Raised out of the bar rather than sitting in it, so it reads as a control
       * on top of the navigation instead of a fifth tab that happens to be yellow.
       */}
      <div className="relative flex w-20 shrink-0 justify-center">
        <MobilePlayButton
          signedIn={isSignedIn === true}
          choosing={choosing}
          setChoosing={setChoosing}
        />
      </div>

      {TABS_RIGHT.map((item) => (
        <Tab key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}

/**
 * The raised centre control, with the search folded into it.
 *
 * No cancel here. The ✕ the sidebar carries needs a 24px target beside a 24px label, and
 * neither fits on a 64px circle without one of them becoming a thing you hit by accident
 * — on a bar your thumb rests against, a mis-tap that silently leaves the queue is the
 * worst outcome available. Tapping it goes to /ranked, where Cancel is a full-size button.
 */
function MobilePlayButton({
  signedIn,
  choosing,
  setChoosing,
}: {
  signedIn: boolean;
  choosing: boolean;
  setChoosing: (open: boolean) => void;
}) {
  const queue = useQueue();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const seconds = Math.floor(queue.waitingMs / 1000);

  /**
   * The parts a Dialog used to provide for free, kept because they are the parts nobody
   * notices until they are gone: Escape closes, focus moves into the menu on open, and
   * comes back to the button that opened it on close.
   */
  useEffect(() => {
    if (!choosing) return;

    // Captured now rather than read in the cleanup: by the time this unwinds the ref may
    // point somewhere else, and focus would be restored to the wrong element or nowhere.
    const opener = trigger.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChoosing(false);
    };
    document.addEventListener("keydown", onKeyDown);
    panel.current?.querySelector<HTMLElement>("a")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [choosing, setChoosing]);

  /**
   * Two carve-outs where the sheet must not appear, both for the same reason: it would
   * put a choice in front of someone who has none.
   *
   * While SEARCHING the button is a live timer and the only route to Cancel — a sheet
   * there would add a tap to backing out of a queue, which is the worst place to spend
   * one. Signed OUT the daily is the only mode reachable at all, so offering Ranked would
   * open a door onto a sign-in wall.
   */
  const direct = queue.inQueue || !signedIn;

  const face = (
    <>
      <span className={`text-xl leading-none ${queue.inQueue ? "animate-pulse" : ""}`}>
        <Glyph name={queue.inQueue ? "timer" : "tier"} filled />
      </span>
      <span className="text-label font-extrabold tabular-nums tracking-wide">
        {queue.inQueue
          ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
          : "PLAY"}
      </span>
    </>
  );

  const shape =
    "press bg-gold text-ink-900 -mt-5 flex size-16 flex-col items-center justify-center gap-0.5 rounded-full";
  const edge = { ["--press-edge" as string]: "#9E7414" };

  if (direct) {
    return (
      <Link
        href={queue.inQueue || signedIn ? "/ranked" : "/daily"}
        aria-label={queue.inQueue ? "Searching for a match" : "Play"}
        className={shape}
        style={edge}
      >
        {face}
      </Link>
    );
  }

  return (
    <>
      <button
        ref={trigger}
        onClick={() => setChoosing(!choosing)}
        // The name stays put and the STATE moves — that is what aria-expanded is for.
        // Renaming the control to "Close…" on open makes it a different thing to anyone
        // listening, and breaks every locator that refers to it by name.
        aria-label="Play"
        aria-haspopup="menu"
        aria-expanded={choosing}
        // Above the dismiss layer, so pressing it again closes rather than being swallowed.
        className={`${shape} relative z-10`}
        style={edge}
      >
        {face}
      </button>

      <AnimatePresence>
        {choosing && (
          /**
           * Anchored to the button, and grown from it.
           *
           * `bottom-full` puts it directly above the control, and the transform origin is
           * the bottom centre — the point the button occupies — so it visibly expands OUT
           * of the thing that was pressed rather than arriving from somewhere else. That
           * was the whole complaint about the centred modal this replaces.
           *
           * Width is capped to the viewport rather than the 80px column it is centred in,
           * which is why it needs the translate.
           */
          <motion.div
            ref={panel}
            role="menu"
            aria-label="What are you playing?"
            initial={{ opacity: 0, scale: 0.6, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 6, transition: { duration: 0.12 } }}
            transition={snap}
            style={{ originY: 1, originX: 0.5 }}
            /**
             * `mb-7`, and the number is load-bearing.
             *
             * `bottom-full` anchors to the wrapper, but the button is raised out of the bar
             * by `-mt-5` — so its top edge sits 20px ABOVE that anchor. Anything under 20px
             * of margin puts the menu on top of the control it came from. This clears it
             * by eight.
             */
            className="border-line bg-ink-800 absolute bottom-full left-1/2 z-10 mb-7 flex
                       w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-2
                       rounded-lg border p-2 shadow-2xl shadow-black/50"
          >
            <ButtonLink
              href="/ranked"
              size="lg"
              block
              onClick={() => setChoosing(false)}
              className="justify-start"
            >
              <Glyph name="rank" filled />
              Ranked duel
            </ButtonLink>

            {/* Quieter on purpose. Practice lost its tab to make room for Me, and this is
                where it went — but it is still the un-rated mode, and it does not get equal
                billing with the ladder. Same call the /ranked page already makes. */}
            <ButtonLink
              href="/practice"
              variant="ghost"
              block
              onClick={() => setChoosing(false)}
              className="justify-start"
            >
              <Glyph name="bot" />
              Practice against a bot
            </ButtonLink>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Tab({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
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
      <span className="text-label font-semibold">{item.shortLabel ?? item.label}</span>
    </Link>
  );
}

/**
 * Top bar on mobile only — the sidebar carries this on desktop.
 *
 * Carries the same user menu, anchored top-right and opening downward, so identity
 * lives in one recognisable place on both form factors. The level bar rides inside the
 * menu here rather than on the bar itself, which has no room for it.
 */
export function MobileTopBar() {
  const immersive = useImmersiveState();
  if (immersive) return null;

  return (
    <header className="border-line flex items-center justify-between gap-3 border-b px-4 py-3 lg:hidden">
      <Wordmark />
      <SignedIn>
        {/* Bounded so a long handle cannot squeeze the wordmark off the bar. */}
        <div className="min-w-0 max-w-[60%]">
          <UserMenu side="bottom" align="end" includeLevel />
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex items-center gap-3">
          <MuteToggle />
          <AuthDialogButton mode="sign-in" size="sm" variant="secondary">
            Sign in
          </AuthDialogButton>
        </div>
      </SignedOut>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The logo, at two sizes.
 *
 * `bar` is the compact lockup the mobile top bar needs — it shares a 48px row with the
 * account menu, and anything larger squeezes a long handle off the bar. `brand` is the
 * sidebar masthead: a 240px column can carry the mark at 40px next to SNAP at display
 * size and still have room, and at the small size it read as a favicon that had wandered
 * into the layout rather than as the name of the thing you are inside.
 *
 * Horizontal at both sizes. Stacking the mark above the name would spend vertical space
 * the nav wants and read as a splash screen.
 *
 * No bloom behind the mark: globals.css licenses exactly three exceptions to the no-glow
 * rule and that one belongs to rank emblems. Prominence here is size and space.
 */
function Wordmark({ size = "bar" }: { size?: "bar" | "brand" | "mark" }) {
  const brand = size === "brand";
  // `mark` is the collapsed rail: 64px has no room for the name, and the mark alone is
  // still the same object people recognise from the favicon and the home-screen icon.
  const markOnly = size === "mark";

  return (
    <Link
      href="/"
      aria-label={markOnly ? "SNAP — home" : undefined}
      className={`inline-flex items-center transition-[filter] hover:brightness-110 ${
        brand ? "gap-2.5" : "gap-2"
      }`}
    >
      {/* The same mark as the favicon and the home-screen icon, cut from one generated
          image by scripts/build-icon.ts. This used to be a CSS clip-path plate, which
          stayed crisp but showed a bare chamfer while every other surface showed the
          waveform — the logo has to be the same object everywhere it appears.

          public/mark.png is the transparent variant; the favicon bakes ink-900 in
          because it lands on browser chrome we do not control, and this one does not. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mark.png"
        alt=""
        aria-hidden="true"
        className={`inline-block shrink-0 select-none ${
          brand ? "size-10" : markOnly ? "size-8" : "size-5"
        }`}
      />
      {!markOnly && (
        <span
          className={`font-display text-paper font-extrabold tracking-tight ${
            brand ? "text-display-2 leading-none" : "text-xl"
          }`}
        >
          SNAP
        </span>
      )}
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

    void claimGuestRun({ guestToken: token })
      .then((result) => {
        clearGuestToken();
        /**
         * The last step of the guest funnel, and the only one that proves the mechanism
         * worked end to end — a signup that fails to carry the run across is a conversion
         * the player experiences as having lost their score.
         *
         * `claimed` is a COUNT of runs moved, and zero is a real outcome rather than a
         * failure: it is what a token with nothing behind it returns.
         */
        track("guest_run_claimed", { runs: result?.claimed ?? 0 });
      })
      // Previously an unhandled rejection. It stays non-fatal — a failed claim must not
      // break the first screen of a new account — but it is no longer invisible.
      .catch(() => track("guest_run_claimed", { runs: 0, failed: true }));
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

