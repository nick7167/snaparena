"use client";

import { useCategories, useMe, useProfile } from "../db";
import { STARTING_ELO } from "@/engine/config";
import { rankForElo } from "@/engine/ranks";
import { Meter, SectionLabel, Skeleton } from "@/ui/Surface";

/** Categories shown. Enough to see a shape, few enough to read at a glance. */
const SHOWN = 5;

/**
 * The band the bars are drawn across.
 *
 * Not 0-to-max: category ratings all start at STARTING_ELO and move at K=8, so a real
 * spread is a couple of hundred points either side of it. Scaled from zero, every bar
 * would sit at the same three-quarters-full and the panel would say nothing. This
 * centres the scale on where everyone begins, which is what makes "above" and "below"
 * legible at the actual magnitudes involved.
 */
const BAND = 400;

/**
 * Below this spread, the ordering is noise rather than a finding.
 *
 * K=8 over a handful of rounds moves a category a few points, so a player can have five
 * "different" ratings that are all the same answer. The bars draw that honestly — five
 * near-identical bars, because the truth is near-identical — and honest is exactly what
 * looks like a broken panel. So the panel says which it is rather than leaving the reader
 * to guess whether the renderer failed.
 */
const MEANINGFUL_SPREAD = 40;

/**
 * What you are good at.
 *
 * These are real Elo ratings, one per category, each updated against the opponent's
 * rating in that same category — see `applyCategoryResults`. "Rock 1310" means you beat
 * Rock-strong opponents on Rock rounds, not that you answered a lot of Rock questions.
 *
 * Ranked-only, and slow: K=8 over rounds that happen to carry the category. So the
 * teaching state below is not a placeholder, it is the state most players are genuinely
 * in for a while, and it has to say what to do about it rather than apologise.
 */
export function Categories() {
  const me = useMe();
  const profile = useProfile(me?.handle);
  const categories = useCategories();
  
  if (me === undefined) return <Skeleton className="h-40 w-full" />;
  if (!me) return null;

  const rated = (profile?.categories ?? []).filter((entry) => entry.games > 0);
  const shown = rated.slice(0, SHOWN);
  const counted = rated.reduce((total, entry) => total + entry.games, 0);
  const spread =
    shown.length > 1
      ? Math.max(...shown.map((e) => e.rating)) - Math.min(...shown.map((e) => e.rating))
      : 0;

  return (
    // See the note on Neighbours: grid items need min-w-0 or their fixed-width columns
    // push the track past the viewport.
    <section className="border-line bg-ink-800 flex min-w-0 flex-col gap-4 rounded-md border p-5">
      <SectionLabel>What you&rsquo;re good at</SectionLabel>

      {rated.length === 0 ? (
        <Teaching names={(categories ?? []).slice(0, SHOWN).map((row) => row.name)} />
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {shown.map((entry) => {
              const above = entry.rating >= STARTING_ELO;
              return (
                <li key={entry.slug} className="flex items-center gap-3">
                  <span className="text-body-sm text-secondary w-20 shrink-0 truncate sm:w-24">
                    {entry.name}
                  </span>
                  <Meter
                    value={Math.max(0, Math.min(BAND, entry.rating - (STARTING_ELO - BAND / 2)))}
                    max={BAND}
                    tone={above ? "gold" : "muted"}
                    height="sm"
                    className="min-w-0 flex-1"
                    label={`${entry.name}: rated ${entry.rating} over ${entry.games} rounds`}
                  />
                  <span
                    className="font-display text-body-sm w-10 shrink-0 text-right font-bold tabular-nums"
                    style={{ color: rankForElo(entry.rating).tier.accent }}
                  >
                    {entry.rating}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="text-label text-muted tabular-nums">
            {spread < MEANINGFUL_SPREAD ? (
              <>
                <span className="text-secondary">Too close to call yet.</span> Keep playing
                ranked and these will separate — {counted} rounds so far.
              </>
            ) : (
              <>{counted} ranked rounds counted</>
            )}
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Before there is anything to show.
 *
 * Names the categories and says exactly what moves them. A greyed list with no
 * explanation reads as a broken panel; the same list with one sentence reads as a thing
 * waiting to be filled in, which is what it is.
 */
function Teaching({ names }: { names: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-secondary">
        Every category carries its own rating, moved only by{" "}
        <span className="text-paper font-medium">ranked</span> rounds in that category.
        Play a few and this fills in.
      </p>

      <ul className="flex flex-col gap-2.5">
        {names.map((name) => (
          <li key={name} className="flex items-center gap-3">
            <span className="text-body-sm text-muted w-20 shrink-0 truncate sm:w-24">
              {name}
            </span>
            <Meter
              value={0}
              max={1}
              tone="muted"
              height="sm"
              className="min-w-0 flex-1"
              label={`${name}: not rated yet`}
            />
            <span className="text-body-sm text-faint w-10 shrink-0 text-right">—</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
