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
      /**
       * The NAME stays put and the STATE moves. That is the rule app-shell.tsx states for
       * the mobile Play control, and this is the same situation.
       *
       * This used to flip its label to "Unmute sound effects" while `aria-pressed` was
       * true, which announces as "Unmute sound effects, pressed" — the name describing an
       * action and the state describing something else, so the two contradict. A stable
       * name plus a moving pressed state says exactly one thing, and it also stops the
       * accessible name changing under any test locator that refers to it.
       */
      aria-label="Sound effects"
      aria-pressed={!muted}
      className={`text-muted hover:text-paper rounded-xs p-1 text-xl transition-colors ${className ?? ""}`}
    >
      <Glyph name={muted ? "mute" : "sound"} />
    </button>
  );
}
