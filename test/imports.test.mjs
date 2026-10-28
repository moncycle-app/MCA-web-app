// Every named import of the app's modules is something that module exports (a typo would only show in the browser).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("the named imports of src/ exist", () => {
	const output = execFileSync(process.execPath, [fileURLToPath(new URL("../scripts/check_imports.mjs", import.meta.url))], { encoding: "utf8" });
	assert.match(output, /imports ok/);
});
