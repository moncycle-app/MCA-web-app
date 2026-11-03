// A public device: the copy is kept in memory, the session in sessionStorage, and it ends two hours after the sign-in.
import test from "node:test";
import assert from "node:assert/strict";
import { install } from "./support/browser_stub.mjs";

install();
const { device } = await import("/js/core/device.js");

test("an ordinary device keeps everything in localStorage", () => {
	assert.equal(device.is_public(), false);
	assert.equal(device.storage, localStorage);
	assert.equal(device.keep, localStorage);
});
test("a public device keeps the copy in memory and the session in sessionStorage", () => {
	device.begin_public();
	assert.equal(device.is_public(), true);
	assert.notEqual(device.storage, localStorage);
	assert.equal(device.keep, sessionStorage);
	device.storage.setItem("data_account", "{}");
	device.keep.setItem("auth", "7");
	assert.equal(localStorage.length, 0);
	assert.deepEqual(device.storage_keys(), ["data_account"]);
	const left = device.deadline() - Date.now();
	assert.ok(left > device.limit_ms - 5000 && left <= device.limit_ms);
	assert.equal(device.expired(), false);
});
test("clear forgets every trace", () => {
	device.clear();
	assert.equal(device.is_public(), false);
	assert.equal(device.storage_keys().length, 0);
	assert.equal(sessionStorage.length, 0);
});
