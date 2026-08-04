"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { SignedIn, SignedOut } from "./auth-gate";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
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
import { clearGuestToken, getGuestToken } from "./guest";
import {
  getMuteServerSnapshot,
  getMuteSnapshot,
  setMuted,
  subscribeMute,
} from "@/audio/sfx";
import { MuteToggle } from "@/ui/MuteToggle";

/**
 * The application shell.
 *
 * Sidebar from `lg` up, bottom tab bar below it. Same four destinations and the same
 * four routes as the header it replaces — this is chrome, not information architecture.
 *
 * Both disappear during a match: the arena wants the whole screen, and a navigation bar
 * within thumb reach of the guess field is a way to lose a round by accident.
 */

type NavItem = { href: string; label: string; glyph: GlyphName };

/**
 * The nav, in two groups.
 *
 * Ways to duel above the rule, everything else below it. The split is the point: five
 * flat rows made Daily — a solo mode against a fixed puzzle — sit in the same list as
 * the three modes where you play a person, and nothing on screen said they were
 * different kinds of thing.
 */
const NAV_MODES: NavItem[] = [
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
 * Two either side of the raised centre control. Ranked is absent because Play IS ranked —
 * listing it twice would make the big gold button look like a shortcut to something
 * ordinary rather than the primary action.
 *
 * Written out rather than filtered from NAV: a filter takes its order from whatever order
 * NAV happens to be in, so regrouping the sidebar would silently reshuffle the tab bar.
 */
const byHref = (href: string): NavItem => {
  const item = NAV.find((candidate) => candidate.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item;
};

const TABS_LEFT: NavItem[] = [byHref("/daily"), byHref("/leaderboard")];
const TABS_RIGHT: NavItem[] = [byHref("/rooms"), byHref("/practice")];

export function AppShell({ children }: { children: ReactNode }) {
  const immersive = useImmersiveState();

  return (
    // QueueProvider wraps everything, including the chrome: the Play button reports the
    // search and the pages read it, so both have to be inside. Mounted here for the same
    // reason NavRecorder is — the shell is the only thing on every route.
    <QueueProvider>
      <div className="flex min-h-full flex-col lg:flex-row">
        <NavRecorder />
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

/* -------------------------------------------------------------------------- */
/* Desktop                                                                     */
/* -------------------------------------------------------------------------- */

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-ink-900 border-line sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r lg:flex">
      <div className="px-5 pt-6 pb-5">
        <Wordmark size="brand" />
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        {NAV_MODES.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Same hairline as MenuSeparator. Decorative, so `line` rather than
            `line-strong` — it groups, it does not divide. */}
        <div role="separator" className="bg-line my-2 h-px" />

        {NAV_MORE.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="flex-1" />

      {/*
       * Play sits at the bottom, directly above progression and identity, rather than at
       * the top under the wordmark. The nav is a list of places; this is the thing you
       * came to do, and it belongs in the corner your hand already rests in — next to the
       * account menu, above the level bar it fills.
       */}
      <div className="flex flex-col gap-3 p-4 pb-0">
        <SignedIn>
          <PlayButton href="/ranked" caption="Ranked duel" />
        </SignedIn>
        <SignedOut>
          {/* The daily is the only mode a guest can actually play, so that is where the
              button goes. Sending them at ranked would be a wall wearing the costume of
              a game. */}
          <PlayButton href="/daily" caption="Today's challenge" />
        </SignedOut>
      </div>

      <div className="border-line mt-4 flex flex-col gap-3 border-t p-4">
        <SignedIn>
          <LevelBlock />
          <UserMenu side="top" align="start" />
        </SignedIn>

        <SignedOut>
          <MuteToggle />
          <AuthDialogButton mode="sign-in" variant="secondary" block>
            Sign in
          </AuthDialogButton>
        </SignedOut>
      </div>
    </aside>
  );
}

/**
 * One sidebar row. Extracted when the nav split into two groups so both `.map()`s
 * render exactly the same thing — the active treatment is the kind of detail that
 * drifts the moment it is written twice.
 */
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`text-body flex items-center gap-3 rounded-sm px-3 py-2.5 font-medium transition-colors ${
        active ? "bg-ink-600 text-paper" : "text-secondary hover:bg-ink-700 hover:text-paper"
      }`}
    >
      <span className="text-lg">
        <Glyph name={item.glyph} filled={active && item.glyph === "win"} />
      </span>
      {item.label}
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

        <button
          type="button"
          onClick={queue.dequeue}
          aria-label="Cancel search"
          className="text-ink-900/70 hover:bg-ink-900/10 hover:text-ink-900 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-xs transition-colors"
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
}: {
  side: "top" | "bottom";
  align: "start" | "end";
  /** Mobile has no sidebar, so the level bar rides inside the menu instead. */
  includeLevel?: boolean;
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
      triggerClassName="hover:bg-ink-700 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 transition-colors"
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

  return (
    <nav
      aria-label="Main"
      className="bg-ink-900 border-line fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS_LEFT.map((item) => (
        <Tab key={item.href} item={item} pathname={pathname} />
      ))}

      {/*
       * The same primary action as the sidebar, in the one place a thumb reaches without
       * moving. Raised out of the bar rather than sitting in it, so it reads as a control
       * on top of the navigation instead of a fifth tab that happens to be yellow.
       */}
      <div className="flex w-20 shrink-0 justify-center">
        <MobilePlayButton signedIn={isSignedIn === true} />
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
function MobilePlayButton({ signedIn }: { signedIn: boolean }) {
  const queue = useQueue();
  const seconds = Math.floor(queue.waitingMs / 1000);

  return (
    <Link
      href={signedIn ? "/ranked" : "/daily"}
      aria-label={queue.inQueue ? "Searching for a match" : "Play"}
      className="press bg-gold text-ink-900 -mt-5 flex size-16 flex-col items-center justify-center gap-0.5 rounded-full"
      style={{ ["--press-edge" as string]: "#9E7414" }}
    >
      <span className={`text-xl leading-none ${queue.inQueue ? "animate-pulse" : ""}`}>
        <Glyph name={queue.inQueue ? "timer" : "tier"} filled />
      </span>
      <span className="text-label font-extrabold tabular-nums tracking-wide">
        {queue.inQueue
          ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
          : "PLAY"}
      </span>
    </Link>
  );
}

function Tab({
  item,
  pathname,
}: {
  item: { href: string; label: string; glyph: GlyphName };
  pathname: string;
}) {
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
      <span className="text-label font-semibold">{item.label}</span>
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
function Wordmark({ size = "bar" }: { size?: "bar" | "brand" }) {
  const brand = size === "brand";

  return (
    <Link
      href="/"
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
        className={`inline-block shrink-0 select-none ${brand ? "size-10" : "size-5"}`}
      />
      <span
        className={`font-display text-paper font-extrabold tracking-tight ${
          brand ? "text-display-2 leading-none" : "text-xl"
        }`}
      >
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

