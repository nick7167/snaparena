"use client";

import Link from "next/link";
import { useMatchHistory, useMe, useMyStanding } from "./db";
import { rankForElo } from "@/engine/ranks";
import { Chip, Meter, SectionLabel, Skeleton } from "@/ui/Surface";
import { GlobalRank } from "./dashboard/global-rank";
import { RankEmblem } from "@/ui/RankEmblem";
import { Glyph } from "@/ui/Glyph";

/**
 * Where you stand on the ladder, as reusable pieces.
 *
 * Lifted out of /ranked when the dashboard was rebuilt around the same information. The
 * two screens were about to render the same rank, the same progress bar and the same run
 * of recent results from the same two queries, in two hand-maintained copies — and the
 * copy on the dashboard was already the worse one, a small card that mentioned a rating
 * without ever showing how close the next division was.
 *
 * Every figure here comes from a query that already existed. Nothing was added for it.
 */

/** How many recent results the form strip shows. */
export const FORM_LENGTH = 5;

/**
 * Your standing, at the top of whatever screen leads with it.
 *
 * /ranked used to open with a paragraph explaining the rules and then hand half its space
 * to a card advertising practice-a-bot — the competitive mode's front door mostly selling
 * the un-rated one. It leads with the rank now: where you are, how far to the next
 * division, how the last few matches went, and then the queue.
 *
 * `size` is about billing, not about fitting. On /ranked the rank IS the page and takes
 * the h1; on the dashboard it sits under a greeting that already owns the heading, so it
 * steps down a level in both type and markup rather than competing with it.
 */
export function StandingHero({ size = "xl" }: { size?: "lg" | "xl" }) {
  const me = useMe();
  const standing = useMyStanding(me);

  const large = size === "xl";

  if (me === undefined) {
    return <Skeleton className={large ? "h-56 w-full" : "h-44 w-full"} />;
  }
  if (!me) return null;

  const rank = rankForElo(me.elo);
  const placing = me.placementsRemaining > 0;
  const Heading = large ? "h1" : "p";

  return (
    <section
      className={`flex flex-col items-center px-4 text-center ${large ? "gap-4" : "gap-3"}`}
    >
      <RankEmblem
        tierId={rank.tier.id}
        division={rank.tier.divisions > 1 ? rank.division : 1}
        size={large ? "xl" : "lg"}
        unranked={placing}
        bloom={placing ? undefined : rank.tier.accent}
      />

      <div className="flex flex-col items-center gap-1">
        <Heading
          className={`font-display font-extrabold tracking-tight ${
            large ? "text-display-2 sm:text-display-1" : "text-display-2"
          }`}
          style={{ color: placing ? undefined : rank.tier.accent }}
        >
          {placing ? "Unranked" : rank.label}
        </Heading>

        <p className="text-body-lg text-secondary flex flex-wrap items-center justify-center gap-x-2 tabular-nums">
          {placing ? (
            <span>
              {me.placementsRemaining} placement match
              {me.placementsRemaining === 1 ? "" : "es"} to go
            </span>
          ) : (
            <span className="text-paper font-bold">{me.elo}</span>
          )}
        </p>

        {/* The struck chip, not a run-on sentence. Position is a different kind of fact
            from rating — one is how good, the other is how many people are ahead — and
            the same element states it on the dashboard and on the VS reveal. */}
        {!placing && (
          <GlobalRank
            position={standing?.position}
            approximate={standing?.approximate}
          />
        )}
      </div>

      <RankProgress elo={me.elo} placementsRemaining={me.placementsRemaining} />
    </section>
  );
}

/**
 * How far to the next division.
 *
 * `rankForElo` has computed `progress` and `nextAt` since the tier system shipped and
 * nothing in the app has ever rendered either one — the single most motivating number on
 * a ladder was being calculated and thrown away every time. During placements the same
 * bar measures matches played instead, so a new player still has something filling.
 */
export function RankProgress({
  elo,
  placementsRemaining,
}: {
  elo: number;
  placementsRemaining: number;
}) {
  const rank = rankForElo(elo);

  if (placementsRemaining > 0) {
    const played = Math.max(0, 5 - placementsRemaining);
    return (
      <div className="flex w-full max-w-sm flex-col gap-1.5">
        <Meter
          value={played}
          max={5}
          tone="gold"
          height="sm"
          label={`${played} of 5 placement matches played`}
        />
        <p className="text-label text-muted tabular-nums">
          {played} of 5 placements played
        </p>
      </div>
    );
  }

  // Legend has no ceiling, so there is nothing to progress toward.
  if (rank.nextAt === null) {
    return (
      <p className="text-label text-gold tracking-label uppercase">
        Top of the ladder
      </p>
    );
  }

  const remaining = Math.max(0, rank.nextAt - elo);
  const next = rankForElo(rank.nextAt);

  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5">
      <Meter
        value={rank.progress}
        max={1}
        tone="paper"
        height="sm"
        label={`${remaining} rating to ${next.label}`}
      />
      <p className="text-label text-muted tabular-nums">
        {remaining} to <span className="text-secondary font-semibold">{next.label}</span>
      </p>
    </div>
  );
}

