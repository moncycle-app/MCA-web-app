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

import { moncycle_config } from "../../../js/core/config.js";
import { moncycle_store } from "../../../js/model/store.js";
import { t, t_map } from "../../../js/core/i18n.js";
import { by_id, el } from "../../../js/core/dom.js";
import { settings_api, settings_error, settings_is_checked, settings_local_date, settings_read, settings_say, settings_sync_later, settings_today } from "../common.js";
import { settings_text } from "../text.js";

/* ===========================================================================
** 5d. MES DONNÉES: export a period, import a file, the raw export
** ======================================================================== */

export function settings_fill_data(account) {
	const today = settings_today();
	const form = by_id("f_export_complexe");
	const range = [form.elements["from"], form.elements["to"]];
	range.forEach(function (input) { input.setAttribute("max", today); });
	// nothing to export before the first day; with no day at all, nothing to export
	if (account.oldestDay) {
		range.forEach(function (input) { input.setAttribute("min", account.oldestDay); });
		by_id("export_oldest_day").textContent = settings_local_date(account.oldestDay);
		by_id("export_oldest").hidden = false;
		// the whole history is what most exports want: ready to go
		form.elements["from"].value = account.oldestDay;
		form.elements["to"].value = today;
	}
}

export function settings_setup_export() {
	const form = by_id("f_export_complexe");
	const error_line = by_id("export_err");

	by_id("but_export_all").addEventListener("click", function () {
		form.elements["from"].value = form.elements["from"].getAttribute("min") ?? "";
		form.elements["to"].value = settings_today();
	});

	// On the API's own site the browser saves the file with its cookie; another origin has no cookie, so the file is fetched with the token.
	by_id("a_raw_export").addEventListener("click", function (event) {
		if (!moncycle_config.remote) return;
		event.preventDefault();
		settings_say(error_line, "", "");
		moncycle_store.download(event.currentTarget.getAttribute("href")).catch(function (failure) {
			settings_say(error_line, "error", t_map("settings.common_errors")[failure.code] || (failure.status === 0 ? t("settings.error_network") : failure.message) || t("settings.export_failed_default"));
		});
	});

	form.addEventListener("submit", function (event) {
		event.preventDefault();
		const from = settings_read(form, "from");
		const to = settings_read(form, "to");
		const format = settings_read(form, "format");
		const show_error = function (reason) { settings_say(error_line, "error", reason); };
		settings_say(error_line, "", "");
		if (from == "" || to == "") return show_error(t_map("settings.export_errors").missing_field);
		if (new Date(from) > new Date(to)) return show_error(t_map("settings.export_errors").invalid_range);
		moncycle_store.download(`${form.getAttribute("action")}/${encodeURIComponent(format)}?from=${from}&to=${to}`).catch(function (failure) {
			const own = t_map("settings.export_errors")[failure.issues.length ? failure.issues[0].code : failure.code];
			const common = t_map("settings.common_errors")[failure.code];
			show_error(own || common || (failure.status === 0 ? t("settings.error_network") : failure.message) || t("settings.export_failed_default"));
		});
	});
}

/* --- the NFP import --------------------------------------------------------------
** One form, two buttons. "Vérifier le fichier" asks api/v2/import for a dry run: it runs every check, reads the account to see which of
** the file's days are already there, and reports what the write would do -- without writing. "Importer" does it for real. Both answer the
** same report, and on a dry run a refused file answers an error whose details carry the same lists, so one renderer draws all three
** outcomes. The report is built with elements and text: what it quotes from the file is never read as HTML.
*/

let settings_import_running = false;

// A foldable list, because these can run to thousands of dates. The limit keeps the page from drawing them all; the count in the heading
// is always the true one. Returns a list of nodes (none for an empty list).
export function settings_import_list(heading, items, limit) {
	items = items || [];
	if (items.length == 0) return [];
	const shown = items.slice(0, limit);
	const list = el("ul", {}, ...shown.map(function (item) { return el("li", {text: item}); }));
	if (items.length > shown.length) list.append(el("li", {class: "label_info", text: settings_text.import_list_more(items.length - shown.length)}));
	return [el("details", {class: "import_list"}, el("summary", {text: heading}), list)];
}

export function settings_import_line(text, css) {
	return el("p", {class: "import_line " + (css || ""), text: text});
}

// warnings / mappedFields / ignoredFields: what the file carries that is not simply stored as it was. The API fills them on an accepted
// file and, on a dry run, on a refused one too.
export function settings_import_notes(source) {
	return [
		...settings_import_list(settings_text.import_warnings((source.warnings || []).length), source.warnings, 50),
		...settings_import_list(settings_text.import_mapped((source.mappedFields || []).length), source.mappedFields, 50),
		...settings_import_list(settings_text.import_ignored((source.ignoredFields || []).length), source.ignoredFields, 50),
	];
}

