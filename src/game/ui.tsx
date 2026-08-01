"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { SCORE_TIERS } from "@/engine/config";
import { useNow, usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Shared neon primitives.
 *
 * Palette: violet-black base, electric cyan and magenta accents. Rank colours come
 * from RANK_TIERS so a tier's identity is defined in exactly one place.
 */

export function RankBadge({
  label,
  accent,
  placements,
  size = "md",
}: {
  label: string;
  accent: string;
  placements?: number;
  size?: "sm" | "md" | "lg";
}) {
  const scale = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  }[size];

  // A rating before placements are done is noise, so show progress instead of a
  // rank the player has not actually earned.
  if (placements !== undefined && placements > 0) {
    return (
      <span className={`rounded-full border border-white/20 text-white/60 ${scale}`}>
        {placements} placement{placements === 1 ? "" : "s"} left
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${scale}`}
      style={{
        color: accent,
        backgroundColor: `${accent}1a`,
        boxShadow: `inset 0 0 0 1px ${accent}55`,
      }}
    >
      <span aria-hidden="true">◆</span>
      {label}
    </span>
  );
}

/** The score tier earned on a round — the thing worth bragging about. */
export function TierChip({ tierId, size = "md" }: { tierId: string; size?: "sm" | "md" }) {
  const tier = SCORE_TIERS.find((candidate) => candidate.id === tierId);
  if (!tier) return null;

  const colour =
    tier.id === "snap"
      ? "#22d3ee"
      : tier.id === "quick"
        ? "#a3e635"
        : tier.id === "solid"
          ? "#fbbf24"
          : "#f87171";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-bold tracking-wider ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      }`}
      style={{ color: colour, backgroundColor: `${colour}1f` }}
    >
      {tier.id === "snap" && <span aria-hidden="true">⚡</span>}
      {tier.label}
    </span>
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
    <div className={`h-1 w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div
        className="h-full rounded-full bg-cyan-400 transition-[width] duration-200 ease-linear"
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
}: {
  children: ReactNode;
  keyName: string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      key={keyName}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, y: -12 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={`mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Small stat pair used across player cards. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      <span className="tabular-nums text-sm text-white/90">{value}</span>
    </div>
  );
}

export function BadgeRow({
  badges,
  max = 6,
}: {
  badges: readonly { id: string; name: string; emoji: string }[];
  max?: number;
}) {
  if (badges.length === 0) {
    return <span className="text-xs text-white/25">No badges yet</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.slice(0, max).map((badge) => (
        <span
          key={badge.id}
          title={badge.name}
          className="rounded bg-white/10 px-1.5 py-0.5 text-sm leading-none"
        >
          {badge.emoji}
        </span>
      ))}
      {badges.length > max && (
        <span className="self-center text-xs text-white/40">+{badges.length - max}</span>
      )}
    </div>
  );
}
