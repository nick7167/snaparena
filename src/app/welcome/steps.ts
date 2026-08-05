/**
 * The welcome flow's step order, in one place.
 *
 * A named constant rather than bare numbers, because `welcomeStep` is persisted: a stored
 * `4` has to keep meaning the same thing across deploys, or a player resuming after a
 * release lands somewhere arbitrary. Inserting a step means appending here and accepting
 * that stored values below it still resolve correctly — never renumbering an existing one.
 */
export const STEP = {
  /** What SNAP is. */
  INTRO: 0,
  /** Username. The only required step, and the only one that writes to the user row. */
  HANDLE: 1,
  AVATAR: 2,
  GENRES: 3,
  /** How a round works — the explainer before anything is played. */
  EXPLAIN: 4,
  /** The coached rounds, solo then duel. */
  PLAY: 5,
  /** Past the end: the flow is finished and the route redirects away. */
  DONE: 6,
} as const;

export type StepValue = (typeof STEP)[keyof typeof STEP];

/** Human names, for the progress indicator and for the analytics event. */
export const STEP_LABELS: Record<number, string> = {
  [STEP.INTRO]: "intro",
  [STEP.HANDLE]: "handle",
  [STEP.AVATAR]: "avatar",
  [STEP.GENRES]: "genres",
  [STEP.EXPLAIN]: "explain",
  [STEP.PLAY]: "play",
  [STEP.DONE]: "done",
};

/** How many dots the progress rail draws — everything before DONE. */
export const STEP_COUNT = STEP.DONE;
