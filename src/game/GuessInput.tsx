"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { AUTOCOMPLETE_MIN_CHARS } from "@/engine/config";

interface GuessInputProps {
  onGuess: (text: string) => Promise<{ status: string }>;
  disabled: boolean;
  /** Server-provided timestamp; input stays locked until it passes. */
  lockedUntil: number;
  /**
   * Hides suggestions during the first reveal beat. Autocomplete is the largest
   * remaining cheat surface, so it is withheld while the clip is shortest and
   * the points are highest.
   */
  suppressSuggestions: boolean;
}

export function GuessInput({
  onGuess,
  disabled,
  lockedUntil,
  suppressSuggestions,
}: GuessInputProps) {
  const [text, setText] = useState("");
  const [lockRemaining, setLockRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const showSuggestions = !suppressSuggestions && text.trim().length >= AUTOCOMPLETE_MIN_CHARS;

  // Searches the FULL catalogue, not the tracks in this match — see convex/tracks.ts.
  const suggestions = useQuery(
    api.tracks.autocomplete,
    showSuggestions ? { term: text, limit: 6 } : "skip",
  );

  useEffect(() => {
    const update = () => setLockRemaining(Math.max(0, lockedUntil - Date.now()));
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // Keep focus on the box: every millisecond spent clicking is points lost.
  useEffect(() => {
    if (!disabled && lockRemaining === 0) inputRef.current?.focus();
  }, [disabled, lockRemaining]);

  const locked = lockRemaining > 0;
  const inputDisabled = disabled || locked || submitting;

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || inputDisabled) return;

    setSubmitting(true);
    try {
      const result = await onGuess(trimmed);
      if (result.status !== "correct") setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(text);
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={inputDisabled}
          placeholder={locked ? `Locked ${(lockRemaining / 1000).toFixed(1)}s` : "Name the song…"}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Your guess"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-lg
                     outline-none placeholder:text-white/30 focus:border-emerald-500
                     disabled:opacity-50"
        />
      </form>

      {showSuggestions && suggestions && suggestions.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-white/10">
          {suggestions.map((title) => (
            <li key={title}>
              <button
                type="button"
                onClick={() => void submit(title)}
                disabled={inputDisabled}
                className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-50"
              >
                {title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
