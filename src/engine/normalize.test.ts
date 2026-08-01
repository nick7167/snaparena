import { describe, expect, it } from "vitest";
import {
  looksLikeAlternateVersion,
  normalizeArtist,
  normalizeTitle,
  stripDiacritics,
  trackDedupKey,
} from "./normalize";

describe("stripDiacritics", () => {
  it("folds accented characters to their base form", () => {
    expect(stripDiacritics("Rosalía")).toBe("Rosalia");
    expect(stripDiacritics("Beyoncé")).toBe("Beyonce");
    expect(stripDiacritics("Sigur Rós")).toBe("Sigur Ros");
  });
});

describe("normalizeTitle", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeTitle("Mr. Brightside")).toBe("mr brightside");
    expect(normalizeTitle("W.A.P.")).toBe("w a p");
  });

  it("collapses contractions rather than splitting them", () => {
    expect(normalizeTitle("Can't Stop")).toBe("cant stop");
    expect(normalizeTitle("Don’t Start Now")).toBe("dont start now");
  });

  it("drops a leading article", () => {
    expect(normalizeTitle("The Less I Know the Better")).toBe("less i know the better");
  });

  it("expands ampersands so both spellings agree", () => {
    expect(normalizeTitle("Rock & Roll")).toBe(normalizeTitle("Rock and Roll"));
  });

  it("removes bracketed segments", () => {
    expect(normalizeTitle("Blinding Lights (Remix)")).toBe("blinding lights");
    expect(normalizeTitle("Levitating [Radio Edit]")).toBe("levitating");
  });

  it("keeps the substantive half when a title opens with a bracketed phrase", () => {
    expect(normalizeTitle("(I Can't Get No) Satisfaction")).toBe("satisfaction");
    expect(normalizeTitle("(Sittin' On) The Dock of the Bay")).toBe("dock of the bay");
  });

  it("drops trailing feature credits", () => {
    expect(normalizeTitle("Umbrella feat. JAY-Z")).toBe("umbrella");
    expect(normalizeTitle("Shape of You (feat. Nobody)")).toBe("shape of you");
    expect(normalizeTitle("Stay ft. Justin Bieber")).toBe("stay");
  });

  it("drops version suffixes after a dash", () => {
    expect(normalizeTitle("Blinding Lights - Remastered 2019")).toBe("blinding lights");
    expect(normalizeTitle("Africa - Single Version")).toBe("africa");
  });

  it("preserves dashes that are part of the actual title", () => {
    expect(normalizeTitle("Ready - Set - Go")).toBe("ready set go");
  });

  it("falls back to the lenient form rather than returning empty", () => {
    // Aggressive stripping would erase this entirely; we must not return "".
    expect(normalizeTitle("(Untitled)")).toBe("untitled");
    expect(normalizeTitle("[Intro]")).toBe("intro");
  });

  it("returns empty for empty input", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("makes a player's sloppy typing comparable to the stored title", () => {
    expect(normalizeTitle("bohemian   rhapsody  ")).toBe("bohemian rhapsody");
    expect(normalizeTitle("BOHEMIAN RHAPSODY")).toBe("bohemian rhapsody");
  });
});

describe("normalizeArtist", () => {
  it("keeps only the primary artist", () => {
    expect(normalizeArtist("The Weeknd & ROSALÍA")).toBe("weeknd");
    expect(normalizeArtist("Calvin Harris feat. Dua Lipa")).toBe("calvin harris");
  });

  it("handles a lone artist unchanged", () => {
    expect(normalizeArtist("Fleetwood Mac")).toBe("fleetwood mac");
  });
});

describe("looksLikeAlternateVersion", () => {
  it("flags remixes, live cuts and karaoke pollution", () => {
    expect(looksLikeAlternateVersion("Blinding Lights (Remix)")).toBe(true);
    expect(looksLikeAlternateVersion("Yesterday (Karaoke Version)")).toBe(true);
    expect(looksLikeAlternateVersion("Creep - Live")).toBe(true);
    expect(looksLikeAlternateVersion("Africa (Instrumental)")).toBe(true);
  });

  it("leaves ordinary titles alone", () => {
    expect(looksLikeAlternateVersion("Blinding Lights")).toBe(false);
    expect(looksLikeAlternateVersion("Bohemian Rhapsody")).toBe(false);
  });

  it("does not false-positive on version keywords embedded in real words", () => {
    // "live" is a substring of "deliver"; "mix" of "mixtape". Word boundaries matter.
    expect(looksLikeAlternateVersion("Something (Deliver Me)")).toBe(false);
    expect(looksLikeAlternateVersion("Alright (Believer)")).toBe(false);
  });
});

describe("trackDedupKey", () => {
  it("collapses a remix onto its original for dedup purposes", () => {
    expect(trackDedupKey("Blinding Lights (Remix)", "The Weeknd")).toBe(
      trackDedupKey("Blinding Lights", "The Weeknd"),
    );
  });

  it("keeps distinct songs distinct", () => {
    expect(trackDedupKey("Levitating", "Dua Lipa")).not.toBe(
      trackDedupKey("Physical", "Dua Lipa"),
    );
  });
});
