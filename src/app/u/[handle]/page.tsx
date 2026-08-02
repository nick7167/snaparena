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
import { Glyph } from "@/ui/Glyph";
import { ReportDialog } from "./report";

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
export default function ProfilePage() {
  const params = useParams<{ handle: string }>();
  const handle = (params.handle ?? "").toLowerCase();

  const profile = useQuery(api.users.profile, { handle });
  // Skipped until the handle resolves — there is no userId to ask about before then.
  const card = useQuery(api.matches.card, profile ? { userId: profile.userId } : "skip");
  const me = useQuery(api.users.me, {});

  if (profile === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-12">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <Empty
          title="No player with that name"
          body={`Nobody here goes by @${handle}.`}
        />
      </div>
    );
  }

  const isMe = me?._id === profile.userId;
  const placing = profile.placementsRemaining > 0;
  const globalRank = formatGlobalRank(card?.globalRank, card?.globalRankApproximate);
  const notable = isNotable(card?.globalRank);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      {/* Identity */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          {/* The avatar fallback is a single initial, so it takes the bare handle —
              "@" is not an initial. */}
          <Avatar
            url={profile.avatarUrl}
            name={profile.isBot ? profile.displayName : profile.handle}
            className="size-16 text-2xl"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-display-2 truncate font-extrabold">
                {nameFor(profile)}
              </h1>
              {profile.isBot && <BotBadge size="md" />}
              {isMe && <Chip size="sm">you</Chip>}
            </div>
            {/* Only bots carry a second line: their proper name heads the card, so the
                handle is extra information rather than the same string twice. */}
            {profile.isBot && <p className="text-body text-muted">@{profile.handle}</p>}

            {card?.bio && (
              <p className="text-body text-secondary mt-1">{card.bio}</p>
            )}
          </div>

          {card && !placing && (
            <RankEmblem tierId={card.rankTierId} division={card.rankDivision} size="lg" />
          )}
        </div>

        <div className="border-line grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
          <Stat
            label="Rank"
            value={placing ? "Unranked" : (card?.rankLabel ?? "—")}
            accent={placing ? undefined : card?.rankAccent}
          />
          <Stat label="Rating" value={placing ? "—" : String(profile.elo)} />
          <Stat label="Level" value={card ? `L${card.level}` : "—"} />
          <Stat
            label="Record"
            value={card ? `${card.wins}W · ${card.losses}L` : "—"}
          />
        </div>

        {placing && (
          <p className="text-body-sm text-muted">
            {profile.placementsRemaining} placement match
            {profile.placementsRemaining === 1 ? "" : "es"} to go before a rank appears.
          </p>
        )}

        {/* Every placed player gets a position, not just the top 100 — "where am I?" is
            the question a ladder exists to answer. Past 500 the server reports a bucket
            rather than an exact figure, so this reads "1,500+ global".

            Only the notable cutoff earns gold and the trophy glyph. A neutral chip below
            it keeps the flag meaning something. */}
        {globalRank && (
          <Chip tone={notable ? "gold" : "neutral"} size="sm" className="w-fit">
            {notable && <Glyph name="win" filled />}
            {globalRank} global
          </Chip>
        )}
      </Card>

      <BadgeCase earned={card?.badges.map((badge) => badge.id) ?? []} />

      <Categories categories={profile.categories} />

      <RecentMatches userId={profile.userId} />

      {/* Reporting a bio you can't see is meaningless, and you can't report yourself. */}
      {!isMe && !profile.isBot && card?.bio && me && (
        <ReportDialog userId={profile.userId} displayName={nameFor(profile)} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label text-muted font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span
        className="font-display text-body-lg truncate font-bold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
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
              <span className={`text-2xl ${has ? "" : "opacity-25 grayscale"}`}>
                {badge.emoji}
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
                <span
                  aria-hidden
                  className={`h-9 w-1 shrink-0 rounded-full ${
                    result === "won"
                      ? "bg-gold"
                      : result === "lost"
                        ? "bg-signal"
                        : "bg-ink-500"
                  }`}
                />

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

