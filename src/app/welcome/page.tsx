"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AVATAR_COLOURS, HANDLE_MAX_LENGTH, REVEAL_BEATS, SCORE_TIERS } from "@/engine/config";
import { track } from "@/analytics";
import { TutorialRunner } from "@/game/TutorialRunner";
import { usePrefersReducedMotion } from "@/game/usePrefersReducedMotion";
import { Button } from "@/ui/Button";
import { Field, Input } from "@/ui/Input";
import { Card, Skeleton } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";
import { settle, snap } from "@/ui/motion";
import { AvatarUpload } from "../avatar-upload";
import { STEP, STEP_COUNT, STEP_LABELS } from "./steps";

/**
 * The welcome flow.
 *
 * Replaces `OnboardingGate`, which was a blocking modal titled "Pick your username" — a
 * profile form with no teaching in it at all. The app has a lot of systems (reveal beats,
 * score tiers, health, the ban draft, rating against level) and taught none of them; a new
 * player's first real round was also their first explanation.
 *
 * A ROUTE RATHER THAN A MODAL, which fixes three things at once. The old overlay never
 * contained focus and never locked scroll, so the entire app behind it stayed tabbable
 * while `aria-modal="true"` told assistive tech it was inert. A route has none of those
 * problems by construction, and it can hold a two-minute experience without fighting the
 * page underneath.
 *
 * THE UNUSUAL PART IS WHEN THE USERNAME IS COMMITTED: at step 1, not at the end. Convex has
 * no unique constraints, so `completeOnboarding` enforces uniqueness inside its own
 * transaction — the only way to hold a name is to write it. Deferring to the end would let
 * someone pick a free handle, spend two and a half minutes learning the game, and fail on
 * the last screen because the name went. So `onboardedAt` is set early and means "has a
 * username"; `welcomeStep` is what tracks the flow.
 */
export default function WelcomePage() {
  const { isLoaded, isSignedIn } = useUser();
  const me = useQuery(api.users.me, {});
  const router = useRouter();

  // Signed out entirely — nothing here applies. Replace rather than push, so Back does not
  // bounce them straight into a flow they cannot use.
  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/");
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || me === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-16">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Signed in, but the Convex row has not been provisioned yet. `UserProvisioner` in the
  // shell is creating it; this is a beat, not a state worth designing for.
  if (me === null) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-16">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <Flow me={me} />;
}

type Me = NonNullable<ReturnType<typeof useQuery<typeof api.users.me>>>;

function Flow({ me }: { me: Me }) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const setWelcomeStep = useMutation(api.tutorial.setWelcomeStep);
  const tutorialTrack = useQuery(api.tutorial.track, {});

  /**
   * Resumes where they left off.
   *
   * Seeded once from the server rather than kept in sync with it — this is a wizard, and
   * having the current screen re-derive from a live subscription would yank someone
   * sideways the moment any unrelated field on their user row changed.
   *
   * Someone who already has a username but no recorded step is mid-migration from the old
   * modal: send them to the explainer rather than asking for a name they already chose.
   */
  const [step, setStep] = useState<number>(() => {
    if (me.welcomeStep !== undefined) return me.welcomeStep;
    return me.onboardedAt ? STEP.EXPLAIN : STEP.INTRO;
  });

  const finish = useCallback(
    (completedTutorial: boolean) => {
      void setWelcomeStep({ step: STEP.DONE, tutorialCompleted: completedTutorial });
      track("welcome_finish", { completed_tutorial: completedTutorial });
      router.replace("/");
    },
    [setWelcomeStep, router],
  );

  const go = useCallback(
    (next: number) => {
      setStep(next);
      // Persisted per transition so a refresh, a closed tab or a dropped connection resumes
      // rather than restarting. Fire-and-forget: failing to record progress must never
      // block someone from moving through their own signup.
      void setWelcomeStep({ step: next });
      track("welcome_step", { step: next, name: STEP_LABELS[next] ?? String(next) });
    },
    [setWelcomeStep],
  );

  // Already through it. Guards a direct visit to /welcome by someone who has finished.
  useEffect(() => {
    if (step >= STEP.DONE) router.replace("/");
  }, [step, router]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <Progress step={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -12 }}
          transition={snap}
        >
          {step === STEP.INTRO && <Intro onNext={() => go(STEP.HANDLE)} />}

          {step === STEP.HANDLE && (
            <HandleStep me={me} onDone={() => go(STEP.AVATAR)} />
          )}

          {step === STEP.AVATAR && (
            <AvatarStep
              me={me}
              onNext={() => go(STEP.GENRES)}
              onSkip={() => go(STEP.GENRES)}
            />
          )}

          {step === STEP.GENRES && (
            <GenresStep
              onNext={() => go(STEP.EXPLAIN)}
              onSkip={() => go(STEP.EXPLAIN)}
            />
          )}

          {step === STEP.EXPLAIN && (
            <ExplainStep onNext={() => go(STEP.PLAY)} onSkip={() => finish(false)} />
          )}

          {step === STEP.PLAY && (
            <PlayStep
              track={tutorialTrack}
              onComplete={() => finish(true)}
              onSkip={() => finish(false)}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Where they are, without numbers — a wizard that counts at you feels like paperwork. */
function Progress({ step }: { step: number }) {
  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STEP_COUNT}
      aria-valuenow={Math.min(step + 1, STEP_COUNT)}
      aria-label="Setup progress"
    >
      {Array.from({ length: STEP_COUNT }, (_, index) => (
        <span
          key={index}
          className={`h-1 rounded-full transition-all ${
            index === step ? "bg-gold w-6" : index < step ? "bg-secondary w-3" : "bg-ink-600 w-3"
          }`}
        />
      ))}
    </div>
  );
}

