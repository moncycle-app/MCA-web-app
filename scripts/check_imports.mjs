// Every `import { a, b } from "/x.js"` of the app names something that module exports (a typo only shows in the browser otherwise).
//   node scripts/check_imports.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
function files(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (name === "vendor") return [];
		return statSync(path).isDirectory() ? files(path) : name.endsWith(".js") ? [path] : [];
	});
}
const exported = (text) => new Set([...text.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)].map((m) => m[1]));
let bad = 0;
for (const file of files(src)) {
	const text = readFileSync(file, "utf8");
	for (const m of text.matchAll(/^import \{([^}]*)\} from "([^"]+)";/gm)) {
		let target;
		try { target = readFileSync(join(src, m[2]), "utf8"); }
		catch { console.error(file.slice(src.length) + ": no such module " + m[2]); bad++; continue; }
		const names = exported(target);
		for (const raw of m[1].split(",")) {
			const name = raw.trim().split(/\s+as\s+/)[0];
			if (name && !names.has(name)) { console.error(file.slice(src.length) + ": " + m[2] + " does not export " + name); bad++; }
		}
	}
}
console.log(bad ? bad + " bad import(s)" : "imports ok");
process.exit(bad ? 1 : 0);
