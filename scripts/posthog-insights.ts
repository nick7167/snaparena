/**
 * Creates the saved funnels in PostHog.
 *
 * The events in `src/analytics/events.ts` are raw material; a funnel is the view that
 * turns them into an answer. This builds the three that were worth building first, so
 * they are defined in reviewable code rather than assembled by clicking and then lost
 * the next time someone reorganises the project.
 *
 * Idempotent — matched by name, so a re-run updates the existing insight in place
 * rather than filling the project with duplicates. Safe to run before any events have
 * arrived; the funnels will simply render empty until traffic exists.
 *
 * Needs a PERSONAL API key (`phx_...`), not the project token. The project token in
 * `.env.local` is write-only: it can send events and nothing else.
 *
 *   Create one at Settings -> Personal API keys with scopes:
 *     insight:write, dashboard:write
 *
 *   POSTHOG_PERSONAL_API_KEY=phx_... npm run posthog-insights
 *
 * Usage: npm run posthog-insights
 */

/**
 * The API host, which is NOT the ingestion host.
 *
 * Events go to `eu.i.posthog.com`; the REST API lives on `eu.posthog.com`. Sending API
 * calls to the ingestion host is the single easiest mistake to make here, and it fails
 * as a 401 that reads like a bad key rather than a wrong address.
 */
const HOST = process.env.POSTHOG_API_HOST ?? "https://eu.posthog.com";

/** SNAP ARENA. Overridable so this can be pointed at a scratch project. */
const PROJECT = process.env.POSTHOG_PROJECT_ID ?? "241582";

const KEY = process.env.POSTHOG_PERSONAL_API_KEY;

/** How long a player has to complete a funnel before it stops counting them. */
const WINDOW_DAYS = 7;

type Json = Record<string, unknown>;

/** One step. `props` filters the event down to a specific round or welcome step. */
type Step = { event: string; label: string; props?: Json[] };

function eventsNode({ event, label, props }: Step): Json {
  return {
    kind: "EventsNode",
    event,
    name: event,
    custom_name: label,
    ...(props ? { properties: props } : {}),
  };
}

/** An exact-match filter on an event property. */
function prop(key: string, value: string | number): Json {
  return { key, value: [value], operator: "exact", type: "event" };
}

function funnel(steps: Step[], breakdown?: string): Json {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "FunnelsQuery",
      series: steps.map(eventsNode),
      dateRange: { date_from: "-30d" },
      funnelsFilter: {
        funnelVizType: "steps",
        funnelOrderType: "ordered",
        funnelWindowInterval: WINDOW_DAYS,
        funnelWindowIntervalUnit: "day",
        /**
         * First touch: the breakdown value is taken from the property as it was on the
         * step where the person ENTERED the funnel. `is_guest` only exists on
         * `daily_start`, so any other attribution would drop everyone into "none".
         */
        breakdownAttributionType: "first_touch",
      },
      ...(breakdown
        ? { breakdownFilter: { breakdown, breakdown_type: "event" } }
        : {}),
    },
  };
}

/** DAILY_SONGS is 5 and `currentRound` is zero-based, so the songs are rounds 0-4. */
const DAILY_ROUNDS = [0, 1, 2, 3, 4];

