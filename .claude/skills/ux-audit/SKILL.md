---
name: ux-audit
description: Audit an entire codebase through the combined lens of a UX designer, information architect, and UX researcher, and produce one prioritized report covering what to fix, what to improve, what to remove, and what to add. Use this whenever the user asks for a UX review, design critique, usability audit, heuristic evaluation, accessibility check, navigation or information-architecture review, or a report on their app's user experience. Also use it for the broader phrasings people actually type — "how could this app be better", "is this confusing for users", "what should I cut", "review my app's UX", "what's missing from this product" — even when they never say the words "UX" or "audit".
---

# UX Audit

You are running a three-discipline review of a real codebase and producing a single prioritized report. The three lenses:

- **UX Designer** — usability, interaction patterns, feedback, error handling, friction, visual hierarchy, accessibility
- **Information Architect** — structure, navigation, labeling, taxonomy, findability, how content and routes are organized
- **UX Researcher** — who the users are, what evidence supports the current design, which assumptions are unvalidated, what to actually go test

The user runs this once and gets one report. Don't stop halfway through to ask which flow to look at — map the app yourself, decide what matters, and go.

## The failure mode you must avoid

There is one way this skill fails, and it is worth understanding before you start.

A UX report is easy to fake. You can produce forty plausible bullet points — "consider adding loading states", "improve error messaging", "the navigation could be clearer" — without reading a single line of the codebase. These reports feel thorough and are worthless, because the user cannot act on them. They already know loading states are good.

The report is only valuable when a finding tells the user something they did not already know about *their specific app*: that the checkout form at `src/checkout/PaymentForm.tsx:84` clears every field when validation fails, so a user who mistypes one digit re-enters their whole card. That is actionable. "Improve form validation" is not.

So the standard for every finding is: **it must be traceable to specific code, and it must name the consequence for a real person using the app.** If you cannot point at a file and line, you have not found anything yet — you are pattern-matching. Cut it.

A short report of twelve real findings beats a long report of sixty generic ones. Length is not the goal.

## Your second constraint: code is not pixels

You are reading source, not using the app. Be honest with yourself about what that lets you conclude.

**You can verify from code:** route structure, navigation hierarchy, what states a component handles (loading, empty, error, success), form validation logic and what it does on failure, whether destructive actions have confirmation, ARIA attributes and semantic HTML, focus management, keyboard handlers, hardcoded strings and their wording, dead code and unreachable routes, inconsistencies between components that do the same job, how many steps a flow takes, what data is required vs optional.

**You cannot verify from code:** whether the visual hierarchy actually guides the eye, whether contrast passes in practice, whether the tone feels right, whether something is cluttered, whether an animation is annoying, whether the app is fast enough to feel good.

Never assert the second category as though you observed it. Instead, mark those as things to check visually and put them in their own short section of the report. A user who is told "your dashboard is visually cluttered" by something that never saw the dashboard learns to distrust the whole document. A user who is told "I can see `Dashboard.tsx` renders 14 distinct widgets with no grouping — worth checking whether this reads as cluttered when rendered" learns you are being straight with them.

If a dev server or screenshots are available and it's cheap to use them, do — actually looking at the thing beats inferring from JSX. But don't block the audit on it.

## Process

Work through these phases in order. Use a todo list to keep track — this is a long task and the later phases are the valuable ones, so don't let the early ones eat all your effort.

### Phase 1 — Orient

Figure out what you're looking at before judging it. Read the README, `package.json` (or equivalent manifest), the directory structure, and any docs. Identify the framework, the routing approach, the styling system, whether there's a component library or design system, and whether there are existing tests.

Note the scale: number of routes, number of components, rough LOC. This calibrates how deep you can go.

### Phase 2 — Map the product

Build an inventory before you evaluate anything. You are reconstructing the app's structure from source:

