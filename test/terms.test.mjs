import { test } from "node:test";
import assert from "node:assert/strict";
import { terms_url } from "../src/js/core/terms.js";

const info = {termsOfServiceUrl: "https://x.org/en.html", termsOfServiceUrls: {fr: "https://x.org/fr.html", de: "http://x.org/de.html"}};

test("terms_url: the page of the language, else the default, else none", () => {
	assert.equal(terms_url(info, "fr"), "https://x.org/fr.html");
	assert.equal(terms_url(info, "FR"), "https://x.org/fr.html");
	assert.equal(terms_url(info, "pl"), "https://x.org/en.html");
	assert.equal(terms_url(info, "de"), "https://x.org/en.html");   // not https: ignored
	assert.equal(terms_url({termsOfServiceUrls: {}}, "fr"), null);
	assert.equal(terms_url({termsOfServiceUrl: "https://x.org/en.html"}, "fr"), "https://x.org/en.html");   // an older server
	assert.equal(terms_url(null, "fr"), null);
});
