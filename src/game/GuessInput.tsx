"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { AUTOCOMPLETE_MIN_CHARS } from "@/engine/config";
import { isSearchableTerm, searchTitles } from "@/engine/autocomplete";
import { useTrackIndex } from "./track-index";
import { Glyph } from "@/ui/Glyph";

/** Stable identity so an empty result never counts as a change. */
const NO_OPTIONS: readonly string[] = Object.freeze([]);

/** How many suggestions fit in the time a player has to read them. */
const MAX_SUGGESTIONS = 6;

/**
 * What a submitted guess comes back as.
 *
 * Exported and shared by both runners so the contract cannot drift between the duel and
 * the daily — they had independently identical copies of this, and independently identical
 * bugs in the code that used it.
 */
export interface GuessResult {
  status: string;
  /**
   * Keep what the player typed instead of clearing the field.
   *
   * Set when the submission itself failed rather than being judged — the guess never
   * reached the server, so throwing away the text would make the player retype it under a
   * clock that is still running.
   */
  keepText?: boolean;
}

interface GuessInputProps {
  onGuess: (text: string) => Promise<GuessResult>;
  disabled: boolean;
  /** Server-provided timestamp; input stays locked until it passes. */
  lockedUntil: number;
  /**
   * Force a title to the head of the suggestion list. TUTORIAL ONLY.
   *
   * The welcome tutorial has to guarantee a win without handing over the answer, because
   * telling someone the title trains them to type full titles — and the technique that
   * actually wins rounds is recognise, type two or three characters, arrow down, enter.
   * Pinning the right track at the top of the list scaffolds exactly that technique
   * instead of bypassing it.
   *
   * Only `TutorialRunner` passes this. When absent — which is every real round, ranked,
   * daily, practice and rooms — the options list is computed exactly as it was before this
   * prop existed. Keep it that way: this component is where a dropped keystroke costs a
   * player a rated round.
   */
  pinnedSuggestion?: string;
  /** Draw attention to the pinned row, once coaching escalates. TUTORIAL ONLY. */
  highlightPinned?: boolean;
}

