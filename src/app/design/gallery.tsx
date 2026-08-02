"use client";

import { useState } from "react";
import { RANK_TIERS, SCORE_TIERS } from "@/engine/config";
import { Button } from "@/ui/Button";
import { Field, Input } from "@/ui/Input";
import { Card, Chip, Empty, Meter, SectionLabel, Skeleton } from "@/ui/Surface";
import { Glyph, type GlyphName } from "@/ui/Glyph";
import { RankEmblem } from "@/ui/RankEmblem";
import { Avatar, BadgeRow, BotBadge, PhaseTimer, RankBadge, TierChip } from "@/game/ui";
import { useNow } from "@/game/usePrefersReducedMotion";

const GLYPHS: GlyphName[] = [
  "tier", "rank", "bot", "streak", "damage", "skip",
  "mute", "sound", "timer", "win", "loss", "draw", "song",
  "settings", "leave",
];

/** Mirrors rejectionMessage() in RoundRunner. Every branch must render somewhere. */
const REJECTIONS = [
  "locked-out", "already-solved", "too-many-attempts", "not-guessing-phase",
  "below-human-floor", "exceeds-server-window", "not-monotonic", "stale-round",
];

export function DesignGallery() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-1 font-extrabold">Design gallery</h1>
        <p className="text-body text-muted max-w-2xl">
          Every primitive in every state, on fixtures. Check this at 390px and 1440px,
          with <code className="text-secondary">prefers-reduced-motion</code> on and off,
          and with a keyboard only — every focusable element must show the paper ring.
        </p>
      </header>

      <Swatches />
      <Typography />
      <Buttons />
      <Inputs />
      <Surfaces />
      <Meters />
      <Glyphs />
      <Emblems />
      <GameChrome />
      <RareStates />
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-line flex flex-col gap-1 border-b pb-2">
        <SectionLabel>{title}</SectionLabel>
        {note && <p className="text-body-sm text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatches() {
  const groups: { name: string; items: { label: string; className: string; ratio?: string }[] }[] = [
    {
      name: "Surfaces",
      items: [
        { label: "ink-900", className: "bg-ink-900" },
        { label: "ink-800", className: "bg-ink-800" },
        { label: "ink-700", className: "bg-ink-700" },
        { label: "ink-600", className: "bg-ink-600" },
        { label: "ink-500", className: "bg-ink-500" },
        { label: "ink-inset", className: "bg-ink-inset" },
      ],
    },
    {
      name: "Text",
      items: [
        { label: "paper", className: "bg-paper", ratio: "15.9:1" },
        { label: "secondary", className: "bg-secondary", ratio: "8.2:1" },
        { label: "muted", className: "bg-muted", ratio: "4.7:1" },
        { label: "faint", className: "bg-faint", ratio: "2.1:1 — decorative only" },
      ],
    },
    {
      name: "Working colour",
      items: [
        { label: "signal", className: "bg-signal", ratio: "4.1:1 — ≥24px only" },
        { label: "signal-text", className: "bg-signal-text", ratio: "6.4:1" },
        { label: "gold", className: "bg-gold", ratio: "9.6:1" },
        { label: "teal", className: "bg-teal", ratio: "5.4:1" },
      ],
    },
  ];

  return (
    <Group title="Colour" note="Ratios measured against ink-800 in sRGB, where WCAG defines contrast.">
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.name} className="flex flex-col gap-2">
            <p className="text-body-sm text-secondary font-semibold">{group.name}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {group.items.map((item) => (
                <div key={item.label} className="flex flex-col gap-1.5">
                  <div className={`border-line h-14 rounded-md border ${item.className}`} />
                  <span className="text-label text-secondary">{item.label}</span>
                  {item.ratio && <span className="text-label text-muted">{item.ratio}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Group>
  );
}

function Typography() {
  return (
    <Group title="Type" note="Archivo for display and numerals (tabular). Geist for UI text.">
      <div className="flex flex-col gap-4">
        <p className="font-display text-display-hero font-extrabold">62</p>
        <p className="font-display text-display-1 font-extrabold">Victory</p>
        <p className="font-display text-display-2 font-bold">Blinding Lights</p>
        <p className="font-display text-numeral font-bold">1284 · 27.4s · −18</p>
        <p className="text-body-lg">Body large — the guess input.</p>
        <p className="text-body">Body — the default for prose and controls.</p>
        <p className="text-body-sm text-secondary">Body small — the floor for content.</p>
        <p className="text-label text-muted font-semibold tracking-[0.12em] uppercase">
          Label — section headings only
        </p>
        <div className="bg-ink-700 rounded-md p-4">
          <p className="font-display text-numeral tabular-nums">
            00.00 11.11 88.88 · digits must not reflow as they change
          </p>
        </div>
      </div>
    </Group>
  );
}

function Buttons() {
  const variants = ["primary", "secondary", "ghost", "destructive"] as const;
  return (
    <Group
      title="Button"
      note="Solid fill, hard 4px bottom edge, travels down on press. Tab to each — the paper focus ring is required."
    >
      <div className="flex flex-col gap-6">
        {variants.map((variant) => (
          <div key={variant} className="flex flex-col gap-2">
            <p className="text-body-sm text-secondary font-semibold">{variant}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={variant} size="sm">Small</Button>
              <Button variant={variant} size="md">Medium</Button>
              <Button variant={variant} size="lg">Large</Button>
              <Button variant={variant} loading>Loading</Button>
              <Button variant={variant} disabled>Disabled</Button>
              <Button variant={variant}>
                <Glyph name="song" /> With glyph
              </Button>
            </div>
          </div>
        ))}
        <div className="max-w-sm">
          <p className="text-body-sm text-secondary mb-2 font-semibold">block</p>
          <Button block size="lg">Find a match</Button>
        </div>
      </div>
    </Group>
  );
}

function Inputs() {
  const [value, setValue] = useState("");
  return (
    <Group title="Input" note="Inset, not raised — controls you press stand out, controls you fill are cut in.">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Empty" htmlFor="d-1" help="3–16 characters">
          <Input id="d-1" placeholder="Name the song…" />
        </Field>
        <Field label="Filled" htmlFor="d-2">
          <Input id="d-2" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type here" />
        </Field>
        <Field label="With affixes" htmlFor="d-3">
          <Input id="d-3" prefix="@" suffix={<span className="text-teal">✓</span>} defaultValue="kaya" />
        </Field>
        <Field label="Invalid" htmlFor="d-4" error="That handle is taken.">
          <Input id="d-4" invalid defaultValue="taken" />
        </Field>
        <Field label="Disabled" htmlFor="d-5">
          <Input id="d-5" disabled placeholder="Locked 2.4s" />
        </Field>
        <Field label="Large" htmlFor="d-6" optional count="24/80">
          <Input id="d-6" size="lg" placeholder="The guess field" />
        </Field>
      </div>
    </Group>
  );
}

function Surfaces() {
  return (
    <Group title="Surface" note="Card, emphasis card, chips, skeletons, empty state.">
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-body">Default card</p>
            <p className="text-body-sm text-muted">bg-ink-700, hairline border</p>
          </Card>
          <Card emphasis className="p-4">
            <p className="text-body">Emphasis card — &ldquo;this row is you&rdquo;</p>
            <p className="text-body-sm text-muted">Teal rail, no hue change to the fill</p>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["neutral", "gold", "signal", "teal", "paper"] as const).map((tone) => (
            <Chip key={tone} tone={tone}>{tone}</Chip>
          ))}
          {(["neutral", "gold", "paper"] as const).map((tone) => (
            <Chip key={`sm-${tone}`} tone={tone} size="sm">{tone} sm</Chip>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-24 w-full" />
        </div>

        <Empty
          title="Nobody has placed yet"
          body="Ratings appear here once a player finishes their placement matches."
          action={<Button variant="secondary">Play a bot</Button>}
        />
      </div>
    </Group>
  );
}

function Meters() {
  const values = [100, 62, 24, 8, 0];
  // Reuses the existing useNow hook rather than reading Date.now() during render, which
  // is impure. Offsets give three fixed fill levels — more useful to review than one
  // timer that happens to be running.
  const now = useNow(250);
  return (
    <Group title="Meter" note="One implementation for HP, XP and phase clocks. Announced as a progressbar.">
      <div className="flex flex-col gap-5">
        {values.map((value) => (
          <div key={value} className="flex items-center gap-4">
            <span className="font-display text-numeral w-12 shrink-0 font-bold tabular-nums">{value}</span>
            <Meter
              value={value}
              max={100}
              label={`Health ${value} of 100`}
              height="lg"
              tone={value === 0 ? "muted" : value < 25 ? "signal" : "teal"}
              className="flex-1"
            />
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <span className="text-body-sm text-secondary">XP (gold) and phase timer</span>
          <Meter value={40} max={100} label="XP progress" tone="gold" />
          <PhaseTimer endsAt={now + 20_000} durationMs={20_000} />
          <PhaseTimer endsAt={now + 10_000} durationMs={20_000} />
          <PhaseTimer endsAt={now + 2_000} durationMs={20_000} />
        </div>
      </div>
    </Group>
  );
}

function Glyphs() {
  return (
    <Group title="Glyph" note="Twelve marks, one 16×16 grid, one stroke weight. Replaces the emoji set.">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {GLYPHS.map((name) => (
          <div key={name} className="bg-ink-700 flex flex-col items-center gap-2 rounded-md p-3">
            <span className="text-2xl"><Glyph name={name} /></span>
            <span className="text-label text-muted">{name}</span>
          </div>
        ))}
      </div>
    </Group>
  );
}

/** Every rank in ladder order, derived from RANK_TIERS so this cannot drift from the engine. */
const EVERY_RANK = RANK_TIERS.flatMap((tier) =>
  Array.from({ length: tier.divisions }, (_, i) => ({
    tier,
    division: i + 1,
    label: tier.divisions > 1 ? `${tier.name} ${"I".repeat(i + 1)}` : tier.name,
  })),
);

function Emblems() {
  const gold = RANK_TIERS.find((tier) => tier.id === "gold")!;
  const legend = RANK_TIERS.find((tier) => tier.id === "legend")!;

  return (
    <Group
      title="Rank emblem"
      note="Two renditions. At 56px and above it is generated artwork, one bespoke emblem per rank. At 24 and 36px it is the chamfered brand plate in the tier accent, because the artwork turns to mush that small and five of the eight call sites are that small. Divisions ascend: I is the entry rank, III the top of a tier."
    >
      <div className="flex flex-col gap-8">
        {/* The whole ladder at hero size. This is the surface for checking that all
            sixteen assets exist, that the escalation reads, and that no emblem is
            missing after a re-slice. */}
        {RANK_TIERS.map((tier) => (
          <div key={tier.id} className="flex flex-wrap items-end gap-6">
            {EVERY_RANK.filter((rank) => rank.tier.id === tier.id).map((rank) => (
              <div key={rank.label} className="flex flex-col items-center gap-2">
                <RankEmblem tierId={rank.tier.id} division={rank.division} size="lg" />
                <span className="text-label text-muted">{rank.label}</span>
              </div>
            ))}
          </div>
        ))}

        {/* The same ranks as the small CSS mark — what the leaderboard and sidebar show. */}
        <div className="flex flex-wrap items-end gap-4">
          {EVERY_RANK.map((rank) => (
            <div key={rank.label} className="flex flex-col items-center gap-2">
              <RankEmblem tierId={rank.tier.id} division={rank.division} size="md" />
              <RankEmblem tierId={rank.tier.id} division={rank.division} size="sm" />
            </div>
          ))}
        </div>

        {/* Legend at xl — the promotion-banner size, and the widest asset in the set. */}
        <RankEmblem tierId={legend.id} division={1} size="xl" />

        {/* Unranked, at every size. Everyone starts on 1000 rating, which rankForElo
            reads as Silver II — so without this state a brand-new player was shown a
            Silver emblem beside the word "Unranked". */}
        <div className="flex flex-wrap items-end gap-4">
          {(["sm", "md", "lg", "xl"] as const).map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <RankEmblem tierId="silver" division={2} unranked size={size} />
              <span className="text-label text-muted">Unranked {size}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <RankBadge label="Gold II" tierId={gold.id} division={2} accent={gold.accent} />
          <RankBadge label="Legend" tierId={legend.id} accent={legend.accent} size="lg" />
          <RankBadge label="Bronze I" tierId="bronze" division={1} accent="#a9663c" size="sm" />
          <RankBadge label="Silver III" tierId="silver" division={3} accent="#9fb0c4" placements={3} />
        </div>
      </div>
    </Group>
  );
}

function GameChrome() {
  return (
    <Group title="Game chrome" note="Tier chips, bot marker, avatars, badges.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          {SCORE_TIERS.map((tier) => (
            <TierChip key={tier.id} tierId={tier.id} />
          ))}
          {SCORE_TIERS.map((tier) => (
            <TierChip key={`sm-${tier.id}`} tierId={tier.id} size="sm" />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <BotBadge />
          <BotBadge size="md" />
          <Avatar name="Kaya" url="color:#1F9E8C" />
          <Avatar name="Nick" />
          <Avatar name="Big" url="color:#F0B429" className="h-16 w-16 text-2xl" />
        </div>

        <BadgeRow
          badges={[
            { id: "a", name: "Quick Draw", emoji: "🎯" },
            { id: "b", name: "Perfect Round", emoji: "💯" },
            { id: "c", name: "Comeback", emoji: "🔁" },
          ]}
        />
        <BadgeRow badges={[]} />
      </div>
    </Group>
  );
}

/**
 * The states you cannot reach by playing. This is the reason the gallery exists.
 */
function RareStates() {
  return (
    <Group title="Rare states" note="Unreachable in normal play — audio faults, seeding failures, every rejection reason.">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-secondary font-semibold">Audio faults</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["audio-timeout", "This track took too long to load."],
              ["playback-blocked", "Your browser blocked audio playback."],
              ["load-failed", "This track's audio failed to load."],
            ].map(([key, message]) => (
              <Card key={key} className="flex flex-col gap-1 p-4">
                <p className="text-body">{message}</p>
                <p className="text-body-sm text-muted">The round will move on shortly.</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-secondary font-semibold">
            Guess rejections — all {REJECTIONS.length} branches
          </p>
          <div className="flex flex-wrap gap-2">
            {REJECTIONS.map((reason) => (
              <Chip key={reason} tone="signal" size="sm">{reason}</Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-secondary font-semibold">Match outcomes</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4 text-center">
              <p className="font-display text-display-2 text-paper font-extrabold">VICTORY</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="font-display text-display-2 text-signal-text font-extrabold">DEFEAT</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="font-display text-display-2 text-muted font-extrabold">DRAW</p>
            </Card>
          </div>
        </div>
      </div>
    </Group>
  );
}
