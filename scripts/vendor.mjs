// Copies the dist files of the npm dependencies to src/vendor/ (ignored by git). jQuery and Chart.js are the builds
// the page used before the split (checked byte for byte): jquery.min.js and the minified UMD build of Chart.js.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
	["node_modules/jquery/dist/jquery.min.js", "src/vendor/jquery.min.js"],
	["node_modules/chart.js/dist/chart.umd.min.js", "src/vendor/chart.js"],
];
mkdirSync(join(root, "src/vendor"), { recursive: true });
for (const [from, to] of files) copyFileSync(join(root, from), join(root, to));
console.log("vendor: " + files.length + " files copied to src/vendor/");
