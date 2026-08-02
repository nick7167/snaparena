"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { Field, Input } from "@/ui/Input";

/**
 * Sign in and sign up, in SNAP's own chrome.
 *
 * Clerk still owns identity — this is Clerk's custom-flow API driving our primitives,
 * not a reimplementation of authentication. What it replaces is `<SignInButton
 * mode="modal">`, which opened a hosted dialog that could never match the design system
 * and dropped the player out of whatever they were doing.
 *
 * WRITTEN AGAINST CLERK 7.6.4, WHICH IS NOT THE API IN MOST DOCUMENTATION.
 * v7 replaced the old `useSignIn()` hook with a signals API — the shape everyone knows
 * (`isLoaded`, `signIn.create`, `setActive`) now lives at `@clerk/react/legacy`. Here:
 *
 *   const { signIn, errors, fetchStatus } = useSignIn()
 *
 *   signIn.password({ identifier, password })     never throws — returns { error }
 *   signIn.sso({ strategy, redirectUrl, ... })    full-page redirect to the provider
 *   signIn.finalize({ navigate })                 replaces setActive() entirely
 *   errors.fields.password / errors.global        populated after a failed call
 *   fetchStatus === "fetching"                    the loading state
 *
 * The consequence worth internalising: nothing here needs a try/catch, because a wrong
 * password is a value rather than an exception.
 */

/** Where Clerk sends the browser back to after a social round trip. */
const SSO_CALLBACK = "/sso-callback";

export type AuthMode = "sign-in" | "sign-up";

/**
 * Social providers, in the order they are offered.
 *
 * Above the email form because most players arrive through one of these, and burying the
 * one-click path under a password field is how you lose people who already have an
 * account and cannot remember which method they used.
 */
// `as const` so the strategies stay literal types — `signIn.sso` takes Clerk's
// OAuthStrategy union, and a widened `string` does not satisfy it.
const SOCIAL = [
  { strategy: "oauth_google", label: "Google", brand: "#ffffff" },
  { strategy: "oauth_discord", label: "Discord", brand: "#5865f2" },
] as const;

type SocialStrategy = (typeof SOCIAL)[number]["strategy"];

export function AuthForm({
  mode,
  /** Where to land once the session is live. */
  redirectTo = "/",
  onModeChange,
}: {
  mode: AuthMode;
  redirectTo?: string;
  /** Provided by the dialog so switching does not navigate away mid-flow. */
  onModeChange?: (mode: AuthMode) => void;
}) {
  return mode === "sign-in" ? (
    <SignInForm redirectTo={redirectTo} onModeChange={onModeChange} />
  ) : (
    <SignUpForm redirectTo={redirectTo} onModeChange={onModeChange} />
  );
}

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

