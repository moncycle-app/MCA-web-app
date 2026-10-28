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
import { moncycle_config } from "/js/core/config.js";

let on_session_end = () => { };
export function set_session_end_handler(fn) { on_session_end = fn; }

// api("POST", "/token", {email, password}) -> the parsed answer, or a rejection {status, responseJSON, statusText}. `path` is a path of the contract.
export async function api(method, path, body, options = {}) {
	const request = {method: method, headers: {}};
	if (body !== undefined) {
		request.headers["Content-Type"] = "application/json";
		request.body = JSON.stringify(body);
	}
	if (options.signal) request.signal = options.signal;
	let response;
	try { response = await moncycle_config.fetch(moncycle_config.api_url(path), request); }
	catch (e) { throw {status: 0, statusText: "error", responseJSON: undefined}; }
	let json;
	try { json = await response.json(); } catch (e) { json = undefined; }
	if (response.ok) return json;
	const failure = {status: response.status, statusText: response.statusText, responseJSON: json};
	if (response.status === 401 && (((json || {}).error || {}).code === undefined || json.error.code === "unauthorized")) on_session_end(failure);
	throw failure;
}
