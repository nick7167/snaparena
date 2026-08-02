"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { settle } from "./motion";

/**
 * A modal dialog.
 *
 * Extracted because the pattern had been hand-rolled three times — onboarding, the report
 * dialog, and now auth — and each copy got a slightly different subset of the behaviour
 * right. The parts that are easy to forget and impossible to notice missing are the ones
 * that live here: Escape, the backdrop click, focus moving in on open and returning to
 * whatever opened it on close, and a scroll lock so the page behind does not slide about
 * under the overlay.
 *
 * Deliberately not a portal. Nothing in this app renders inside a transform or an
 * overflow-hidden ancestor at the root, and `fixed inset-0 z-50` is enough — a portal
 * would buy nothing and cost an effect that runs on every mount.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  /** Rendered as the dialog heading. Omit only when `labelledBy` names one inside. */
  title?: string;
  description?: string;
  children: ReactNode;
  /** Use when the heading is supplied by `children` rather than by `title`. */
  labelledBy?: string;
}) {
  const generatedId = useId();
  const titleId = labelledBy ?? `${generatedId}-title`;
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    // Remembered before focus moves, so closing returns the user to the control they
    // opened this with rather than to the top of the document.
    opener.current = document.activeElement;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // The first focusable thing inside, falling back to the panel itself so focus is
    // never left outside an aria-modal container.
    const focusable = panel.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? panel.current)?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="bg-ink-900/90 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur"
      // Only a click that both starts and ends on the backdrop dismisses. Without the
      // target check, releasing the mouse outside after selecting text inside the panel
      // closes the dialog and throws the input away.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panel}
        tabIndex={-1}
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={settle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="border-line bg-ink-800 max-h-[90dvh] w-full max-w-md overflow-y-auto
                   rounded-lg border p-6 outline-none"
      >
        {title && (
          <h2 id={titleId} className="font-display text-display-2 font-extrabold">
            {title}
          </h2>
        )}
        {description && <p className="text-body text-secondary mt-1">{description}</p>}
        {children}
      </motion.div>
    </div>
  );
}
