// Build-time check: is the backend in the range src/version.json declares?
//   node scripts/check_api_compat.mjs <backend constants.php | version text>
// The generation is the integer at the start of APP_VERSION ("16dev"), read from constants.php or given as it is.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { moncycle_compat as compat } from "../src/js/core/compat.js";

const here = dirname(fileURLToPath(import.meta.url));
const range = JSON.parse(readFileSync(join(here, "..", "src", "version.json"), "utf8")).api;
const source = process.argv[2];
if (!source) { console.error("usage: check_api_compat.mjs <constants.php | version>"); process.exit(2); }

let api_version = source;
if (existsSync(source)) {
	const found = /const\s+APP_VERSION\s*=\s*["']([^"']+)["']/.exec(readFileSync(source, "utf8"));
	if (!found) { console.error("APP_VERSION not found in " + source); process.exit(2); }
	api_version = found[1];
}
const verdict = compat.check(range, api_version);
console.log("backend " + api_version + ", web app supports " + range.min + ".." + range.max + ": " + verdict);
if (verdict === "incompatible") process.exit(1);
