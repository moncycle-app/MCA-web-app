/* moncycle.app
**
** Copyright (C) 2021-2026 Tech 4 Fertility, aka. T4F (https://tech4fertility.org)
** SPDX-License-Identifier: AGPL-3.0-or-later
**
** This program is free software: you can redistribute it and/or modify it under
** the terms of the GNU Affero General Public License as published by the Free
** Software Foundation, either version 3 of the License, or (at your option) any
** later version. It is distributed WITHOUT ANY WARRANTY; see the licence for details.
**
** https://www.moncycle.app
** https://github.com/moncycle-app/backend-api-web-app
*/

/* The one request function of the plain screens: JSON in, JSON out, the cookie or the token as config.js says, and a failure in the shape the
** store's helpers read (error_pick, error_text, error_code): {status, responseJSON, statusText}. A 401 `unauthorized` ends the session (the
** handler is set by main.js); any other 401 is an answer of an endpoint (a wrong password), the session goes on.
*/
import { moncycle_config } from "./config.js";

let on_session_end = () => { };
export function set_session_end_handler(fn) { on_session_end = fn; }

// send("GET", url, {body, headers, timeout, signal}) -> {status, json, headers}; 304 gives json undefined. A failure is rejected as
// {status, statusText, responseJSON} (status 0: no answer, or the timeout). `url` is a whole address built with config.api_url(path).
export async function send(method, url, options = {}) {
	const request = {method: method, headers: Object.assign({}, options.headers)};
	if (options.body !== undefined) {
		request.headers["Content-Type"] = "application/json";
		request.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
	}
	const timer = options.timeout ? new AbortController() : null;
	const timeout = timer ? setTimeout(() => timer.abort(), options.timeout) : null;
	request.signal = options.signal && timer ? AbortSignal.any([options.signal, timer.signal]) : (options.signal || (timer && timer.signal) || undefined);
	let response, json;
	try {
		response = await moncycle_config.fetch(url, request);
		try { json = response.status === 304 ? undefined : await response.json(); } catch (e) { json = undefined; }
	} catch (e) { throw {status: 0, statusText: "error", responseJSON: undefined}; }
	finally { clearTimeout(timeout); }
	if (response.ok || response.status === 304) return {status: response.status, json: json, headers: response.headers};
	throw {status: response.status, statusText: response.statusText, responseJSON: json};
}

// api("POST", "/token", {email, password}) -> the parsed answer, or a rejection {status, responseJSON, statusText}. `path` is a path of the contract.
export async function api(method, path, body, options = {}) {
	try {
		return (await send(method, moncycle_config.api_url(path), {body: body, signal: options.signal})).json;
	} catch (failure) {
		if (failure.status === 401 && (((failure.responseJSON || {}).error || {}).code === undefined || failure.responseJSON.error.code === "unauthorized")) on_session_end(failure);
		throw failure;
	}
}
