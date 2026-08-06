/**
 * Every event this app emits, in one place.
 *
 * A union rather than free strings, because the failure mode of product analytics is not
 * a missing event — it is `daily_finished` and `daily_finish` both existing, six months
 * apart, and every funnel silently measuring half the traffic. The compiler is the only
 * thing that reliably prevents that.
 *
 * The names are snake_case to match PostHog's own convention, so autocapture and these
 * sit together in the UI without looking like two systems.
 */
export type EventName =
  // --- the guest funnel: the reason any of this exists ---------------------
  /** A run was started, by anyone. `is_guest` is the split that matters. */
  | "daily_start"
  /** One song closed. Carries `round`, so drop-off has a location rather than a rate. */
  | "daily_round_complete"
  /** A run reached its result screen. */
  | "daily_finish"
  /** The conversion panel was actually rendered — the denominator for the one below. */
  | "save_score_shown"
  /** Someone pressed sign-up or sign-in from that panel. */
  | "save_score_clicked"
  /** An account now exists. */
  | "signup_complete"
  /** An anonymous run was carried onto a real account. The funnel's last step. */
  | "guest_run_claimed"

  // --- the welcome flow ----------------------------------------------------
  /**
   * One per step transition, carrying the step index and its name.
   *
   * The reason the flow is instrumented at all: it is a new ~2 minute gate on the most
   * valuable moment in the product, and it could plausibly make signup abandonment WORSE
   * rather than better. Per-step events are what turn that from an argument into a number,
   * and they show which rung of the coaching people actually reach.
   */
  | "welcome_step"
  /** Reached the end. `completed_tutorial` separates playing it from skipping past it. */
  | "welcome_finish"

  // --- ranked: is the queue working, or is it a wall? ----------------------
  | "queue_enqueue"
  /** Carries `waited_ms`, which is the number that decides whether BOT_FALLBACK_MS is right. */
  | "queue_cancel"

  // --- reliability ---------------------------------------------------------
  /**
   * Audio failed for a round. Carries `reason`.
   *
   * This one exists to answer a specific open question: the audit's §3.5 got a UI-only fix
   * on the assumption that genuine failures are rare. If this fires often, that assumption
   * was wrong and the server-side round-voiding is worth building after all.
   */
  | "audio_error"
  /**
   * A round opened while the shared AudioContext was not running. Carries `state`
   * ("suspended", "interrupted", "closed" or "none").
   *
   * The round still plays — it just loses the visualiser, because routing an element
   * through a dead context is irreversible and silences it outright. This counts how
   * often the gesture unlock fails to land before the first round, which is the number
   * that says whether the tap coverage in unlock.ts is wide enough or whether the flow
   * needs an explicit "enable sound" step after all.
   */
  | "audio_context_suspended";

/** Properties allowed on an event. Deliberately narrow — no objects, no PII. */
export type EventProps = Record<string, string | number | boolean | null | undefined>;
