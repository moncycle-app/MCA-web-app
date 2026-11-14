import { test } from "node:test";
import assert from "node:assert/strict";
import { important_text, text_hash } from "../src/js/core/important_info.js";

const info = {importantMessages: {en: "Maintenance Sunday.", fr: "Maintenance dimanche.", de: "  "}};

test("important_text: the language, else English, else none", () => {
	assert.equal(important_text(info, "fr"), "Maintenance dimanche.");
	assert.equal(important_text(info, "FR"), "Maintenance dimanche.");
	assert.equal(important_text(info, "es"), "Maintenance Sunday.");
	assert.equal(important_text(info, "de"), "Maintenance Sunday.");   // blank: English
	assert.equal(important_text({importantMessages: {fr: "x"}}, "es"), null);
	assert.equal(important_text({importantMessages: {}}, "en"), null);
	assert.equal(important_text({}, "en"), null);   // an older server
	assert.equal(important_text(null, "en"), null);
	assert.equal(important_text({importantMessages: {en: 5}}, "en"), null);
});

test("text_hash: stable, changes with the text", () => {
	assert.equal(text_hash("a"), text_hash("a"));
	assert.notEqual(text_hash("a"), text_hash("b"));
});