function Intro({ onNext }: { onNext: () => void }) {
  return (
    <Card variant="hero" className="flex flex-col items-start gap-4 p-6">
      <span className="text-gold text-3xl leading-none">
        <Glyph name="tier" filled />
      </span>
      <h1 className="font-display text-display-1 font-extrabold tracking-tight">
        Welcome to SNAP
      </h1>
      <p className="text-body-lg text-secondary">
        You hear one second of a song. Name it before anyone else does.
      </p>
      <p className="text-body text-muted">
        Two minutes and you&rsquo;ll have played a round. Let&rsquo;s get you a name first.
      </p>
      <Button size="lg" block onClick={onNext}>
        Get started
      </Button>
    </Card>
  );
}

/**
 * The only required step.
 *
 * Commits the handle through `completeOnboarding`, which also sets `onboardedAt` — see the
 * note at the top of this file for why that happens here rather than at the end.
 */
function HandleStep({ me, onDone }: { me: Me; onDone: () => void }) {
  const complete = useMutation(api.users.completeOnboarding);
  const [handle, setHandle] = useState(me.handle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availability = useQuery(
    api.users.isHandleAvailable,
    handle.trim().length >= 3 ? { handle } : "skip",
  );

  const canSubmit = availability?.available === true && !saving;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await complete({ handle });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replace(/^\[.*?\]\s*/, "") : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display-2 font-extrabold">Pick your username</h1>
        <p className="text-body text-secondary">
          This is how you&rsquo;ll appear on leaderboards and to your opponents.
        </p>
      </div>

      <Field
        label="Username"
        htmlFor="handle"
        error={error}
        help={`3–${HANDLE_MAX_LENGTH} characters · letters, numbers, underscore`}
      >
        <Input
          id="handle"
          size="lg"
          value={handle}
          onChange={(event) =>
            setHandle(event.target.value.toLowerCase().slice(0, HANDLE_MAX_LENGTH))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSubmit) void submit();
          }}
          autoComplete="off"
          spellCheck={false}
          prefix="@"
          invalid={error !== null}
          suffix={<HandleStatus handle={handle} availability={availability} />}
        />
      </Field>

      <Button size="lg" block disabled={!canSubmit} loading={saving} onClick={() => void submit()}>
        Continue
      </Button>
    </Card>
  );
}

/** Moved wholesale from the old onboarding modal — the behaviour was already right. */
function HandleStatus({
  handle,
  availability,
}: {
  handle: string;
  availability: { available: boolean; reason?: string } | undefined;
}) {
  if (handle.trim().length < 3) return <span className="text-body-sm text-muted">3+</span>;
  if (!availability) return <span className="text-body-sm text-muted">…</span>;
  if (availability.available)
    return (
      <span className="text-body text-paper font-bold" title="Available">
        ✓
      </span>
    );

  const message =
    availability.reason === "taken"
      ? "taken"
      : availability.reason === "blocked"
        ? "not allowed"
        : "invalid";

  return <span className="text-body-sm text-signal-text whitespace-nowrap">{message}</span>;
}