// An accepted file, dry run or real: the same report either way, with the verbs put in the future tense on a dry run.
export function settings_import_report(report) {
	const dry = !!report.dryRun;
	const nodes = [settings_import_line(dry ? t("settings.import_head_check") : t("settings.import_head_done"), dry ? "import_head" : "import_head vert")];
	nodes.push(settings_import_line(settings_text.import_source(report.schemaVersion, report.sourceApp), "label_info"));
	nodes.push(settings_import_line(settings_text.import_read(report.cyclesRead, report.daysRead), "label_info"));
	if (report.daysToWrite == 0) nodes.push(settings_import_line(t("settings.import_nothing_to_write")));

	// the three per-day outcomes, each a date list
	nodes.push(...settings_import_list(settings_text.import_days_created((report.daysCreated || []).length, dry), report.daysCreated, 40));
	nodes.push(...settings_import_list(settings_text.import_days_overwritten((report.daysOverwritten || []).length, dry), report.daysOverwritten, 40));
	nodes.push(...settings_import_list(settings_text.import_days_skipped((report.daysSkipped || []).length, dry), report.daysSkipped, 40));
	if (report.descriptionsCreated > 0) nodes.push(settings_import_line(settings_text.import_descriptions(report.descriptionsCreated, dry), "label_info"));

	nodes.push(...settings_import_notes(report));
	if (!dry && report.daysWritten > 0) nodes.push(el("p", {class: "import_line"}, el("a", {href: "/", text: t("settings.import_back_to_timeline")})));
	return nodes;
}

export function settings_import_refusal(failure) {
	const error = (failure.responseJSON || {}).error || {};
	const details = error.details || {};
	const nodes = [settings_import_line(t("settings.import_head_refused"), "import_head rouge")];
	// the API's own wording for the refusal, shown as it comes
	nodes.push(settings_import_line(error.message || settings_error(failure), "label_info"));

	// Dates the file itself carries twice. They are among the issues below as well, but a list of its own is what makes the file fixable.
	const duplicated = details.duplicatedDaysInFile || [];
	if (duplicated.length > 0) {
		nodes.push(settings_import_line(settings_text.import_duplicates(duplicated.length), "rouge"));
		nodes.push(...settings_import_list(settings_text.import_duplicates_list(duplicated.length), duplicated, 40));
	}
	const issues = details.issues || [];
	if (issues.length > 0) nodes.push(...settings_import_list(settings_text.import_issues(issues.length, details.issueCount || issues.length), issues, 50));

	return [...nodes, ...settings_import_notes(details)];
}

export function settings_import_run(dry_run) {
	if (settings_import_running) return;
	const form = by_id("f_import");
	const file = form.elements["file"].files[0];
	const line = form.querySelector(".form_msg");
	const report = by_id("import_report");
	if (!file) return settings_say(line, "error", t("settings.import_pick_file"));
	const override = settings_is_checked(form, "override");
	if (!dry_run && override && !confirm(settings_text.import_confirm_override(file.name))) return;

	settings_import_running = true;
	report.replaceChildren();
	settings_say(line, "busy", dry_run ? t("settings.import_checking") : t("settings.import_writing"));
	const check = by_id("i_import_check");
	const submit = by_id("i_import_submit");
	check.disabled = true;
	check.textContent = dry_run ? t("settings.import_but_check_busy") : t("settings.import_but_check");
	submit.disabled = true;
	submit.textContent = dry_run ? t("settings.import_but_submit") : t("settings.import_but_submit_busy");
	const finish = function () {
		settings_import_running = false;
		settings_say(line, "", "");
		check.disabled = false;
		check.textContent = t("settings.import_but_check");
		submit.disabled = false;
		submit.textContent = t("settings.import_but_submit");
	};

	// api/v2/import reads the file as the request body, so it goes up as it is -- no multipart form
	file.text().then(function (body) {
		const query = new URLSearchParams({dryRun: dry_run, override: override, lastWriteClientUtc: (new Date()).toISOString()});
		settings_api("POST", moncycle_config.api_url(`/import?${query}`), body).then(function (ret) {
			finish();
			report.replaceChildren(...settings_import_report(ret.data || {}));
			// A real import adds days and cycles: the local copy gets them with a sync.
			if (!dry_run) settings_sync_later();
		}, function (failure) {
			finish();
			console.error(failure);
			report.replaceChildren(...settings_import_refusal(failure));
		});
	}, function (err) {
		finish();
		console.error(err);
		settings_say(line, "error", t("settings.import_unreadable"));
	});
}

export function settings_setup_import() {
	by_id("i_import_check").addEventListener("click", function () { settings_import_run(true); });
	by_id("f_import").addEventListener("submit", function (event) {
		event.preventDefault();
		settings_import_run(false);
	});
	// another file: the report of the previous one is no longer about it
	by_id("i_import_file").addEventListener("change", function () { by_id("import_report").replaceChildren(); });
}