- **Screens/routes** — every route, what it renders, whether it's reachable from navigation
- **Navigation** — the actual nav components, what links where, how deep the hierarchy goes, what's in primary vs secondary nav
- **Primary user journeys** — the two to five paths that matter most (signup, the core task the app exists for, and whatever the money or retention depends on). Infer these from route structure, naming, and where the logic density is
- **Component inventory** — especially: how many different button/input/modal implementations exist, which is a direct signal of consistency problems
- **Data model** — a glance at the schema or types tells you what the app thinks its objects are, which is the backbone of its information architecture

Write this map down (a scratch file is fine). You'll reference it constantly and it becomes section 1 of the report.

### Phase 3 — Establish who the users are

This is the researcher lens and it is the one most often skipped. Before critiquing the design, state what the app assumes about its users, based on evidence in the code: onboarding copy, marketing strings, permission tiers, role definitions, the vocabulary of the domain models, analytics events, error message tone.

Then write down the **assumptions you cannot verify** — these become a real section of the report. If the app has a five-step onboarding wizard and no analytics on step completion, that is a genuine finding: a significant design bet with no instrumentation to tell anyone whether it's working.

Distinguish clearly between "the code shows this" and "I'm inferring this." Where the app's target user is genuinely unclear from the code, say so — ambiguity about who you're building for is itself one of the most valuable findings you can hand someone.

### Phase 4 — Walk the critical journeys

For each primary journey from Phase 2, trace it through the code step by step, as if you were a user moving through it. At each step ask: what does the user see, what can they do, what happens when it goes wrong, how do they get back, and how do they know it worked?

This is where most real findings come from. Read `references/usability-heuristics.md` for the ten heuristics and, more usefully, the code-level tells for each one — the specific things to look for in source that indicate a violation.

Pay particular attention to failure paths. Happy paths are usually built carefully; the error, empty, offline, permission-denied, and slow-network states are where apps fall apart, and they're fully visible in code.

### Phase 5 — Sweep for systemic issues

Journey-walking finds local problems. This phase finds structural ones. Read the relevant references as you go:

- **Information architecture** — `references/information-architecture.md`. Navigation structure, labeling consistency, hierarchy depth, whether the app's organizing scheme matches how users think about the domain, orphaned routes, findability.
- **Accessibility** — `references/accessibility.md`. WCAG 2.2 checks that are genuinely verifiable in source: semantic HTML, ARIA, keyboard operability, focus management, form labeling, target size.
- **Consistency** — the same interaction implemented differently in different places. Four modal implementations, three date formats, two different words for the same concept.
- **Dead weight** — unreachable routes, features with no entry point, commented-out flows, settings nobody can find, abandoned experiments. This is the source of your "remove" findings, and it needs evidence: something is dead because nothing references it, not because you think it's unimportant.

### Phase 6 — Prioritize and write

Now consolidate. See the sections below on severity, prioritization, and report structure.

## Rating severity

Use Nielsen's 0–4 scale, where severity combines three factors: **frequency** (how many users hit it, how often), **impact** (how hard it is to overcome), and **persistence** (whether it's a one-time confusion or a repeated tax).

- **4 — Catastrophe.** Blocks a core task or loses user data. Fix before anything else.
- **3 — Major.** Users can get through but many will fail, give up, or make errors. High priority.
- **2 — Minor.** Causes friction or confusion but users recover. Low priority.
- **1 — Cosmetic.** Fix if there's spare time.
- **0 — Not a problem.** Don't include it.

Be disciplined here. If everything is a 3, the rating carries no information and the user cannot prioritize. Most findings in a working app are 2s. Reserve 4 for genuine blockers, and expect a healthy codebase to have very few.

## Prioritizing the top of the report

The single most useful thing in the report is the ordered list at the top. Order by expected value, roughly: **severity × how many users hit it, divided by implementation effort.** A severity-2 issue on the signup screen every user passes through outranks a severity-3 issue in an admin panel three people use.

