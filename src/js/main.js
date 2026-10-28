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
import { ready as i18n_ready } from "/js/core/i18n.js";
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
await start();