const INSIGHTS: { name: string; description: string; query: Json }[] = [
  {
    name: "Guest funnel — run to claimed account",
    description:
      "The growth thesis, as a number. Broken down by is_guest: the guest curve is the one that matters, because the whole save-your-score panel exists for it. Step 3->4 is the panel's own conversion; a collapse at 1->2 means the game loses people before it ever asks.",
    query: funnel(
      [
        { event: "daily_start", label: "Started a run" },
        { event: "daily_finish", label: "Finished the run" },
        { event: "save_score_shown", label: "Saw the save panel" },
        { event: "save_score_clicked", label: "Pressed sign up / in" },
        { event: "signup_complete", label: "Account created" },
        { event: "guest_run_claimed", label: "Run carried over" },
      ],
      "is_guest",
    ),
  },
  {
    name: "Daily — drop-off by song",
    description:
      "Where inside a run people stop. A cliff at one song is a difficulty problem; an even bleed across all five is a length problem, and they need opposite fixes. Rounds are zero-based, so song 1 is round 0.",
    query: funnel([
      { event: "daily_start", label: "Started a run" },
      ...DAILY_ROUNDS.map((round) => ({
        event: "daily_round_complete",
        label: `Song ${round + 1}`,
        props: [prop("round", round)],
      })),
      { event: "daily_finish", label: "Reached the result" },
    ]),
  },
  {
    name: "Welcome flow — step drop-off",
    description:
      "Whether the welcome flow earns its place. It is a ~2 minute gate on the most valuable moment in the product and could plausibly make abandonment worse; this is what turns that from an argument into a number. welcome_step fires on ENTERING a step, so each name is the step being opened.",
    query: funnel([
      { event: "welcome_step", label: "Handle", props: [prop("name", "handle")] },
      { event: "welcome_step", label: "Avatar", props: [prop("name", "avatar")] },
      { event: "welcome_step", label: "Genres", props: [prop("name", "genres")] },
      { event: "welcome_step", label: "Explainer", props: [prop("name", "explain")] },
      { event: "welcome_step", label: "Coached rounds", props: [prop("name", "play")] },
      { event: "welcome_finish", label: "Finished" },
    ]),
  },
];

const DASHBOARD = "SNAP ARENA — core funnels";

async function call(path: string, init?: RequestInit): Promise<Json> {
  const response = await fetch(`${HOST}/api/projects/${PROJECT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = await response.text();
  if (!response.ok) {
    // The detail field carries the actual complaint; without it a 400 says nothing.
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${response.status}\n${body}`);
  }
  return body ? (JSON.parse(body) as Json) : {};
}

/** Finds an existing item by exact name, so re-runs update instead of duplicating. */
async function findByName(collection: string, name: string): Promise<number | null> {
  const page = (await call(`/${collection}/?limit=200`)) as { results?: Json[] };
  const match = page.results?.find((item) => item.name === name);
  return match ? (match.id as number) : null;
}

// A module rather than a global script. Without this its top-level `main` merges into
// the global scope and collides with the same name in a sibling script — a pre-existing
// clash that was invisible while the whole tree was failing to compile.
export {};

async function main() {
  if (!KEY) {
    throw new Error(
      "POSTHOG_PERSONAL_API_KEY is not set.\n" +
        "This needs a PERSONAL key (phx_...) with insight:write and dashboard:write —\n" +
        "the phc_ project token cannot create anything. Settings -> Personal API keys.",
    );
  }

  let dashboardId = await findByName("dashboards", DASHBOARD);
  if (dashboardId === null) {
    const created = await call("/dashboards/", {
      method: "POST",
      body: JSON.stringify({
        name: DASHBOARD,
        description: "Created by scripts/posthog-insights.ts. Edit there, not here.",
      }),
    });
    dashboardId = created.id as number;
    console.log(`Dashboard: created "${DASHBOARD}" (${dashboardId})`);
  } else {
    console.log(`Dashboard: reusing "${DASHBOARD}" (${dashboardId})`);
  }

  for (const insight of INSIGHTS) {
    const existing = await findByName("insights", insight.name);
    const payload = {
      name: insight.name,
      description: insight.description,
      query: insight.query,
      dashboards: [dashboardId],
    };

    if (existing === null) {
      const created = await call("/insights/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      console.log(`  created  ${insight.name}  ${HOST}/project/${PROJECT}/insights/${created.short_id}`);
    } else {
      const updated = await call(`/insights/${existing}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      console.log(`  updated  ${insight.name}  ${HOST}/project/${PROJECT}/insights/${updated.short_id}`);
    }
  }

  console.log(`\nDashboard: ${HOST}/project/${PROJECT}/dashboard/${dashboardId}`);
  console.log("Empty until the deployed app has the key and has been rebuilt.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
