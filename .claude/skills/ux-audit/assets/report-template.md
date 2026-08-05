# UX Audit — <app name>
<YYYY-MM-DD> · <commit hash> · <what was covered and what wasn't>

<!--
Scope line examples:
"Covers the web app under src/app and src/components. Excludes the marketing site,
the Convex backend except where it determines UI behaviour, and anything requiring
a running instance."
Delete every HTML comment in this template before delivering.
-->

## 1. What this app is

<!--
Two paragraphs, plain language, no critique. What the app does, who it appears to be
for, and the primary journeys identified in Phase 2. If this section is wrong, the
user catches it here instead of after twenty findings built on a misreading.
End with the journeys as a short list:

Primary journeys traced:
1. New user → account → first <core object> created
2. Returning user → <core daily action> → result
3. <the money or retention path>
-->

## 2. Top priorities

<!--
5–15 items, ordered by severity × reach ÷ effort. One line each: what's wrong, where,
why it matters. Link down to the full finding. This is the section that gets read.
-->

1. **[S<n>]** <one line> — `path/file.tsx:LL` · <effort>
2. **[S<n>]** <one line> — `path/file.tsx:LL` · <effort>

---

## 3. Fix — things that are broken or blocking

<!-- Group by flow/screen/system. Findings that stop or seriously derail users. -->

### <Area>

**[S<n>] <Finding title — the problem, not the category>**
`path/to/file.tsx:LL-LL` · <Designer | IA | Researcher> lens

<What the code does, and what that means for someone using the app. Name the
consequence concretely. Cite the heuristic or criterion at the end, not the start.>

**Recommendation:** <proportionate fix> Roughly a <line change | component-level change | structural change>.

---

## 4. Improve — things that work but are weak

### <Area>

**[S<n>] <title>**
`path:LL` · <lens>

<body>

**Recommendation:** <...>

---

## 5. Remove — things that should be cut

<!--
Every item here needs evidence of deadness or cost: no inbound references, no route,
no nav entry, no usage instrumentation. "I think this is unimportant" is not evidence.
-->

**[S<n>] <title>**
`path:LL` · <lens>

<What it is, how you established nothing reaches it or nothing needs it.>

**Recommendation:** <...>

---

## 6. Add — things that are missing

<!--
Missing states count here: empty, error, offline, permission-denied, loading.
So do missing entry points to features that exist but can't be found.
-->

**[S<n>] <title>**
`path:LL` · <lens>

<body>

**Recommendation:** <...>

---

## 7. Research gaps — what you're deciding without evidence

### Assumptions with no supporting evidence
- **<Assumption>** — embodied in `path:LL`. If wrong: <cost>.

### Instrumentation gaps
- **<Moment that isn't measured>** — `path:LL` fires no event, so <question> is unanswerable.

### Worth actually testing
1. **<Question>** — <method>, <n> participants. Would settle: <the decision it changes>.

### Evidence that does exist
<Analytics already in place, tests encoding real flows, documented feedback. Brief.>

---

## 8. Needs visual confirmation

<!--
Things flagged from code that genuinely cannot be judged from source. Each one:
what you saw in code, and what to check when looking at the running app.
-->

- **<Screen/component>** — `path:LL` <what the code shows>. Check whether <the visual question>.

---

## 9. What's working well

<!--
Brief, specific, honest. The point is to name patterns worth extending to the places
that lack them — not to soften the report.
-->

- **<Pattern>** — `path:LL`. <Why it's good and where else it should be applied.>

---

### Severity key
**4** Catastrophe — blocks a core task or loses data · **3** Major — many users will fail or err · **2** Minor — friction, users recover · **1** Cosmetic
