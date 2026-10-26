// Writes the build date and the commit into version.json (a copy made by the image build, never the committed file).
//   node scripts/stamp_version.mjs <version.json> <build> <commit>
import { readFileSync, writeFileSync } from "node:fs";

const [file, build, commit] = process.argv.slice(2);
if (!file || !build || !commit) { console.error("usage: stamp_version.mjs <version.json> <build> <commit>"); process.exit(2); }
const version = JSON.parse(readFileSync(file, "utf8"));
version.build = build;
version.commit = commit;
writeFileSync(file, JSON.stringify(version, null, "\t") + "\n");
console.log("stamped " + file + ": " + version.version + " " + build + " " + commit);
