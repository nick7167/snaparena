# Information Architecture — auditing structure from source

The IA lens asks a different question from the designer lens. Not "is this screen usable" but "is this the right set of screens, named the right way, arranged in the right shape." Findings here are structural: they're about the map, not the rooms.

Read during Phase 5.

---

## The four systems

Every IA has four parts. Audit each separately — they fail in different ways.

### 1. Organization systems — how content is grouped

**What to read:** the route tree, the directory structure under your routes folder, the top-level nav component, the schema.

**Questions**
- What is the app's primary organizing scheme — by object type (Projects, Contacts, Invoices), by task (Create, Review, Publish), by audience (Admin, Member), by time, or by workflow stage?
- Is that scheme consistent, or does the top level mix schemes? A nav reading `Dashboard / Projects / Settings / Onboarding / Reports` mixes an object, a task, a lifecycle stage, and two views. Mixed schemes at one level are a genuine finding — users can't predict which bucket a thing lives in.
- Does the grouping match the data model? If the schema's central object is `campaign` but the nav is organized around `channel`, users navigating by the thing they think about (a campaign) have to traverse sideways.
- Are there exact/objective schemes (alphabetical, chronological, geographic) where they'd help — long lists with no sort control?

### 2. Labeling systems — what things are called

**What to read:** nav link text, page headings, button labels, schema field names, enum values, empty-state copy.

**Questions**
- Is one concept called one thing everywhere? Build a small table: schema term → nav label → page heading → button text. Divergence is the finding, and it's citable.
- Are labels drawn from the user's vocabulary or the engineer's? (See heuristic 2.)
- Are labels distinguishable? "Settings" and "Preferences" and "Configuration" as three separate destinations is a findability problem regardless of what's in them.
- Do icons carry meaning without text labels in primary nav? Icon-only nav is a recall tax and a known accessibility problem.

### 3. Navigation systems — how users move

**What to read:** the nav/sidebar/header components, breadcrumb logic, any tab bars, in-page links, the router config.

**Questions**
- **Breadth vs depth.** Count top-level items and maximum depth. Very broad flat nav (15+ top-level) overwhelms; very deep nav (4+ levels to reach routine content) buries. Neither number is a rule — report the actual shape and what it costs.
- **Reachability.** For every route in the router, is there a path to it from the nav or from a link in another screen? Routes reachable only by typing a URL are either dead (Remove) or hidden features (Add: an entry point).
- **Orientation.** Does the user know where they are? Look for active-state styling on nav items, breadcrumbs on deep routes, page titles matching nav labels, `document.title` updates.
- **Local vs global.** Is there a contextual nav for within-section movement, or does every move go through the global nav?
- **Utility nav.** Where do account, billing, help, and sign-out live, and are they consistent across authenticated routes?
- **Depth of the core task.** How many clicks from landing to the app's primary action? Trace it literally.

### 4. Search systems — how users find without browsing

**What to read:** any search component, query implementation, filter state.

**Questions**
- Does search exist at all in an app whose data grows unboundedly? Its absence is a finding once list sizes get large.
- What does it search — one field, all fields, related objects? A search that only matches title where users will type a person's name fails silently.
- Is there zero-result guidance, or a bare "No results"?
- Are filters and search state in the URL (shareable, back-button-safe) or in local state (lost on navigation)?
- Is search scoped ambiguously — does the box on this page search this section or everything? If the placeholder doesn't say, users can't tell.

---

## Dan Brown's eight principles of IA

Useful as a checklist for structural findings. Each one, with what its violation looks like in code.

1. **Objects** — treat content as living things with lifecycles. *Tell:* the schema has states (`draft`, `published`, `archived`) that the UI never surfaces or lets users move between.
2. **Choices** — offer meaningful, limited options. *Tell:* a nav or action menu with a long undifferentiated list; every option presented at equal weight.
3. **Disclosure** — preview enough to predict what's underneath. *Tell:* list rows showing only an ID or title where the user needs status/date/owner to choose; nav labels that don't hint at their contents.
4. **Exemplars** — show examples of what a category contains. *Tell:* category or section landing pages that are empty shells listing sub-links with no preview.
5. **Front doors** — assume users arrive from anywhere, not the homepage. *Tell:* deep routes that render without context — no breadcrumb, no parent link, no explanation of what this object belongs to. Also: flows that break if entered mid-way (step 3 of a wizard with no guard redirecting to step 1).
6. **Multiple classification** — offer several paths to the same content. *Tell:* one and only one route to important content; no tags, no cross-links, no alternate browse.
7. **Focused navigation** — don't mix apples and oranges in one menu. *Tell:* a single nav list containing objects, tasks, settings, and external links together.
8. **Growth** — assume content will multiply. *Tell:* a nav with hardcoded items that will break at scale; lists with no pagination, sort, or filter; a structure that works at 10 items and collapses at 1,000. Check the schema for what grows unboundedly and then check whether the UI for it has any affordance for volume.

---

## How to actually run the audit

A workable order:

1. **Extract the route table.** From the router config or file-based routing directory. List every path, its component, its params, whether it's authenticated, whether it's a layout.
2. **Extract the nav graph.** Read the nav components; list every link and where it points.
3. **Diff them.** Routes with no inbound nav link are candidates for Remove or for a missing entry point. Nav links pointing to routes that don't exist are broken. This diff is where the highest-value IA findings live and it is purely mechanical.
4. **Grep for hardcoded internal links** (`href="/..."`, `router.push("/...")`) to catch cross-links the nav doesn't show.
5. **Build the label table.** Schema term vs UI term for the five or six main objects.
6. **Measure the shape.** Top-level breadth, max depth, clicks-to-core-task.
7. **Check the growth points.** For each unbounded collection in the schema, find its list UI and check for search/sort/filter/pagination.

Steps 3 and 7 are the two that most reliably produce findings a developer hasn't already noticed.

---

## Writing IA findings

IA findings should read differently from designer findings — they're about the system, not the screen, and their recommendations are usually structural.

> **[S2] Two names for one object across the app** · IA lens
> The schema calls it `workspace` (`convex/schema.ts:14`), the sidebar says "Teams" (`Nav.tsx:29`), and the settings page header says "Organization" (`SettingsHeader.tsx:8`). A user reading the docs or a support reply has to infer that all three are the same thing, and search for "team settings" doesn't lead anywhere. Pick one term and use it in nav, headings, copy, and URLs. Roughly a find-and-replace plus a route rename.

Avoid recommending a full IA overhaul unless the structure is genuinely broken. Most IA findings resolve to: rename this, move this one level up, add an entry point here, delete this orphan.
