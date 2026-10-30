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
import { t } from "/js/core/i18n.js";
import { by_id } from "/js/core/dom.js";
import { settings_confirmed_change, settings_form_say, settings_read, settings_sync_later } from "/screens/settings/common.js";

/* ===========================================================================
** 5c. CYCLES PAR E-MAIL: the automatic mail of each cycle, and who gets it
** ======================================================================== */

export function settings_fill_notifications(account) {
	by_id("i_auto_mail_export").checked = !!account.autoMailExport;
	by_id("i_notification_emails").value = account.notificationEmails ?? "";
}

// The cycles are the owner's, so the password confirms a change of who receives them.
export function settings_setup_notifications() {
	const form = by_id("form_notification_emails");
	settings_confirmed_change(form, function () {
		return {notificationEmails: settings_read(form, "notification_emails"), password: settings_read(form, "password")};
	}, function () {
		form.elements["password"].value = "";
		settings_form_say(form, "ok", t("settings.notification_emails_saved"));
		settings_sync_later();
	});
}
