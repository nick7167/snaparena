/**
 * Module entry point.
 *
 * SpacetimeDB discovers reducers, views and lifecycle hooks through this module's
 * exports, and refuses to publish if it finds an export that is none of those. So
 * the re-exports below are EXPLICIT rather than `export *`: the domain modules also
 * export plain helpers to each other (`requireSenderUser`, `senderUser`, …), and a
 * wildcard would hand those to the registrar and fail the build.
 *
 * `./schedules` is imported FIRST, deliberately. It and `./schema` form a cycle —
 * the schema names the scheduled reducers in its `scheduled: (): any => …` thunks,
 * and the reducers need the schema. The thunks defer, which makes the cycle legal,
 * but only if the reducer side finishes evaluating first.
 */
export {
  advancePhase,
  waitForReady,
  draftWatchdog,
  runBotAction,
  sweepMatchmaking,
  sweepForfeits,
  cleanupGuests,
  rebuildLadder,
  refillDevBotQueue,
  finalizeMatch,
} from "./schedules";

export {
  // lifecycle
  init,
  onConnect,
  onDisconnect,
  // reducers
  ensureUser,
  completeOnboarding,
  updateProfile,
  setHandle,
  setWelcomeStep,
  probeHandle,
  setAuthIssuer,
  removeAuthIssuer,
  setRole,
  reportProfile,
  // views
  me,
  myHandleProbe,
} from "./users";

export {
  upsertCategories,
  upsertTracks,
  rebuildTitleIndex,
  catalogueStats,
  tutorialTrack,
} from "./catalogue";

export { nudge } from "./phases";

export { submitBan } from "./draft";

export {
  startDaily,
  completeDaily,
  forfeitDaily,
  claimGuestRuns,
} from "./daily";

export { enqueue, dequeue, surrender } from "./matchmaking";

export { seedBots, startPractice } from "./bots";

export {
  createRoom,
  joinRoom,
  setRoomReady,
  leaveRoom,
  startRoomMatch,
  returnToLobby,
} from "./rooms";

export {
  submitGuess,
  passRound,
  reportReady,
  myRoundStatus,
} from "./guesses";

export {
  saveConfig,
  revertConfig,
  resetConfig,
  setDevFeatures,
  currentConfigVersion,
} from "./config";

export { default } from "./schema";
