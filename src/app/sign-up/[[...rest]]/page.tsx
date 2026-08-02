"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/auth/AuthForm";
import { Card } from "@/ui/Surface";

/**
 * The standalone sign-up page. See sign-in for why this route exists alongside the
 * dialog, and why the segment is an optional catch-all.
 */
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpScreen />
    </Suspense>
  );
}

function SignUpScreen() {
  const redirectTo = useSearchParams().get("redirect_url") ?? "/";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display-1 font-extrabold">Create your account</h1>
        <p className="text-body-lg text-secondary">
          Your scores go on the board, and your rating starts moving.
        </p>
      </div>

      <Card className="p-6">
        <AuthForm mode="sign-up" redirectTo={redirectTo} />
      </Card>
    </div>
  );
}
