"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BOT_PERSONAS, practiceCandidates } from "@/engine/bots";
import { rankForElo } from "@/engine/ranks";
import { Panel, Skeleton } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { CountUp } from "../dashboard/motion";

/**
 * The opponents you might get, and the ones you have beaten.
 *
 * Practice's whole cast was invisible. Twelve personas with ratings, genre strengths and a
 * line of their own, and the page showed a generic bot badge and the words "a bot near your
 * rating" — so the most characterful content in the app never reached a player until the VS
 * reveal, by which point they were already committed.
 *
 * Neither panel here costs a query the app was not already making: the shortlist is pure
 * client arithmetic over `users.me`, and `bots.beaten` is the one addition.
 */

/** The 2–3 personas the server will actually draw from, named before you commit. */
export function Shortlist() {
  const me = useQuery(api.users.me, {});

  if (me === undefined) return <Skeleton className="h-24 w-full" />;
  if (!me) return null;

  // The same function the server picks with — see `practiceCandidates`. Re-deriving the
  // rule here would work today and lie the first time it changed.
  const candidates = practiceCandidates(me.elo, me.lastPracticePersonaId);

  return (
    <div className="flex flex-col gap-2.5">
      <ul className="flex flex-col gap-1.5">
        {candidates.map((persona) => {
          const accent = rankForElo(persona.elo).tier.accent;
          return (
            <li key={persona.id} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span className="text-body text-paper min-w-0 flex-1 truncate font-semibold">
                {persona.displayName}
              </span>
              {/* Strengths, not the bio — three lines of prose in a row this size is a
                  paragraph pretending to be a list. The bio gets its room below. */}
              <span className="text-label text-muted hidden min-w-0 truncate sm:block">
                {persona.strongCategories.length > 0
                  ? persona.strongCategories.join(" · ")
                  : "no weak spot"}
              </span>
              <span
                className="font-display text-body-sm w-10 shrink-0 text-right font-bold tabular-nums"
                style={{ color: accent }}
              >
                {persona.elo}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-label text-muted tabular-nums">
        Drawn from the personas nearest your rating of {me.elo}
        {me.lastPracticePersonaId ? ", minus whoever you just played" : ""}.
      </p>
    </div>
  );
}

/**
 * All twelve, as a set to complete.
 *
 * A collection rather than a win-loss table: `bots.beaten` reads a bounded window, so a
 * tally would be a floor presented as a fact — and a record would punish a bad night
 * against a bot already cleared. One bit per bot is the claim the data can actually make.
 */
export function Roster() {
  const record = useQuery(api.bots.beaten, {});

  if (record === undefined) return <Skeleton className="h-64 w-full" />;

  const beaten = new Set(record.beaten);
  const ordered = [...BOT_PERSONAS].sort((a, b) => a.elo - b.elo);

  return (
    <Panel title="The roster" aside={`${beaten.size} / ${BOT_PERSONAS.length}`}>
      <ul className="flex flex-col">
        {ordered.map((persona) => {
          const won = beaten.has(persona.id);
          const accent = rankForElo(persona.elo).tier.accent;

          return (
            <li
              key={persona.id}
              className="border-line flex items-center gap-3 border-b py-2.5 last:border-b-0"
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center text-sm ${
                  won ? "text-gold" : "text-faint"
                }`}
              >
                {won ? <Glyph name="win" filled /> : <Glyph name="bot" />}
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`text-body truncate font-semibold ${
                    won ? "text-paper" : "text-secondary"
                  }`}
                >
                  {persona.displayName}
                </span>
                {/* The bio is the reason this roster is worth showing at all. */}
                <span className="text-label text-muted truncate italic">
                  {persona.bio}
                </span>
              </span>

              <span
                className="font-display text-body-sm w-10 shrink-0 text-right font-bold tabular-nums"
                style={{ color: won ? accent : undefined }}
              >
                {persona.elo}
              </span>
            </li>
          );
        })}
      </ul>

      {record.played > 0 && (
        <p className="text-label text-muted tabular-nums">
          <CountUp value={record.played} /> practice matches counted
          {record.approximate ? " (most recent)" : ""}
        </p>
      )}
    </Panel>
  );
}
