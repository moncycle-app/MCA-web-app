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

/* The footer of the screens of someone not signed in: its link to the terms of service is the server's (TERMS_OF_SERVICE_URL, told by server_info);
** none told, no link. */
import { api } from "./api.js";

export function attach_terms_link(root, signal) {
	api("GET", "/server_info", undefined, {signal}).then((ret) => {
		const url = ((ret || {}).data || {}).termsOfServiceUrl;
		const link = root.querySelector("#a_footer_terms");
		if (link && /^https:\/\//i.test(url || "")) {
			link.setAttribute("href", url);
			link.hidden = false;
		}
	}, () => { });
}
