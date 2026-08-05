# Usability Heuristics — with code-level tells

Nielsen's ten heuristics, each paired with the thing that actually matters here: what a violation looks like *in source*. The heuristic name is a label for a finding, not the finding itself. Lead with the consequence, cite the heuristic at the end.

Read this before Phase 4 and keep the "tells" column in mind while tracing journeys.

---

## 1. Visibility of system status

The user should always know what the system is doing and whether their action worked.

**Code-level tells**
- An async handler (`onSubmit`, `onClick` calling a mutation/fetch) with no pending state — no `isLoading`, `isPending`, `isSubmitting` referenced in the JSX it returns.
- A component that fetches but renders only the success branch: no skeleton, no spinner, no `if (loading)`.
- A mutation whose `.then()` does nothing user-visible — no toast, no redirect, no state change. The user cannot distinguish success from a no-op.
- Optimistic updates with no rollback path on error: the UI says it worked and the server disagrees silently.
- Long-running work (upload, export, batch job) with a binary pending/done state and no progress indication.
- Buttons that stay enabled during submission — the tell is an absent `disabled={isPending}`; the consequence is double submission.

**Example finding shape**
> `ExportButton.tsx:44` fires the export mutation and immediately closes the dialog. The job runs 10–60s server-side with no notification on completion, so the user's only way to learn it finished is to re-open the exports list and guess.

---

## 2. Match between system and the real world

The product should speak the user's language, not the database's.

**Code-level tells**
- Enum values, table names, or internal IDs rendered straight to the user: `status: "PENDING_REVIEW_2"`, `Deal stage: STAGE_C`.
- Error strings that surface implementation detail — `"Constraint violation on users_email_key"`, raw HTTP codes, stack fragments.
- Domain vocabulary that differs between the schema, the UI copy, and the nav. If the schema says `organization`, the nav says "Teams", and the settings page says "Workspace", that is three names for one object.
- Date/time rendered in ISO or epoch form in a user-facing surface.
- Sort orders that follow insertion or ID order where users expect recency or alphabetical.

**Note:** jargon is only a violation relative to the audience. A tool for radiologists should say "priors", not "old scans." Establish the audience in Phase 3 before calling vocabulary wrong.

---

## 3. User control and freedom

Users need a clearly marked exit from anywhere they land.

**Code-level tells**
- Destructive mutations (`delete`, `remove`, `archive`, `cancel`, `reset`) called directly from an `onClick` with no confirmation dialog and no undo.
- Confirmation dialogs where the destructive action is the default/primary-styled button.
- Modals rendered without an `onClose`/escape handler, or with `onOpenChange` ignored.
- Multi-step wizards where the step state is local component state — no back navigation, and a refresh loses everything.
- Forms with no cancel affordance, or a cancel that discards without warning when the form is dirty (no `isDirty` check before navigating away).
- Bulk actions with no selection-clearing or preview of what will be affected.
- "Undo" existing nowhere in the codebase while `delete` appears in many places — a legitimate systemic finding.

**Example finding shape**
> `MemberRow.tsx:61` calls `removeMember` directly from the trash icon's `onClick`. There is no confirmation and no undo, and the mutation is not soft-delete (`members.ts:88` deletes the row), so a misclick on a touch target adjacent to "Edit" permanently removes a teammate and their history.

---

## 4. Consistency and standards

The same thing should look, read, and behave the same everywhere. Platform conventions count too.

**Code-level tells**
- Count the implementations: how many distinct `Button`, `Modal`, `Input`, `Toast`, `Card` components exist? Two is a smell; four is a finding.
- Mixed styling approaches in the same app — CSS modules here, inline styles there, three different spacing scales.
- The same concept labeled differently across screens ("Delete" / "Remove" / "Discard" for one action).
- Date formatting done ad hoc at call sites rather than through one helper. Grep for `toLocaleDateString`, `format(`, manual `.split("T")`.
- Inconsistent error presentation: some failures toast, some render inline, some only `console.error`.
- Navigation patterns that vary by section — a sidebar on some routes, tabs on others, for the same level of hierarchy.
- Icon meanings reused for different actions.

This heuristic is best audited by grep, not by reading. It is one of the few places a count is itself the evidence.

---

## 5. Error prevention

Better than a good error message is a design where the error can't happen.

