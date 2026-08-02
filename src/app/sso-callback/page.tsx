"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Where Google and Discord drop the browser on the way back.
 *
 * `AuthenticateWithRedirectCallback` reads the parameters the provider appended, finishes
 * the sign-in or sign-up, and navigates on. It renders nothing, so this page is a spinner
 * over a component that is only ever on screen for a moment.
 */
export default function SsoCallbackPage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4">
      <span
        aria-hidden="true"
        className="border-line border-t-gold size-8 animate-spin rounded-full border-2"
      />
      <p className="text-body text-muted" role="status">
        Signing you in…
      </p>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
