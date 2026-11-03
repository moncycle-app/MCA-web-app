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

/* A sign-in on a device that is not the user's own ("public device").
**
**  - `device.keep` holds what makes a session (the `auth` marker, the token of a remote API): localStorage, or sessionStorage on a public
**    device, so that closing the tab ends it;
**  - `device.storage` holds the local copy (store.js) and the view choices: localStorage, or on a public device a store in memory, so that nothing
**    of the account is written in the browser, the copy is downloaded again at every load and there is no offline use;
**  - the session lasts `limit_ms` (the API cannot make a token shorter than a day, see `expiresInDays`): `watch()` ends it at the deadline.
*/
const FLAG = "public_device_until";

// Storage in memory, with the part of the Storage interface the app uses
class MemoryStorage {
	#items = new Map();
	get length() { return this.#items.size; }
	key(index) { return index < this.#items.size ? [...this.#items.keys()][index] : null; }
	getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
	setItem(key, value) { this.#items.set(String(key), String(value)); }
	removeItem(key) { this.#items.delete(key); }
	clear() { this.#items.clear(); }
}

const memory = new MemoryStorage();
const read_flag = () => { try { return parseInt(sessionStorage.getItem(FLAG)) || 0; } catch (e) { return 0; } };

export const device = {
	limit_ms : 2 * 3600 * 1000,
	// the least the API allows (POST /token, expiresInDays: 1 to 365)
	token_days : 1,

	is_public : function () { return read_flag() > 0; },
	// when the session of a public device ends (ms since the epoch), else 0
	deadline : function () { return read_flag(); },
	get keep() { return device.is_public() ? sessionStorage : localStorage; },
	get storage() { return device.is_public() ? memory : localStorage; },

	storage_keys : function () {
		const store = device.storage, found = [];
		for (let i = 0; i < store.length; i++) found.push(store.key(i));
		return found;
	},
	// called after a sign-in made with "not my device", before anything is kept
	begin_public : function () {
		memory.clear();
		sessionStorage.setItem(FLAG, String(Date.now() + device.limit_ms));
	},
	// every trace of the session, wherever it is kept
	clear : function () {
		try { localStorage.clear(); } catch (e) { }
		try { sessionStorage.clear(); } catch (e) { }
		memory.clear();
	},
	expired : function () {
		return device.is_public() && Date.now() >= device.deadline();
	},
	// `on_end` runs once, when the deadline passes (a timer, and again when the tab comes back, a sleeping machine stops timers)
	watch : function (on_end) {
		if (!device.is_public()) return;
		let done = false;
		const check = () => { if (!done && device.expired()) { done = true; on_end(); } };
		setTimeout(check, Math.max(0, device.deadline() - Date.now()) + 50);
		document.addEventListener("visibilitychange", check);
		window.addEventListener("focus", check);
		check();
	},
};
