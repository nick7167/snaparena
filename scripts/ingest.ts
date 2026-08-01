/**
 * iTunes Search API ingest.
 *
 * Stage 1 of a two-stage pipeline: this script talks to Apple, filters and dedupes,
 * and writes `data/tracks.json`. Stage 2 (`import-tracks.ts`) pushes that file into
 * Convex. Splitting them means the slow, rate-limited network work is reproducible
 * and reviewable before anything touches the database.
 *
 * Never called at request time — the API allows only ~20 calls/minute.
 *
 * Usage:
 *   node scripts/ingest.ts                  # full run
 *   node scripts/ingest.ts --artists 2      # quick smoke test, 2 artists per category
 *   node scripts/ingest.ts --out data/x.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  looksLikeAlternateVersion,
  normalizeArtist,
  normalizeTitle,
  trackDedupKey,
} from "../src/engine/normalize.ts";
import { CATEGORY_SEEDS, type CategorySeed } from "./seeds.ts";

/** Apple documents ~20 calls/min. We stay under it and back off on 429. */
const REQUEST_INTERVAL_MS = 3_500;
const MAX_RETRIES = 4;
const RESULTS_PER_ARTIST = 50;

/** Tracks below this rank in an artist's relevance-ordered results are dropped. */
const RELEVANCE_CUTOFF = 25;

interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  kind?: string;
}

export interface IngestedTrack {
  itunesTrackId: number;
  title: string;
  titleNormalized: string;
  artist: string;
  artistNormalized: string;
  artworkUrl: string;
  previewUrl: string;
  categorySlugs: string[];
  difficulty: number;
  popularity: number;
  releaseYear: number;
  playable: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    artistLimit: Number(get("--artists") ?? Number.POSITIVE_INFINITY),
    outPath: get("--out") ?? "data/tracks.json",
  };
}

async function searchArtist(artist: string): Promise<ItunesTrack[]> {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", artist);
  url.searchParams.set("attribute", "artistTerm");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(RESULTS_PER_ARTIST));
  url.searchParams.set("country", "US");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": "song-race-ingest/1.0" },
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status === 429) {
      // Exponential backoff — the documented rate limit is a soft target and
      // Apple throttles bursts harder than the average suggests.
      const backoff = REQUEST_INTERVAL_MS * Math.pow(2, attempt + 1);
      console.warn(`  429 for "${artist}", backing off ${backoff}ms`);
      await sleep(backoff);
      continue;
    }

    if (!response.ok) {
      console.warn(`  HTTP ${response.status} for "${artist}"`);
      return [];
    }

    const body = (await response.json()) as { results?: ItunesTrack[] };
    return body.results ?? [];
  }

  console.warn(`  giving up on "${artist}" after ${MAX_RETRIES} retries`);
  return [];
}

/**
 * Maps an artist-search result position onto a 0..100 popularity score.
 * iTunes returns no play counts, so relevance rank is the best proxy available.
 *
 * Scaled against RELEVANCE_CUTOFF rather than RESULTS_PER_ARTIST: everything past
 * the cutoff is discarded, so dividing by the larger number would compress every
 * surviving track into the top half of the range and leave difficulty tiers 4 and 5
 * permanently unreachable.
 */
function popularityFromRank(rank: number): number {
  return Math.max(0, Math.round(100 * (1 - rank / RELEVANCE_CUTOFF)));
}

/**
 * Difficulty tier 1 (easiest) .. 5 (hardest), seeded from popularity only.
 * Corrected later from real median solve times — see `medianSolveMs` on the table.
 */
function difficultyFromPopularity(popularity: number): number {
  if (popularity >= 85) return 1;
  if (popularity >= 70) return 2;
  if (popularity >= 50) return 3;
  if (popularity >= 30) return 4;
  return 5;
}

function releaseYearOf(track: ItunesTrack): number {
  if (!track.releaseDate) return 0;
  const year = Number(track.releaseDate.slice(0, 4));
  return Number.isFinite(year) ? year : 0;
}

function matchesEra(track: ItunesTrack, seed: CategorySeed): boolean {
  if (!seed.yearRange) return true;
  const year = releaseYearOf(track);
  return year >= seed.yearRange[0] && year <= seed.yearRange[1];
}

