// The local copy: queue, retry, refusals, end of session, drop of an old copy, descriptions made offline. localStorage is a stub in memory and
// the API is scripted (test/support/fake_api.mjs); nothing here touches a network.
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { install } from "./support/browser_stub.mjs";
import { server, install_fake_api, location_calls } from "./support/fake_api.mjs";

install();
install_fake_api();
const { moncycle_store: store } = await import("/js/model/store.js");

const ACCOUNT = { userId: 7, nickname: "T", method: "cervicalMucus", temperatureTracking: false, timelineAscending: true };
const DAY = "2026-03-10";
const events = [];

function answer_for(request) {
	const path = request.url.replace("/api/v2", "");
	if (path === "/server_info") return { status: 200, json: { data: { appVersion: "16dev" } } };
	if (path.startsWith("/day/") && request.method === "POST") return { status: 200, json: { data: { ...request.body, cycleStartDate: DAY, cycleDay: 1, lastWriteDb: "2026-03-10T10:00:00Z" } } };
	return { status: 404, json: { error: { code: "not_found", message: "" } } };
}

beforeEach(() => {
	localStorage.clear();
	location_calls.length = 0;
	server.requests.length = 0;
	server.handler = answer_for;
	events.length = 0;
	store.listeners = {};
	["changed", "sent", "failed", "status"].forEach((name) => store.on(name, (detail) => events.push([name, detail])));
	store.expired = false;
	store.checked_version = true;   // the version stamp is the business of its own tests
	store.compat = null;
	store.blocked = null;
	store.error = null;
	store.retry_count = 0;
	store.wipe_data(false);
	store.account = { ...ACCOUNT, allCyclesFirstDay: [DAY], allObservationPausedDates: [] };
});
afterEach(() => clearTimeout(store.retry_timer));

const body = (extra = {}) => ({ date: DAY, stampColor: "Green", comment: "x", lastWriteClientUtc: "2026-03-10T09:00:00Z", ...extra });
const writes = () => server.requests.filter((request) => request.method !== "GET" && request.url.includes("/day/"));

test("a day is in the copy and the queue at once, then sent and replaced by the server's", async () => {
	store.queue_day(body());
	assert.equal(store.get_day(DAY).stampColor, "Green");
	assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem("data_pending"))), [DAY]);
	await store.flush();
	assert.equal(writes().length, 1);
	assert.equal(store.pending_count(), 0);
	assert.equal(JSON.parse(localStorage.getItem("data_pending")).length ?? Object.keys(JSON.parse(localStorage.getItem("data_pending"))).length, 0);
	assert.equal(store.days[DAY].lastWriteDb, "2026-03-10T10:00:00Z");
	assert.ok(events.some(([name, detail]) => name === "sent" && detail.date === DAY));
});

test("a day that cannot be sent waits, the error says network, and a later flush sends it", async () => {
	let up = false;
	server.handler = (request) => (up ? answer_for(request) : { status: 0 });
	store.queue_day(body());
	await assert.rejects(store.flush());
	assert.equal(store.pending_count(), 1);
	assert.equal(store.error.kind, "network");
	assert.ok(store.retry_timer, "a retry is planned");
	up = true;
	await store.flush();
	assert.equal(store.pending_count(), 0);
	assert.equal(store.error, null);
});

test("a server in trouble is retried, a refusal (4xx) is dropped and the day downloaded again", async () => {
	server.handler = () => ({ status: 500, json: { error: { code: "server_error", message: "boom" } } });
	store.queue_day(body());
	await assert.rejects(store.flush());
	assert.equal(store.pending_count(), 1);
	assert.equal(store.error.kind, "server");

	server.handler = (request) => {
		if (request.method === "POST") return { status: 400, json: { error: { code: "validation_failed", message: "bad", details: { issues: [{ field: "comment", code: "too_long", message: "Too long." }] } } } };
		return { status: 200, json: { data: { ...body({ comment: "server" }), cycleStartDate: DAY, cycleDay: 1 } } };
	};
	await store.flush();
	assert.equal(store.pending_count(), 0);
	const failed = events.find(([name]) => name === "failed")[1];
	assert.equal(failed.date, DAY);
	assert.equal(failed.message, "Too long.");
	assert.equal(store.days[DAY].comment, "server");
});

test("409 stale_write: the late write is dropped and the server's day comes back", async () => {
	server.handler = (request) => {
		if (request.method === "POST") return { status: 409, json: { error: { code: "stale_write", message: "late" } } };
		return { status: 200, json: { data: { ...body({ comment: "newer elsewhere" }), cycleStartDate: DAY, cycleDay: 1 } } };
	};
	store.queue_day(body({ comment: "mine" }));
	await store.flush();
	assert.equal(store.pending_count(), 0);
	assert.equal(store.error.kind, "rejected");
	assert.equal(store.error.code, "stale_write");
	assert.equal(store.days[DAY].comment, "newer elsewhere");
	assert.deepEqual(store.stale, []);
});

