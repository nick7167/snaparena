/**
 * Node ESM resolve hook that fills in the extensions SpacetimeDB's codegen omits.
 *
 * `spacetime generate` writes extensionless relative imports
 * (`from "./match_table"`), which is what a bundler expects and what Next.js
 * resolves without complaint. Plain `node script.ts` does not: Node ESM requires a
 * full specifier, so the scripts in this directory could not import the generated
 * bindings at all.
 *
 * Editing the generated files is not an option — they are regenerated on every
 * schema change, and a post-processing step would be one more thing to forget. So
 * the gap is closed at resolution time instead: try the specifier as written, and
 * on failure retry it as `.ts` and then as `/index.ts`.
 *
 * Registered by scripts/loader.mjs, which every script runs under.
 */

const CANDIDATE_SUFFIXES = [".ts", "/index.ts", ".js", "/index.js"];

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    // Only relative specifiers are worth retrying. A bare package name that fails
    // to resolve is a genuinely missing dependency, and guessing extensions for it
    // would turn a clear error into a confusing one.
    if (!specifier.startsWith(".")) throw error;

    for (const suffix of CANDIDATE_SUFFIXES) {
      try {
        return await next(specifier + suffix, context);
      } catch {
        // Try the next shape.
      }
    }
    throw error;
  }
}