/**
 * Decides which category a track should be filed under, given the seed we found
 * it through. Returns null only if the track genuinely has nowhere to go.
 *
 * Falling outside a seed's era window must NOT discard the track. An artist whose
 * career spans a decade boundary is seeded under one era category, and dropping
 * everything outside that window silently removed half their catalogue — that is
 * how "Levitating" (Dua Lipa, 2020, found via the 2010s Pop seed) went missing.
 * Instead, look for an era category that does cover the track and shares a genre.
 */
function resolveCategorySlug(track: ItunesTrack, seed: CategorySeed): string | null {
  if (matchesEra(track, seed)) return seed.slug;

  const genre = track.primaryGenreName ?? "";
  const alternative = CATEGORY_SEEDS.find(
    (candidate) =>
      candidate.slug !== seed.slug &&
      candidate.yearRange !== null &&
      matchesEra(track, candidate) &&
      candidate.genreHints.some((hint) => genre.includes(hint)),
  );

  return alternative?.slug ?? null;
}

async function main() {
  const { artistLimit, outPath } = parseArgs();

  /** Dedup key -> track. First writer wins, later categories only append a slug. */
  const collected = new Map<string, IngestedTrack>();
  const stats = {
    seen: 0,
    noPreview: 0,
    alternateVersion: 0,
    lowRelevance: 0,
    outOfEra: 0,
    duplicate: 0,
  };

  for (const seed of CATEGORY_SEEDS) {
    const artists = seed.artists.slice(0, artistLimit);
    console.log(`\n${seed.name} (${artists.length} artists)`);

    for (const artist of artists) {
      const results = await searchArtist(artist);
      let kept = 0;

      results.forEach((track, rank) => {
        stats.seen++;

        if (track.kind && track.kind !== "song") return;

        // A track with no preview is unplayable by definition — this is the
        // single most important filter in the pipeline.
        if (!track.previewUrl) {
          stats.noPreview++;
          return;
        }

        if (looksLikeAlternateVersion(track.trackName)) {
          stats.alternateVersion++;
          return;
        }

        if (rank >= RELEVANCE_CUTOFF) {
          stats.lowRelevance++;
          return;
        }

        const categorySlug = resolveCategorySlug(track, seed);
        if (!categorySlug) {
          stats.outOfEra++;
          return;
        }

        const key = trackDedupKey(track.trackName, track.artistName);
        const existing = collected.get(key);

        if (existing) {
          stats.duplicate++;
          if (!existing.categorySlugs.includes(categorySlug)) {
            existing.categorySlugs.push(categorySlug);
          }
          return;
        }

        const popularity = popularityFromRank(rank);
        collected.set(key, {
          itunesTrackId: track.trackId,
          title: track.trackName,
          titleNormalized: normalizeTitle(track.trackName),
          artist: track.artistName,
          artistNormalized: normalizeArtist(track.artistName),
          artworkUrl: (track.artworkUrl100 ?? "").replace("100x100bb", "600x600bb"),
          previewUrl: track.previewUrl,
          categorySlugs: [categorySlug],
          difficulty: difficultyFromPopularity(popularity),
          popularity,
          releaseYear: releaseYearOf(track),
          playable: true,
        });
        kept++;
      });

      console.log(`  ${artist.padEnd(24)} +${kept}`);
      await sleep(REQUEST_INTERVAL_MS);
    }
  }

  const tracks = [...collected.values()].sort((a, b) => b.popularity - a.popularity);
  const absoluteOut = path.resolve(outPath);
  await mkdir(path.dirname(absoluteOut), { recursive: true });
  await writeFile(absoluteOut, JSON.stringify({ tracks }, null, 2), "utf8");

  console.log(`\n--- ingest summary ---`);
  console.log(`  results seen        ${stats.seen}`);
  console.log(`  dropped: no preview ${stats.noPreview}`);
  console.log(`  dropped: alt cut    ${stats.alternateVersion}`);
  console.log(`  dropped: low rank   ${stats.lowRelevance}`);
  console.log(`  dropped: wrong era  ${stats.outOfEra}`);
  console.log(`  merged duplicates   ${stats.duplicate}`);
  console.log(`  KEPT                ${tracks.length}`);
  console.log(`  written to          ${absoluteOut}`);

  const byDifficulty = tracks.reduce<Record<number, number>>((acc, track) => {
    acc[track.difficulty] = (acc[track.difficulty] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  difficulty spread   ${JSON.stringify(byDifficulty)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
