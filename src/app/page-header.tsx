"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { Glyph } from "@/ui/Glyph";
import { useImmersiveState } from "./immersive";
import {
  backTarget,
  getNavHistoryServerSnapshot,
  previousRoute,
  subscribeNavHistory,
} from "./nav-history";

/**
 * The sub-page header: a way back, a title, and room for one page action.
 *
 * Lives in src/app rather than src/ui because it depends on two app-level concerns — the
 * navigation history and the immersive context. src/ui stays pure presentation with no
 * knowledge of routing, which is what lets the design gallery render every primitive in
 * it without a router.
 *
 * Only sub-pages get one. The five top-level nav destinations keep their own display-1
 * headings: the ladder and the profile have heroes now, and a second title bar above a
 * hero is just two titles.
 */
export function PageHeader({
  parent,
  title,
  actions,
}: {
  /**
   * Where "up" goes when there is no history to go back to — a shared link, a refresh,
   * a cold load. Required, because a page that adopts this header has to have decided.
   */
  parent: { href: string; label: string };
  title?: ReactNode;
  actions?: ReactNode;
}) {
  const immersive = useImmersiveState();

  /**
   * sessionStorage does not exist on the server, so the previous route has to be read as
   * external state rather than during render. `getServerSnapshot` returns null, which
   * resolves to the declared parent — so the server-rendered markup and the first client
   * paint agree, and the real target swaps in once hydrated.
   *
   * The same three-argument shape the mute toggle uses in app-shell.tsx. The snapshot is a
   * string rather than the resolved object on purpose: useSyncExternalStore compares
   * snapshots by identity, and a fresh object every call would loop forever.
   */
  const previous = useSyncExternalStore(
    subscribeNavHistory,
    previousRoute,
    getNavHistoryServerSnapshot,
  );
  const target = backTarget(previous, parent);

  // A match owns the whole screen. Same guard the tab bar and MobileTopBar use.
  if (immersive) return null;

  return (
    <header className="bg-ink-900 border-line sticky top-0 z-30 border-b">
      {/**
       * Flush left, not centred on the content column.
       *
       * This used to carry `mx-auto` and the page's own max-width so the back control
       * lined up with the text beneath it. On a phone that is invisible — the viewport is
       * narrower than the max-width, so the row is full-bleed anyway, which is why mobile
       * always looked right. On desktop it parked the only way off the page in the middle
       * of the bar. A back control belongs in the corner, at the edge of the screen.
       */}
      <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href={target.href}
          className="text-secondary hover:text-paper -ml-1 flex min-h-9 shrink-0
                     items-center gap-1.5 rounded-xs px-1 font-medium transition-colors"
        >
          {/* The chevron points down by default; a quarter turn clockwise points it back
              the way you came. One mark, four directions — no second glyph needed. */}
          <span className="rotate-90 text-base leading-none">
            <Glyph name="chevron" />
          </span>
          <span className="text-body-sm max-w-40 truncate">{target.label}</span>
        </Link>

        {/**
         * A `p`, not a heading.
         *
         * The header is chrome that sits above the page, and every page adopting it
         * already owns an `h1` — the profile's name, Settings, the match verdict. Making
         * this one too gave those pages two top-level headings, which is wrong for a
         * screen reader and was caught as a strict-mode violation by the ladder spec.
         */}
        {title && (
          <>
            <span aria-hidden="true" className="bg-line h-4 w-px shrink-0" />
            <p className="text-body text-paper min-w-0 flex-1 truncate font-semibold">
              {title}
            </p>
          </>
        )}

        {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
