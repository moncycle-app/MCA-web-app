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

import { moncycle_config } from "/js/core/config.js";
import { moncycle_store } from "/js/model/store.js";
import { t, t_map } from "/js/core/i18n.js";
import { settings_error, settings_escape_html, settings_is_checked, settings_leave_if_signed_out, settings_local_date, settings_read, settings_say, settings_sync_later, settings_today } from "/screens/settings/common.js";
import { settings_text } from "/screens/settings/text.js";

const $ = globalThis.$;

/* ===========================================================================
** 5d. MES DONNÉES: export a period, import a file, the raw export
** ======================================================================== */

export function settings_fill_data(account) {
	const today = settings_today();
	const form = $("#f_export_complexe");
	form.find("[name=from], [name=to]").attr("max", today);
	// nothing to export before the first day; with no day at all, nothing to export
	if (account.oldestDay) {
		form.find("[name=from], [name=to]").attr("min", account.oldestDay);
		$("#export_oldest_day").text(settings_local_date(account.oldestDay));
		$("#export_oldest").prop("hidden", false);
		// the whole history is what most exports want: ready to go
		form.find("[name=from]").val(account.oldestDay);
		form.find("[name=to]").val(today);
	}
}

export function settings_setup_export() {
	const form = $("#f_export_complexe");
	const error_line = $("#export_err");

	$("#but_export_all").on("click", function () {
		form.find("[name=from]").val(form.find("[name=from]").attr("min"));
		form.find("[name=to]").val(settings_today());
	});

	// On the API's own site the browser saves the file with its cookie; another origin has no cookie, so the file is fetched with the token.
	$("#a_raw_export").on("click", function (event) {
		if (!moncycle_config.remote) return;
		event.preventDefault();
		settings_say(error_line, "", "");
		moncycle_store.download($(this).attr("href")).catch(function (failure) {
			settings_say(error_line, "error", t_map("settings.common_errors")[failure.code] || (failure.status === 0 ? t("settings.error_network") : failure.message) || t("settings.export_failed_default"));
		});
	});

	form.on("submit", function (event) {
		event.preventDefault();
		const from = settings_read(form, "from");
		const to = settings_read(form, "to");
		const format = settings_read(form, "format");
		const show_error = function (reason) { settings_say(error_line, "error", reason); };
		settings_say(error_line, "", "");
		if (from == "" || to == "") return show_error(t_map("settings.export_errors").missing_field);
		if (new Date(from) > new Date(to)) return show_error(t_map("settings.export_errors").invalid_range);
		moncycle_store.download(`${form.attr("action")}/${encodeURIComponent(format)}?from=${from}&to=${to}`).catch(function (failure) {
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
** outcomes.
*/

let settings_import_running = false;

// A foldable list, because these can run to thousands of dates. The limit keeps the page from drawing them all; the count in the heading
// is always the true one.
export function settings_import_list(heading, items, limit) {
	items = items || [];
	if (items.length == 0) return "";
	const shown = items.slice(0, limit);
	let lines = shown.map(function (item) { return `<li>${settings_escape_html(item)}</li>`; }).join("");
	if (items.length > shown.length) lines += `<li class="label_info">${settings_text.import_list_more(items.length - shown.length)}</li>`;
	return `<details class="import_list"><summary>${heading}</summary><ul>${lines}</ul></details>`;
}

export function settings_import_line(text, css) {
	return `<p class="import_line ${css || ""}">${text}</p>`;
}

// warnings / mappedFields / ignoredFields: what the file carries that is not simply stored as it was. The API fills them on an accepted
// file and, on a dry run, on a refused one too.
export function settings_import_notes(source) {
	return settings_import_list(settings_text.import_warnings((source.warnings || []).length), source.warnings, 50)
		+ settings_import_list(settings_text.import_mapped((source.mappedFields || []).length), source.mappedFields, 50)
		+ settings_import_list(settings_text.import_ignored((source.ignoredFields || []).length), source.ignoredFields, 50);
}

// An accepted file, dry run or real: the same report either way, with the verbs put in the future tense on a dry run.
export function settings_import_report(report) {
	const dry = !!report.dryRun;
	let html = settings_import_line(dry ? t("settings.import_head_check") : t("settings.import_head_done"), dry ? "import_head" : "import_head vert");
	html += settings_import_line(settings_escape_html(settings_text.import_source(report.schemaVersion, report.sourceApp)), "label_info");
	html += settings_import_line(settings_text.import_read(report.cyclesRead, report.daysRead), "label_info");
	if (report.daysToWrite == 0) html += settings_import_line(t("settings.import_nothing_to_write"));

	// the three per-day outcomes, each a date list
	html += settings_import_list(settings_text.import_days_created((report.daysCreated || []).length, dry), report.daysCreated, 40);
	html += settings_import_list(settings_text.import_days_overwritten((report.daysOverwritten || []).length, dry), report.daysOverwritten, 40);
	html += settings_import_list(settings_text.import_days_skipped((report.daysSkipped || []).length, dry), report.daysSkipped, 40);
	if (report.descriptionsCreated > 0) html += settings_import_line(settings_text.import_descriptions(report.descriptionsCreated, dry), "label_info");

	html += settings_import_notes(report);
	if (!dry && report.daysWritten > 0) html += `<p class="import_line"><a href="/">${t("settings.import_back_to_timeline")}</a></p>`;
	return html;
}

export function settings_import_refusal(jqXHR) {
	const error = (jqXHR.responseJSON || {}).error || {};
	const details = error.details || {};
	let html = settings_import_line(t("settings.import_head_refused"), "import_head rouge");
	// the API's own wording for the refusal, shown as it comes
	html += settings_import_line(settings_escape_html(error.message || settings_error(jqXHR)), "label_info");

	// Dates the file itself carries twice. They are among the issues below as well, but a list of its own is what makes the file fixable.
	const duplicated = details.duplicatedDaysInFile || [];
	if (duplicated.length > 0) {
		html += settings_import_line(settings_text.import_duplicates(duplicated.length), "rouge");
		html += settings_import_list(settings_text.import_duplicates_list(duplicated.length), duplicated, 40);
	}
	const issues = details.issues || [];
	if (issues.length > 0) html += settings_import_list(settings_text.import_issues(issues.length, details.issueCount || issues.length), issues, 50);

	return html + settings_import_notes(details);
}

export function settings_import_run(dry_run) {
	if (settings_import_running) return;
	const form = $("#f_import");
	const file = form.find("[name=file]")[0].files[0];
	const line = form.find(".form_msg");
	if (!file) return settings_say(line, "error", t("settings.import_pick_file"));
	const override = settings_is_checked(form, "override");
	if (!dry_run && override && !confirm(settings_text.import_confirm_override(file.name))) return;

	settings_import_running = true;
	$("#import_report").empty();
	settings_say(line, "busy", dry_run ? t("settings.import_checking") : t("settings.import_writing"));
	$("#i_import_check").prop("disabled", true).text(dry_run ? t("settings.import_but_check_busy") : t("settings.import_but_check"));
	$("#i_import_submit").prop("disabled", true).text(dry_run ? t("settings.import_but_submit") : t("settings.import_but_submit_busy"));
	const finish = function () {
		settings_import_running = false;
		settings_say(line, "", "");
		$("#i_import_check").prop("disabled", false).text(t("settings.import_but_check"));
		$("#i_import_submit").prop("disabled", false).text(t("settings.import_but_submit"));
	};

	// api/v2/import reads the file as the request body, so it goes up as it is -- no multipart form, and processData off so jQuery does not
	// try to encode the string.
	file.text().then(function (body) {
		const query = $.param({dryRun: dry_run, override: override, lastWriteClientUtc: (new Date()).toISOString()});
		$.ajax({type: "POST", url: moncycle_config.api_url(`/import?${query}`), contentType: "application/json", data: body, processData: false}).done(function (ret) {
			finish();
			$("#import_report").html(settings_import_report(ret.data || {}));
			// A real import adds days and cycles: the local copy gets them with a sync.
			if (!dry_run) settings_sync_later();
		}).fail(function (jqXHR) {
			finish();
			settings_leave_if_signed_out(jqXHR);
			console.error(jqXHR);
			$("#import_report").html(settings_import_refusal(jqXHR));
		});
	}, function (err) {
		finish();
		console.error(err);
		settings_say(line, "error", t("settings.import_unreadable"));
	});
}

export function settings_setup_import() {
	$("#i_import_check").on("click", function () { settings_import_run(true); });
	$("#f_import").on("submit", function (event) {
		event.preventDefault();
		settings_import_run(false);
	});
	// another file: the report of the previous one is no longer about it
	$("#i_import_file").on("change", function () { $("#import_report").empty(); });
}
