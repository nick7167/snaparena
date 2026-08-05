"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, useSyncExternalStore } from "react";
import { api } from "../../../convex/_generated/api";
import { SignedIn, SignedOut } from "../auth-gate";
import { AuthDialogButton } from "@/auth/AuthDialogButton";
import { Button, ButtonLink } from "@/ui/Button";
import { Field, Input } from "@/ui/Input";
import { Card, SectionLabel, Skeleton } from "@/ui/Surface";
import { PageHeader } from "../page-header";
import { AvatarUpload } from "../avatar-upload";
import { BIO_MAX_LENGTH, HANDLE_MAX_LENGTH } from "@/engine/config";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  getMuteServerSnapshot,
  getMuteSnapshot,
  setMuted,
  subscribeMute,
} from "@/audio/sfx";

/**
 * Account settings.
 *
 * Wires `users.setHandle`, which existed with no caller — meaning the username chosen
 * during onboarding was permanent for no reason other than a missing screen.
 */
export default function SettingsPage() {
  return (
    <>
      {/* Settings is reached from the account menu, which is on every page — so "where
          you came from" is genuinely unpredictable here and the history-aware label
          earns its keep more than anywhere else in the app. */}
      <PageHeader parent={{ href: "/", label: "Home" }} />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-display-1 font-extrabold">Settings</h1>

      <SignedOut>
        <Card className="flex flex-col items-start gap-3 p-5">
          <p className="text-body text-secondary">Sign in to manage your account.</p>
          <AuthDialogButton mode="sign-in">Sign in</AuthDialogButton>
        </Card>
      </SignedOut>

      <SignedIn>
        <AvatarSection />
        <HandleSection />
        <BioSection />
        <GenresSection />
      </SignedIn>

      <SoundSection />
      </div>
    </>
  );
}

/**
 * Your picture.
 *
 * Settings offered nothing but the handle and a sound toggle, so an avatar chosen during
 * onboarding was permanent — the same gap `setHandle` had before it got a screen.
 */
function AvatarSection() {
  const me = useQuery(api.users.me, {});
  if (me === undefined) return <Skeleton className="h-28 w-full" />;
  if (me === null) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Picture</SectionLabel>
      <Card className="flex flex-col items-start gap-3 p-5">
        <AvatarUpload
          currentUrl={me.avatarUrl}
          name={me.handle}
          label={me.avatarUrl?.startsWith("http") ? "Replace picture" : "Upload a picture"}
        />
        <p className="text-body-sm text-muted">
          Shown on the leaderboard, on your profile, and to your opponents.
        </p>
      </Card>
    </section>
  );
}

function HandleSection() {
  const me = useQuery(api.users.me, {});
  const setHandle = useMutation(api.users.setHandle);

  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (me === undefined) return <Skeleton className="h-40 w-full" />;
  if (me === null) return null;

  // Uncontrolled until first edit, so the field shows the live handle without an effect
  // copying server state into local state.
  const value = draft ?? me.handle;
  const changed = value !== me.handle;

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Username</SectionLabel>
      <Card className="flex flex-col items-start gap-4 p-5">
        <Field
          label="Username"
          htmlFor="handle"
          error={error}
          help={`3–${HANDLE_MAX_LENGTH} characters · letters, numbers, underscore`}
        >
          <Input
            id="handle"
            size="lg"
            prefix="@"
            value={value}
            invalid={error !== null}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setDraft(event.target.value.toLowerCase().slice(0, HANDLE_MAX_LENGTH));
              setError(null);
              setSaved(false);
            }}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!changed || value.length < 3}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await setHandle({ handle: value });
                setDraft(null);
                setSaved(true);
              } catch (caught) {
                // The mutation is the authority here — it owns the blocklist, the
                // pattern and the uniqueness check, and its messages are already
                // written for a person to read.
                setError(
                  caught instanceof Error
                    ? caught.message.replace(/^\[.*?\]\s*/, "")
                    : "Could not save that",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>

          {changed && (
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          )}

          {saved && !changed && (
            <span className="text-body-sm text-secondary" role="status">
              Saved.
            </span>
          )}
        </div>

        <p className="text-body-sm text-muted">
          Your username is how you appear on leaderboards and to opponents. Changing it
          updates it everywhere, including past results.
        </p>

        <ButtonLink variant="secondary" href={`/u/${me.handle}`}>
          View your profile
        </ButtonLink>
      </Card>
    </section>
  );
}

/**
 * Your tagline.
 *
 * `users.updateProfile` handled this from the day it was written and had no caller, so a
 * bio chosen during onboarding was permanent — the same gap `setHandle` had before it got
 * a screen, and the reason this file exists at all.
 *
 * It is worse than an inconvenience, because a bio is the one profile field other players
 * can act on: `u/[handle]/report.tsx` lets anyone report it, and enough reports set
 * `bioHidden`. Without this section a player could have their tagline hidden pending
 * review and no way to change the thing being reviewed.
 */
