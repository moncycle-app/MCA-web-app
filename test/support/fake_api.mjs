// A scripted API for the store: fetch() answers from a handler the test sets ({status, json?, headers?}; status 0 is "no answer"), the way
// the real one does. Also config.json and version.json, and window.location spies.
import { readFileSync } from "node:fs";

export const server = {
	requests: [],
	// (request: {method, url, body}) => {status, json?, headers?}; status 0 is "no answer"
	handler: () => ({ status: 200, json: { data: {} } }),
};

function fake_fetch(url, options = {}) {
	const request = { method: options.method || "GET", url: String(url), body: options.body === undefined ? undefined : JSON.parse(options.body), headers: options.headers || {} };
	server.requests.push(request);
	return new Promise((resolve, reject) => queueMicrotask(() => {
		const answer = server.handler(request);
		if (answer.status === 0) return reject(new TypeError("network"));
		resolve({
			ok: answer.status >= 200 && answer.status < 300,
			status: answer.status,
			statusText: "",
			headers: { get: (name) => (answer.headers || {})[name] ?? null },
			json: async () => { if (answer.json === undefined) throw new Error("no body"); return answer.json; },
		});
	}));
}

export const location_calls = [];

export function install_fake_api() {
	Object.assign(globalThis.window.location, { pathname: "/", search: "" });
	globalThis.window.history = { replaceState: (state, title, url) => location_calls.push("replace " + url) };
	globalThis.window.location.reload = () => location_calls.push("reload");
	globalThis.window.addEventListener = () => { };
	globalThis.document = { addEventListener() { }, hidden: false, querySelectorAll: () => [] };
	globalThis.fetch = async (url, options) => {
		const path = String(url);
		if (path.startsWith("i18n/")) return { ok: true, json: async () => JSON.parse(readFileSync(new URL("../../src/" + path, import.meta.url), "utf8")) };
		if (path.includes("config.json")) return { ok: true, json: async () => ({ apiUrl: "/api/v3" }) };
		if (path.includes("version.json")) return { ok: true, json: async () => ({ version: "1.0.0", api: { min: 16, max: 16 } }) };
		return fake_fetch(url, options);
	};
}
