// The production build: src/ to dist/ (served by the Docker image; dev keeps serving src/ as it is).
//   node scripts/build.mjs [--out DIR]          (DIR relative to the repository; default dist)
// - The script: js/main.js and everything it imports, bundled by esbuild as ES modules, minified, split: the entry, shared chunks, one
//   chunk per screen (the import() of router.js) and one for Chart.js (the import() of js/vendor/chart.js), all as assets/<name>-<hash>.js.
// - The styles: the <link rel="stylesheet"> of index.html, in their order, as one assets/app-<hash>.css; what they point at with url()
//   (the font) is copied to assets/ with a hash too, so font/ is not copied but for its licence.
// - index.html: those links and the module script replaced by the built files, with a modulepreload of the entry's chunks.
// - Copied: what the app fetches by its name (the screens' markup, i18n/*.json minified, config.json, version.json as it is: the stamp
//   of scripts/stamp_version.mjs, which runs before) and what pages point at (img/, the favicons, robots.txt). A file fetched at
//   run time must be listed in `copied` below; a module only needs to be imported.
// No source map. Any esbuild warning, a missing file, an inline script or handler in a page of dist/: an error, and exit code 1.
// The same input gives the same output (names and bytes).
import { build } from "esbuild";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const args = process.argv.slice(2);
const out = resolve(root, args.includes("--out") ? args[args.indexOf("--out") + 1] ?? "" : "dist");
const banner = "/* moncycle.app, Tech 4 Fertility, AGPL-3.0-or-later; source: https://github.com/moncycle-app */";
// what the app fetches or a page points at by name, relative to src/ (directories are copied whole)
const copied = ["config.json", "version.json", "robots.txt", "favicon.ico", "favicon.svg", "favicon-16x16.png", "favicon-32x32.png",
	"apple-touch-icon.png", "img", "font/montserrat/OFL.txt"];

function fail(message) {
	console.error("build: " + message);
	process.exit(1);
}
function files(dir) {
	return readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]);
}
function write(path, text) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, text);
}

// The output folder is emptied first: refuse one that is not ours (src/, the repository, a folder that holds them, a folder of something else).
if (args.includes("--out") && !args[args.indexOf("--out") + 1]) fail("--out needs a folder");
if (out === root || (src + sep).startsWith(out + sep) || out.startsWith(src + sep)) fail("refusing to build into " + out);
if (existsSync(out) && readdirSync(out).length && !existsSync(join(out, "assets")))
	fail(out + " is not empty and is not a former build");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// esbuild: the messages are read here, a warning fails the build like an error
async function run(options) {
	let result;
	try {
		result = await build({ bundle: true, minify: true, sourcemap: false, write: true, metafile: true, logLevel: "silent", charset: "utf8",
			outdir: out, entryNames: "assets/[name]-[hash]", chunkNames: "assets/[name]-[hash]", assetNames: "assets/[name]-[hash]", ...options });
	} catch (error) {
		for (const message of error.errors || []) console.error("esbuild error: " + message.text + (message.location ? " (" + message.location.file + ":" + message.location.line + ")" : ""));
		fail("esbuild failed");
	}
	for (const message of result.warnings) console.error("esbuild warning: " + message.text + (message.location ? " (" + message.location.file + ":" + message.location.line + ")" : ""));
	if (result.warnings.length) fail("esbuild warnings");
	return result.metafile;
}
const built = (metafile) => Object.keys(metafile.outputs).map((path) => relative(out, resolve(root, path)).split(sep).join("/"));

const page = readFileSync(join(src, "index.html"), "utf8");
const stylesheet = /^[ \t]*<link rel="stylesheet" href="([^"]+)" \/>\n/gm;
const styles = [...page.matchAll(stylesheet)].map((match) => match[1]);
const module_script = /<script type="module" src="js\/main\.js"><\/script>/;
if (!styles.length || !module_script.test(page)) fail("src/index.html: no stylesheet link or no <script type=\"module\" src=\"js/main.js\">");

// Chart.js: src/vendor/chart.js is its UMD file (scripts/vendor.mjs), which the browser runs as it is; the bundle takes the ES modules of the
// same package and version instead (chart.js/auto: every chart type registered, as in the UMD file).
const chart_esm = { name: "chart", setup(plugin) {
	plugin.onResolve({ filter: /\/vendor\/chart\.js$/ }, (args) => args.importer === join(src, "js/vendor/chart.js")
		? plugin.resolve("chart.js/auto", { kind: args.kind, resolveDir: root }) : undefined);
} };
const js = await run({ entryPoints: [join(src, "js/main.js")], format: "esm", splitting: true, target: "es2022", banner: { js: banner },
	plugins: [chart_esm] });
