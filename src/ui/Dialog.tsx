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

    /**
     * Escape closes, and Tab is contained.
     *
     * The trap was the missing half. Focus moved IN on open and back OUT on close, but
     * nothing stopped Tab walking straight out of the panel and into the page behind —
     * which `aria-modal="true"` has already promised assistive technology is inert. A
     * screen-reader user tabbing out of a dialog lands in content their software has been
     * told does not exist, with no visible indication they have left.
     *
     * Recomputed per keypress rather than cached on open, because the focusable set is not
     * static: the auth dialog swaps between sign-in and sign-up, and the report dialog
     * reveals a confirm step. A list captured at open time would be wrong by then.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Wrapping is what makes it a trap rather than a wall: Tab past the end returns to
      // the start, and Shift+Tab before the start goes to the end.
      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
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