function SignInForm({
  redirectTo,
  onModeChange,
}: {
  redirectTo: string;
  onModeChange?: (mode: AuthMode) => void;
}) {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const busy = fetchStatus === "fetching";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { error } = await signIn.password({ identifier, password });
    // `errors` already carries the detail for the UI; this only decides whether to move.
    if (error) return;
    await signIn.finalize({ navigate: () => router.push(redirectTo) });
  }

  return (
    <div className="flex flex-col gap-5">
      <SocialButtons
        disabled={busy}
        onSelect={(strategy) =>
          // `redirectUrl` is where the player ends up; `redirectCallbackUrl` is the
          // staging route Clerk uses when the round trip did not produce a session on
          // its own. Getting these the wrong way round strands people on the spinner.
          signIn.sso({
            strategy,
            redirectUrl: redirectTo,
            redirectCallbackUrl: SSO_CALLBACK,
          })
        }
      />

      <Divider />

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Email"
          htmlFor="auth-identifier"
          error={errors.fields.identifier?.message}
        >
          <Input
            id="auth-identifier"
            type="email"
            size="lg"
            autoComplete="email"
            value={identifier}
            invalid={Boolean(errors.fields.identifier)}
            onChange={(event) => setIdentifier(event.target.value)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="auth-password"
          error={errors.fields.password?.message}
        >
          <Input
            id="auth-password"
            type="password"
            size="lg"
            autoComplete="current-password"
            value={password}
            invalid={Boolean(errors.fields.password)}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <GlobalError errors={errors.global} />

        <Button type="submit" size="lg" block loading={busy}>
          Sign in
        </Button>
      </form>

      <SwitchMode
        prompt="New here?"
        action="Create an account"
        onSelect={() => onModeChange?.("sign-up")}
        href="/sign-up"
        canSwitchInPlace={Boolean(onModeChange)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sign up                                                                     */
/* -------------------------------------------------------------------------- */

function SignUpForm({
  redirectTo,
  onModeChange,
}: {
  redirectTo: string;
  onModeChange?: (mode: AuthMode) => void;
}) {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const busy = fetchStatus === "fetching";
  // Clerk drives this, not us: the account exists after `password()` but the session is
  // not live until the address is verified, and `status` is how it says so.
  const verifying = signUp.status === "missing_requirements" && signUp.hasPassword;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { error } = await signUp.password({ emailAddress, password });
    if (error) return;

    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: () => router.push(redirectTo) });
      return;
    }
    await signUp.verifications.sendEmailCode();
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return;
    await signUp.finalize({ navigate: () => router.push(redirectTo) });
  }

  // A code has been sent, so the email and password fields are history — showing them
  // alongside the code box invites people to edit an address they have already proved.
  if (verifying) {
    return (
      <form onSubmit={verify} className="flex flex-col gap-4">
        <p className="text-body text-secondary">
          We sent a six-digit code to{" "}
          <span className="text-paper font-medium">{emailAddress}</span>.
        </p>

        <Field label="Code" htmlFor="auth-code" error={errors.fields.code?.message}>
          <Input
            id="auth-code"
            size="lg"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="font-display tracking-[0.4em]"
            value={code}
            invalid={Boolean(errors.fields.code)}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
        </Field>

        <GlobalError errors={errors.global} />

        <Button type="submit" size="lg" block loading={busy}>
          Verify and play
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => void signUp.verifications.sendEmailCode()}
        >
          Send it again
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SocialButtons
        disabled={busy}
        onSelect={(strategy) =>
          signUp.sso({
            strategy,
            redirectUrl: redirectTo,
            redirectCallbackUrl: SSO_CALLBACK,
          })
        }
      />

      <Divider />

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Email"
          htmlFor="auth-email"
          error={errors.fields.emailAddress?.message}
        >
          <Input
            id="auth-email"
            type="email"
            size="lg"
            autoComplete="email"
            value={emailAddress}
            invalid={Boolean(errors.fields.emailAddress)}
            onChange={(event) => setEmailAddress(event.target.value)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="auth-new-password"
          error={errors.fields.password?.message}
          help="At least 8 characters."
        >
          <Input
            id="auth-new-password"
            type="password"
            size="lg"
            autoComplete="new-password"
            value={password}
            invalid={Boolean(errors.fields.password)}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <GlobalError errors={errors.global} />

        {/* Clerk's bot check mounts itself here when the instance has it enabled.
            Without the element the sign-up fails with a captcha error nobody can act
            on, and the element is invisible until it is actually needed. */}
        <div id="clerk-captcha" />

        <Button type="submit" size="lg" block loading={busy}>
          Create account
        </Button>
      </form>

      <SwitchMode
        prompt="Already play?"
        action="Sign in"
        onSelect={() => onModeChange?.("sign-in")}
        href="/sign-in"
        canSwitchInPlace={Boolean(onModeChange)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

function SocialButtons({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (strategy: SocialStrategy) => Promise<unknown>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {SOCIAL.map((provider) => (
        <Button
          key={provider.strategy}
          type="button"
          variant="secondary"
          size="lg"
          block
          disabled={disabled}
          onClick={() => void onSelect(provider.strategy)}
        >
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: provider.brand }}
          />
          Continue with {provider.label}
        </Button>
      ))}
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="bg-line h-px flex-1" />
      <span className="text-label text-muted font-semibold tracking-[0.12em] uppercase">
        or
      </span>
      <span className="bg-line h-px flex-1" />
    </div>
  );
}

/**
 * Errors that belong to the attempt rather than to a field — a locked account, a rate
 * limit, an unverified identifier. `role="alert"` because these arrive after a submit,
 * when focus is on a button and nothing else announces them.
 */
function GlobalError({ errors }: { errors: { message: string }[] | null }) {
  if (!errors || errors.length === 0) return null;

  return (
    <p className="text-body-sm text-signal-text" role="alert">
      {errors.map((error) => error.message).join(" ")}
    </p>
  );
}

/**
 * In the dialog this swaps the form in place; on the standalone routes it has to be a
 * real link, because there is no parent holding the mode.
 */
function SwitchMode({
  prompt,
  action,
  onSelect,
  href,
  canSwitchInPlace,
}: {
  prompt: string;
  action: string;
  onSelect: () => void;
  href: string;
  canSwitchInPlace: boolean;
}) {
  return (
    <p className="text-body-sm text-muted text-center">
      {prompt}{" "}
      {canSwitchInPlace ? (
        <button
          type="button"
          onClick={onSelect}
          className="text-paper rounded-xs font-semibold underline"
        >
          {action}
        </button>
      ) : (
        <a href={href} className="text-paper rounded-xs font-semibold underline">
          {action}
        </a>
      )}
    </p>
  );
}
