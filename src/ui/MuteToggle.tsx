"use client";

import { useSyncExternalStore } from "react";
import {
  getMuteServerSnapshot,
  getMuteSnapshot,
  setMuted,
  subscribeMute,
} from "@/audio/sfx";
import { Glyph } from "./Glyph";

/**
 * Sound on/off.
 *
 * Lives here rather than in the app shell because a match hides the shell, and the shell
 * used to be the only place this existed — so starting a duel took the mute control away
 * for the one part of the app that is entirely about sound.
 */
export function MuteToggle({ className }: { className?: string }) {
  // Subscribed rather than copied into state: the preference lives in the sfx
  // module and is shared by every surface that plays a sound.
  const muted = useSyncExternalStore(subscribeMute, getMuteSnapshot, getMuteServerSnapshot);

  return (
    <button
      onClick={() => setMuted(!muted)}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      aria-pressed={muted}
      className={`text-muted hover:text-paper rounded-xs p-1 text-xl transition-colors ${className ?? ""}`}
    >
      <Glyph name={muted ? "mute" : "sound"} />
    </button>
  );
}
