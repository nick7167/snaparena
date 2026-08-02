"use client";

import { motion } from "motion/react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { play } from "@/audio/sfx";
import { AVATAR_COLOURS } from "@/engine/config";
import { Button } from "@/ui/Button";
import { Field, Input } from "@/ui/Input";
import { settle } from "@/ui/motion";

/**
 * First-run profile setup.
 *
 * Only the username is required — it is the identity shown on every leaderboard,
 * VS screen and match history, so it must be chosen rather than auto-generated.
 * Avatar, bio and genres are skippable and editable later; nobody should be blocked
 * from playing by a form.
 *
 * Shown until `onboardedAt` is set on the user record.
 */
export function OnboardingGate() {
  const me = useQuery(api.users.me, {});

  // Still loading, signed out, or already done.
  if (!me || me.onboardedAt) return null;

  return <OnboardingModal suggestedHandle={me.handle} currentAvatar={me.avatarUrl} />;
}

function OnboardingModal({
  suggestedHandle,
  currentAvatar,
}: {
  suggestedHandle: string;
  currentAvatar?: string;
}) {
  const complete = useMutation(api.users.completeOnboarding);
  const categories = useQuery(api.tracks.categories, {});

  const [handle, setHandle] = useState(suggestedHandle);
  const [bio, setBio] = useState("");
  const [colour, setColour] = useState<string | null>(null);
  const [picked, setPicked] = useState<Id<"categories">[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live availability. Skipped until the handle is long enough to be valid.
  const availability = useQuery(
    api.users.isHandleAvailable,
    handle.trim().length >= 3 ? { handle } : "skip",
  );

  const canSubmit = availability?.available === true && !saving;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await complete({
        handle,
        bio: bio.trim() || undefined,
        avatarUrl: colour ? `color:${colour}` : currentAvatar,
        preferredCategoryIds: picked.length > 0 ? picked : undefined,
      });
      play("podium");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="bg-ink-900/90 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={settle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="border-line bg-ink-800 max-h-[90dvh] w-full max-w-lg overflow-y-auto
                   rounded-lg border p-6"
      >
        <h2 id="onboarding-title" className="font-display text-display-2 font-extrabold">
          Pick your username
        </h2>
        <p className="text-body text-secondary mt-1">
          This is how you&rsquo;ll appear on leaderboards and to your opponents.
        </p>

        <div className="mt-5">
          <Field
            label="Username"
            htmlFor="handle"
            help="3–16 characters · letters, numbers, underscore"
          >
            <Input
              id="handle"
              size="lg"
              value={handle}
              onChange={(event) => setHandle(event.target.value.toLowerCase().slice(0, 16))}
              autoComplete="off"
              spellCheck={false}
              prefix="@"
              suffix={<HandleStatus handle={handle} availability={availability} />}
            />
          </Field>
        </div>

        <fieldset className="mt-6">
          <legend className="text-label text-secondary font-semibold tracking-[0.12em] uppercase">
            Avatar <span className="text-muted normal-case">— optional</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {currentAvatar && (
              <button
                type="button"
                onClick={() => setColour(null)}
                className={`size-11 overflow-hidden rounded-md ring-2 ${
                  colour === null ? "ring-paper" : "ring-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentAvatar} alt="Your account picture" className="h-full w-full object-cover" />
              </button>
            )}
            {AVATAR_COLOURS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Avatar colour ${option}`}
                onClick={() => setColour(option)}
                style={{ backgroundColor: option }}
                className={`size-11 rounded-md ring-2 ring-offset-2 ${
                  colour === option ? "ring-paper ring-offset-ink-800" : "ring-transparent ring-offset-transparent"
                }`}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-6">
          <Field label="Tagline" htmlFor="bio" optional count={`${bio.length}/80`}>
            <Input
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value.slice(0, 80))}
              placeholder="One line about your taste"
              maxLength={80}
            />
          </Field>
        </div>

        <fieldset className="mt-4">
          <legend className="text-label text-secondary font-semibold tracking-[0.12em] uppercase">
            Favourite genres <span className="text-muted normal-case">— optional</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(categories ?? []).map((category) => {
              const on = picked.includes(category._id);
              return (
                <button
                  key={category._id}
                  type="button"
                  onClick={() =>
                    setPicked((current) =>
                      on
                        ? current.filter((id) => id !== category._id)
                        : [...current, category._id],
                    )
                  }
                  aria-pressed={on}
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
        </fieldset>

        {error && (
          <p className="text-body-sm text-signal-text mt-4" role="alert">
            {error}
          </p>
        )}

        <Button
          size="lg"
          block
          className="mt-6"
          disabled={!canSubmit}
          loading={saving}
          onClick={() => void submit()}
        >
          Start playing
        </Button>
      </motion.div>
    </div>
  );
}

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

  return (
    <span className="text-body-sm text-signal-text whitespace-nowrap">{message}</span>
  );
}
