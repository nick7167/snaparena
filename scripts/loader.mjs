/**
 * Registers the TypeScript resolve hook. Run scripts with:
 *
 *   node --import ./scripts/loader.mjs scripts/whatever.ts
 *
 * See scripts/ts-resolve.mjs for why this is needed.
 */
import { register } from "node:module";

register("./ts-resolve.mjs", import.meta.url);
