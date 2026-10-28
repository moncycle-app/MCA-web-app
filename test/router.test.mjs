// The addresses the router accepts: old .html forms are written back, the settings panels stay in the hash, unknown paths are not routes.
import test from "node:test";
import assert from "node:assert/strict";
import { install } from "./support/browser_stub.mjs";

install();
const { normalise_path, is_route, has_session } = await import("/js/core/router.js");

test("normalise_path", () => {
	assert.equal(normalise_path("/"), "/");
	assert.equal(normalise_path(""), "/");
	assert.equal(normalise_path("/index.html"), "/");
	assert.equal(normalise_path("/auth.html"), "/auth");
	assert.equal(normalise_path("/settings/"), "/settings");
	assert.equal(normalise_path("/verify_email.html"), "/verify_email");
});
test("is_route", () => {
	for (const path of ["/", "/auth", "/register", "/verify_email", "/settings", "/auth.html", "/settings/"]) assert.equal(is_route(path), true, path);
	for (const path of ["/nope", "/api/v2/token", "/settings/extra", "/js/main.js", "/constructor", "/__proto__"]) assert.equal(is_route(path), false, path);
});
test("has_session reads the sign-in marker", () => {
	localStorage.clear();
	assert.equal(has_session(), false);
	localStorage.auth = "7";
	assert.equal(has_session(), true);
	localStorage.auth = "0";
	assert.equal(has_session(), false);
});
