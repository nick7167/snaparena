"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { play } from "@/audio/sfx";
import { badgeById } from "@/engine/badges";
import { rankChange } from "@/engine/ranks";
import { levelForXp } from "@/engine/xp";
import { BadgeRow, RankBadge, Stage } from "./ui";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import type { PlayerCardData } from "./stages";

/**
 * The results screen.
 *
 * Every reward lands here — rating delta, XP, badges, promotion — which is exactly
 * why the VS screen withholds the projected swing. Spending that number up front
 * would leave this screen with nothing to give.
 */

export interface MatchEndPlayer extends PlayerCardData {
  totalPoints: number;
  setsWon: number;
  ratingBefore: number;
  ratingAfter: number | null;
  ratingDelta: number | null;
  xpEarned: number | null;
  badgesEarned: string[];
  forfeited: boolean;
}

export function MatchEnd({
  players,
  winnerId,
  mode,
  onPlayAgain,
}: {
  players: MatchEndPlayer[];
  winnerId: string | null;
  mode: "ranked" | "room" | "daily";
  onPlayAgain?: () => void;
}) {
  const me = players.find((player) => player.isMe);
  const reduced = usePrefersReducedMotion();

  const promotion = useMemo(() => {
    if (!me || me.ratingAfter === null) return null;
    const change = rankChange(me.ratingBefore, me.ratingAfter);
    return change.promotion === "tier" ? change : null;
  }, [me]);

  useEffect(() => {
    if (promotion) play("promote");
    else if (me && winnerId === me.userId) play("podium");
  }, [promotion, me, winnerId]);

  return (
    <Stage keyName="match-end" className="py-12">
      <h1 className="text-center text-3xl font-black">
        {winnerId === null
          ? "Draw"
          : me && winnerId === me.userId
            ? "Victory"
            : mode === "daily"
              ? "Run complete"
              : "Defeat"}
      </h1>

      {promotion && <PromotionBanner label={promotion.after.label} accent={promotion.after.tier.accent} />}

      <ul className="flex flex-col gap-2">
        {players.map((player, index) => (
          <li
            key={player.userId}
            className={`flex items-center justify-between rounded-lg px-4 py-3 ${
              player.isMe ? "bg-cyan-400/10 ring-1 ring-cyan-400/30" : "bg-white/5"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="w-4 text-white/40 tabular-nums">{index + 1}</span>
              <span>{player.displayName}</span>
              {player.forfeited && (
                <em className="text-xs text-white/40">forfeited</em>
              )}
            </span>
            <span className="flex items-baseline gap-4">
              <span className="text-xs text-white/40">
                {player.setsWon} set{player.setsWon === 1 ? "" : "s"}
              </span>
              <span className="tabular-nums">{player.totalPoints}</span>
              {player.ratingDelta !== null && (
                <RatingDelta delta={player.ratingDelta} />
              )}
            </span>
          </li>
        ))}
      </ul>

      {me && me.xpEarned !== null && <XpBar xpEarned={me.xpEarned} />}

      {me && me.badgesEarned.length > 0 && <NewBadges ids={me.badgesEarned} />}

      {onPlayAgain && (
        <motion.button
          whileHover={reduced ? undefined : { scale: 1.03 }}
          whileTap={reduced ? undefined : { scale: 0.97 }}
          onClick={onPlayAgain}
          className="mx-auto rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-6 py-3
                     font-semibold text-black"
        >
          Play again
        </motion.button>
      )}
    </Stage>
  );
}

/** Counts the rating change up rather than printing it, so it reads as a reward. */
function RatingDelta({ delta }: { delta: number }) {
  const reduced = usePrefersReducedMotion();
  // Split rather than branching inside an effect: the reduced-motion path has no
  // animation to run, so it should not mount the counter at all.
  return reduced ? <DeltaText delta={delta} shown={delta} /> : <CountingDelta delta={delta} />;
}

function CountingDelta({ delta }: { delta: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let frame = 0;
    const steps = 24;
    const id = setInterval(() => {
      frame++;
      setShown(Math.round((delta * frame) / steps));
      if (frame >= steps) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [delta]);

  return <DeltaText delta={delta} shown={shown} />;
}

function DeltaText({ delta, shown }: { delta: number; shown: number }) {
  return (
    <span
      className={`w-12 text-right tabular-nums font-semibold ${
        delta >= 0 ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      {delta >= 0 ? "+" : ""}
      {shown}
    </span>
  );
}

function XpBar({ xpEarned }: { xpEarned: number }) {
  const reduced = usePrefersReducedMotion();
  // Progress within the level is illustrative here; the authoritative total lives
  // on the user record and shows in the header.
  const progress = levelForXp(xpEarned).progress;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 p-4">
      <div className="flex justify-between text-sm">
        <span className="text-white/60">XP earned</span>
        <span className="font-semibold text-cyan-300">+{xpEarned}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500"
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(8, progress * 100)}%` }}
          transition={{ delay: 0.3, duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function NewBadges({ ids }: { ids: string[] }) {
  const reduced = usePrefersReducedMotion();
  const badges = ids.map(badgeById).filter((badge) => badge !== undefined);
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4">
      <p className="text-sm font-semibold text-amber-300">New badge{badges.length > 1 ? "s" : ""}</p>
      <div className="flex flex-wrap gap-3">
        {badges.map((badge, index) => (
          <motion.div
            key={badge!.id}
            initial={reduced ? false : { scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.4 + index * 0.12, type: "spring", stiffness: 300, damping: 14 }}
            className="flex items-center gap-2 rounded bg-white/10 px-3 py-1.5"
          >
            <span className="text-lg">{badge!.emoji}</span>
            <span className="text-sm">{badge!.name}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PromotionBanner({ label, accent }: { label: string; accent: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 14 }}
      className="flex flex-col items-center gap-2 rounded-xl border p-6"
      style={{ borderColor: `${accent}55`, backgroundColor: `${accent}12` }}
    >
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Promoted</p>
      <RankBadge label={label} accent={accent} size="lg" />
    </motion.div>
  );
}

export { BadgeRow };
