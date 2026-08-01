"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { PHASE_DURATIONS_MS } from "@/engine/config";
import { play } from "@/audio/sfx";
import { Avatar, BadgeRow, BotBadge, RankBadge, Stage, TierChip } from "./ui";
import { useNow, usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { Card, Chip, Meter } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { snap } from "@/ui/motion";
import { hpTone } from "./RoundRunner";

/**
 * The between-round beats. These exist because the drama lives in the gaps: a match
 * that cuts straight from one song to the next reads as a blur rather than a contest.
 */

export interface PlayerCardData {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  elo: number;
  rankLabel: string;
  rankAccent: string;
  placementsRemaining: number;
  level: number;
  wins: number;
  losses: number;
  bestCategory: string | null;
  badges: { id: string; name: string; emoji: string }[];
  globalRank: number | null;
  hp?: number;
  roundsWon?: number;
  streak?: number;
  bestMs?: number | null;
  isBot: boolean;
  bio?: string | null;
  isMe?: boolean;
}

/**
 * Opponent reveal.
 *
 * Deliberately shows no projected rating swing — spending that number before the
 * match spends the reward before it is earned. The delta lands on the results
 * screen instead. The matchup label is qualitative framing over ratings both
 * players can already see.
 */
export function VsReveal({
  me,
  opponent,
  matchup,
}: {
  me: PlayerCardData;
  opponent: PlayerCardData;
  matchup: string | null;
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("whoosh");
  }, []);

  const slam = (fromX: number) =>
    reduced
      ? { initial: false as const, animate: { opacity: 1, x: 0 } }
      : {
          initial: { opacity: 0, x: fromX, scale: 0.85 },
          animate: { opacity: 1, x: 0, scale: 1 },
        };

  return (
    <Stage keyName="vs" className="py-10 text-center">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <motion.div {...slam(-120)} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
          <VsCard player={me} />
        </motion.div>

        <motion.div
          initial={reduced ? false : { scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 14 }}
          className="font-display text-display-2 sm:text-display-1 text-muted font-extrabold italic"
        >
          VS
        </motion.div>

        <motion.div {...slam(120)} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
          <VsCard player={opponent} />
        </motion.div>
      </div>

      {opponent.globalRank !== null && (
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-body-sm text-gold font-semibold tracking-wide"
        >
          #{opponent.globalRank} GLOBAL
        </motion.p>
      )}

      {matchup && (
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="font-display text-body-lg text-paper font-bold tracking-[0.2em]"
        >
          {matchup}
        </motion.p>
      )}
    </Stage>
  );
}

function VsCard({ player }: { player: PlayerCardData }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-3 sm:p-4">
      <Avatar url={player.avatarUrl} name={player.displayName} className="h-14 w-14 text-xl sm:h-20 sm:w-20" />
      <p className="text-body max-w-full truncate font-semibold">
        {player.displayName}
      </p>
      <p className="text-body-sm text-muted max-w-full truncate">@{player.handle}</p>
      {player.isBot && <BotBadge />}
      <RankBadge
        label={player.rankLabel}
        accent={player.rankAccent}
        placements={player.placementsRemaining}
        size="sm"
      />
      <div className="text-body-sm text-secondary flex gap-3">
        <span className="tabular-nums">{player.elo}</span>
        <span>L{player.level}</span>
      </div>
      <div className="text-body-sm text-muted tabular-nums">
        {player.wins}W · {player.losses}L
      </div>
      <BadgeRow badges={player.badges} max={5} />
      {player.bestCategory && (
        <p className="text-label text-muted">best: {player.bestCategory}</p>
      )}
    </Card>
  );
}

/**
 * Round intro.
 *
 * A bare "3 · 2 · 1" wastes three seconds a round. This is the natural place to
 * remind players where they stand, warn them when the multiplier has risen, and
 * tell them what is at stake — all information they otherwise have to hunt for.
 */
