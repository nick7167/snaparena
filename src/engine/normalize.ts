/**
 * Text normalization for song titles and artist names.
 *
 * The same pipeline runs at ingest time (to build the searchable/comparable form
 * stored on each track) and at guess time (on whatever the player typed). Both
 * sides must go through the identical function or comparisons are meaningless.
 */

/** Words that mark a trailing credit rather than part of the title proper. */
const FEATURE_MARKERS = ["feat", "ft", "featuring", "with", "w"];

/**
 * Keywords identifying an alternate cut of a song. Used two ways: stripped from a
 * ` - suffix` tail during normalization, and used by the ingest script to exclude
 * karaoke/tribute pollution from the playable pool.
 */
const VERSION_KEYWORDS = [
  "remaster",
  "remastered",
  "remix",
  "radio edit",
  "single version",
  "album version",
  "extended",
  "live",
  "acoustic",
  "instrumental",
  "karaoke",
  "cover",
  "tribute",
  "demo",
  "reprise",
  "mono",
  "stereo",
  "deluxe",
  "bonus track",
  "edit",
  "mix",
  "version",
];

/**
 * Matches a version keyword as a whole word.
 *
 * Word boundaries are essential here, not cosmetic: a plain substring test finds
 * "live" inside "deliver", which would wrongly flag "(Deliver Me)" as a live
 * recording and drop a legitimate track from the playable pool.
 */
const VERSION_PATTERN = new RegExp(`\\b(?:${VERSION_KEYWORDS.join("|")})\\b`, "i");

/** Removes combining marks so "Rosalía" and "Rosalia" compare equal. */
export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Removes every `(...)` and `[...]` segment, including nested ones. */
function stripBracketed(input: string): string {
  let out = input;
  let previous: string;
  do {
    previous = out;
    out = out.replace(/\([^()]*\)/g, " ").replace(/\[[^[\]]*\]/g, " ");
  } while (out !== previous);
  return out;
}

/** Drops a trailing "feat. X" / "ft X" / "with X" credit. */
function stripFeatureCredit(input: string): string {
  const pattern = new RegExp(`\\s[-,]?\\s*\\b(${FEATURE_MARKERS.join("|")})\\.?\\s.*$`, "i");
  return input.replace(pattern, "");
}

/**
 * Drops a ` - Remastered 2019` style tail, but only when the tail actually looks
 * like a version marker. A plain hyphen inside a real title ("Ready - Set - Go")
 * is left alone.
 */
function stripVersionSuffix(input: string): string {
  const parts = input.split(/\s+-\s+/);
  if (parts.length < 2) return input;

  const kept = [parts[0]];
  for (const part of parts.slice(1)) {
    if (!VERSION_PATTERN.test(part)) kept.push(part);
  }
  return kept.join(" - ");
}

function collapse(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Symbols, punctuation and whitespace. Everything except the leading article. */
function finalizeKeepingArticle(input: string): string {
  let out = stripDiacritics(input.toLowerCase());
  out = out.replace(/&/g, " and ");
  out = out.replace(/[‘’‛]/g, "'");
  // Contractions collapse rather than split: "can't" -> "cant", not "can t".
  out = out.replace(/'/g, "");
  out = out.replace(/[^a-z0-9\s]/g, " ");
  return collapse(out);
}

/** Applies the shared tail of the pipeline: symbols, punctuation, whitespace, leading article. */
function finalize(input: string): string {
  return collapse(finalizeKeepingArticle(input).replace(/^the\s+/, ""));
}

/**
 * Search fold: the character normalization of `finalize`, without the article strip.
 *
 * `normalizeTitle` is the right key for COMPARING a finished guess and the wrong key for
 * RANKING a partial one, and the difference is the leading article. Normalizing turns
 * "The S" into "s", which prefix-matches every title starting with "s" and ranks "The
 * Sound of Silence" no better than "Sicko Mode" — so a player typing the first two words
 * of a title gets noise back.
 *
 * This keeps the article, and also keeps bracketed segments and version suffixes, because
 * a player may well type them. Callers derive the article-stripped variant by slicing this
 * result, which is why titles are still findable both ways.
 */
export function foldForSearch(raw: string): string {
  if (!raw) return "";
  return finalizeKeepingArticle(raw);
}

/**
 * Canonical comparable form of a song title.
 *
 * If aggressive stripping would empty the string (e.g. a title that is entirely
 * parenthetical), we fall back to the unstripped form rather than returning "".
 */
export function normalizeTitle(raw: string): string {
  if (!raw) return "";

  const aggressive = finalize(stripVersionSuffix(stripFeatureCredit(stripBracketed(raw))));
  if (aggressive.length > 0) return aggressive;

  const lenient = finalize(raw);
  return lenient;
}

/** Canonical comparable form of an artist name. Bracketed segments are kept. */
export function normalizeArtist(raw: string): string {
  if (!raw) return "";
  const primary = raw.split(/\s*(?:,|&|feat\.?|ft\.?|featuring|x|\band\b)\s*/i)[0] ?? raw;
  const normalized = finalize(primary);
  return normalized.length > 0 ? normalized : finalize(raw);
}

/**
 * True if the title advertises itself as a remix, live cut, karaoke version, etc.
 *
 * The ingest script uses this to keep alternate cuts out of the playable pool —
 * iTunes search results are heavily polluted with karaoke and tribute recordings,
 * and a player who hears a karaoke backing track has no fair chance.
 */
export function looksLikeAlternateVersion(rawTitle: string): boolean {
  const lowered = stripDiacritics(rawTitle.toLowerCase());
  const bracketed = lowered.match(/[([][^)\]]*[)\]]/g) ?? [];
  const dashTail = lowered.split(/\s+-\s+/).slice(1);
  const suspectRegions = [...bracketed, ...dashTail];

  return suspectRegions.some((region) => VERSION_PATTERN.test(region));
}

/** Stable dedup key for a recording, used during ingest. */
export function trackDedupKey(title: string, artist: string): string {
  return `${normalizeTitle(title)}::${normalizeArtist(artist)}`;
}