Estimate effort in rough terms only (a line change / a component rewrite / a structural change), and say when you're unsure. You know the code, so these estimates are grounded — but don't pretend to precision you don't have.

## Report structure

Write to `ux-audit-<YYYY-MM-DD>.md` in the repo root unless the user says otherwise. Use this structure:

```markdown
# UX Audit — <app name>
<date> · <commit hash if available> · <what was and wasn't covered>

## 1. What this app is
Two paragraphs, plain language. What it does, who it's for, the primary journeys you identified.
This proves you understood the app before critiquing it — and if you got it wrong, the user
spots it immediately instead of reading twenty findings built on a misunderstanding.

## 2. Top priorities
The ordered list. Aim for 5–15 items. Each one line: what's wrong, where, why it matters.
This is the section people actually read. Everything below is supporting detail.

## 3. Fix — things that are broken or blocking
## 4. Improve — things that work but are weak
## 5. Remove — things that should be cut
## 6. Add — things that are missing

Each finding follows the format below. Group by area (flow, screen, or system) inside
each section so related items sit together.

## 7. Research gaps — what you're deciding without evidence
Unvalidated assumptions, missing instrumentation, and the two or three things most worth
actually testing with users, with the method that would answer each question.

## 8. Needs visual confirmation
Short list. Things you flagged from code but genuinely cannot judge from source.

## 9. What's working well
Brief and honest. Not padding — if the error handling is consistently good, say so, because
it tells the user what pattern to extend to the places that lack it.
```

### Finding format

```markdown
**[S3] Password reset gives no confirmation that the email was sent**
`src/auth/ResetPassword.tsx:52-71` · Designer lens

On submit the form clears and returns to its initial state with no success message or
state change. A user who doesn't immediately receive the email has no way to tell whether
the request went through, so the likely behaviour is repeated submissions and then a
support ticket. Violates "visibility of system status."

**Recommendation:** Replace the form with a confirmation state naming the address the mail
went to, plus a resend control on a timer. Roughly a component-level change.
```

Include the lens (Designer / IA / Researcher) so the user can see the three perspectives actually did distinct work. Keep severity visible inline — it's how the report stays scannable.

## Calibration

Some things worth holding in mind as you write:

**Be specific about consequences, not just violations.** "Violates consistency and standards" tells the user nothing. "Three different date formats appear across the app (`Dashboard.tsx:31`, `OrderList.tsx:88`, `Invoice.tsx:12`), so the same order looks like it happened on different days depending on where you look at it" tells them something.

**Don't recommend a redesign when a fix will do.** The user has to implement this. Proportionate recommendations get built; sweeping ones get ignored.

**Respect that constraints exist.** Something that looks wrong may be a deliberate trade-off. Where a finding depends on context you don't have — business rules, a known user base, a deliberate decision — say so rather than assuming incompetence. You're advising, not grading.

**Don't invent user research.** You have not talked to their users. Never write "users find this confusing" as a statement of fact. Write "this is likely to confuse users because X" — or better, put it in the research-gaps section as something to test.

**Three lenses, not one lens three times.** If every finding is a usability nitpick, the IA and research lenses did no work. The IA findings should be about structure. The research findings should be about evidence. They look different from designer findings, and if they don't, go back and look again.

## References

Read these as you reach the relevant phase — they carry the domain detail so this file stays navigable.

- `references/usability-heuristics.md` — Nielsen's 10 heuristics, each with concrete code-level tells and example findings. Read before Phase 4.
- `references/information-architecture.md` — the four IA systems, Dan Brown's eight principles, and how to audit structure from routes, schemas, and nav components. Read during Phase 5.
- `references/accessibility.md` — WCAG 2.2 checks that are actually verifiable in source code. Read during Phase 5.
- `references/ux-research.md` — the research-methods landscape, how to audit evidence and instrumentation, and how to recommend the right method for each open question. Read during Phase 3 and again for section 7.
- `assets/report-template.md` — the full report skeleton, ready to fill in.
