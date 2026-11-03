// The production build (scripts/build.mjs), run twice into temporary folders: the layout the Docker image serves and caches, no inline
// script, the files fetched by name unchanged, and the same output for the same input.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const script = join(root, "scripts/build.mjs");
const screens = ["timeline", "auth", "recover", "register", "verify_email", "settings"];

function files(dir) {
	return readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]);
}
function run_build() {
	const out = mkdtempSync(join(tmpdir(), "moncycle_build_"));
	const output = execFileSync(process.execPath, [script, "--out", out], { encoding: "utf8" });
	return { out, output };
}

const first = run_build();
const second = run_build();
test.after(() => { for (const { out } of [first, second]) rmSync(out, { recursive: true, force: true }); });
const out = first.out;
const assets = readdirSync(join(out, "assets"));
const page = readFileSync(join(out, "index.html"), "utf8");

test("the build ends without an error", () => {
	assert.match(first.output, /^build: /);
});

test("one entry script and one stylesheet, with a hash in their name, named by index.html", () => {
	const entries = [...page.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map((m) => m[1]);
	const sheets = [...page.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
	assert.equal(entries.length, 1);
	assert.equal(sheets.length, 1);
	assert.match(entries[0], /^assets\/main-[A-Z0-9]{8}\.js$/);
	assert.match(sheets[0], /^assets\/app-[A-Z0-9]{8}\.css$/);
	assert.equal(assets.filter((name) => name.endsWith(".css")).length, 1);
	for (const name of assets) assert.match(name, /-[A-Z0-9]{8}\.[a-z0-9]+$/, name + " has no hash");
});

test("every file index.html points at is in the output", () => {
	for (const [, address] of page.matchAll(/\s(?:href|src)="([^"#:]+)"/g)) statSync(join(out, address));
});

test("no inline script, no inline handler, no source map", () => {
	for (const path of files(out).filter((path) => path.endsWith(".html"))) {
		const text = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, "");
		assert.doesNotMatch(text, /<script\b(?![^>]*\bsrc=)[^>]*>/i, relative(out, path));
		assert.doesNotMatch(text, /<[^>]+\son[a-z]+\s*=/i, relative(out, path));
	}
	assert.equal(files(out).filter((path) => path.endsWith(".map")).length, 0);
});

test("version.json and config.json are the bytes of src/; the catalogs are valid JSON, with the same content", () => {
	for (const name of ["version.json", "config.json"]) assert.equal(readFileSync(join(out, name), "utf8"), readFileSync(join(src, name), "utf8"), name);
	const catalogs = readdirSync(join(src, "i18n")).filter((name) => name.endsWith(".json"));
	assert.ok(catalogs.includes("en.json"));
	for (const name of catalogs)
		assert.deepEqual(JSON.parse(readFileSync(join(out, "i18n", name), "utf8")), JSON.parse(readFileSync(join(src, "i18n", name), "utf8")), name);
});

test("one chunk per screen, and the markup each screen fetches", () => {
	for (const name of screens) {
		assert.equal(assets.filter((file) => new RegExp("^" + name + "-[A-Z0-9]{8}\\.js$").test(file)).length, 1, name);
		statSync(join(out, "screens", name, name + ".html"));
	}
});

test("Chart.js is a chunk of its own, neither in the entry nor in the timeline", () => {
	const holding = assets.filter((name) => name.endsWith(".js") && readFileSync(join(out, "assets", name), "utf8").includes("Chart.js v"));
	assert.equal(holding.length, 1);
	assert.doesNotMatch(holding[0], /^(main|timeline|chunk)-/);
});

test("the same input gives the same output, with no path of this machine in it", () => {
	const listing = (dir) => files(dir).map((path) => relative(dir, path)).sort();
	assert.deepEqual(listing(second.out), listing(out));
	for (const name of listing(out)) assert.ok(readFileSync(join(out, name)).equals(readFileSync(join(second.out, name))), name);
	for (const name of assets.filter((name) => /\.(js|css)$/.test(name))) assert.ok(!readFileSync(join(out, "assets", name), "utf8").includes(root), name);
});
