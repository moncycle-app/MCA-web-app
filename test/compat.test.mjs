import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const compat = require("../src/js/compat.js");

test("parse", () => {
	assert.equal(compat.parse("16dev"), 16);
	assert.equal(compat.parse("v16"), 16);
	assert.equal(compat.parse("16"), 16);
	assert.equal(compat.parse("v14-76-gd792319"), null);
	assert.equal(compat.parse(""), null);
	assert.equal(compat.parse(null), null);
});
test("check", () => {
	const range = { min: 16, max: 16 };
	assert.equal(compat.check(range, "16dev"), "compatible");
	assert.equal(compat.check(range, "15"), "incompatible");
	assert.equal(compat.check(range, "17dev"), "incompatible");
	assert.equal(compat.check(range, "v14-76-gd792319"), "unknown");
	assert.equal(compat.check(undefined, "16"), "unknown");
	assert.equal(compat.check({ min: 15, max: 17 }, "v16"), "compatible");
});
