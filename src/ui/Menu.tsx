"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Glyph, type GlyphName } from "./Glyph";

/**
 * A menu button and its menu.
 *
 * Built rather than hand-rolled per call site because a dropdown is mostly the parts
 * nobody remembers: Escape, click-outside, returning focus to the trigger, and arrow
 * keys. A `useState` toggle gets the visible half right and none of that.
 *
 * Follows the WAI-ARIA menu button pattern — `aria-haspopup` / `aria-expanded` on the
 * trigger, `role="menu"` on the surface, `role="menuitem"` on each entry — so a screen
 * reader announces it as a menu rather than as a pile of buttons that appeared.
 *
 * Deliberately not animated. This is a control you stab at; a menu that fades in is a
 * menu you mis-click. The mount is instant and the CSS transitions are hover only.
 */

/**
 * `returnFocus: false` is for dismissals where focus is already going somewhere else —
 * a link navigating away, or Clerk's modal taking over. Yanking it back to the trigger
 * in those cases fights whatever the user actually did.
 */
const MenuContext = createContext<{ close: (returnFocus?: boolean) => void }>({
  close: () => {},
});

export function Menu({
  trigger,
  label,
  side = "bottom",
  align = "start",
  className = "",
  triggerClassName = "",
  children,
}: {
  /** Rendered inside the trigger button. */
  trigger: ReactNode;
  /** Accessible name for the trigger. */
  label: string;
  /** `top` opens upward — used by the sidebar, which sits at the bottom of the screen. */
  side?: "top" | "bottom";
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    // Focus goes back where it came from, or a keyboard user is dumped at the top of
    // the document every time they dismiss a menu.
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Click-outside. The trigger is excluded because it has its own toggle handler —
  // without that check a click on it would close here and reopen there.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Focus the first item on open, which is what makes the menu reachable by keyboard
  // at all. Deferred a frame so the surface is mounted and measurable first.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => itemsOf(menuRef.current)[0]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = itemsOf(menuRef.current);
    if (items.length === 0) return;

    const index = items.indexOf(document.activeElement as HTMLElement);

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "ArrowDown":
        event.preventDefault();
        items[(index + 1) % items.length].focus();
        return;
      case "ArrowUp":
        event.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
        return;
      case "Home":
        event.preventDefault();
        items[0].focus();
        return;
      case "End":
        event.preventDefault();
        items[items.length - 1].focus();
        return;
      case "Tab":
        // Tabbing away is a dismissal, but the browser is already moving focus —
        // reclaiming it for the trigger would fight the user.
        close(false);
        return;
      default:
        return;
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          // Opening straight onto the first item, so a keyboard user never has to
          // open and then hunt for the list.
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={`border-line bg-ink-800 absolute z-50 flex min-w-56 flex-col gap-0.5 rounded-md
                      border p-1.5 shadow-lg
                      ${side === "top" ? "bottom-full mb-2" : "top-full mt-2"}
                      ${align === "end" ? "right-0" : "left-0"}`}
        >
          <MenuContext.Provider value={{ close }}>{children}</MenuContext.Provider>
        </div>
      )}
    </div>
  );
}

/** Focusable entries, in DOM order. Queried rather than tracked so items stay declarative. */
function itemsOf(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
}

const ITEM_CLASS =
  `text-body text-secondary hover:bg-ink-600 hover:text-paper focus-visible:bg-ink-600
   focus-visible:text-paper flex w-full items-center gap-3 rounded-sm px-3 py-2
   text-left font-medium transition-colors`;

/**
 * One entry. Either navigates (`href`) or acts (`onSelect`) — never both.
 *
 * Selecting always closes the menu, which is the behaviour every menu has and the one
 * most easily forgotten when these are hand-rolled.
 */
export function MenuItem({
  children,
  glyph,
  href,
  onSelect,
  tone = "default",
}: {
  children: ReactNode;
  glyph?: GlyphName;
  href?: string;
  onSelect?: () => void;
  /** `danger` is for sign-out and nothing else. */
  tone?: "default" | "danger";
}) {
  const { close } = useContext(MenuContext);
  const toneClass = tone === "danger" ? "text-signal-text hover:text-signal-text" : "";

  const body = (
    <>
      {glyph && (
        <span className="w-4 shrink-0 text-lg leading-none">
          <Glyph name={glyph} />
        </span>
      )}
      <span className="min-w-0 truncate">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link
        role="menuitem"
        href={href}
        onClick={() => close(false)}
        className={`${ITEM_CLASS} ${toneClass}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      role="menuitem"
      type="button"
      onClick={() => {
        // Closed before the action runs: `signOut` unmounts this subtree, and calling
        // close() afterwards would set state on a component that no longer exists.
        close(false);
        onSelect?.();
      }}
      className={`${ITEM_CLASS} ${toneClass}`}
    >
      {body}
    </button>
  );
}

/** Non-interactive grouping line. Skipped by arrow-key navigation, being no menuitem. */
export function MenuSeparator() {
  return <div role="separator" className="bg-line my-1 h-px" />;
}