/**
 * Recent form.
 *
 * Reads `matches.history`, which the profile already uses. A run of results is the thing
 * a competitive player checks before queueing — it answers "am I on a good day?" faster
 * than a rating that moves eighteen points at a time.
 */
export function Form() {
  const me = useMe();
  const matches = useMatchHistory(me?.id);

  if (matches === undefined) return <Skeleton className="mx-4 h-10" />;

  /**
   * Rated matches only.
   *
   * `matches.history` returns practice alongside ranked, and a form strip built from all
   * of it is a lie on this page: practice moves no rating, so a run of practice losses
   * would show as terrible ranked form while your rating had not moved a point. The
   * recent list below still shows practice, because it is labelled there.
   */
  const rated = matches.filter((match) => match.mode !== "practice");
  if (rated.length === 0) return null;

  const recent = rated.slice(0, FORM_LENGTH);

  // Counted from the most recent backwards, stopping at the first result that breaks it.
  let streak = 0;
  for (const match of rated) {
    if (match.drawn || !match.won) break;
    streak += 1;
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4">
      <div className="flex items-center gap-2">
        <SectionLabel>Form</SectionLabel>
        <div className="flex items-center gap-1">
          {recent.map((match) => {
            const result = match.drawn ? "draw" : match.won ? "won" : "lost";
            return (
              <span
                key={match.matchId}
                title={result}
                className={`font-display flex size-6 items-center justify-center rounded-xs text-label font-bold ${
                  result === "won"
                    ? "bg-gold text-ink-900"
                    : result === "lost"
                      ? "bg-signal text-paper"
                      : "bg-ink-600 text-secondary"
                }`}
              >
                {result === "won" ? "W" : result === "lost" ? "L" : "D"}
              </span>
            );
          })}
        </div>
      </div>

      {streak >= 2 && (
        <Chip tone="gold" size="sm">
          <Glyph name="streak" />
          {streak} win streak
        </Chip>
      )}
    </div>
  );
}

/**
 * The last few rated matches, with the rating they moved.
 *
 * Same query and the same route as the profile's history list, so a result opens the real
 * results screen rather than a summary of it.
 */
export function RecentMatches() {
  const me = useMe();
  const matches = useMatchHistory(me?.id);

  if (matches === undefined || matches.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 px-4">
      <SectionLabel>Recent</SectionLabel>
      <ul className="flex flex-col gap-1.5">
        {matches.slice(0, FORM_LENGTH).map((match) => {
          const result = match.drawn ? "draw" : match.won ? "won" : "lost";
          return (
            <li key={match.matchId}>
              <Link
                href={`/m/${match.matchId}${me ? `?p=${me.id}` : ""}`}
                className="border-line bg-ink-800 hover:bg-ink-700 flex items-center gap-3
                           rounded-md border px-3 py-2 transition-colors"
              >
                <span
                  aria-hidden
                  className={`flex size-7 shrink-0 items-center justify-center text-base ${
                    result === "won"
                      ? "text-gold"
                      : result === "lost"
                        ? "text-signal-text"
                        : "text-muted"
                  }`}
                >
                  <Glyph
                    name={result === "won" ? "win" : result === "lost" ? "loss" : "draw"}
                    filled={result === "won"}
                  />
                </span>

                <span className="text-body min-w-0 flex-1 truncate font-medium">
                  {match.opponent
                    ? match.opponent.isBot
                      ? match.opponent.displayName
                      : `@${match.opponent.handle}`
                    : "Unknown opponent"}
                </span>

                {match.mode === "practice" && (
                  <span className="text-label text-muted shrink-0">practice</span>
                )}

                {/* Zero is its own case, not a small win — a loss at the rating floor
                    reports a delta of 0 and colouring that gold would read as a gain. */}
                {(match.ratingDelta ?? 0) !== null && (
                  <span
                    className={`text-body-sm shrink-0 font-semibold tabular-nums ${
                      (match.ratingDelta ?? 0) > 0
                        ? "text-gold"
                        : (match.ratingDelta ?? 0) < 0
                          ? "text-signal-text"
                          : "text-muted"
                    }`}
                  >
                    {(match.ratingDelta ?? 0) > 0 ? "+" : ""}
                    {(match.ratingDelta ?? 0)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

