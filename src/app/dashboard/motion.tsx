"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { settle } from "@/ui/motion";
import { usePrefersReducedMotion } from "@/game/usePrefersReducedMotion";

/**
 * The dashboard's two motion devices, defined once.
 *
 * A game lobby feels alive because things ARRIVE and numbers EARN their value — not
 * because of decoration, which this design system does not have. Both are here rather
 * than sprinkled through seven components so the cadence is one decision: seven files
 * each picking their own delay is how a staged entrance becomes a stutter.
 */

/** Gap between panels landing. Seven panels finish inside ~700ms at this spacing. */
const STEP_MS = 90;

/**
 * One beat in the entrance.
 *
 * `index` is the panel's place in the sequence, not a delay in milliseconds — callers
 * should never be doing that arithmetic, because the moment two of them disagree about
 * the step size the rhythm is gone.
 */
export function Beat({
  index,
  children,
  className = "",
}: {
  index: number;
  children: ReactNode;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? undefined : { ...settle, delay: (index * STEP_MS) / 1000 }}
      /**
       * `empty:hidden` is load-bearing, not tidying.
       *
       * Panels hide themselves by returning null, which leaves this wrapper in the DOM as
       * an empty div — and an empty flex child still claims its share of the parent's
       * `gap`. A first-week player, for whom three panels have nothing to say, was looking
       * at 70-odd pixels of unexplained space. `display: none` takes it out of the flex
       * layout entirely, so the gaps collapse with it.
       */
      className={`empty:hidden ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Counts a number up to its value on first paint.
 *
 * Deliberately keyed on the target rather than on render: a hook that restarts whenever
 * its parent re-renders turns a dashboard into a slot machine, and this one sits under
 * four live Convex subscriptions that settle at different moments. It animates on mount
 * and when the value genuinely changes, and never in between.
 *
 * The first real value is the interesting case. These numbers arrive as `undefined` while
 * the query is in flight, so the first defined value IS the mount as far as a player is
 * concerned — counting up from zero there is the whole effect. Counting up again later,
 * when a background subscription happens to refresh, is not.
 */
export function useCountUp(target: number | null | undefined, durationMs = 650): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(target ?? 0);
  const from = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Reduced motion is handled by RETURNING the target below, not by writing it into
    // state here: a synchronous setState in an effect body is a second render for a
    // value that was already known, and every panel on this page has one.
    if (reduced) return;
    if (target === null || target === undefined) return;

    const start = performance.now();
    const origin = from.current;
    const distance = target - origin;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Cubic ease-out: fast enough to read as a count, slow enough at the end that the
      // final digit settles rather than snapping.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(origin + distance * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = target;
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      from.current = target;
    };
  }, [target, durationMs, reduced]);

  if (reduced) return target ?? 0;
  return value;
}

/** A number that counts up to its value. Tabular so the width cannot jitter. */
export function CountUp({
  value,
  className = "",
  format = (n: number) => String(n),
}: {
  value: number | null | undefined;
  className?: string;
  format?: (value: number) => string;
}) {
  const shown = useCountUp(value);
  if (value === null || value === undefined) return null;
  return <span className={`tabular-nums ${className}`}>{format(shown)}</span>;
}
