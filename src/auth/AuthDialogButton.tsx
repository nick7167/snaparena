"use client";

import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { AuthForm, type AuthMode } from "./AuthForm";

/**
 * The single entry point into auth from anywhere in the app.
 *
 * Replaces every `<SignInButton mode="modal">` call site. Keeping it a dialog rather than
 * a navigation matters most at the end of a guest's daily run: sending someone to
 * /sign-in from that screen means their score scrolls away behind a page transition at
 * the exact moment they are deciding whether it is worth keeping.
 *
 * The standalone /sign-in and /sign-up routes render the same `AuthForm` for deep links
 * and for Clerk's own redirects.
 */
export function AuthDialogButton({
  mode: initialMode,
  children,
  variant,
  size,
  block,
  className,
  redirectTo,
  onOpen,
}: {
  mode: AuthMode;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  /** Defaults to staying put, which is almost always what a mid-flow sign-in wants. */
  redirectTo?: string;
  /**
   * Fired when the dialog is opened, for the call site to record the intent.
   *
   * Here rather than inside this component because the interesting fact is never "auth was
   * opened" — it is WHERE from. The same control on the daily result screen and in the
   * sidebar mean entirely different things to a funnel.
   */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Held here rather than in the form so switching between the two inside the dialog
  // does not remount and lose what has been typed into the shared fields.
  const [mode, setMode] = useState(initialMode);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        block={block}
        className={className}
        onClick={() => {
          setMode(initialMode);
          setOpen(true);
          onOpen?.();
        }}
      >
        {children}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "sign-in" ? "Welcome back" : "Create your account"}
        description={
          mode === "sign-in"
            ? "Pick up your rating, your level and your streak."
            : "Your scores go on the board, and your rating starts moving."
        }
      >
        <div className="mt-6">
          <AuthForm
            mode={mode}
            onModeChange={setMode}
            // Staying on the current URL is the point of the dialog. Clerk still needs
            // somewhere to return to after a social round trip, which is why the SSO
            // path takes an explicit destination.
            redirectTo={redirectTo ?? "/"}
          />
        </div>
      </Dialog>
    </>
  );
}