function AvatarStep({
  me,
  onNext,
  onSkip,
}: {
  me: Me;
  onNext: () => void;
  onSkip: () => void;
}) {
  const updateProfile = useMutation(api.users.updateProfile);
  const [colour, setColour] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display-2 font-extrabold">Pick a look</h1>
        <p className="text-body text-secondary">
          Optional — you can change it any time in Settings.
        </p>
      </div>

      {/* Upload writes straight to the user row, so `uploaded` exists only to show the
          result here — clearing `colour` at the same time, since a picture and a swatch
          are alternatives. */}
      <AvatarUpload
        currentUrl={uploaded ?? (colour ? `color:${colour}` : me.avatarUrl)}
        name={me.handle}
        onUploaded={(url) => {
          setUploaded(url);
          setColour(null);
        }}
        label={uploaded ? "Replace picture" : "Upload a picture"}
      />

      <div className="flex flex-col gap-2">
        <p className="text-label text-muted">Or pick a colour</p>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLOURS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`Avatar colour ${option}`}
              aria-pressed={colour === option}
              onClick={() => {
                setColour(option);
                setUploaded(null);
                void updateProfile({ avatarUrl: `color:${option}` });
              }}
              style={{ backgroundColor: option }}
              className={`size-11 rounded-md ring-2 ring-offset-2 ${
                colour === option
                  ? "ring-paper ring-offset-ink-800"
                  : "ring-transparent ring-offset-transparent"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="lg" block onClick={onNext}>
          Continue
        </Button>
        <Button size="lg" variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </Card>
  );
}

function GenresStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const categories = useQuery(api.tracks.categories, {});
  const updateProfile = useMutation(api.users.updateProfile);
  const [picked, setPicked] = useState<Id<"categories">[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (picked.length === 0) return onNext();
    setSaving(true);
    try {
      await updateProfile({ preferredCategoryIds: picked });
    } catch {
      // Never hold someone in setup over an optional field.
    } finally {
      setSaving(false);
      onNext();
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display-2 font-extrabold">What do you listen to?</h1>
        {/*
         * Says what it is FOR, which it never used to.
         *
         * This question was asked during onboarding from the day it existed and the answer
         * was read by nothing — no matchmaking, no track selection, no screen. It shows on
         * your profile now, and the copy promises exactly that and nothing more.
         */}
        <p className="text-body text-secondary">
          Optional. It shows on your profile — every match still draws from the whole
          catalogue.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(categories ?? []).map((category) => {
          const on = picked.includes(category._id);
          return (
            <button
              key={category._id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setPicked((current) =>
                  on ? current.filter((id) => id !== category._id) : [...current, category._id],
                )
              }
              className={`text-body-sm min-h-9 rounded-sm border px-3 py-1.5 font-medium
                          transition-colors ${
                            on
                              ? "border-paper bg-paper text-ink-900"
                              : "border-line-strong text-secondary hover:bg-ink-600 hover:text-paper"
                          }`}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button size="lg" block loading={saving} onClick={() => void save()}>
          Continue
        </Button>
        <Button size="lg" variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </Card>
  );
}

/**
 * How a round works, in three beats.
 *
 * Every number is derived from `REVEAL_BEATS` and `SCORE_TIERS` rather than written out,
 * the same way `landing.tsx` does it — so retuning the curve cannot leave the tutorial
 * teaching numbers the game no longer uses.
 */
function ExplainStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const reduced = usePrefersReducedMotion();
  const snapTier = SCORE_TIERS[0];
  const lateTier = SCORE_TIERS[SCORE_TIERS.length - 1];

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display-2 font-extrabold">How a round works</h1>
        <p className="text-body text-secondary">Three things, then you play one.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Beat
          index={0}
          reduced={reduced}
          glyph="song"
          title={`You hear ${REVEAL_BEATS[0].playToMs / 1000} second`}
        >
          That is all you get at first. The clip grows every few seconds until someone
          names it.
        </Beat>

        <Beat
          index={1}
          reduced={reduced}
          glyph="tier"
          title={`Guess early, score ${snapTier.points}`}
        >
          Naming it on the first clip is a {snapTier.label}. Waiting for more of the song
          drops you to {lateTier.points}.
        </Beat>

        <Beat index={2} reduced={reduced} glyph="damage" title="In a duel, the gap hurts">
          Whoever is slower loses health equal to the difference between you. Reach zero
          and the duel is over.
        </Beat>
      </div>

      {/* The press that starts the audio — see TutorialRunner for why a real gesture here
          is what stops the tutorial opening into a blocked-playback error. */}
      <div className="flex gap-2">
        <Button size="lg" block onClick={onNext}>
          <Glyph name="tier" filled />
          Try it
        </Button>
        <Button size="lg" variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </Card>
  );
}

function Beat({
  index,
  reduced,
  glyph,
  title,
  children,
}: {
  index: number;
  reduced: boolean;
  glyph: "song" | "tier" | "damage";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...settle, delay: reduced ? 0 : index * 0.09 }}
      className="flex gap-3"
    >
      <span className="text-gold mt-0.5 shrink-0 text-lg leading-none">
        <Glyph name={glyph} filled />
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-body text-paper font-semibold">{title}</p>
        <p className="text-body-sm text-muted">{children}</p>
      </div>
    </motion.div>
  );
}

/** The coached rounds. Falls through gracefully if the catalogue has nothing to teach on. */
function PlayStep({
  track: tutorialTrack,
  onComplete,
  onSkip,
}: {
  track: { title: string; artist: string; artworkUrl: string; previewUrl: string } | null | undefined;
  onComplete: () => void;
  onSkip: () => void;
}) {
  if (tutorialTrack === undefined) {
    return <Skeleton className="h-80 w-full" />;
  }

  /**
   * An empty catalogue is a real state on a fresh deployment, and it must not trap anyone
   * inside setup. Finishing is the only sensible move — there is nothing to teach with.
   */
  if (tutorialTrack === null) {
    return (
      <Card className="flex flex-col items-start gap-4 p-6">
        <h1 className="font-display text-display-2 font-extrabold">You&rsquo;re all set</h1>
        <p className="text-body text-secondary">
          The practice song isn&rsquo;t available right now, so we&rsquo;ll skip straight
          to the game.
        </p>
        <Button size="lg" block onClick={onComplete}>
          Go to SNAP
        </Button>
      </Card>
    );
  }

  return (
    <TutorialRunner
      track={tutorialTrack}
      rivalName="Echo"
      onComplete={onComplete}
      onSkip={onSkip}
    />
  );
}
