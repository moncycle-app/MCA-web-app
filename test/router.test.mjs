// The routes live in the hash: a route is parsed from it, the old path addresses are not routes, and there is no server setting to make.
import test from "node:test";
import assert from "node:assert/strict";
import { install } from "./support/browser_stub.mjs";

install();
const { parse_route, is_route, has_session } = await import("/js/core/router.js");

test("parse_route", () => {
	for (const hash of ["", "#", "#/", "#/?x=1"]) assert.equal(parse_route(hash).path, "/", hash);
	assert.deepEqual({ ...parse_route("#/auth"), query: "" + parse_route("#/auth").query }, { path: "/auth", sub: "", query: "" });
	const panel = parse_route("#/settings/notifications");
	assert.equal(panel.path, "/settings");
	assert.equal(panel.sub, "notifications");
	const mail = parse_route("#/verify_email?purpose=resetPassword&t=ab%2Bc");
	assert.equal(mail.path, "/verify_email");
	assert.equal(mail.query.get("purpose"), "resetPassword");
	assert.equal(mail.query.get("t"), "ab+c");
	assert.equal(parse_route("#/auth?login_email=a%2Bb@c.d").query.get("login_email"), "a+b@c.d");
});
test("is_route", () => {
	for (const path of ["/", "/auth", "/register", "/recover", "/verify_email", "/settings", "/settings/"]) assert.equal(is_route(path), true, path);
	for (const path of ["/nope", "/api/v3/token", "/settings/extra", "/js/main.js", "/constructor", "/__proto__"]) assert.equal(is_route(path), false, path);
});
test("has_session reads the sign-in marker", () => {
	localStorage.clear();
	assert.equal(has_session(), false);
	localStorage.auth = "7";
	assert.equal(has_session(), true);
	localStorage.auth = "0";
	assert.equal(has_session(), false);
});
