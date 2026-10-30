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

/* The start of the app: the address of the API (config.json), the catalog, the local copy when someone is signed in, then the router. */
import { moncycle_config } from "/js/core/config.js";
import { ready as i18n_ready, resolve_language, set_language, requested_language, apply } from "/js/core/i18n.js";
import { set_session_end_handler } from "/js/core/api.js";
import { moncycle_store } from "/js/model/store.js";
import { start, has_session } from "/js/core/router.js";

await Promise.all([moncycle_config.ready, i18n_ready]);
set_session_end_handler(() => moncycle_store.expire_session());
// the local copy is made once and lives across the screens; the first sync is at the start, and only for a session
if (has_session()) {
	moncycle_store.init();
	moncycle_store.sync().catch(() => { });
}

// The language of the interface: the account's once there is one (the local copy has it from the last visit, a sync can change it), else the
// browser's, else EN. French is the only catalog for now, so any other language falls back to it; the code path is the one a second catalog
// will use. The screen on view is filled again when the language changes after it was drawn.
async function follow_language() {
	const wanted = resolve_language({account: (moncycle_store.account || {}).language, navigator_languages: navigator.languages}).toLowerCase();
	if (wanted === requested_language()) return;
	await set_language(wanted);
	apply(document.getElementById("app"));
}
await follow_language();
moncycle_store.on("changed", (change) => { if (change.account) follow_language(); });
await start();