export function GuessInput({
  onGuess,
  disabled,
  lockedUntil,
  pinnedSuggestion,
  highlightPinned = false,
}: GuessInputProps) {
  const [text, setText] = useState("");
  const [lockRemaining, setLockRemaining] = useState(0);
  // -1 means "no suggestion highlighted" — the raw typed text is what submits.
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * A ref, not state, deliberately.
   *
   * This used to be state that fed the input's `disabled` attribute while a guess was in
   * flight — which blurred the field, dropped whatever was typed during the round-trip, and
   * left the player having to click back in mid-race. Tracking it in a ref keeps the guard
   * without re-rendering, so the attribute never flips and focus is never lost.
   */
  const inFlight = useRef(false);

  /**
   * Suggestions come from a locally prefetched copy of the catalogue, so they are computed
   * in the same render as the keystroke. That is the whole point: this is a typing race,
   * and a list that arrives a round-trip late has already cost the player the round.
   *
   * The catalogue is the FULL one, not the tracks in this match — see convex/tracks.ts for
   * why that is load-bearing rather than incidental.
   */
  const index = useTrackIndex();
  const local = index ? searchTitles(index, text, MAX_SUGGESTIONS) : null;

  /**
   * Server fallback, live only in the moment before the index lands — and permanently if it
   * never does. `local === null` is the only condition that arms it, so once the index is
   * loaded this query is skipped for the rest of the session.
   */
  const remote = useQuery(
    api.tracks.autocomplete,
    local === null && isSearchableTerm(text) ? { term: text, limit: MAX_SUGGESTIONS } : "skip",
  );

  /**
   * The bug this component existed to cause.
   *
   * `useQuery` returns undefined while a query is in flight, and every keystroke changes the
   * args — so collapsing undefined into [] closed the list on every single character, and a
   * player typing faster than the round-trip never saw it at all. Holding the last resolved
   * result means loading can no longer empty the list.
   *
   * State adjusted during render rather than in an effect: the codebase's own pattern (see
   * useRoundAudio), and unlike a ref it is safe under concurrent rendering.
   */
  const [heldRemote, setHeldRemote] = useState<readonly string[]>(NO_OPTIONS);
  if (remote !== undefined && remote !== heldRemote) setHeldRemote(remote);

  useEffect(() => {
    const update = () => setLockRemaining(Math.max(0, lockedUntil - Date.now()));
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const locked = lockRemaining > 0;
  const inputDisabled = disabled || locked;

  // Keep focus on the box: every millisecond spent clicking is points lost.
  useEffect(() => {
    if (!inputDisabled) inputRef.current?.focus();
  }, [inputDisabled]);

  const gateOpen = text.trim().length >= AUTOCOMPLETE_MIN_CHARS;
  const matched = gateOpen ? (local ?? remote ?? heldRemote) : NO_OPTIONS;

  /**
   * The real path is untouched.
   *
   * Without `pinnedSuggestion` this is `matched` by identity — the same array the previous
   * version computed, with no copy, no filter and no allocation. The tutorial branch only
   * runs when the prop is set, which is only ever from `TutorialRunner`.
   *
   * The gate is dropped along with it: a tutorial pin has to appear on the FIRST keystroke,
   * and AUTOCOMPLETE_MIN_CHARS is 2 — so a coached player typing one letter would see
   * nothing and conclude the field is broken.
   */
  const options = pinnedSuggestion
    ? text.trim().length === 0
      ? NO_OPTIONS
      : [pinnedSuggestion, ...matched.filter((title) => title !== pinnedSuggestion)]
    : matched;

  const open = options.length > 0;

  /**
   * Clamped rather than synced.
   *
   * The list can shrink between renders — a later keystroke returns fewer matches — and a
   * highlight left pointing past the end would submit `undefined`. Deriving it costs nothing
   * and cannot fall out of step the way an effect could.
   */
  const activeIndex = active >= 0 && active < options.length ? active : -1;

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || inputDisabled || inFlight.current) return;

    inFlight.current = true;
    try {
      const result = await onGuess(trimmed);
      // A guess that was judged and rejected clears the field; one that never reached the
      // server keeps it, so retrying costs a keystroke rather than the whole title.
      if (result.status !== "correct" && !result.keepText) setText("");
      setActive(-1);
    } finally {
      inFlight.current = false;
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
          {/* Titles are unique — the index keeps one recording per normalized title — so
              the title itself is a safe key. */}
          {options.map((title, index) => {
            // Tutorial only, and inert in every real round because `highlightPinned` is
            // false unless the coaching has escalated to its second rung.
            const coached = highlightPinned && title === pinnedSuggestion;

            return (
              <li key={title} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`guess-suggestion-${index}`}
                  aria-selected={index === activeIndex}
                  // Prevents the field losing focus before the click registers, which
                  // would otherwise blur mid-race.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void submit(title)}
                  disabled={inputDisabled}
                  className={`text-body block w-full min-h-11 px-4 py-2 text-left transition-colors
                              disabled:opacity-50 ${
                                coached
                                  ? "bg-gold text-ink-900 font-semibold"
                                  : index === activeIndex
                                    ? "bg-ink-500 text-paper"
                                    : "text-secondary hover:bg-ink-600 hover:text-paper"
                              }`}
                >
                  {title}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          // A highlighted suggestion wins over the raw text — that is what the
          // highlight promises.
          void submit(activeIndex >= 0 ? options[activeIndex] : text);
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
            aria-activedescendant={
              activeIndex >= 0 ? `guess-suggestion-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            className="text-body-lg placeholder:text-muted min-h-13 w-full min-w-0 bg-transparent
                       outline-none"
          />
        </div>
      </form>
    </div>
  );
}
