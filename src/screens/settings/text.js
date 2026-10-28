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
import { settings_local_date } from "/screens/settings/common.js";

/* ===========================================================================
** 1. THE TEXT THE USER READS
** ======================================================================== */

/* The texts are in the catalog (src/i18n/fr.json, keys settings.*); what is here only chooses and assembles them: plurals, the parts of a sentence. */
export const settings_text = {
	desc_confirm_delete_many : function (name, count) { return t("settings.desc_confirm_delete_many", {name: name, count: count}); },
	desc_confirm_delete_one : function (name) { return t("settings.desc_confirm_delete_one", {name: name}); },
	desc_merge_confirm : function (name, target, count) {
		const body = count ? t("settings.desc_merge_confirm_days", {name: name, target: target, count: count}) : t("settings.desc_merge_confirm_none", {name: name});
		return t("settings.desc_merge_confirm", {name: name, target: target, body: body});
	},
	desc_merge_done : function (name, target, count) { return t("settings.desc_merge_done", {name: name, target: target, days: t("settings.n_days", {count: count})}); },
	desc_comment_nothing : function (name) { return t("settings.desc_comment_nothing", {name: name}); },
	// refused before anything is written: the description would be deleted, and these days would lose it
	desc_comment_too_long : function (name, dates, max) {
		let n = dates.length;
		let shown = dates.slice(0, 5).map(settings_local_date).join(", ") + (n > 5 ? t("settings.desc_comment_too_long_more") : "");
		return t("settings.desc_comment_too_long", {name: name, max: max, shown: shown, who: t("settings.desc_comment_too_long_who", {count: n}), which: t("settings.desc_comment_too_long_which", {count: n})});
	},
	// asked before the move: it cannot be taken back
	desc_comment_confirm : function (name, plan) {
		let n = plan.change.length;
		let kept = plan.kept.length;
		if (n == 0) return t("settings.desc_comment_confirm_only", {name: name, days: t("settings.n_days", {count: kept})});
		let text = t("settings.desc_comment_confirm_move", {name: name, days: t("settings.n_days", {count: n}), each: t("settings.desc_comment_confirm_each", {count: n})});
		if (kept > 0) text += "\n\n" + t("settings.desc_comment_confirm_kept", {name: name, count: kept});
		return text;
	},
	desc_comment_progress : function (done, total) { return t("settings.desc_comment_progress", {done: done, total: total}); },
	// what the row says once the description is gone
	desc_comment_moved : function (name, plan) {
		if (plan.change.length == 0) return t("settings.desc_comment_moved_already", {name: name, days: t("settings.n_days", {count: plan.kept.length})});
		return t("settings.desc_comment_moved", {name: name, days: t("settings.n_days", {count: plan.change.length})});
	},
	desc_comment_refused : function (done, refused) {
		return t("settings.desc_comment_refused", {modified: t("settings.n_days_modified", {count: done}), refused: t("settings.n_refused", {count: refused}), those: t("settings.desc_comment_refused_those", {count: refused})});
	},
	// asked before a real import that is allowed to replace what is already there, since that is the only thing this form can destroy
	import_confirm_override : function (filename) { return t("settings.import_confirm_override", {filename: filename}); },
	import_source : function (version, app) { return app ? t("settings.import_source_app", {version: version, app: app}) : t("settings.import_source", {version: version}); },
	import_read : function (cycles, days) { return t("settings.import_read", {cycles: t("settings.n_cycles_read", {count: cycles}), days: t("settings.n_days_read", {count: days})}); },
	// the per-day outcomes. Each heading is the summary line of a foldable list of dates; `dry` is the simulation (what would be done).
	import_days_created : function (n, dry) { return t(dry ? "settings.import_days_created_dry" : "settings.import_days_created", {count: n}); },
	import_days_overwritten : function (n, dry) { return t(dry ? "settings.import_days_overwritten_dry" : "settings.import_days_overwritten", {count: n}); },
	import_days_skipped : function (n, dry) { return t(dry ? "settings.import_days_skipped_dry" : "settings.import_days_skipped", {count: n}); },
	import_descriptions : function (n, dry) { return t(dry ? "settings.import_descriptions_dry" : "settings.import_descriptions", {count: n}); },
	// the three "nothing is dropped silently" lists the API answers with
	import_warnings : function (n) { return t("settings.import_warnings", {count: n}); },
	import_mapped : function (n) { return t("settings.import_mapped", {count: n}); },
	import_ignored : function (n) { return t("settings.import_ignored", {count: n}); },
	// a refused file
	import_issues : function (shown, total) { return shown < total ? t("settings.import_issues_first", {shown: shown, total: total}) : t("settings.import_issues", {count: total}); },
	import_duplicates : function (n) { return t("settings.import_duplicates", {count: n}); },
	import_duplicates_list : function (n) { return t("settings.import_duplicates_list", {count: n}); },
	import_list_more : function (n) { return t("settings.import_list_more", {more: t("settings.import_list_more_n", {count: n})}); },
	error_server : function (status) { return t("settings.error_server", {status: status}); },
	tokens_revoked : function (n) { return t("settings.tokens_revoked", {count: n}); },
	delete_confirm : function (nickname) { return t("settings.delete_confirm", {nickname: nickname}); },
	delete_done : function (nickname) { return t("settings.delete_done", {nickname: nickname}); },
	delete_failed : function (nickname, reason) { return t("settings.delete_failed", {nickname: nickname, reason: reason}); },
};
