"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/auth/AuthForm";
import { Card } from "@/ui/Surface";

/**
 * The standalone sign-in page.
 *
 * Most sign-ins in this app happen in a dialog, which is deliberate — see
 * AuthDialogButton. This route exists because some things can only be a URL: Clerk's own
 * redirects (NEXT_PUBLIC_CLERK_SIGN_IN_URL), a link in an email, and anyone who lands
 * here with the session already expired.
 *
 * The optional catch-all segment is Clerk's requirement, not ours: multi-step flows push
 * sub-paths under this route, and a plain `page.tsx` would 404 on them.
 */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInScreen />
    </Suspense>
  );
}

function SignInScreen() {
  // Set by whatever bounced the visitor here, so they resume rather than landing on the
  // home page having forgotten what they were doing.
  const redirectTo = useSearchParams().get("redirect_url") ?? "/";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display-1 font-extrabold">Welcome back</h1>
        <p className="text-body-lg text-secondary">
          Pick up your rating, your level and your streak.
        </p>
      </div>

      <Card className="p-6">
        <AuthForm mode="sign-in" redirectTo={redirectTo} />
      </Card>
    </div>
  );
}
