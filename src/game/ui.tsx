"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { SCORE_TIERS } from "@/engine/config";
import { Chip } from "@/ui/Surface";
import { BadgeMark, Glyph } from "@/ui/Glyph";
import { RankEmblem } from "@/ui/RankEmblem";
import { settle } from "@/ui/motion";
import { useNow, usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Shared game primitives.
 *
 * Every export here keeps the prop signature it had before the overhaul — these are
 * called from nine stages and four pages, and this file is a restyle, not a redesign of
 * the interfaces.
 *
 * Palette: deep ink, opaque colour, no gradients. Rank colours still come from
 * RANK_TIERS via the server payload so a tier's identity is defined in exactly one
 * place.
 */

export function RankBadge({
  label,
  tierId,
  division = 1,
  accent,
  placements,
  size = "md",
}: {
  label: string;
  tierId: string;
  division?: number;
  accent: string;
  placements?: number;
  size?: "sm" | "md" | "lg";
}) {
  // A rating before placements are done is noise, so show progress instead of a
  // rank the player has not actually earned.
  if (placements !== undefined && placements > 0) {
    return (
      <span
        className={`border-line-strong text-muted rounded-full border whitespace-nowrap ${
          size === "sm" ? "text-label px-2 py-0.5" : "text-body-sm px-2.5 py-1"
        }`}
      >
        {placements} placement{placements === 1 ? "" : "s"} left
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <RankEmblem
        tierId={tierId}
        division={division}
        size={size === "lg" ? "lg" : size === "sm" ? "sm" : "md"}
      />
      <span
        className={`font-display font-bold whitespace-nowrap ${
          size === "sm" ? "text-body-sm" : size === "lg" ? "text-display-2" : "text-body"
        }`}
        style={{ color: accent }}
      >
        {label}
      </span>
    </span>
  );
}

/** The score tier earned on a round — the thing worth bragging about. */
export function TierChip({ tierId, size = "md" }: { tierId: string; size?: "sm" | "md" }) {
  const tier = SCORE_TIERS.find((candidate) => candidate.id === tierId);
  if (!tier) return null;

  // SNAP is pure paper. Nothing else in the app is this bright, which is exactly what
  // makes it unmistakable — you cannot get "more coloured" than the best call, you get
  // brighter. Below it the ramp dims rather than shifting hue: gold, then secondary,
  // then muted. SOLID and LATE used to share `neutral` and were impossible to tell
  // apart, which flattened a four-step ramp into three.
  const tone =
    tier.id === "snap"
      ? "paper"
      : tier.id === "quick"
        ? "gold"
        : tier.id === "solid"
          ? "neutral"
          : "muted";

  return (
    <Chip tone={tone} size={size} className="font-display tracking-wider">
      {tier.id === "snap" && <Glyph name="tier" filled />}
      {tier.label}
    </Chip>
  );
}

/** Countdown ring driven by a server deadline, so both players see the same clock. */
export function PhaseTimer({
  endsAt,
  durationMs,
  className = "",
}: {
  endsAt: number | null;
  durationMs: number;
  className?: string;
}) {
  // Ticked into state rather than read during render — Date.now() in render is an
  // impure read and two components in the same commit could disagree.
  const now = useNow(100);
  const remaining = endsAt ? Math.max(0, endsAt - now) : 0;
  const progress = durationMs > 0 ? remaining / durationMs : 0;

  return (
    <div
      className={`bg-ink-inset h-1 w-full overflow-hidden rounded-full ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(remaining / 1000)}
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs / 1000)}
      aria-label="Time remaining in this phase"
    >
      <div
        className="bg-paper h-full rounded-full transition-[width] duration-200 ease-linear"
        style={{ width: `${Math.min(100, progress * 100)}%` }}
      />
    </div>
  );
}

/**
 * Full-bleed stage wrapper. Every phase renders inside one of these so transitions
 * between phases are consistent and the layout never jumps.
 */
export function Stage({
  children,
  keyName,
  className = "",
  width = "max-w-2xl",
  fit = false,
}: {
  children: ReactNode;
  keyName: string;
  className?: string;
  /**
   * An explicit prop rather than a `max-w-*` in `className`, because two width utilities
   * on one element resolve by stylesheet order rather than by which was written last —
   * so an override silently wins or loses depending on where Tailwind happens to sort it.
   * The VS reveal is the one stage that wants more room than the default column.
   */
  width?: string;
  /**
   * Bind the stage to the viewport instead of letting it run as long as it likes.
   *
   * A prop for the same reason `width` is one: `h-dvh` and the default flow both set
   * height-adjacent utilities, and which wins from a `className` is a coin flip. A stage
   * that opts in must lay itself out in the space it gets — children need `min-h-0` to
   * be allowed to shrink, since flex items refuse to go below their content size without
   * it. `overflow-hidden` is the backstop, not the plan: if content is being clipped the
   * composition is wrong, not the container.
   */
  fit?: boolean;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      key={keyName}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, y: -12 }}
      transition={settle}
      /**
       * `--match-chrome` is the height of the row the runners put above every stage (see
       * MatchChrome). It defaults to 0px, so a stage rendered anywhere else is unaffected;
       * inside a match it has to come out of the budget or the stage claims a full viewport
       * it does not have, and `overflow-hidden` below hides the overflow rather than
       * reporting it.
       */
      className={`mx-auto flex w-full flex-col px-4 ${width} ${
        fit
          ? `h-[calc(100dvh-var(--match-chrome,0px))] max-h-[calc(100dvh-var(--match-chrome,0px))]
             justify-center gap-3 overflow-hidden py-3`
          : "gap-6"
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Bot marker.
 *
 * Shown everywhere a bot appears. Research on human-bot trust games found bot
 * opponents draw measurably less good faith than human ones, and disclosure is what
 * protects trust — players work it out regardless, so hiding it costs more than
 * labelling ever does.
 */
export function BotBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <Chip tone="neutral" size={size} title="This opponent is a bot" className="tracking-wider">
      <Glyph name="bot" />
      BOT
    </Chip>
  );
}

/**
 * Player avatar.
 *
 * Supports `color:#rrggbb` values written by onboarding, so a player can pick an
 * avatar without us hosting any image.
 */
export function Avatar({
  url,
  name,
  className = "h-10 w-10",
  plate = false,
}: {
  url?: string | null;
  name: string;
  className?: string;
  /**
   * Cut to the app's chamfer instead of the usual rounded square.
   *
   * A prop rather than a `.plate` class passed through `className`, because the shape is
   * chosen by swapping `rounded-md` out — and two border-radius utilities on one element
   * resolve by stylesheet order rather than by which the caller wrote last. Used where the
   * portrait sits beside the rank emblem and the two should read as the same material.
   */
  plate?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const shape = plate ? "plate" : "rounded-md";

  if (url?.startsWith("color:")) {
    return (
      <span
        className={`font-display text-ink-900 flex shrink-0 items-center justify-center font-bold ${shape} ${className}`}
        style={{ backgroundColor: url.slice(6) }}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`shrink-0 object-cover ${shape} ${className}`} />;
  }

  return (
    <span
      className={`font-display bg-ink-600 text-secondary flex shrink-0 items-center justify-center font-bold ${shape} ${className}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

/**
 * The public name for a player.
 *
 * `@handle` is the username chosen during onboarding, which is exactly what onboarding
 * promises it is: "how you'll appear on leaderboards and to your opponents". Until now
 * every one of those surfaces actually rendered `displayName` — the name Clerk pulled
 * from the Google account — so the promise was false and players were published under a
 * real name they never chose to show.
 *
 * Bots are the deliberate exception. "Seoul Search" is a persona's proper name and
 * reads better on a VS card than @seoulsearch.
 */
export function nameFor(player: {
  handle?: string | null;
  displayName?: string | null;
  isBot?: boolean;
}): string {
  if (player.isBot) return player.displayName ?? "Bot";
  return player.handle ? `@${player.handle}` : (player.displayName ?? "Player");
}

/**
 * Health as heat.
 *
 * Full health burns bright, low health cools to an ember, zero goes out entirely. This
 * is the one place colour is derived rather than passed, because it means the same
 * thing on every bar in the app.
 *
 * Lives here rather than in RoundRunner because stages.tsx and MatchEnd.tsx both need
 * it, and importing it from RoundRunner made those three files a cycle.
 */
export function hpTone(hp: number, maxHp: number): "paper" | "gold" | "signal" | "muted" {
  if (hp <= 0) return "muted";
  const pct = maxHp > 0 ? hp / maxHp : 0;
  if (pct < 0.25) return "signal";
  if (pct < 0.6) return "gold";
  return "paper";
}

export function BadgeRow({
  badges,
  max = 6,
}: {
  badges: readonly { id: string; name: string; emoji: string }[];
  max?: number;
}) {
  if (badges.length === 0) {
    return <span className="text-body-sm text-muted">No badges yet</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.slice(0, max).map((badge) => (
        <span
          key={badge.id}
          title={badge.name}
          className="bg-ink-600 rounded-xs px-1.5 py-1 text-sm leading-none"
        >
          {/* No colour set here — BadgeMark carries its own tone, so a badge looks the
              same on a VS panel as it does in the profile case. */}
          <BadgeMark id={badge.id} />
        </span>
      ))}
      {badges.length > max && (
        <span className="text-body-sm text-muted self-center">+{badges.length - max}</span>
      )}
    </div>
  );
}