function BioSection() {
  const me = useQuery(api.users.me, {});
  const updateProfile = useMutation(api.users.updateProfile);

  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (me === undefined) return <Skeleton className="h-40 w-full" />;
  if (me === null) return null;

  // Uncontrolled until first edit, matching HandleSection — no effect copying server
  // state into local state.
  const value = draft ?? me.bio ?? "";
  const changed = value !== (me.bio ?? "");

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Tagline</SectionLabel>
      <Card className="flex flex-col items-start gap-4 p-5">
        <Field
          label="Tagline"
          htmlFor="bio"
          error={error}
          optional
          count={`${value.length}/${BIO_MAX_LENGTH}`}
        >
          <Input
            id="bio"
            value={value}
            placeholder="One line about your taste"
            maxLength={BIO_MAX_LENGTH}
            invalid={error !== null}
            onChange={(event) => {
              setDraft(event.target.value.slice(0, BIO_MAX_LENGTH));
              setError(null);
              setSaved(false);
            }}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!changed}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                // Sent even when empty — an empty string is how a bio is deliberately
                // cleared, and the mutation distinguishes that from "not provided".
                await updateProfile({ bio: value });
                setDraft(null);
                setSaved(true);
              } catch (caught) {
                // The mutation owns the blocklist and its messages are already written
                // for a person; the prefix strip matches HandleSection.
                setError(
                  caught instanceof Error
                    ? caught.message.replace(/^\[.*?\]\s*/, "")
                    : "Could not save that",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>

          {changed && (
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          )}

          {saved && !changed && (
            <span className="text-body-sm text-secondary" role="status">
              Saved.
            </span>
          )}
        </div>

        <p className="text-body-sm text-muted">
          Shown on your profile and to your opponents before a duel.
        </p>
      </Card>
    </section>
  );
}

/**
 * Favourite genres.
 *
 * Collected during onboarding since it existed, written to the user row, and read by
 * absolutely nothing — not matchmaking, not track selection, not the veto pool, not the
 * profile. The question was asked at the highest-stakes moment in the funnel and the
 * answer was discarded.
 *
 * It is honest now: the profile renders them (see `users.profile`), so the picks are
 * visible to the player and to anyone looking them up. They still have no effect on
 * gameplay, which the copy below says outright rather than implying otherwise.
 */
function GenresSection() {
  const me = useQuery(api.users.me, {});
  const categories = useQuery(api.tracks.categories, {});
  const updateProfile = useMutation(api.users.updateProfile);

  const [draft, setDraft] = useState<Id<"categories">[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (me === undefined || categories === undefined) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (me === null) return null;

  const stored = me.preferredCategoryIds ?? [];
  const picked = draft ?? stored;
  const changed =
    draft !== null &&
    (draft.length !== stored.length || draft.some((id) => !stored.includes(id)));

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Favourite genres</SectionLabel>
      <Card className="flex flex-col items-start gap-4 p-5">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const on = picked.includes(category._id);
            return (
              <button
                key={category._id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setDraft(
                    on
                      ? picked.filter((id) => id !== category._id)
                      : [...picked, category._id],
                  );
                  setSaved(false);
                }}
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

        {error && (
          <p className="text-body-sm text-signal-text" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!changed}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await updateProfile({ preferredCategoryIds: picked });
                setDraft(null);
                setSaved(true);
              } catch {
                setError("Could not save that");
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>

          {changed && (
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          )}

          {saved && !changed && (
            <span className="text-body-sm text-secondary" role="status">
              Saved.
            </span>
          )}
        </div>

        <p className="text-body-sm text-muted">
          Shown on your profile. These do not affect which songs you are given — every
          match draws from the whole catalogue.
        </p>
      </Card>
    </section>
  );
}

/** Mirrors the shell's toggle; both read the same store, so they stay in step. */
function SoundSection() {
  const muted = useSyncExternalStore(subscribeMute, getMuteSnapshot, getMuteServerSnapshot);

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>Sound</SectionLabel>
      <Card className="flex items-center justify-between gap-4 p-5">
        <div className="flex flex-col">
          <span className="text-body text-paper font-medium">Sound effects</span>
          <span className="text-body-sm text-muted">
            Round cues, hits and results. Music always plays.
          </span>
        </div>
        {/* Same rule as MuteToggle: the accessible name is fixed and `aria-pressed`
            carries the state. The visible label still flips, because sighted users read
            it as the action — so the name is pinned separately rather than inherited from
            the text, which would otherwise announce "Unmute, pressed". */}
        <Button
          variant="secondary"
          onClick={() => setMuted(!muted)}
          aria-label="Sound effects"
          aria-pressed={!muted}
        >
          {muted ? "Unmute" : "Mute"}
        </Button>
      </Card>
    </section>
  );
}
