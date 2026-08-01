"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { AUTOCOMPLETE_MIN_CHARS } from "@/engine/config";
import { Glyph } from "@/ui/Glyph";

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
  // -1 means "no suggestion highlighted" — the raw typed text is what submits.
  const [active, setActive] = useState(-1);
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
  const options = showSuggestions ? (suggestions ?? []) : [];
  const open = options.length > 0;

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || inputDisabled) return;

    setSubmitting(true);
    try {
      const result = await onGuess(trimmed);
      if (result.status !== "correct") setText("");
      setActive(-1);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Keyboard is the primary input here — this is a typing race, and reaching for the
   * mouse to pick a suggestion costs more than typing the rest of the title.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current <= 0 ? options.length - 1 : current - 1));
    } else if (event.key === "Escape") {
      event.preventDefault();
      setActive(-1);
    }
  }

  return (
    <div className="relative flex flex-col gap-2">
      {/* Suggestions sit ABOVE the field, not below: the field is bottom-anchored in
          the thumb zone and a dropdown there would be under the on-screen keyboard. */}
      {open && (
        <ul
          id="guess-suggestions"
          role="listbox"
          aria-label="Track suggestions"
          className="border-line bg-ink-700 flex flex-col overflow-hidden rounded-md border"
        >
          {options.map((title, index) => (
            <li key={title} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                // Prevents the field losing focus before the click registers, which
                // would otherwise blur mid-race.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void submit(title)}
                disabled={inputDisabled}
                className={`text-body block w-full min-h-11 px-4 py-2 text-left transition-colors
                            disabled:opacity-50 ${
                              index === active
                                ? "bg-ink-500 text-paper"
                                : "text-secondary hover:bg-ink-600 hover:text-paper"
                            }`}
              >
                {title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          // A highlighted suggestion wins over the raw text — that is what the
          // highlight promises.
          void submit(active >= 0 && options[active] ? options[active] : text);
        }}
      >
        <div
          className={`bg-ink-inset flex items-center gap-3 rounded-md border px-4
                      transition-colors focus-within:border-paper
                      ${locked ? "border-signal" : "border-line-strong"}
                      ${inputDisabled ? "opacity-60" : ""}`}
        >
          <span className="text-muted text-lg">
            <Glyph name={locked ? "timer" : "song"} />
          </span>
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            disabled={inputDisabled}
            placeholder={locked ? `Locked ${(lockRemaining / 1000).toFixed(1)}s` : "Name the song…"}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Your guess"
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? "guess-suggestions" : undefined}
            aria-autocomplete="list"
            className="text-body-lg placeholder:text-muted min-h-13 w-full min-w-0 bg-transparent
                       outline-none"
          />
        </div>
      </form>
    </div>
  );
}
