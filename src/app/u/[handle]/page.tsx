"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { BADGES } from "@/engine/badges";
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
            <RankEmblem accent={card.rankAccent} divisions={divisions(card.rankLabel)} size="lg" />
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

        {card?.globalRank !== null && card?.globalRank !== undefined && (
          <Chip tone="gold" size="sm" className="w-fit">
            <Glyph name="win" filled />#{card.globalRank} global
          </Chip>
        )}
      </Card>

      <BadgeCase earned={card?.badges.map((badge) => badge.id) ?? []} />

      <Categories categories={profile.categories} />

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

/** "Gold II" → 2, matching how RankBadge derives chevrons. */
function divisions(label: string | undefined): number {
  const suffix = label?.trim().split(/\s+/).pop();
  return suffix === "III" ? 3 : suffix === "II" ? 2 : 1;
}