**Code-level tells**
- Free-text inputs where a constrained control fits (a text field for a date, a country, a known enum).
- No client-side validation before an expensive or irreversible submit.
- Destructive actions positioned adjacent to routine ones in the same control group.
- Missing `type="button"` on non-submit buttons inside forms — they submit the form.
- No debounce/guard on handlers that create records, allowing duplicates from double-click.
- Inputs with no `maxLength`, `min`/`max`, `step`, `inputMode`, or `autocomplete` where the field has an obvious constraint.
- Format requirements enforced only server-side and only stated after failure ("password must contain…" revealed on submit).
- Numeric inputs that accept negative values the domain can't represent.

---

## 6. Recognition rather than recall

Don't make users remember things across screens.

**Code-level tells**
- Multi-step flows that don't show what was entered in earlier steps (no summary/review step before a consequential submit).
- Search or filter state that resets on navigation — filters held in local state, not URL params. The tell is `useState` for filters plus no `searchParams` usage; the consequence is a lost result set on every back-navigation.
- Settings that reference identifiers the user must have memorized (raw IDs, key prefixes) with no human-readable label.
- Forms that require data the user has to fetch from elsewhere in the app, with no picker or lookup.
- Empty states that don't say what the screen is for or what to do next — just "No results".
- Keyboard shortcuts with no discoverable list.

---

## 7. Flexibility and efficiency of use

Serve the novice without taxing the expert.

**Code-level tells**
- No keyboard shortcuts anywhere in a tool designed for daily/repeat use.
- No bulk operations where the data model clearly implies them (a list of items, each with the same single-item action).
- Mandatory onboarding or tours with no skip.
- No saved views, filters, presets, or defaults in an app whose core loop is repeated queries.
- Deep-linkable state absent: everything behind client-side state means an expert can't bookmark or share a view.
- No sensible defaults — required fields the system could reasonably prefill (timezone, currency, the user's only team).

---

## 8. Aesthetic and minimalist design

Every extra element competes with the relevant ones. **This is the heuristic most likely to tempt you into unverifiable claims.** From code you can count and structure; you cannot see clutter. Report counts and structure, and push the judgment to section 8 of the report.

**Code-level tells (legitimate)**
- A single screen component rendering many distinct sections with no grouping abstraction — report the count and the file, not the verdict.
- Forms with a high field count where many are optional — count required vs optional; a 14-field form with 3 required fields is a real signal.
- Multiple simultaneous attention-grabbers in one view (banner + tooltip + badge + modal on mount).
- Navigation with a large flat set of top-level items.
- Copy blocks that restate what a label already says.

**Not legitimate from code:** "the layout is busy", "too much whitespace", "the hierarchy is unclear", "the colors fight". Move these to Needs visual confirmation.

---

## 9. Help users recognize, diagnose, and recover from errors

Errors should say what happened, why, and what to do now.

**Code-level tells**
- `catch` blocks that only `console.error`, swallow silently, or render a generic `"Something went wrong"` for every failure class.
- One error string covering distinct causes (network vs validation vs permission vs not-found) — the user can't tell a typo from an outage.
- Error UI with no recovery affordance: no retry, no link back, no support path.
- Validation messages that state the rule but not the fix, or that appear far from the offending field.
- Form submit failures that clear entered data — trace the reset call. This is the single most costly error-recovery bug and it is always visible in code.
- 404/500 boundaries that are default framework pages, or an error boundary that unmounts the whole app for a widget-level failure.
- Permission-denied handled as a generic error rather than an explanation of what access is needed and how to request it.

**Example finding shape**
> `useCreateProject.ts:33` maps every rejection to `toast.error("Could not create project")`. The mutation can fail on duplicate slug, quota exhaustion, and expired session — three problems with three different user actions, presented identically. A user at quota will retry indefinitely.

---

## 10. Help and documentation

Ideally unnecessary; in practice, findable and task-focused.

**Code-level tells**
- Complex or irreversible features with no inline explanation, tooltip, or link to docs.
- Help content that exists in the repo but has no route or nav entry pointing at it (also a Remove/IA finding).
- Fields whose meaning is non-obvious from the label alone and carry no helper text — especially anything with billing, permission, or data-retention consequences.
- No empty-state guidance on the screens a new user hits first.
- A support/contact path that exists only in the footer of marketing pages, not in the app where failures occur.

---

## Applying these while walking a journey

At each step of a traced flow, run the short version:

1. **Status** — how does the user know what's happening and that it worked?
2. **Exit** — how do they back out or undo?
3. **Failure** — what happens when this step fails, and can they tell why?
4. **Memory** — does this step assume they remember something from an earlier one?
5. **Prevention** — could the design have made the likely mistake impossible?

Steps 3 and 4 produce most of the real findings. Happy paths are usually well built.
