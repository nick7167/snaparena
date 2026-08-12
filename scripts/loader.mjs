/**
 * Registers the TypeScript resolve hook. Run scripts with:
 *
 *   node --experimental-strip-types --import ./scripts/loader.mjs scripts/whatever.ts
 *
 * See scripts/ts-resolve.mjs for why the hook is needed.
 *
 * BOTH FLAGS, ALWAYS. They fix different halves of the same problem and package.json
 * cannot carry a comment saying so, which is why it is said here:
 *
 *   --experimental-strip-types  lets Node run a `.ts` file at all. Stripping is on by
 *                               default from Node 22.18, but the flag is what makes
 *                               these scripts work on 22.6–22.17 too — without it those
 *                               versions fail with ERR_UNKNOWN_FILE_EXTENSION before
 *                               any hook gets a chance to run. Newer Node still accepts
 *                               the flag, so passing it costs nothing.
 *   --import ./scripts/loader.mjs   resolves the extensionless imports inside the
 *                               generated SpacetimeDB bindings.
 *
 * A script that imports src/module_bindings needs both; one that does not still takes
 * both, so there is one shape to copy rather than two to choose between.
 */
import { register } from "node:module";

register("./ts-resolve.mjs", import.meta.url);
