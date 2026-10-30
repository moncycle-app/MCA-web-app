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
import { restart } from "../../../js/core/router.js";
import { moncycle_store } from "../../../js/model/store.js";
import { by_id } from "../../../js/core/dom.js";
import { settings_api, settings_error, settings_read, settings_state } from "../common.js";
import { settings_text } from "../text.js";

/* ===========================================================================
** 5h. SUPPRIMER MON COMPTE
** ======================================================================== */

export function settings_setup_deletion() {
	const form = by_id("f_suppr_user_account");
	form.addEventListener("submit", function (event) {
		event.preventDefault();
		const nickname = settings_state.account.nickname;
		if (!confirm(settings_text.delete_confirm(nickname))) return;
		const payload = {password: settings_read(form, "pw_before_deletion")};
		const code = settings_read(form, "code");
		if (code) payload.code = code;
		settings_api("POST", form.getAttribute("action"), payload).then(function () {
			moncycle_store.clear_storage();
			alert(settings_text.delete_done(nickname));
			restart("/auth");
		}, function (failure) {
			alert(settings_text.delete_failed(nickname, settings_error(failure)));
		});
	});
}
