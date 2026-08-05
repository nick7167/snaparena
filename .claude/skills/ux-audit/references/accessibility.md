# Accessibility — WCAG 2.2 checks verifiable in source

Only checks you can genuinely confirm by reading code appear here. Contrast ratios, reading order as rendered, animation comfort, and screen-reader *experience* are not on this list — they need the running app or a real assistive-tech pass, and belong in "Needs visual confirmation."

Each item gives the success criterion, the grep or read that finds it, and the consequence to name in the finding.

Read during Phase 5.

---

## Semantic structure

### Headings (1.3.1 Info and Relationships, 2.4.6 Headings and Labels)
- **Check:** grep for `<h1`–`<h6`. Does each page/route render exactly one `h1`? Do levels skip (h1 → h3)?
- **Check:** headings faked with styled `<div>`/`<span>` (a `text-2xl font-bold` div where a heading belongs).
- **Consequence:** screen-reader users navigate by heading. A page with no `h1` or with visual-only headings has no outline to jump through — they read linearly or leave.

### Landmarks (1.3.1, 2.4.1 Bypass Blocks)
- **Check:** does the layout use `<header>`, `<nav>`, `<main>`, `<footer>`, or is it `<div>` throughout? Is there exactly one `<main>`?
- **Check:** is there a skip link as the first focusable element on pages with substantial nav?
- **Consequence:** without landmarks and a skip link, keyboard and screen-reader users traverse the entire nav on every page load before reaching content.

### Lists, tables, and generic containers (1.3.1)
- **Check:** repeated items rendered as sibling `<div>`s rather than `<ul>/<li>`; tabular data in flex/grid divs rather than `<table>` with `<th scope>`.
- **Consequence:** a screen reader announces "list, 12 items" for the first and nothing for the second — the user loses both count and structure.

### Language (3.1.1)
- **Check:** `<html lang="…">` present in the root layout/document.

---

## Interactive elements

### Buttons and links (2.1.1 Keyboard, 4.1.2 Name Role Value)
- **Check (high-yield):** grep for `onClick` on `<div>` and `<span>`. Each hit is a control that is unreachable by keyboard and unannounced by role, unless it also carries `role`, `tabIndex={0}`, and key handlers.
- **Check:** `<a>` without `href` used as a button; `<button>` used for navigation (breaks open-in-new-tab and middle click).
- **Consequence:** keyboard-only and switch users cannot activate the control at all. This is a hard block, not friction — rate accordingly when it sits on a core path.

### Accessible names (4.1.2, 2.4.4 Link Purpose, 1.1.1 Non-text Content)
- **Check:** icon-only buttons with no `aria-label` — grep for `<button` whose children are only an icon component.
- **Check:** `<img>` without `alt`; decorative images without `alt=""`.
- **Check:** link text that is `"here"`, `"read more"`, `"click"`, or a bare URL.
- **Consequence:** the control is announced as "button" with no indication of what it does.

### Keyboard operability (2.1.1, 2.1.2 No Keyboard Trap, 2.4.3 Focus Order)
- **Check:** `onMouseEnter`/`onMouseOver` revealing content with no focus equivalent — hover-only menus and tooltips.
- **Check:** `tabIndex` values greater than 0 (they break document order).
- **Check:** modals/drawers/dialogs — is focus moved into the dialog on open, trapped while open, and restored to the trigger on close? Is Escape handled? Read the dialog primitive once; if it's a library primitive (Radix, React Aria, headlessui) this is usually handled and worth noting as working well. If it's hand-rolled, check it properly.
- **Check:** custom widgets (comboboxes, tabs, menus, sliders) implemented from scratch without arrow-key handling.
- **Consequence for focus restore:** after closing a dialog, focus lands back at document start, so the user re-traverses the page to return to where they were — every time.

### Focus visibility (2.4.7 Focus Visible, 2.4.11 Focus Not Obscured — 2.2)
- **Check:** grep for `outline: none` / `outline-none` / `focus:outline-none` and confirm a replacement focus style exists on the same element (`focus-visible:ring`, custom outline).
- **Consequence:** a sighted keyboard user has no idea where they are on the page.

