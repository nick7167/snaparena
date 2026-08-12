import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards a class of module error that `tsc` cannot see.
 *
 * SpacetimeDB derives a type name from every table and view name — `tutorial_track`
 * becomes `TutorialTrack` — and a module declaring its own type under a name already
 * taken is rejected at publish with `name X is used for multiple types`. That check
 * lives in the registrar, not the type system, so the module typechecks perfectly and
 * then fails at `spacetime publish`.
 *
 * This is not hypothetical: the tutorial view was written with its row type named after
 * the view and broke the first publish that carried it. Every other view in the module
 * already avoided the collision by convention — `catalogue_stats` returns a
 * `CatalogueHealth`, `my_round_status` a `RoundStatus` — but a convention nothing checks
 * is one somebody re-breaks.
 *
 * The test parses source rather than importing the module, because importing it means
 * evaluating the registrar, which is the thing being tested.
 */

const MODULE_SRC = path.resolve(import.meta.dirname, "../../spacetimedb/src");

function moduleSources(): string {
  return readdirSync(MODULE_SRC)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => readFileSync(path.join(MODULE_SRC, file), "utf8"))
    .join("\n");
}

/** `daily_run` -> `DailyRun`, the way the registrar derives it. */
function pascalCase(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function matchAll(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

describe("module type names", () => {
  const source = moduleSources();

  /** Names the registrar generates for us, from `{ name: "..." }` on tables and views. */
  const derived = matchAll(source, /name:\s*"([a-z0-9_]+)"/g).map(pascalCase);

  /** Names the module declares by hand, for row and object types. */
  const declared = matchAll(source, /t\.(?:row|object|product|sum)\(\s*"([A-Za-z0-9_]+)"/g);

  it("finds the names it is meant to be checking", () => {
    // A regex that silently matched nothing would make every assertion below pass.
    expect(derived.length).toBeGreaterThan(20);
    expect(declared.length).toBeGreaterThan(5);
  });

  it("declares no type under a name a table or view already derives", () => {
    const taken = new Set(derived);
    const collisions = declared.filter((name) => taken.has(name));

    expect(collisions).toEqual([]);
  });

  it("declares each type name exactly once", () => {
    const seen = new Set<string>();
    const duplicates = declared.filter((name) => {
      if (seen.has(name)) return true;
      seen.add(name);
      return false;
    });

    expect(duplicates).toEqual([]);
  });

  it("derives each table and view name exactly once", () => {
    const seen = new Set<string>();
    const duplicates = derived.filter((name) => {
      if (seen.has(name)) return true;
      seen.add(name);
      return false;
    });

    expect(duplicates).toEqual([]);
  });
});
