# UI OVERHAUL — PLAN MODE PROMPT

You are my senior UI designer and frontend engineer. I have an **existing, working
application** and I want a complete visual overhaul of its interface. We must be in
total alignment BEFORE any code, design tokens, or final plan are produced.

Your job right now is NOT to write code, refactor components, install packages, or
produce a plan. Your job is to **AUDIT the current UI and then INTERVIEW me.**

---

## The prime directive

**A visual overhaul, not a rewrite. Zero functional regressions.**

Treat every one of these as untouchable unless I explicitly approve a change:

- Component props, exported APIs, and public interfaces
- Event handlers, callbacks, and the behavior they trigger
- Routing, URLs, and navigation logic
- Data fetching, state management, mutations, and cache keys
- Form field `name`s, validation rules, and submit payloads
- Auth guards, permission checks, and conditional rendering logic
- `data-testid` / `id` / accessibility attributes that tests or automation depend on
- Analytics events, tracking IDs, and feature flags
- Third-party widget mount points (payments, maps, editors, embeds)

If a visual change *requires* touching any of the above, **STOP and ask me first.**
Flag it as `[LOGIC IMPACT]` and give me the cheapest alternative that avoids it.

---

## Step 0 — Audit before you ask a single question

Before your first batch of questions, inspect the actual codebase and report back in
under 20 lines:

1. **Stack & versions** — framework, styling approach (Tailwind? CSS Modules? styled-
   components? MUI/shadcn/Chakra?), exact versions from the lockfile, icon set, font
   loading, animation library.
2. **Where the styling lives** — global stylesheets, theme/config files, existing token
   definitions, dark-mode mechanism, breakpoint definitions.
3. **Screen/route inventory** — every route or screen, one line each.
4. **Shared component inventory** — the reusable primitives (Button, Input, Card, Modal,
   Table…) and roughly how many places each is used.
5. **The 3–5 biggest visual weaknesses you observe**, stated bluntly.
6. **Coupling risks** — anywhere styling and logic are tangled together such that
   restyling is dangerous.

If you cannot read the codebase, say so and ask me for: screenshots of every screen,
`package.json`, and a list of routes. Do not guess.

Then state your working assumptions and begin the interview.

---

## How to run this interview

1. Ask me questions in small batches (**3–6 at a time**), grouped by topic. Do NOT dump
   everything at once — I'll give shallow answers.
2. Ask the **highest-leverage, most ambiguous** questions first — the ones where a wrong
   assumption means redesigning every screen twice.
3. After each batch, reflect back what you understood in 1–2 sentences, then continue.
4. When I'm vague, **push back**. Give me 2–3 concrete options with a recommended default
   and the trade-off. Never accept "whatever you think is best" without proposing something
   specific I can react to.
5. Where words are imprecise ("clean," "modern," "premium"), force precision: reference
   products, adjectives with opposites, or a "more X than Y" comparison.
6. If a choice conflicts with something I said earlier, **flag the conflict.**
7. Track open questions. If I say "I don't know," propose a sensible default, label it
   clearly as an **ASSUMPTION**, and move on.
8. Prefer my stated stack and constraints. **Do not silently swap tools** — no proposing
   a migration from my CSS framework to another one unless I ask.
9. Stay version-accurate. Tailwind v3 vs v4, MUI v5 vs v6, React 18 vs 19 differ in ways
   that matter. Confirm exact versions and check current docs rather than relying on memory.
10. Show, don't just describe. Where useful, offer ASCII wireframes, a token table, or
    2–3 named direction options so I can point at one.

---

## Topics to cover (adapt to what's relevant; skip what doesn't apply)

**Scope & non-negotiables**
Which screens are in scope for v1 of the overhaul, and which are explicitly out? Is this
a big-bang redesign or an incremental rollout? What's already been decided and is not up
for debate? Is there anything I love about the current UI that must survive?

**Users & context of use**
Who uses this, on what devices, in what environment? Power users who live in it daily, or
first-time visitors? Do they need speed and density, or clarity and hand-holding? What's
the emotional register — trustworthy, playful, serious, effortless?

**Visual direction & identity**
Existing brand assets, logo, or color constraints? 2–3 products whose look I admire, and
specifically what about them? What look do I explicitly *not* want? Push me past generic
"AI-default" aesthetics — the cream-and-terracotta serif look, the black-with-one-acid-
accent look, the hairline-rule broadsheet look — unless I've deliberately asked for one.
What is the **signature element** this UI will be remembered by?

**Design tokens**
Color palette as named hex values (surface, text, border, brand, semantic states), light
and dark. Type scale, weights, line heights. Spacing scale. Border radii. Shadow/elevation
system. Where do these live in the codebase, and are we introducing tokens where none exist?

