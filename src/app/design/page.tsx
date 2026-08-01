import { notFound } from "next/navigation";
import { DesignGallery } from "./gallery";

/**
 * Design gallery — the verification harness.
 *
 * Renders every primitive in every state and every rare screen the app can produce,
 * driven entirely by fixtures. No Convex, no Clerk, no live match, no seeded catalogue.
 *
 * This exists because the states that break are the ones you cannot reach by playing:
 * audio-timeout, playback-blocked, no-bots-seeded, a draw, a forfeit, a promotion, an
 * empty leaderboard, and all eight guess-rejection reasons. Before this page they were
 * unreviewable.
 *
 * Dev only — never shipped.
 */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}
