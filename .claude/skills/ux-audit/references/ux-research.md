# UX Research — auditing evidence, not just design

The research lens asks: **what does this app believe about its users, and what would happen if those beliefs were wrong?** Its findings are about evidence and instrumentation, not about interfaces. If your research section reads like more usability notes, it hasn't done its job.

Read during Phase 3, and again before writing section 7.

---

## Part 1 — Reconstructing the user model from code

You can't interview anyone. But the code is full of statements about who the app is for. Collect them, and be explicit about which are evidence and which are inference.

**Where the evidence lives**

| Source | What it tells you |
|---|---|
| Marketing/landing copy, meta description, README | Who the team *says* it's for, and the promised value |
| Onboarding flow — steps, questions asked, what's skippable | What the team believes a new user needs before they can succeed |
| Role and permission definitions in the schema | The actual cast of users, and the power hierarchy between them |
| Domain vocabulary in models and enums | Assumed familiarity — jargon implies expertise |
| Error and empty-state tone | Assumed sophistication and emotional context |
| Pricing/plan/quota logic | Which segments matter commercially and where the product expects to be constrained |
| Analytics/telemetry events | What the team currently measures — and by omission, what it doesn't |
| Feature flags and experiment code | What's contested or in flight |
| Seed/fixture/demo data | The team's mental image of a typical account |
| Notification and email templates | Assumed cadence of engagement |
| Mobile vs desktop breakpoints and any native shell | Assumed context of use |

**What to write down**

1. **The user model as evidenced.** "The app assumes a returning daily user on mobile who already understands the domain terms `ladder`, `veto`, and `draft` (`schema.ts:20-64`), and who arrives via a notification rather than by browsing."
2. **Segments the code implies.** Roles, plan tiers, first-run vs returning, admin vs member. Note any segment the code creates but the UI never differentiates for.
3. **The unverifiable assumptions.** This is the valuable list. Frame each as a bet: what the design assumes, what happens if it's false, and what evidence would settle it.

**Discipline:** never write "users find X confusing." Write "this design assumes X is understood; nothing in the codebase tests that assumption." The first is fabricated research; the second is a real finding.

---

## Part 2 — Auditing instrumentation

A design decision without instrumentation is a decision nobody will ever learn from. This is the most reliably valuable research finding in a codebase, and it's fully verifiable.

**How to audit**

1. Find the analytics layer — grep for `analytics`, `track(`, `posthog`, `mixpanel`, `amplitude`, `gtag`, `logEvent`, `va.track`, or a homegrown wrapper. If nothing exists, that's the finding.
2. List every event that is fired, with the file it fires from.
3. Now list the **key moments** from your Phase 2 journey map: entry, each step of onboarding, the core action, first success, error paths, abandonment points, upgrade/conversion, return visits.
4. **Diff the two lists.** The gaps are the findings.

**What a strong instrumentation finding looks like**

> **[S3] The onboarding funnel cannot be measured** · Researcher lens
> `OnboardingWizard.tsx:14-190` implements five steps, and step 3 asks for eight fields including two that are optional. `track()` is called once, on completion (`:186`). There is no event on entry or on each step transition, so if users are dropping at step 3 — the longest step, and the one whose data isn't used until much later — nobody can see it. The completion rate is knowable; the drop-off location is not.
> **Recommendation:** fire a step-view event with the step index on each transition, and an abandon event on unmount without completion. Small change, and it converts the largest design bet in the product into something observable.

**Other instrumentation gaps worth checking**
- Errors surfaced to users but never logged anywhere the team can count them.
- Search queries not recorded — a zero-result query log is the cheapest source of vocabulary and IA findings any product has.
- Features shipped with no usage event, so nobody can tell whether to keep them (this connects directly to your Remove section: "we can't tell if this is used" is itself the finding).
- Performance timings absent on flows where speed plausibly drives abandonment.
- No distinction between first-time and returning users in events, making activation unmeasurable.

---

## Part 3 — Choosing the right method for each open question

Section 7 should not say "do user testing." It should name the question, the method that answers it, and roughly what it costs. Use this to pick.

**The two axes:** attitudinal (what people say) vs behavioural (what people do); qualitative (why) vs quantitative (how many).

| Question shape | Method | Notes on cost |
|---|---|---|
| Why do users fail at this step? | Moderated usability test, 5 participants, task-based | ~1 day of sessions; 5 users surface most severe issues |
| Do users understand this label / structure? | Tree test (findability) or card sort (structure) | Unmoderated, 15–30 participants, cheap and fast |
| Where exactly do users drop off? | Funnel analytics | Requires the instrumentation above — often the real blocker |
| Which of two designs performs better? | A/B test | Needs traffic volume; overkill below a few thousand users on the flow |
| What do users actually do on this screen? | Session replay or click/scroll heatmaps | Fast to install; watch for privacy implications |
| Is this problem widespread or one person's complaint? | Survey to existing users, or support-ticket tagging | Cheap if there's already a support channel |
| What do users need that we haven't built? | Contextual inquiry / interviews, 5–8 participants | Highest effort, highest value for Add findings |
| Is the copy understood as intended? | Comprehension test / highlighter test | Very cheap, often skipped |
| Does the whole experience hold up over time? | Diary study | Weeks-long; only for retention questions |
| Do the numbers we have mean what we think? | Analyse existing data before collecting more | Always check this first |

**Rules for recommending methods**
- Prefer the cheapest method that would actually change a decision.
- If the answer wouldn't change what the team builds, don't recommend the study.
- Where instrumentation is missing, recommend fixing that *before* qualitative work — otherwise the team has no way to tell whether the fix worked either.
- Five participants is the standard for qualitative usability work. Don't inflate numbers to sound rigorous.
- Name the specific task or question, not the topic. "Ask 5 users to create their first match without help; measure completion and note where they hesitate" beats "test onboarding."

---

## Part 4 — Writing section 7

Structure it in three short blocks:

**Assumptions being made without evidence.** Each one: the assumption, where in the code it's embodied, and the cost if it's wrong. Three to six of these, ranked by how expensive being wrong would be.

**Instrumentation gaps.** The diff from Part 2, with the specific events missing and the question each would answer.

**The two or three studies worth actually running.** Question, method, participant count, and what decision the result would change. Keep it to a handful — a list of twelve studies is a list nobody runs.

Close with what evidence *does* exist, if any. If the repo has tests that encode real user flows, a support inbox integration, existing analytics dashboards, or documented user feedback in issues or comments, say so — it tells the team what to build on rather than starting from zero.