test("401 unauthorized ends the session: storage emptied, back to /auth", async () => {
	store.init();
	server.handler = () => ({ status: 401, json: { error: { code: "unauthorized", message: "no" } } });
	localStorage.setItem("auth", "7");
	store.queue_day(body());
	await assert.rejects(store.flush());
	assert.equal(localStorage.length, 0);
	assert.deepEqual(location_calls, ["replace /auth"]);
	assert.equal(store.expired, true);
});

test("a 401 that is a wrong password is not the end of the session", () => {
	assert.equal(store.is_unauthorized({ status: 401, responseJSON: { error: { code: "invalid_credentials" } } }), false);
	assert.equal(store.is_unauthorized({ status: 401, responseJSON: { error: { code: "unauthorized" } } }), true);
	assert.equal(store.is_unauthorized({ status: 401 }), true);
	assert.equal(store.is_unauthorized({ status: 403 }), false);
});

test("a copy of another schema is dropped, with its queue", () => {
	localStorage.setItem("data_version", `${store.schema - 1}/16dev/1.0.0`);
	localStorage.setItem("data_account", JSON.stringify(ACCOUNT));
	localStorage.setItem("data_last_sync", JSON.stringify("2026-03-10T00:00:00Z"));
	localStorage.setItem("data_day_" + DAY, JSON.stringify({ date: DAY, comment: "old" }));
	localStorage.setItem("data_pending", JSON.stringify({ [DAY]: { op: "put", body: body() } }));
	localStorage.setItem("auth", "7");
	store.init();
	assert.deepEqual(store.days, {});
	assert.equal(store.account, null);
	assert.equal(store.pending_count(), 0);
	assert.equal(localStorage.getItem("data_day_" + DAY), null);
	assert.equal(localStorage.getItem("auth"), "7");
});

test("a copy of the same schema is read back, queue included", () => {
	localStorage.setItem("data_version", `${store.schema}/16dev/1.0.0`);
	localStorage.setItem("data_account", JSON.stringify({ ...ACCOUNT, allCyclesFirstDay: [DAY], allObservationPausedDates: [] }));
	localStorage.setItem("data_last_sync", JSON.stringify("2026-03-10T00:00:00Z"));
	localStorage.setItem("data_day_" + DAY, JSON.stringify({ date: DAY, comment: "kept" }));
	localStorage.setItem("data_pending", JSON.stringify({ [DAY]: { op: "put", body: body() } }));
	store.init();
	assert.equal(store.days[DAY].comment, "kept");
	assert.equal(store.pending_count(), 1);
});

test("an update of the API drops the copy, keeps the queue and reloads the page", async () => {
	store.checked_version = false;
	store.webapp_version = { version: "1.0.0" };
	localStorage.setItem("data_version", `${store.schema}/15/1.0.0`);
	localStorage.setItem("data_day_" + DAY, JSON.stringify({ date: DAY, comment: "old" }));
	server.handler = (request) => (request.method === "POST" ? { status: 0 } : answer_for(request));   // the write waits in the queue
	store.queue_day(body());
	await new Promise((resolve) => setTimeout(resolve, 20));
	server.requests.length = 0;
	store.check_version();   // never settles: the page is reloaded
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.deepEqual(location_calls, ["reload"]);
	assert.equal(store.pending_count(), 1);
	assert.equal(localStorage.getItem("data_version"), `${store.schema}/16dev/1.0.0`);
});

test("a description made offline shows at once, is sent, then lives in the server's list", async () => {
	server.handler = (request) => {
		if (request.url.endsWith("/description") && request.method === "POST") return { status: 201, json: { data: { id: 31, name: request.body.name, type: request.body.type } } };
		return answer_for(request);
	};
	store.queue_description("  Fatigue ", "sensation", "2026-03-10T09:00:00Z");
	assert.deepEqual(store.all_descriptions().map((d) => [d.id, d.name, d.type]), [[null, "fatigue", "sensation"]]);
	await store.flush();
	assert.equal(store.pending_descriptions.length, 0);
	assert.deepEqual(store.all_descriptions().map((d) => [d.id, d.name]), [[31, "fatigue"]]);
});

test("a description whose name is taken is not a failure: the server's list is read again", async () => {
	server.handler = (request) => {
		if (request.url.endsWith("/description") && request.method === "POST") return { status: 409, json: { error: { code: "duplicate_name", message: "taken" } } };
		if (request.url.endsWith("/description")) return { status: 200, json: { data: [{ id: 5, name: "fatigue", type: "sensation", useCount: 0 }] } };
		return answer_for(request);
	};
	store.queue_description("fatigue", "sensation");
	await store.flush();
	assert.equal(store.pending_descriptions.length, 0);
	assert.equal(store.error, null);
	assert.deepEqual(store.all_descriptions().map((d) => d.id), [5]);
});

test("an API generation out of the range blocks every write and keeps the queue", async () => {
	server.handler = (request) => (request.url.endsWith("/server_info") ? { status: 200, json: { data: { appVersion: "99" } } } : answer_for(request));
	const incompatible = [];
	store.on("incompatible", (detail) => incompatible.push(detail));
	store.queue_day(body());
	await store.flush();
	assert.equal(writes().length, 0);
	assert.equal(store.pending_count(), 1);
	assert.equal(incompatible.length, 1);
});
