// A jQuery stand-in for the store: $.ajax answers from a handler the test sets, with the shape of jQuery's promise (done/fail) and of
// its jqXHR, and $(document).ajaxError() is called on a failure as jQuery does. Also fetch() for version.json, and window.location spies.
export const server = {
	requests: [],
	// (request: {method, url, body}) => {status, json?, headers?}; status 0 is "no answer"
	handler: () => ({ status: 200, json: { data: {} } }),
	ajax_error: null,
};

function jqxhr(answer) {
	return {
		status: answer.status,
		statusText: answer.status === 0 ? "error" : "",
		responseJSON: answer.json,
		getResponseHeader: (name) => (answer.headers || {})[name] ?? null,
	};
}

function ajax(options) {
	const request = { method: options.type || "GET", url: options.url, body: options.data === undefined ? undefined : JSON.parse(options.data), headers: options.headers || {} };
	server.requests.push(request);
	const done = [];
	const fail = [];
	const promise = { done(fn) { done.push(fn); return promise; }, fail(fn) { fail.push(fn); return promise; } };
	queueMicrotask(() => {
		const answer = server.handler(request);
		const xhr = jqxhr(answer);
		if (answer.status >= 200 && answer.status < 300) done.forEach((fn) => fn(answer.json, "success", xhr));
		else if (answer.status === 304) done.forEach((fn) => fn(undefined, "notmodified", xhr));
		else {
			fail.forEach((fn) => fn(xhr));
			if (server.ajax_error) server.ajax_error({}, xhr);
		}
	});
	return promise;
}

export const location_calls = [];

export function install_fake_api() {
	const dollar = () => ({ ajaxError: (fn) => { server.ajax_error = fn; } });
	dollar.ajax = ajax;
	dollar.holdReady = () => { };
	dollar.ajaxPrefilter = () => { };
	globalThis.$ = dollar;
	globalThis.window.location.replace = (url) => location_calls.push("replace " + url);
	globalThis.window.location.reload = () => location_calls.push("reload");
	globalThis.window.addEventListener = () => { };
	globalThis.document = { addEventListener() { }, hidden: false, querySelectorAll: () => [] };
	globalThis.fetch = async (url) => ({ ok: true, json: async () => (String(url).includes("config.json") ? { apiUrl: "/api/v2" } : { version: "1.0.0", api: { min: 16, max: 16 } }) });
}