### Target size (2.5.8 Target Size (Minimum) — new in 2.2)
- **Check:** interactive elements with explicit small dimensions (`h-6 w-6`, `padding: 2px`, icon buttons with no padding), especially in dense lists and toolbars.
- **Threshold:** 24×24 CSS pixels minimum, with exceptions for inline text links.
- **Consequence:** mis-taps on touch devices — worth pairing with a "destructive action adjacent to routine action" finding when both are true.

### Dragging (2.5.7 Dragging Movements — new in 2.2)
- **Check:** drag-and-drop reordering, kanban boards, sliders. Is there a non-drag alternative (move up/down buttons, a menu, keyboard reorder)?
- **Consequence:** users with motor impairments cannot perform the action at all.

---

## Forms

### Labels (1.3.1, 3.3.2 Labels or Instructions, 4.1.2)
- **Check:** every `<input>`, `<select>`, `<textarea>` has an associated `<label htmlFor>` matching its `id`, or an `aria-label`/`aria-labelledby`. Placeholder text is **not** a label.
- **Check:** required fields marked with more than color or a bare asterisk; `required`/`aria-required` present.
- **Consequence:** placeholder-as-label disappears on typing, so anyone who pauses mid-form loses the field's meaning; screen readers may not announce it at all.

### Errors (3.3.1 Error Identification, 3.3.3 Error Suggestion)
- **Check:** validation errors associated with their field via `aria-describedby`, and the field marked `aria-invalid`.
- **Check:** is the error announced? A live region (`role="alert"` / `aria-live`) for form-level errors, or focus moved to the first invalid field on submit.
- **Consequence:** a screen-reader user submits, nothing is announced, and the page appears unchanged — the form silently refuses to proceed.

### Redundant entry and authentication (3.3.7, 3.3.8 — new in 2.2)
- **Check:** multi-step flows re-asking for information already provided in an earlier step.
- **Check:** login/verification flows that block paste (`onPaste` preventDefault) or forbid password managers (`autocomplete="off"` on credential fields) — 3.3.8 Accessible Authentication.
- **Check:** missing `autocomplete` tokens on name/email/address/tel fields (1.3.5 Identify Input Purpose).

---

## Dynamic content

### Status messages (4.1.3 Status Messages)
- **Check:** toasts, inline success messages, async result counts, and loading announcements — do they live in a container with `role="status"`, `role="alert"`, or `aria-live`?
- **Consequence:** a sighted user sees the toast; a screen-reader user gets nothing, and the app appears not to have responded.

### Motion and timing (2.2.1 Timing Adjustable, 2.2.2 Pause Stop Hide, 2.3.3 Animation from Interactions)
- **Check:** auto-dismissing toasts with very short timeouts; carousels/auto-advancing content with no pause; session timeouts with no warning or extension.
- **Check:** any animation/transition code paired with a `prefers-reduced-motion` media query.

### Route changes in SPAs (4.1.3, 2.4.2 Page Titled)
- **Check:** does client-side navigation update the document title and move or reset focus? Framework routers usually don't do this by default.
- **Consequence:** the screen reader keeps reading the old page context after navigation; the user doesn't know the page changed.

---

## Fast first pass

If time is short, these six greps find the most real problems per minute:

```
onClick=\{[^}]*\}                 # then filter to div/span/li hosts
<button[^>]*>\s*<[A-Z]            # icon-only buttons — check for aria-label
outline-none|outline: *none       # focus styles removed
<img(?![^>]*alt=)                 # images without alt
placeholder=                      # then check each has a real label too
aria-live|role="alert"|role="status"   # absence across the app is the finding
```

Report the counts alongside two or three concrete instances with file:line. "47 `onClick` handlers on non-interactive elements, e.g. `PlayerCard.tsx:22`, `Row.tsx:58`" is a stronger finding than either the number or the examples alone.

---

## What to push to "Needs visual confirmation"

- Colour contrast of text, icons, focus rings, and disabled states (needs rendering; a token value in CSS is not enough without knowing what it's on).
- Whether the visible focus indicator is actually visible against its background.
- Reading order as rendered vs DOM order when CSS grid/flex reordering is used.
- Whether text reflows without loss at 320px / 400% zoom (1.4.10) — you can note the absence of responsive styles, not confirm the result.
- Actual screen-reader announcement quality.
- Whether motion is discomforting.
