"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { BADGES } from "@/engine/badges";
import { formatGlobalRank, isNotable } from "@/engine/ranks";
import { Avatar, BotBadge, nameFor } from "@/game/ui";
import { Card, Chip, Empty, Meter, SectionLabel, Skeleton } from "@/ui/Surface";
import { RankEmblem } from "@/ui/RankEmblem";
import { BadgeMark, Glyph } from "@/ui/Glyph";
import { ReportDialog } from "./report";
import { PageHeader } from "../../page-header";

/**
 * Public player profile.
 *
 * Reads two queries that were both built and both unused. They are complementary, not
 * redundant:
 *
 *   users.profile(handle)  identity, elo, games, and the per-category breakdown
 *   matches.card(userId)   badges, bio, level, rank accent, W/L, global position
 *
 * `profile` is the entry point because the URL carries a handle; it returns `userId`
 * so the card can be fetched for the rest.
 */
/**
 * Where a profile goes "up" to when there is no history — a shared link, or a refresh.
 * The ladder is the page profiles are reached from, and the one place every profile in
 * the app is listed.
 */
const LADDER = { href: "/leaderboard", label: "Leaderboard" };

export default function ProfilePage() {
  const params = useParams<{ handle: string }>();
  const handle = (params.handle ?? "").toLowerCase();

  const profile = useQuery(api.users.profile, { handle });
  // Skipped until the handle resolves — there is no userId to ask about before then.
  const card = useQuery(api.matches.card, profile ? { userId: profile.userId } : "skip");
  const me = useQuery(api.users.me, {});

  /**
   * Both early branches carry the header too.
   *
   * A profile that is still loading, or that does not exist, is precisely when you most
   * want a way out — and it is the one case where the browser back button is the only
   * thing left if the page does not offer one.
   */
  if (profile === undefined) {
    return (
      <>
        <PageHeader parent={LADDER} />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
          <Skeleton className="mx-auto size-28" />
          <Skeleton className="mx-auto h-10 w-56" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    );
  }

  if (profile === null) {
    return (
      <>
        <PageHeader parent={LADDER} />
        <div className="mx-auto w-full max-w-2xl px-4 py-12">
          <Empty
            title="No player with that name"
            body={`Nobody here goes by @${handle}.`}
          />
        </div>
      </>
    );
  }

  const isMe = me?._id === profile.userId;
  const placing = profile.placementsRemaining > 0;
  const globalRank = formatGlobalRank(card?.globalRank, card?.globalRankApproximate);
  const notable = isNotable(card?.globalRank);

  // Record is already on the card; the rate it implies is the stat people actually quote,
  // and deriving it here costs nothing rather than another query.
  const decided = card ? card.wins + card.losses : 0;
  const winRate = decided > 0 ? Math.round((card!.wins / decided) * 100) : null;

  return (
    <>
      <PageHeader parent={LADDER} title={nameFor(profile)} />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      {/**
       * The hero.
       *
       * The emblem artwork used to sit at `lg` in the top-right corner of an identity
       * card, at which size it is a marker rather than a trophy — the app's single
       * strongest asset, filed as decoration. It is the subject of the page now: `xl`,
       * centred, lit by its own tier accent, with the name and standing underneath.
       */}
      <section className="flex flex-col items-center gap-4 text-center">
        {card && !placing ? (
          <RankEmblem
            tierId={card.rankTierId}
            division={card.rankDivision}
            size="xl"
            bloom={card.rankAccent}
          />
        ) : (
          <RankEmblem tierId="bronze" division={1} size="xl" unranked />
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h1 className="font-display text-display-2 sm:text-display-1 font-extrabold tracking-tight">
              {nameFor(profile)}
            </h1>
            {profile.isBot && <BotBadge size="md" />}
            {isMe && <Chip size="sm">you</Chip>}
          </div>

          <p className="text-body-lg flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-bold">
            <span style={{ color: placing ? undefined : card?.rankAccent }}>
              {placing ? "Unranked" : (card?.rankLabel ?? "—")}
            </span>
            {globalRank && (
              <>
                <span className="text-faint" aria-hidden="true">
                  ·
                </span>
                {/* Only the notable cutoff earns gold and the trophy glyph. Everyone
                    else still gets their real position — just quietly. */}
                <span
                  className={`inline-flex items-center gap-1 ${
                    notable ? "text-gold" : "text-muted"
                  }`}
                >
                  {notable && <Glyph name="win" filled />}
                  {globalRank} global
                </span>
              </>
            )}
          </p>

          {/* Only bots carry a handle line: their proper name heads the page, so the
              handle is extra information rather than the same string twice. */}
          {profile.isBot && <p className="text-body text-muted">@{profile.handle}</p>}

          {card?.bio && (
            <p className="text-body text-secondary max-w-md text-balance">{card.bio}</p>
          )}

          {placing && (
            <p className="text-body-sm text-muted">
              {profile.placementsRemaining} placement match
              {profile.placementsRemaining === 1 ? "" : "es"} to go before a rank appears.
            </p>
          )}
        </div>
      </section>

      {/* The stat strip. Four numbers, evenly weighted, in the app's numeral face —
          this is the line you read to size someone up. */}
      <Card variant="hero" className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Rating" value={placing ? "—" : String(profile.elo)} />
        <Stat label="Level" value={card ? `L${card.level}` : "—"} />
        <Stat
          label="Record"
          value={card ? `${card.wins}W · ${card.losses}L` : "—"}
        />
        <Stat label="Win rate" value={winRate === null ? "—" : `${winRate}%`} />
      </Card>

      <BadgeCase earned={card?.badges.map((badge) => badge.id) ?? []} />

      <Categories categories={profile.categories} />

      <RecentMatches userId={profile.userId} />

      {/* Reporting a bio you can't see is meaningless, and you can't report yourself. */}
      {!isMe && !profile.isBot && card?.bio && me && (
        <ReportDialog userId={profile.userId} displayName={nameFor(profile)} />
      )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      {/* Value above label. The numbers are what you scan; the words are what you read
          only if a number surprises you. */}
      <span className="font-display text-display-2 text-paper truncate font-extrabold tabular-nums">
        {value}
      </span>
      <span className="text-label text-muted font-semibold tracking-wider uppercase">
        {label}
      </span>
    </div>
  );
}

/**
 * The badge case.
 *
 * Shows every badge, not just the earned ones — a case with three things in it and no
 * sense of what else exists gives you nothing to chase. Locked entries carry their
 * description, which is already written as the instruction for earning it.
 */
function BadgeCase({ earned }: { earned: string[] }) {
  const owned = new Set(earned);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <SectionLabel>Badges</SectionLabel>
        <span className="text-body-sm text-muted tabular-nums">
          {owned.size} / {BADGES.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BADGES.map((badge) => {
          const has = owned.has(badge.id);
          return (
            <div
              key={badge.id}
              className={`flex items-center gap-3 rounded-md border p-3 ${
                has ? "border-gold bg-ink-700" : "border-line bg-ink-800"
              }`}
            >
              <span className={`text-2xl ${has ? "text-gold" : "text-faint"}`}>
                <BadgeMark id={badge.id} />
              </span>
              <div className="flex min-w-0 flex-col">
                <span
                  className={`text-body font-semibold ${has ? "text-paper" : "text-muted"}`}
                >
                  {badge.name}
                </span>
                <span className="text-body-sm text-muted">{badge.description}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Recent duels.
 *
 * `matchPlayers` has carried the rating delta, the points and the final health of every
 * match since the duel shipped, and nothing read them — a result existed for as long as
 * the results screen was on screen and then vanished. A record is most of what makes an
 * account look like an account.
 *
 * Every row opens the real results screen at /m/[matchId], carrying `?p=` so the verdict
 * is read from this player's side rather than the viewer's.
 */
function RecentMatches({ userId }: { userId: Id<"users"> }) {
  const matches = useQuery(api.matches.history, { userId });

  if (matches === undefined) {
    return (
      <section className="flex flex-col gap-3">
        <SectionLabel>Recent matches</SectionLabel>
        <Skeleton className="h-40 w-full" />
      </section>
    );
  }

  if (matches.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <SectionLabel>Recent matches</SectionLabel>
        <Empty
          title="No matches yet"
          body="Finished duels show up here with the result and the rating swing."
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Recent matches</SectionLabel>

      <ul className="flex flex-col gap-2">
        {matches.map((match) => {
          const result = match.drawn ? "draw" : match.won ? "won" : "lost";

          return (
            <li key={match.matchId}>
              <Link
                href={`/m/${match.matchId}?p=${userId}`}
                className="border-line bg-ink-800 hover:bg-ink-700 flex items-center gap-3
                           rounded-md border p-3 transition-colors"
              >
                {/* Was a 1px coloured bar down the left edge — the same tab motif the
                    ladder used, and just as anonymous. A result has a glyph for exactly
                    this; `signal-text` rather than `signal` because the mark is small and
                    `signal` is only legal at 24px and up. */}
                <span
                  aria-hidden
                  className={`flex size-9 shrink-0 items-center justify-center text-lg ${
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

                {match.opponent ? (
                  <Avatar
                    url={match.opponent.avatarUrl}
                    name={
                      match.opponent.isBot
                        ? match.opponent.displayName
                        : match.opponent.handle
                    }
                    className="size-9 shrink-0 text-sm"
                  />
                ) : (
                  <span className="bg-ink-600 size-9 shrink-0 rounded-full" />
                )}

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body flex items-center gap-1.5 truncate font-medium">
                    {match.opponent ? nameFor(match.opponent) : "Unknown opponent"}
                    {match.opponent?.isBot && <BotBadge size="sm" />}
                  </span>
                  <span className="text-body-sm text-muted">
                    {result === "draw" ? "Draw" : result === "won" ? "Win" : "Loss"}
                    {match.forfeited && " · resigned"}
                    {match.mode === "practice" && " · practice"}
                    {" · "}
                    {relativeDay(match.completedAt)}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-body font-display font-bold tabular-nums">
                    {match.totalPoints}
                    <span className="text-body-sm text-muted ml-1 font-normal">pts</span>
                  </span>
                  {match.ratingDelta !== null && (
                    <span
                      // Zero is its own case, not a small win. A loss at the rating floor
                      // reports a delta of 0 — `applyMatchResult` deliberately shows the
                      // drop actually taken — and coloring that gold would read as a gain.
                      className={`text-body-sm font-semibold tabular-nums ${
                        match.ratingDelta > 0
                          ? "text-gold"
                          : match.ratingDelta < 0
                            ? "text-signal-text"
                            : "text-muted"
                      }`}
                    >
                      {match.ratingDelta > 0 ? "+" : ""}
                      {match.ratingDelta}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Coarse on purpose: the exact minute of a match three weeks ago is not information. */
function relativeDay(completedAt: number): string {
  const days = Math.floor((Date.now() - completedAt) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(completedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/**
 * Per-category ratings — the one thing `users.profile` has that the player card does
 * not, and the most interesting data on the page: what this player is actually good at.
 */
function Categories({
  categories,
}: {
  categories: { slug: string; name: string; rating: number; games: number }[];
}) {
  if (categories.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <SectionLabel>Strongest categories</SectionLabel>
        <Empty
          title="No category data yet"
          body="Category ratings appear once a few ranked matches have been played."
        />
      </section>
    );
  }

  // Scaled against the strongest so the bars compare within this player rather than
  // against an absolute ceiling nobody can see.
  const top = Math.max(...categories.map((entry) => entry.rating));

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Strongest categories</SectionLabel>
      <div className="flex flex-col gap-3">
        {categories.map((category) => (
          <div key={category.slug} className="flex flex-col gap-1.5">
            <div className="text-body-sm flex items-baseline justify-between gap-3">
              <span className="text-paper truncate font-medium">{category.name}</span>
              <span className="text-muted shrink-0 tabular-nums">
                <span className="font-display text-secondary font-bold">
                  {Math.round(category.rating)}
                </span>{" "}
                · {category.games}g
              </span>
            </div>
            <Meter
              value={category.rating}
              max={top}
              height="sm"
              tone="paper"
              label={`${category.name} rating ${Math.round(category.rating)}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

