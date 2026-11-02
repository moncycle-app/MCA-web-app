import test from "node:test";
import assert from "node:assert/strict";
import { install } from "./support/browser_stub.mjs";
install();
const { moncycle_config: config } = await import("/js/core/config.js");

test("parse_api_url", () => {
	assert.equal(config.parse_api_url("/api/v3"), "/api/v3");
	assert.equal(config.parse_api_url("api/v3"), "api/v3");
	assert.equal(config.parse_api_url("https://tableau.moncycle.app/api/v3/"), "https://tableau.moncycle.app/api/v3");
	assert.equal(config.parse_api_url("https://tableau.moncycle.app"), null);
	assert.equal(config.parse_api_url("ftp://x/api/v3"), null);
	assert.equal(config.parse_api_url(5), null);
});
test("api_url and remote", () => {
	config.set_api_url("/api/v3");
	assert.equal(config.api_url("/day/2026-03-10"), "/api/v3/day/2026-03-10");
	assert.equal(config.remote, false);
	config.set_api_url("https://api.example/api/v3");
	assert.equal(config.api_url("/token"), "https://api.example/api/v3/token");
	assert.equal(config.remote, true);
	assert.equal(config.is_api_call("https://api.example/api/v3/token"), true);
	assert.equal(config.is_api_call("https://other.example/api/v3/token"), false);
});
