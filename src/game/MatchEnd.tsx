"use client";

import { motion } from "motion/react";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { play } from "@/audio/sfx";
import { badgeById } from "@/engine/badges";
import { rankChange } from "@/engine/ranks";
import type { GameMode } from "@/engine/config";
import { levelForXp } from "@/engine/xp";
import { BadgeRow, BotBadge, RankBadge, Stage } from "./ui";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { Button } from "@/ui/Button";
import { Card, Chip, Meter, SectionLabel } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { snap } from "@/ui/motion";
import { hpTone } from "./RoundRunner";
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
  maxHp,
  matchId,
  onPlayAgain,
}: {
  players: MatchEndPlayer[];
  winnerId: string | null;
  mode: GameMode;
  maxHp: number;
  matchId: Id<"matches">;
  onPlayAgain?: () => void;
}) {
  const me = players.find((player) => player.isMe);
  // No reduced-motion read here any more: the Play again control's motion is CSS-driven
  // by the shared `.press` utility, which the global reduced-motion rule already covers.
  // The nested components that still animate read the hook themselves.

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
      {/* Stated without softening. A loss says so — that is what makes a win worth
          anything. Everything below this line is generous; this line is not. */}
      <h1
        className={`font-display text-display-1 text-center font-extrabold tracking-tight ${
          winnerId === null
            ? "text-muted"
            : me && winnerId === me.userId
              ? "text-paper"
              : mode === "daily"
                ? "text-paper"
                : "text-signal-text"
        }`}
      >
        {winnerId === null
          ? "DRAW"
          : me && winnerId === me.userId
            ? "VICTORY"
            : mode === "daily"
              ? "RUN COMPLETE"
              : "DEFEAT"}
      </h1>

      {promotion && <PromotionBanner label={promotion.after.label} accent={promotion.after.tier.accent} />}

      {/* Final health. A knockout must LOOK like a knockout — an empty bar says
          "you were finished off" in a way a bare number never does. */}
      <ul className="flex flex-col gap-3">
        {players.map((player) => {
          // Meter derives its own percentage from value/max, so there is no local pct.
          const hp = player.hp ?? 0;

          return (
            <Card
              as="li"
              key={player.userId}
              emphasis={player.isMe}
              className="flex flex-col gap-2 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-body font-semibold">
                    {player.isMe ? "You" : player.displayName}
                  </span>
                  {player.isBot && <BotBadge />}
                  {player.forfeited && (
                    <Chip size="sm">resigned</Chip>
                  )}
                </span>
                <span className="flex items-baseline gap-4">
                  <span className="text-body-sm text-muted tabular-nums">{player.totalPoints} pts</span>
                  <span
                    className={`font-display text-display-2 font-extrabold tabular-nums ${
                      hp <= 0 ? "text-signal-text" : "text-paper"
                    }`}
                  >
                    {hp}
                    <span className="text-body-sm text-muted ml-1 font-normal">HP</span>
                  </span>
                  {player.ratingDelta !== null && (
                    <RatingDelta delta={player.ratingDelta} />
                  )}
                </span>
              </div>

              <Meter
                value={hp}
                max={maxHp}
                tone={hpTone(hp, maxHp)}
                label={`${player.isMe ? "Your" : `${player.displayName}'s`} final health`}
              />
            </Card>
          );
        })}
      </ul>

      <RoundTimeline matchId={matchId} players={players} />

      {me && me.xpEarned !== null && <XpBar xpEarned={me.xpEarned} />}

      {me && me.badgesEarned.length > 0 && <NewBadges ids={me.badgesEarned} />}

      {onPlayAgain && (
        <Button size="lg" onClick={onPlayAgain} className="mx-auto">
          Play again
        </Button>
      )}
    </Stage>
  );
}

/**
 * Round-by-round timeline.
 *
 * A compact strip so the momentum of the whole duel is readable at a glance, with
 * per-round detail behind a tap — the swings are the most interesting part of a
 * long match and were previously invisible once it ended.
 */
