import { moncycle_store } from "../../../js/model/store.js";
import { date_compact } from "../../../js/model/format.js";
import * as dates from "../../../js/model/dates.js";
import { account_setting } from "../../../js/model/cycles.js";
import { t } from "../../../js/core/i18n.js";
import { by_id } from "../../../js/core/dom.js";
import { settings_today } from "../common.js";

/* ===========================================================================
** 5b. AFFICHAGE (and the automatic mail): the optional settings of the account. Each one is a form of its own, `form.setting_form`, with
** one control named after the API key (`data-setting` says the key too) and a "back to the default" button. The script only submits it: a
** change of the control, or the button, sends the key alone ({"dateOrder": "MONTH_FIRST"}); the reset sends it as null.
** ======================================================================== */

function setting_forms() {
	return [...document.querySelectorAll("form.setting_form")];
}

// the value a setting form sends: null for the default entry of a select
function setting_value(form, key) {
	const field = form.elements[key];
	if (field.type === "checkbox") return field.checked;
	return field.value === "" ? null : field.value;
}

// `save(body, line, {on_refused})` sends the change (settings_save of suivi.js) and shows its answer in the form's line. The copy of the
// store takes the change at once, so that the dates and temperatures of the other screens follow; a refusal puts it back.
export function settings_setup_setting_forms(save) {
	setting_forms().forEach(function (form) {
		form.addEventListener("change", function () { form.requestSubmit(); });
		form.addEventListener("submit", function (event) {
			event.preventDefault();
			const key = form.dataset.setting;
			const reset = event.submitter && event.submitter.name === "reset";
			const body = {[key]: reset ? null : setting_value(form, key)};
			const before = moncycle_store.set_setting(key, body[key]);
			save(body, form.querySelector(".form_msg"), {on_refused : function () { moncycle_store.restore_setting(key, before); }});
		});
	});
}

// The controls show what the account holds: the value (the default while it is not set), and a reset button that works only on a setting
// that is set. The date orders are shown with today's date written in them.
export function settings_fill_settings(account) {
	const settings = account.settings || {};
	setting_forms().forEach(function (form) {
		const key = form.dataset.setting;
		const field = form.elements[key];
		const is_set = !!(settings[key] && settings[key].isSet);
		if (key === "dateOrder") fill_date_orders(field, account);
		else if (field.type === "checkbox") field.checked = !!account_setting(account, key);
		else field.value = account_setting(account, key);
		form.elements["reset"].disabled = !is_set;
	});
	// the unit only matters when the temperature is tracked (the setting is kept either way)
	by_id("f_temperature_unit").hidden = !account.temperatureTracking;
}

// the two orders, each shown with today's compact date written in it; the default is the first, so the select always holds a value
function fill_date_orders(select, account) {
	const today = dates.parse(settings_today());
	select.replaceChildren(
		new Option(t("settings.date_order_day_first", {example: date_compact(today, true, "DAY_FIRST")}), "DAY_FIRST"),
		new Option(t("settings.date_order_month_first", {example: date_compact(today, true, "MONTH_FIRST")}), "MONTH_FIRST"));
	select.value = account_setting(account, "dateOrder");
}
