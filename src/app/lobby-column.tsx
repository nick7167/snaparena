import type { ReactNode } from "react";

/**
 * The reading column a mode's lobby sits in — the standing, the rules, the button that
 * starts a match.
 *
 * It exists as a component because of what must NOT be inside it. /ranked and /practice
 * both used to wrap their whole page in this, match included, which quietly capped the
 * arena at 672px: the VS reveal asks for `max-w-4xl` and explains in its own docblock why
 * it needs the extra room, and it had never once been rendered at that width. A parent
 * `max-w-*` cannot be escaped by a child, so the fix is structural — the lobby gets the
 * column, the match gets the viewport.
 *
 * Anything full-bleed (DuelMatch, and anything else that calls `useImmersive`) belongs
 * outside this.
 */
export function LobbyColumn({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">{children}</div>
  );
}