function RoundTimeline({
  matchId,
  players,
}: {
  matchId: Id<"matches">;
  players: MatchEndPlayer[];
}) {
  const summary = useQuery(api.matches.summary, { matchId });
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!summary || summary.rounds.length === 0) return null;

  const me = players.find((player) => player.isMe);
  const detail = summary.rounds.find((round) => round.roundIndex === expanded);

  const markerFor = (round: (typeof summary.rounds)[number]) => {
    // Shape carries the meaning, colour only reinforces it — the timeline must be
    // readable without relying on hue.
    if (round.outcome === "song") return { glyph: "song" as const, tone: "text-gold" };
    if (!round.winnerId) return { glyph: "draw" as const, tone: "text-muted" };
    return String(round.winnerId) === me?.userId
      ? { glyph: "win" as const, tone: "text-paper" }
      : { glyph: "loss" as const, tone: "text-signal-text" };
  };

  return (
    <Card as="section" className="flex flex-col gap-3 p-4">
      <SectionLabel>Round timeline</SectionLabel>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {summary.rounds.map((round) => {
          const marker = markerFor(round);
          const myDamage =
            round.damage.find((entry) => String(entry.userId) === me?.userId)?.damage ?? 0;
          const isOpen = expanded === round.roundIndex;

          return (
            <button
              key={round.roundIndex}
              onClick={() => setExpanded(isOpen ? null : round.roundIndex)}
              className={`flex min-w-[2.5rem] flex-col items-center gap-0.5 rounded-lg px-1.5 py-2
                          transition-colors ${isOpen ? "bg-ink-500" : "hover:bg-ink-600"}`}
            >
              <span className="text-label text-muted tabular-nums">
                {round.roundIndex + 1}
              </span>
              <span className={`text-sm leading-none ${marker.tone}`}>
                <Glyph name={marker.glyph} filled />
              </span>
              <span className="text-label text-muted tabular-nums">
                {myDamage > 0 ? `−${myDamage}` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-label text-muted flex flex-wrap items-center gap-3">
        <span className="text-paper flex items-center gap-1"><Glyph name="win" filled /> you</span>
        <span className="text-signal-text flex items-center gap-1"><Glyph name="loss" filled /> them</span>
        <span className="text-gold flex items-center gap-1"><Glyph name="song" /> song</span>
        <span className="ml-auto">damage shown is yours</span>
      </div>

      {detail && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-ink-600 flex gap-3 overflow-hidden rounded-sm p-3"
        >
          {detail.track && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={detail.track.artworkUrl}
              alt=""
              className="size-14 shrink-0 rounded-xs object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-body truncate font-semibold">
              {detail.track?.title ?? "Unknown track"}
            </p>
            <p className="text-body-sm text-muted truncate">
              {detail.track?.artist}
              {detail.track?.releaseYear ? ` · ${detail.track.releaseYear}` : ""}
            </p>
            <div className="mt-1.5 flex flex-col gap-0.5">
              {detail.results.map((result) => {
                const player = players.find(
                  (candidate) => candidate.userId === String(result.userId),
                );
                return (
                  <div
                    key={String(result.userId)}
                    className="text-label flex justify-between gap-3"
                  >
                    <span className={player?.isMe ? "text-paper font-semibold" : "text-secondary"}>
                      {player?.isMe ? "You" : (player?.displayName ?? "Player")}
                    </span>
                    <span className="text-secondary tabular-nums">
                      {result.solved && result.elapsedMs !== undefined
                        ? `${(result.elapsedMs / 1000).toFixed(2)}s · ${result.points} pts`
                        : "missed"}
                    </span>
                  </div>
                );
              })}
            </div>
            {detail.outcome === "time" && detail.timeGapMs !== null && (
              <p className="text-label text-muted mt-1">
                Same tier — decided by {(detail.timeGapMs / 1000).toFixed(2)}s
              </p>
            )}
          </div>
        </motion.div>
      )}

      {(summary.fastest || summary.costliest) && (
        <div className="border-line grid grid-cols-2 gap-3 border-t pt-3">
          <Highlight
            label="Fastest call"
            value={
              summary.fastest
                ? `${(summary.fastest.elapsedMs / 1000).toFixed(2)}s`
                : "—"
            }
            sub={summary.fastest ? `Round ${summary.fastest.roundIndex + 1}` : "no solves"}
          />
          <Highlight
            label="Costliest round"
            value={summary.costliest ? `−${summary.costliest.damage}` : "—"}
            sub={
              summary.costliest ? `Round ${summary.costliest.roundIndex + 1}` : "untouched"
            }
          />
        </div>
      )}
    </Card>
  );
}

function Highlight({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-label text-muted font-semibold tracking-wider uppercase">{label}</span>
      <span className="font-display text-display-2 text-paper font-extrabold tabular-nums">{value}</span>
      <span className="text-label text-muted">{sub}</span>
    </div>
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
      className={`font-display w-14 text-right font-bold tabular-nums ${
        delta >= 0 ? "text-paper" : "text-signal-text"
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
    <Card className="flex flex-col gap-2 p-4">
      <div className="text-body flex justify-between">
        <span className="text-secondary">XP earned</span>
        <span className="font-display text-gold font-bold tabular-nums">+{xpEarned}</span>
      </div>
      <div className="bg-ink-inset h-2 overflow-hidden rounded-full">
        <motion.div
          className="bg-gold h-full rounded-full"
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(8, progress * 100)}%` }}
          transition={{ delay: 0.3, duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </Card>
  );
}

function NewBadges({ ids }: { ids: string[] }) {
  const reduced = usePrefersReducedMotion();
  const badges = ids.map(badgeById).filter((badge) => badge !== undefined);
  if (badges.length === 0) return null;

  return (
    <div className="border-gold bg-ink-700 flex flex-col gap-2 rounded-md border p-4">
      <p className="text-body text-gold font-semibold">New badge{badges.length > 1 ? "s" : ""}</p>
      <div className="flex flex-wrap gap-3">
        {badges.map((badge, index) => (
          <motion.div
            key={badge!.id}
            initial={reduced ? false : { scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.4 + index * 0.12, type: "spring", stiffness: 300, damping: 14 }}
            className="bg-ink-600 flex items-center gap-2 rounded-sm px-3 py-1.5"
          >
            <span className="text-lg">{badge!.emoji}</span>
            <span className="text-body-sm">{badge!.name}</span>
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
      transition={snap}
      className="flex flex-col items-center gap-3 rounded-md border p-6"
      style={{ borderColor: `${accent}55`, backgroundColor: `${accent}12` }}
    >
      <p className="text-label text-secondary font-semibold tracking-[0.3em] uppercase">Promoted</p>
      <RankBadge label={label} accent={accent} size="lg" />
    </motion.div>
  );
}

export { BadgeRow };