export function Countdown({
  endsAt,
  roundNumber,
  multiplier,
  players,
  maxHp,
  suddenDeath,
}: {
  endsAt: number | null;
  roundNumber: number;
  multiplier: number;
  players: PlayerCardData[];
  maxHp: number;
  suddenDeath: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const now = useNow(80);
  const remaining = endsAt ? Math.max(0, endsAt - now) : PHASE_DURATIONS_MS.countdown;
  const seconds = Math.ceil(remaining / 1000);

  useEffect(() => {
    if (seconds > 0) play("tick");
    else play("go");
  }, [seconds]);

  const me = players.find((player) => player.isMe);
  const opponent = players.find((player) => !player.isMe);
  const lead = me && opponent ? (me.hp ?? 0) - (opponent.hp ?? 0) : null;

  return (
    <Stage keyName="countdown" className="items-center py-14">
      <p className="text-label text-muted font-semibold tracking-[0.35em] uppercase">
        {suddenDeath ? "Sudden death" : `Round ${roundNumber}`}
      </p>

      <motion.div
        key={seconds}
        initial={reduced ? false : { scale: 1.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={snap}
        className="font-display text-display-hero text-paper font-extrabold tabular-nums"
      >
        {seconds > 0 ? seconds : "GO"}
      </motion.div>

      {multiplier > 1 && (
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Chip tone="gold">×{multiplier} damage</Chip>
        </motion.p>
      )}

      {lead !== null && (
        <p className="text-body text-secondary">
          {lead === 0
            ? "Dead level"
            : lead > 0
              ? `You lead by ${lead} HP`
              : `Behind by ${Math.abs(lead)} HP`}
        </p>
      )}

      {players.length > 1 && (
        <div className="flex w-full max-w-sm gap-3">
          {players.map((player) => (
            <div key={player.userId} className="flex flex-1 flex-col gap-1">
              <span className="text-label text-muted truncate">
                {player.isMe ? "You" : player.displayName}
              </span>
              <Meter
                value={player.hp ?? 0}
                max={maxHp}
                height="sm"
                tone={hpTone(player.hp ?? 0, maxHp)}
                label={`${player.isMe ? "Your" : `${player.displayName}'s`} health`}
              />
            </div>
          ))}
        </div>
      )}
    </Stage>
  );
}

export interface RoundResultEntry {
  userId: string;
  solved: boolean;
  elapsedMs: number | null;
  points: number;
}

/**
 * The reveal. This is the payoff the old build buried in an end-of-match list —
 * "OH, it's THAT song" is the single best moment in a music game.
 */
export interface RevealTrack {
  title: string;
  artist: string;
  artworkUrl: string;
  releaseYear?: number;
  difficulty?: number;
  categoryName?: string | null;
}

export function RevealStage({
  track,
  results,
  players,
}: {
  track: RevealTrack | null;
  results: RoundResultEntry[];
  players: PlayerCardData[];
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("reveal");
  }, []);

  if (!track) return null;

  // Nobody got it. Worth naming explicitly — a silent scoreboard of zeroes reads
  // like a bug rather than a hard song.
  const nobodySolved = results.every((result) => !result.solved);

  return (
    <Stage keyName="reveal" className="items-center py-8 text-center">
      <motion.div
        initial={reduced ? false : { scale: 0.5, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 16 }}
        className="relative"
      >
        {/* The artwork is the largest thing on screen. This is the payoff of the whole
            round — "oh, it's THAT song" — and it deserves to look like a music product
            rather than a row in a scoreboard. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={track.artworkUrl}
          alt=""
          className="border-line size-56 rounded-lg border object-cover sm:size-72"
        />
        {track.releaseYear ? (
          <span className="bg-paper text-ink-900 text-label absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-xs px-2 py-0.5 font-bold tabular-nums">
            {track.releaseYear}
          </span>
        ) : null}
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-3 flex flex-col items-center gap-2"
      >
        <h2 className="font-display text-display-2 text-paper font-bold text-balance">
          {track.title}
        </h2>
        <p className="text-body-lg text-secondary">{track.artist}</p>

        <div className="mt-1 flex items-center justify-center gap-2">
          {track.categoryName && (
            <Chip size="sm">{track.categoryName}</Chip>
          )}
          {track.difficulty !== undefined && (
            <Chip size="sm" title={`Difficulty ${track.difficulty} of 5`}>
              <span aria-hidden="true">
                {"●".repeat(track.difficulty)}
                <span className="text-faint">{"●".repeat(5 - track.difficulty)}</span>
              </span>
            </Chip>
          )}
        </div>
      </motion.div>

      {nobodySolved && (
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-body text-muted"
        >
          Nobody got this one.
        </motion.p>
      )}

      <div className="flex w-full flex-col gap-2">
        {results.map((result) => {
          const player = players.find((candidate) => candidate.userId === result.userId);
          return (
            <Card
              key={result.userId}
              emphasis={player?.isMe}
              className="text-body flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <span className={player?.isMe ? "text-paper font-semibold" : "text-secondary"}>
                {player?.isMe ? "You" : (player?.displayName ?? "Player")}
              </span>
              <span className="flex items-center gap-3">
                {result.solved && result.elapsedMs !== null ? (
                  <>
                    <span className="font-display text-secondary font-bold tabular-nums">
                      {(result.elapsedMs / 1000).toFixed(2)}s
                    </span>
                    <TierChip tierId={tierIdFor(result.elapsedMs)} size="sm" />
                    <span className="font-display text-paper w-12 text-right font-bold tabular-nums">
                      +{result.points}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">missed</span>
                )}
              </span>
            </Card>
          );
        })}
      </div>
    </Stage>
  );
}

/** Local mirror of the tier thresholds for display. Scores still come from the server. */
function tierIdFor(elapsedMs: number): string {
  if (elapsedMs < 7_000) return "snap";
  if (elapsedMs < 15_000) return "quick";
  if (elapsedMs < 23_000) return "solid";
  return "late";
}

export interface DamageEntry {
  userId: string;
  damage: number;
  hpAfter: number;
}

/**
 * HP bars draining with the damage number flying off — a fighting-game hit.
 *
 * The information is the same as an ordinary scoreboard, but framed as a
 * consequence rather than a table, which is what makes a duel feel like a fight.
 */
export function StandingsStage({
  players,
  damage,
  maxHp,
  roundWinnerId,
  nextMultiplier,
  multiplier,
  outcome,
  timeGapMs,
}: {
  players: PlayerCardData[];
  damage: DamageEntry[];
  maxHp: number;
  roundWinnerId: string | null;
  nextMultiplier: number;
  multiplier: number;
  outcome: string | null;
  timeGapMs: number | null;
}) {
  const reduced = usePrefersReducedMotion();

  const hpFor = (userId: string) =>
    damage.find((entry) => entry.userId === userId)?.hpAfter ?? maxHp;
  const damageFor = (userId: string) =>
    damage.find((entry) => entry.userId === userId)?.damage ?? 0;

  useEffect(() => {
    if (damage.some((entry) => entry.damage > 0)) play("wrong");
  }, [damage]);

  const ordered = [...players].sort((a, b) => hpFor(b.userId) - hpFor(a.userId));
  const winner = players.find((player) => player.userId === roundWinnerId);
  const me = players.find((player) => player.isMe);
  const opponent = players.find((player) => !player.isMe);
  const lead = me && opponent ? hpFor(me.userId) - hpFor(opponent.userId) : null;

  return (
    <Stage keyName="standings" className="py-10">
      {/* Name the outcome AND the reason. A same-tier loss with a silent bar reads
          as arbitrary when both players clearly got the song. */}
      <motion.div
        initial={reduced ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="text-center"
      >
        {/* The result is stated without softening. A round you lost says so. */}
        {outcome === "song" ? (
          <>
            <p className="font-display text-display-2 text-gold flex items-center justify-center gap-2 font-extrabold">
              <Glyph name="song" />
              THE SONG WINS
            </p>
            <p className="text-body text-secondary mt-1">
              Neither of you got it. It takes a bite out of you both.
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-display-2 font-extrabold">
              {winner ? (
                winner.isMe ? (
                  <span className="text-paper">ROUND WON</span>
                ) : (
                  <span className="text-signal-text">ROUND LOST</span>
                )
              ) : (
                <span className="text-muted">DEAD HEAT</span>
              )}
            </p>

            <p className="text-body text-secondary mt-1">
              {outcome === "time" && timeGapMs !== null
                ? `Same call — decided by ${(timeGapMs / 1000).toFixed(2)}s`
                : winner && !winner.isMe
                  ? `${winner.displayName} was on a faster tier`
                  : "Faster tier wins"}
            </p>
          </>
        )}

        {outcome !== "song" && winner && (winner.streak ?? 0) > 1 && (
          <p className="mt-2 flex items-center justify-center">
            <Chip tone="gold">
              <Glyph name="streak" />
              {winner.streak} in a row
            </Chip>
          </p>
        )}
      </motion.div>

      <div className="flex flex-col gap-5">
        {ordered.map((player) => {
          const hp = hpFor(player.userId);
          const hit = damageFor(player.userId);
          const dead = hp <= 0;
          const pct = Math.max(0, (hp / maxHp) * 100);

          return (
            <motion.div
              key={player.userId}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex flex-col gap-1.5"
            >
              <div className="text-body flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={player.isMe ? "text-paper font-semibold" : "text-secondary"}>
                    {player.isMe ? "You" : player.displayName}
                  </span>
                  {player.isBot && <BotBadge />}
                  {dead && (
                    <Chip tone="signal" size="sm">
                      <Glyph name="damage" />
                      ELIMINATED
                    </Chip>
                  )}
                </span>
                <span className="flex items-baseline gap-3">
                  {hit > 0 && (
                    <motion.span
                      initial={reduced ? false : { opacity: 0, y: 0, scale: 1.5 }}
                      animate={{ opacity: [1, 1, 0], y: -22, scale: 1 }}
                      transition={{ duration: 1.2, times: [0, 0.55, 1] }}
                      className="font-display text-display-2 text-signal-text font-extrabold tabular-nums"
                    >
                      −{hit}
                    </motion.span>
                  )}
                  <span className="font-display text-display-2 text-paper font-extrabold tabular-nums">
                    {hp}
                  </span>
                </span>
              </div>

              {/* Health is how brightly you are still burning: full is paper-bright,
                  low is an ember, zero goes out. Both bars use the same ramp — whose
                  row is whose is carried by the label, not by hue. */}
              <div className="bg-ink-inset relative h-4 overflow-hidden rounded-full">
                {/* Ghost bar showing the health that was just lost. */}
                {hit > 0 && !reduced && (
                  <motion.div
                    className="bg-signal absolute inset-y-0 left-0 rounded-full opacity-50"
                    initial={{ width: `${((hp + hit) / maxHp) * 100}%` }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.85, duration: 0.5, ease: "easeIn" }}
                  />
                )}
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    { paper: "bg-paper", gold: "bg-gold", signal: "bg-signal", muted: "bg-muted" }[
                      hpTone(hp, maxHp)
                    ]
                  }`}
                  initial={reduced ? false : { width: `${((hp + hit) / maxHp) * 100}%` }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.25, duration: 0.7, ease: "easeOut" }}
                />
              </div>

              <div className="text-label text-muted flex justify-between gap-3">
                <span>
                  {player.roundsWon ?? 0} round{(player.roundsWon ?? 0) === 1 ? "" : "s"} won
                  {player.bestMs != null && ` · best ${(player.bestMs / 1000).toFixed(2)}s`}
                </span>
                <span className="tabular-nums">{Math.round(pct)}%</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3">
        {lead !== null && (
          <span
            className={`text-body-sm font-semibold ${
              lead > 0 ? "text-paper" : lead < 0 ? "text-signal-text" : "text-muted"
            }`}
          >
            {lead === 0
              ? "Dead level"
              : lead > 0
                ? `You lead by ${lead}`
                : `Behind by ${Math.abs(lead)}`}
          </span>
        )}
        {nextMultiplier > multiplier && (
          <Chip tone="gold" size="sm">×{nextMultiplier} next round</Chip>
        )}
      </div>
    </Stage>
  );
}

/**
 * Momentum beat every few rounds, which also announces the multiplier stepping up.
 *
 * The escalating multiplier is what guarantees a duel ends, so it deserves to be
 * announced rather than silently applied.
 */
export function MilestoneStage({
  roundNumber,
  multiplier,
  players,
  maxHp,
}: {
  roundNumber: number;
  multiplier: number;
  players: PlayerCardData[];
  maxHp: number;
}) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    play("podium");
  }, []);

  return (
    <Stage keyName={`milestone-${roundNumber}`} className="items-center py-16 text-center">
      <p className="text-label text-muted font-semibold tracking-[0.3em] uppercase">
        {roundNumber} rounds in
      </p>

      <motion.h2
        initial={reduced ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={snap}
        className="font-display text-display-1 text-gold font-extrabold tabular-nums"
      >
        ×{multiplier} DAMAGE
      </motion.h2>
      <p className="text-body text-secondary">Every mistake costs more from here.</p>

      {/* Match stats so far. A milestone that only announces a number is a pause;
          one that shows how the duel is actually going is a moment. */}
      <div className="flex w-full flex-col gap-3">
        {[...players]
          .sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0))
          .map((player) => (
            <Card
              key={player.userId}
              emphasis={player.isMe}
              className="flex flex-col gap-2.5 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-body flex min-w-0 items-center gap-2 font-semibold">
                  <span className="truncate">
                    {player.isMe ? "You" : player.displayName}
                  </span>
                  {player.isBot && <BotBadge />}
                </span>
                <span className="font-display text-display-2 font-extrabold tabular-nums">
                  {player.hp ?? 0}
                  <span className="text-body-sm text-muted ml-1 font-normal">HP</span>
                </span>
              </div>

              <Meter
                value={player.hp ?? 0}
                max={maxHp}
                tone={hpTone(player.hp ?? 0, maxHp)}
                label={`${player.isMe ? "Your" : `${player.displayName}'s`} health`}
              />

              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Rounds won" value={String(player.roundsWon ?? 0)} />
                <Metric
                  label="Fastest"
                  value={player.bestMs != null ? `${(player.bestMs / 1000).toFixed(2)}s` : "—"}
                />
                <Metric
                  label="Streak"
                  value={(player.streak ?? 0) > 0 ? String(player.streak) : "—"}
                />
              </div>
            </Card>
          ))}
      </div>
    </Stage>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-label text-muted font-semibold tracking-wider uppercase">{label}</span>
      <span className="font-display text-body text-paper font-bold tabular-nums">{value}</span>
    </div>
  );
}