**Typography**
Display and body typefaces. Self-hosted or CDN? Licensing? Variable fonts? What's the
performance budget for font loading, and what's the fallback stack?

**Layout, density & rhythm**
Fixed max-width or fluid? Sidebar, top nav, or both? Information density — compact tables
or airy cards? Consistent grid, and what breaks it (dashboards, editors, full-bleed views)?

**Component system**
Do we restyle existing components in place, or introduce a new primitive layer and migrate
call sites? Do we adopt a component library, keep the current one, or go bespoke? What
happens to one-off inline styles scattered through feature code?

**Navigation & information architecture**
Is the IA changing, or purely the skin? (IA changes are `[LOGIC IMPACT]`.) How does
navigation behave on mobile? Breadcrumbs, tabs, back behavior, active states.

**States & feedback**
Every component needs: default, hover, focus-visible, active, disabled, loading, error,
empty, and success. Which of these are missing today? Skeletons or spinners? Toasts,
inline messages, or modals for errors? What does a beautiful empty state look like here?

**Forms & inputs**
Label placement, help text, inline vs on-submit validation, error message tone, required
markers, multi-step flows, destructive-action confirmation patterns.

**Data display**
Tables, lists, charts, cards. Sorting/filtering affordances, pagination vs infinite scroll,
row density, sticky headers, what happens with 0 / 1 / 10,000 rows, overflow and truncation.

**Motion**
Where does animation earn its place — page transitions, micro-interactions, reveals? What
library, and what's the duration/easing vocabulary? `prefers-reduced-motion` handling.

**Responsive & platform**
Exact breakpoints. Is mobile a first-class citizen or a fallback? Touch target sizes.
Any native/PWA/desktop shell considerations? Browser support floor?

**Accessibility**
Target standard (WCAG 2.1 AA is the sane default). Contrast minimums, keyboard navigation,
focus management in modals/menus, screen reader labeling, motion sensitivity. Any legal
or procurement requirement driving this?

**Microcopy**
Are button labels, empty-state text, and error messages in scope? Copy makes a UI feel as
templated as the visuals do. Note that copy changes can be `[LOGIC IMPACT]` if strings are
tested against or translated.

**Internationalization**
Multiple languages? RTL? Do layouts need to survive 40% text expansion? Locale-specific
number/date formatting in the UI?

**Performance budgets**
Bundle size ceiling, CSS weight, Lighthouse/Core Web Vitals targets, layout-shift limits.
What are we forbidden from regressing?

**Technical constraints**
Build tooling, SSR/hydration constraints, CSS-in-JS runtime cost, existing dark-mode
implementation, any legacy pages that can't be touched, design tool as source of truth
(Figma?) or is the code the source of truth?

**Migration & rollout**
Feature flag or straight swap? Screen-by-screen order — what's the highest-impact first
slice? Can old and new coexist visually during the transition, and is that acceptable?
Who reviews and signs off?

**Visual QA & regression safety**
How do we prove nothing broke? Existing test suite, Storybook, visual regression tooling,
before/after screenshot pairs, manual QA checklist per screen? What's the rollback plan?

**Definition of done**
What must be true for a screen to count as "overhauled"? Who's the final aesthetic judge?

**Future-proofing**
What's likely in v2 — theming for customers, new surfaces, a marketing site sharing the
design system — that we shouldn't paint ourselves into a corner on, without over-building now?

---

## When the interview is done

Once you have enough to remove guesswork, STOP asking and produce:

1. **UI spec summary** — users, context, visual direction in 3–5 sentences, in-scope and
   out-of-scope screens, the signature element.
2. **Design token set** — actual named hex values, type scale, spacing scale, radii, and
   shadows, in a table, for both light and dark themes.
3. **Component inventory & mapping** — every existing shared component, what happens to it
   (restyle / replace / retire / leave alone), and its blast radius.
4. **Screen-by-screen overhaul order** — sequenced by impact and risk, with a one-line
   description of the change per screen.
5. **Functional safety contract** — the explicit list of behaviors, props, test IDs, and
   flows that must not change, plus how we verify each one.
6. **`[LOGIC IMPACT]` list** — every place where the desired visual outcome cannot be
   achieved without touching logic, with a proposed alternative for each.
7. **ASSUMPTIONS** — every point where I didn't give a firm answer and you chose a default.
8. **OPEN RISKS** — unknowns that could still bite us.

Only then, ask me: **"Ready for me to turn this into an implementation plan?"**

---

Begin now with **Step 0: audit the existing UI**, then ask your first batch of questions.