// the styles of index.html, one entry made of their @import (esbuild inlines them and rewrites their url())
const css = await run({ entryPoints: [{ in: "app.css", out: "app" }], target: "esnext", banner: { css: banner },
	loader: { ".ttf": "file", ".woff": "file", ".woff2": "file", ".png": "file", ".jpg": "file", ".svg": "file" },
	plugins: [{ name: "styles", setup(plugin) {
		plugin.onResolve({ filter: /^app\.css$/ }, () => ({ path: "app.css", namespace: "styles" }));
		plugin.onLoad({ filter: /.*/, namespace: "styles" }, () => ({ loader: "css", resolveDir: src,
			contents: styles.map((href) => "@import " + JSON.stringify("./" + href) + ";").join("\n") }));
	} }] });

const outputs = Object.entries(js.outputs);
const [entry_path, entry] = outputs.find(([, output]) => output.entryPoint === "src/js/main.js") || fail("no entry in the output");
const entry_file = built({ outputs: { [entry_path]: entry } })[0];
const preloads = entry.imports.filter((item) => item.kind === "import-statement").map((item) => relative(out, resolve(root, item.path)).split(sep).join("/"));
const css_file = built(css).find((path) => path.endsWith(".css"));

let html = page.replace(stylesheet, (line, href) => href === styles[0] ? line.replace(href, css_file) : "");
html = html.replace(module_script, ['<script type="module" src="' + entry_file + '"></script>',
	...preloads.map((path) => '\t\t<link rel="modulepreload" href="' + path + '" />')].join("\n"));
write(join(out, "index.html"), html);

// copied as they are; the catalogs minified; the screens' markup (fetched by the router)
for (const name of copied) cpSync(join(src, name), join(out, name), { recursive: true });
for (const path of files(join(src, "i18n")).filter((path) => path.endsWith(".json")))
	write(join(out, relative(src, path)), JSON.stringify(JSON.parse(readFileSync(path, "utf8"))));
for (const path of files(join(src, "screens")).filter((path) => path.endsWith(".html"))) {
	mkdirSync(dirname(join(out, relative(src, path))), { recursive: true });
	copyFileSync(path, join(out, relative(src, path)));
}

// The checks of the output.
const problems = [];
for (const path of [...built(js), ...built(css)]) if (!existsSync(join(out, path))) problems.push("missing output " + path);
if (!/^assets\/main-[A-Z0-9]{8}\.js$/.test(entry_file) || !/^assets\/app-[A-Z0-9]{8}\.css$/.test(css_file || "")) problems.push("unexpected names " + entry_file + ", " + css_file);
if (readFileSync(join(src, "version.json"), "utf8") !== readFileSync(join(out, "version.json"), "utf8")) problems.push("version.json differs from src/");
const pages = files(out).filter((path) => path.endsWith(".html"));
for (const path of pages) {
	const text = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, ""), name = relative(out, path);
	if (/<script\b(?![^>]*\bsrc=)[^>]*>|<script\b[^>]*>[^<]+<\/script>/i.test(text)) problems.push(name + ": inline script");
	if (/<[^>]+\son[a-z]+\s*=/i.test(text)) problems.push(name + ": inline event handler");
	if (/javascript:/i.test(text)) problems.push(name + ": javascript: link");
	// the files a page points at; a screen's markup is put in index.html, so its addresses are relative to dist/ too
	for (const [, attribute, address] of text.matchAll(/\s(href|src)="([^"]*)"/g)) {
		if (/^(#|[a-z]+:|\/\/|api\/)/i.test(address) || (name !== "index.html" && attribute === "href")) continue;
		if (!existsSync(join(out, address.split(/[?#]/)[0]))) problems.push(name + ": " + attribute + "=\"" + address + "\" not in the output");
	}
}
if (files(out).some((path) => path.endsWith(".map"))) problems.push("a source map is in the output");
if (problems.length) fail(problems.join("\n       "));

console.log("build: " + relative(root, out) + "/ " + entry_file + ", " + css_file + ", " + (built(js).length - 1) + " chunks, " + files(out).length + " files");
