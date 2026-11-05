// The pure models: dates, FertilityCare notation, descriptions, days, cycles. No DOM, no storage.
import test from "node:test";
import assert from "node:assert/strict";
import * as dates from "/js/model/dates.js";
import { fc_score_to_codified, fc_score_from_api, fc_note_regex, fc_note_from_packed, fc_note_from_boxes, fc_boxes_from_note, fc_boxes_unticked_by } from "/js/model/fc_notation.js";
import { description_from_api, resolve, exists, of_day, to_day_fields } from "/js/model/descriptions.js";
import { day_from_api, day_to_api, blank_day, is_blank, day_from_body, stamp_from_api } from "/js/model/day.js";
import * as cycles from "/js/model/cycles.js";
import * as stats from "/js/model/cycle_stats.js";

test("dates", () => {
	assert.equal(dates.str(dates.parse("2026-03-09")), "2026-03-09");
	assert.equal(dates.parse("2026-03-09").getHours(), 9);
	assert.equal(dates.days_between("2026-02-28", "2026-03-02"), 2);
	assert.equal(dates.add_days("2026-02-28", 1), "2026-03-01");
	assert.equal(dates.add_days("2026-03-28", 2), "2026-03-30");   // over a change of hour
	assert.equal(dates.add_days("2026-03-01", -1), "2026-02-28");
	assert.match(dates.now_in_utc(), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
});

// typed note -> the fields of the API, the note shown: [typed, flow, brown, discharge, letters, number, pain]
const NOTES = [
	["H AP", "H", false, null, [], null, "AP"],
	["MB", "M", true, null, [], null, null],
	["VLB 4 X1", "VL", true, "4", [], "X1", null],
	["LB", "L", true, null, [], null, null],
	["L", "L", false, null, [], null, null],
	["L 10KL AD", "L", false, "10", ["K", "L"], "AD", null],
	["10KL AD", null, false, "10", ["K", "L"], "AD", null],
	["0 AD", null, false, "0", [], "AD", null],
	["2W X1", null, false, "2W", [], "X1", null],
	["10DL", null, false, "10DL", [], null, null],
	["10SL X2", null, false, "10SL", [], "X2", null],
	["6CP X3", null, false, "6", ["C", "P"], "X3", null],
	["PY AD", null, false, null, ["P", "Y"], "AD", null],
	["6BC X1", null, false, "6", ["B", "C"], "X1", null],
	["B", null, true, null, [], null, null],
	["LAP", null, false, null, [], null, "LAP"],
	["RAP", null, false, null, [], null, "RAP"],
	["VLB 10KL AD", "VL", true, "10", ["K", "L"], "AD", null],
];
for (const [typed, flow, brown, discharge, letters, number, pain] of NOTES) {
	test(`the FertilityCare note ${typed}: typed, read, shown`, () => {
		const fields = {
			codifiedBleedingObservation: flow, codifiedBleedingBrown: brown, codifiedMucusSensation: discharge,
			codifiedMucusObservation: letters, codifiedNumberObservations: number, codifiedPainObservations: pain,
		};
		assert.deepEqual(fc_score_to_codified(typed), fields);
		assert.equal(fc_score_from_api(fields), typed);
		assert.ok(fc_note_regex.test(typed), typed);
	});
}

test("a note is read whatever its case and spacing, longest code first", () => {
	assert.equal(fc_score_from_api(fc_score_to_codified("vlb 10kl ad")), "VLB 10KL AD");
	assert.equal(fc_score_from_api(fc_score_to_codified("VL B 10 KL")), "VLB 10KL");
	assert.equal(fc_score_to_codified("10WL").codifiedMucusSensation, "10WL");
	assert.equal(fc_score_to_codified("10WLAP").codifiedPainObservations, "AP");
	assert.deepEqual(fc_score_to_codified("6KCK").codifiedMucusObservation, ["C", "K"]);
	assert.equal(fc_score_to_codified("").codifiedBleedingObservation, null);
	assert.equal(fc_score_from_api({}), "");
});

test("L beside AP: a pain when glued, a flow when apart", () => {
	assert.equal(fc_score_to_codified("L AP").codifiedBleedingObservation, "L");
	assert.equal(fc_score_to_codified("L AP").codifiedPainObservations, "AP");
	assert.equal(fc_score_to_codified("LLAP").codifiedBleedingObservation, "L");
	assert.equal(fc_score_to_codified("LLAP").codifiedPainObservations, "LAP");
	assert.equal(fc_score_to_codified("6KLAP").codifiedPainObservations, "LAP");
	assert.deepEqual(fc_score_to_codified("6KL AP").codifiedMucusObservation, ["K", "L"]);
});

test("a typed R is not a code", () => {
	assert.deepEqual(fc_score_to_codified("6CR").codifiedMucusObservation, ["C"]);
	assert.equal(fc_score_to_codified("6CRAP").codifiedPainObservations, "RAP");
	assert.equal(fc_score_to_codified("R").codifiedMucusSensation, null);
});

test("every day the server can hold reads back the same from its note; a B with no discharge is the brown of the notation", () => {
	for (const flow of [null, "H", "L", "VL"]) for (const brown of [false, true]) for (const discharge of [null, "0", "2W", "10", "10WL"])
		for (const letters of [[], ["B"], ["L"], ["B", "C"], ["B", "L"], ["C", "K"], ["B", "C", "G", "K", "P", "Y", "L"]])
			for (const pain of [null, "LAP", "AP"]) {
				const fields = { codifiedBleedingObservation: flow, codifiedBleedingBrown: brown, codifiedMucusSensation: discharge, codifiedMucusObservation: letters, codifiedNumberObservations: null, codifiedPainObservations: pain };
				const moved = discharge === null && letters.includes("B");
				const expected = moved ? { ...fields, codifiedBleedingBrown: true, codifiedMucusObservation: letters.filter((letter) => letter !== "B") } : fields;
				assert.deepEqual(fc_score_to_codified(fc_score_from_api(fields)), expected, JSON.stringify(fields));
			}
});

test("the chart: one B, two L, C/K", () => {
	assert.equal(fc_score_from_api({ codifiedMucusObservation: ["L"] }), " L");
	assert.deepEqual(fc_score_to_codified(" L").codifiedMucusObservation, ["L"]);
	assert.equal(fc_score_to_codified(" L").codifiedBleedingObservation, null);
	assert.equal(fc_score_from_api({ codifiedBleedingBrown: true, codifiedMucusObservation: ["L"] }), "B L");
	assert.equal(fc_score_from_api({ codifiedMucusObservation: [], codifiedPainObservations: "LAP" }), "LAP");
	for (const typed of ["H B", "HB", "H  B", " B", "PB", "BP"]) assert.equal(fc_score_to_codified(typed).codifiedBleedingBrown, true, typed);
	assert.deepEqual(fc_score_to_codified("PB").codifiedMucusObservation, ["P"]);
	assert.equal(fc_score_to_codified("6BC").codifiedBleedingBrown, false);
	assert.equal(fc_score_to_codified("HB 6BC").codifiedBleedingBrown, true);
	assert.deepEqual(fc_score_to_codified("HB 6BC").codifiedMucusObservation, ["B", "C"]);
	for (const typed of ["10C/K", "6C/K X1", "VL 8C/K AD", "c/k ad"]) {
		assert.ok(fc_note_regex.test(typed), typed);
		assert.ok(fc_score_to_codified(typed).codifiedMucusObservation.join() === "C,K", typed);
	}
});

// the boxes as they are in timeline.html, by part
const BOXES = {
	flow: ["fc_h", "fc_m", "fc_flow_l", "fc_vl", "fc_vh"],
	discharge: ["fc_0", "fc_2", "fc_2w", "fc_4", "fc_6", "fc_8", "fc_10", "fc_10dl", "fc_10sl", "fc_10wl"],
	number: ["fc_x1", "fc_x2", "fc_x3", "fc_ad"],
	pain: ["fc_ap", "fc_rap", "fc_lap"],
	free: ["fc_b", "fc_c", "fc_g", "fc_k", "fc_p", "fc_y", "fc_l"],
};
const sorted = (list) => [...list].sort();

test("every combination of boxes makes a valid note that gives back the same boxes and the fields ticked", () => {
	let count = 0;
	for (const flow of [null, ...BOXES.flow]) for (const discharge of [null, ...BOXES.discharge]) for (const number of [null, ...BOXES.number]) for (const pain of [null, ...BOXES.pain])
		for (let bits = 0; bits < 2 ** BOXES.free.length; bits++) {
			const free = BOXES.free.filter((_, i) => bits & (1 << i));
			const ticked = [flow, discharge, number, pain, ...free].filter(Boolean);
			const note = fc_note_from_boxes(ticked, "");
			assert.ok(fc_note_regex.test(note), note);
			assert.deepEqual(sorted(fc_boxes_from_note(note)), sorted(ticked), JSON.stringify(note));
			const fields = fc_score_to_codified(note);
			assert.equal(fields.codifiedBleedingBrown, free.includes("fc_b"));
			assert.equal(fields.codifiedBleedingObservation === null, flow === null);
			assert.equal(fields.codifiedMucusSensation === null, discharge === null);
			assert.equal(fields.codifiedNumberObservations === null, number === null);
			assert.equal(fields.codifiedPainObservations === null, pain === null);
			assert.equal(fields.codifiedMucusObservation.length, free.filter((box) => box !== "fc_b").length);
			count++;
		}
	assert.equal(count, 6 * 11 * 5 * 4 * 128);
});

test("ticking and unticking at random never breaks the note", () => {
	const all = Object.values(BOXES).flat();
	let seed = 42;
	const next = (max) => (seed = (seed * 1664525 + 1013904223) % 4294967296) % max;
	let ticked = [];
	let note = "";
	for (let step = 0; step < 50000; step++) {
		const box = all[next(all.length)];
		if (ticked.includes(box)) ticked = ticked.filter((other) => other !== box);
		else ticked = [...ticked.filter((other) => !fc_boxes_unticked_by(box).includes(other)), box];
		note = fc_note_from_boxes(ticked, note);
		assert.ok(fc_note_regex.test(note), note);
		assert.deepEqual(sorted(fc_boxes_from_note(note)), sorted(ticked), JSON.stringify(note));
	}
});

test("a typed letter B stays through the boxes while there is a discharge", () => {
	assert.equal(fc_note_from_boxes(["fc_6", "fc_c", "fc_ad"], "6BC X1"), "6BC AD");
	assert.equal(fc_note_from_boxes(["fc_8", "fc_c"], "6BC"), "8BC");
	assert.equal(fc_note_from_boxes(["fc_c"], "6BC"), "C");
	assert.deepEqual(sorted(fc_boxes_from_note("6BC X1")), ["fc_6", "fc_c", "fc_x1"]);
});

test("the box R, which the notation does not know, stays in the note and is not sent", () => {
	for (const ticked of [["fc_r"], ["fc_6", "fc_c", "fc_r"], ["fc_l", "fc_r"], ["fc_h", "fc_r"]]) {
		const note = fc_note_from_boxes(ticked, "");
		assert.ok(fc_note_regex.test(note), note);
		assert.deepEqual(sorted(fc_boxes_from_note(note)), sorted(ticked), note);
		assert.ok(!fc_score_to_codified(note).codifiedMucusObservation.includes("R"));
	}
});

test("what is accepted of a note is read whole, and the note of any day the server holds is accepted", () => {
	for (const ok of ["VL 10KL X1", "H", "0", "6C", "2W AD", "10KL X2 AP", "B", "BC", "h b", " L", "6KLR", "10C/K", "PY", "L AP", "VLAP", "10", "6", "2C", "0 K", "10WLK", "R"]) assert.ok(fc_note_regex.test(ok), ok);
	for (const bad of ["Z", "12", "VL VL", "HM", "2 4", "X1X2", "APLAP", "AD 10KL", "1010DL", "10 10", "6 X1 X2"]) assert.ok(!fc_note_regex.test(bad), bad);
	for (const flow of [null, "H", "VL"]) for (const brown of [false, true]) for (const discharge of [null, "0", "2", "2W", "4", "6", "10", "10DL"])
		for (const letters of [[], ["B"], ["L"], ["B", "C"], ["K", "L"]]) for (const number of [null, "AD"]) {
			const note = fc_score_from_api({ codifiedBleedingObservation: flow, codifiedBleedingBrown: brown, codifiedMucusSensation: discharge, codifiedMucusObservation: letters, codifiedNumberObservations: number });
			assert.ok(fc_note_regex.test(note), JSON.stringify(note));
		}
});

test("a body queued before the note was split takes the shape of the API", () => {
	assert.deepEqual(fc_note_from_packed({ codifiedBleedingObservation: "VLB", codifiedMucusSensation: "10", codifiedMucusObservation: "KL", codifiedNumberObservations: "AD", codifiedPainObservations: null }), {
		codifiedBleedingObservation: "VL", codifiedBleedingBrown: true, codifiedMucusSensation: "10",
		codifiedMucusObservation: ["K", "L"], codifiedNumberObservations: "AD", codifiedPainObservations: null,
	});
	assert.equal(fc_note_from_packed({ codifiedBleedingObservation: "BL" }).codifiedBleedingObservation, "L");
	assert.equal(fc_note_from_packed({ codifiedBleedingObservation: "BL" }).codifiedBleedingBrown, true);
	assert.equal(fc_note_from_packed({ codifiedBleedingObservation: "B" }).codifiedBleedingObservation, null);
	assert.equal(fc_note_from_packed({ codifiedMucusSensation: "0" }).codifiedMucusSensation, "0");
	assert.deepEqual(fc_note_from_packed({ codifiedMucusObservation: "CK" }).codifiedMucusObservation, ["C", "K"]);
	assert.deepEqual(fc_note_from_packed({}).codifiedMucusObservation, []);
});

test("a day of the form and its twin in the copy hold the note's boolean and list", () => {
	const blank = blank_day("2026-03-10");
	assert.equal(blank.codifiedBleedingBrown, false);
	assert.deepEqual(blank.codifiedMucusObservation, []);
	assert.ok(is_blank({ ...blank }));
	assert.ok(!is_blank({ ...blank, codifiedBleedingBrown: true }));
	assert.ok(!is_blank({ ...blank, codifiedMucusSensation: "0" }));
	assert.ok(!is_blank({ ...blank, codifiedMucusObservation: ["K"] }));
	const letters = ["C", "K"];
	const day = day_from_body({ date: "2026-03-10", codifiedBleedingBrown: true, codifiedMucusSensation: "0", codifiedMucusObservation: letters });
	assert.equal(day.codifiedBleedingBrown, true);
	assert.equal(day.codifiedMucusSensation, "0");
	assert.deepEqual(day.codifiedMucusObservation, letters);
	assert.notEqual(day.codifiedMucusObservation, letters);
	const none = day_from_body({ date: "2026-03-10" });
	assert.equal(none.codifiedBleedingBrown, false);
	assert.deepEqual(none.codifiedMucusObservation, []);
	assert.equal(none.codifiedPainObservations, null);
	const flat = day_from_api({ date: "2026-03-10", codifiedBleedingObservation: "VL", codifiedBleedingBrown: true, codifiedMucusSensation: "10", codifiedMucusObservation: ["K"], freeMucusSensation: [], freeMucusObservation: [], freeOther: [] }, []);
	assert.equal(flat.fc_score, "VLB 10K");
	assert.equal(flat.fc_flow, "VL");
	assert.equal(flat.fc_sensation, "10");
	assert.deepEqual(flat.fc_letters, ["K"]);
});

test("descriptions", () => {
	assert.deepEqual(description_from_api({ id: 3, name: "a", type: "sensation", useCount: 2 }), { id: 3, name: "a", type: 2, use_count: 2 });
	assert.equal(description_from_api({ id: 3, name: "a", type: "weird", useCount: 0 }).type, 0);
	const list = [{ id: 1, name: "a", type: 1, use_count: 0 }, { id: 2, name: "b", type: 2, use_count: 0 }];
	assert.equal(resolve(list, "a", 1).id, 1);
	assert.equal(resolve(list, "a", 2).id, null);
	assert.equal(exists(list, "a", 1), true);
	assert.equal(exists(list, "a", 1, 1), false);
	assert.deepEqual(of_day({ freeMucusSensation: ["b"], freeMucusObservation: ["a"], freeOther: ["z"] }, list).map((d) => d.name), ["a", "b", "z"]);
	assert.deepEqual(to_day_fields(["b", "a", "unknown"], list), { freeMucusObservation: ["a"], freeMucusSensation: ["b"], freeOther: [] });
});

test("day: API <-> flat shape <-> form", () => {
	const flat = day_from_api({ date: "2026-03-10", stampColor: "Red", stampBaby: true, comment: "x", cycleDay: 3, freeMucusSensation: ["b"] }, [{ id: 2, name: "b", type: 2, use_count: 0 }]);
	assert.equal(flat.stamp, "RBB");
	assert.equal(flat.pos, 3);
	assert.equal(flat.description[0].id, 2);
	assert.equal(stamp_from_api({ stampColor: null, stampBaby: true }), "BB");
	const body = day_to_api([
		{ name: "date", value: "2026-03-10" }, { name: "stamp", value: "G" }, { name: "baby", value: "BB" }, { name: "temp", value: "36.5" },
		{ name: "comment", value: "<b>x</b>" }, { name: "is_peak", value: "1" }, { name: "fc_score", value: "VL" }, { name: "fc_arrow", value: "↑" },
		{ name: "description[]", value: "b" },
	], [{ id: 2, name: "b", type: 2, use_count: 0 }]);
	assert.equal(body.stampColor, "Green");
	assert.equal(body.stampBaby, true);
	assert.equal(body.temperature, 36.5);
	assert.equal(body.isPeak, true);
	assert.equal(body.cycleFirstDay, false);
	assert.equal(body.codifiedArrow, "Up");
	assert.equal(body.codifiedBleedingObservation, "VL");
	assert.deepEqual(body.freeMucusSensation, ["b"]);
	assert.equal(body.comment, "<b>x</b>");
});
test("day: blank and from a body", () => {
	assert.equal(is_blank(blank_day("2026-03-10")), true);
	const day = day_from_body({ date: "2026-03-10", stampBaby: true, temperature: 0, lastWriteClientUtc: "2026-03-10 09:00:00" }, null);
	assert.equal(day.stampColor, "White");
	assert.equal(day.temperature, null);
	assert.equal(day.lastWriteClientUtc, "2026-03-10T09:00:00Z");
	assert.equal(is_blank(day), false);
	// where a day stands in its cycle and when it was written do not make it non-blank
	assert.equal(is_blank({ ...blank_day("2026-03-10"), cycleDay: 4, cycleStartDate: "2026-03-07" }), true);
});

test("cycles: places and lengths", () => {
	assert.equal(cycles.day_number("2026-03-01", "2026-03-10"), 10);
	const starts = ["2026-03-20", "2026-03-01", "2026-02-01"];
	assert.deepEqual(cycles.cycle_of(starts, "2026-03-10"), { cycleStartDate: "2026-03-01", cycleDay: 10 });
	assert.deepEqual(cycles.cycle_of(starts, "2026-01-10"), { cycleStartDate: null, cycleDay: null });
	const list = ["2026-03-20", "2026-03-01"];
	cycles.set_member(list, "2026-03-10", true);
	assert.deepEqual(list, ["2026-03-20", "2026-03-10", "2026-03-01"]);
	cycles.set_member(list, "2026-03-20", false);
	assert.deepEqual(list, ["2026-03-10", "2026-03-01"]);
	const days = { "2026-03-02": { cycleStartDate: null, cycleDay: null }, "2026-03-25": { cycleStartDate: "2026-03-01", cycleDay: 25 } };
	assert.deepEqual(cycles.place_days(["2026-03-20", "2026-03-01"], days), ["2026-03-02", "2026-03-25"]);
	assert.deepEqual(days["2026-03-25"], { cycleStartDate: "2026-03-20", cycleDay: 6 });
});
test("cycles: line length", () => {
	assert.equal(cycles.cycle_line_length([], []), 35);
	const starts = ["2026-05-01", "2026-04-03", "2026-03-06", "2026-02-06", "2026-01-09"];   // lengths 28, 28, 28, 28
	assert.equal(cycles.cycle_line_length(starts, []), 35);   // median 28 + 5 = 33, in steps of 5
	const long = ["2026-07-01", "2026-05-20", "2026-04-01", "2026-02-10", "2026-01-01"];   // 42, 49, 51, 40
	assert.equal(cycles.cycle_line_length(long, []), 45);   // at most 45
	assert.equal(cycles.cycle_line_length(starts, ["2026-03-20", "2026-04-10", "2026-02-20"]), 35);   // three pauses leave one length: the default
});
test("cycles: lengths", () => {
	assert.deepEqual(cycles.cycle_lengths([], []), []);
	assert.deepEqual(cycles.cycle_lengths(["2026-05-01", "2026-04-03", "2026-03-06"], []), [{start: "2026-04-03", days: 28}, {start: "2026-03-06", days: 28}]);
	assert.deepEqual(cycles.cycle_lengths(["2026-05-01", "2026-04-03", "2026-03-06"], ["2026-03-20"]), [{start: "2026-04-03", days: 28}]);   // ended by a pause
});
test("cycles: span, peak marks, counters", () => {
	const closed = cycles.cycle_span(["2026-05-01", "2026-04-03"], [], 1);
	assert.equal(closed.start, "2026-04-03");
	assert.equal(closed.days, 28);
	assert.equal(dates.str(closed.end_date), "2026-04-30");
	const paused = cycles.cycle_span(["2026-05-01", "2026-04-03"], ["2026-04-20"], 1);
	assert.equal(paused.days, 18);
	assert.equal(paused.new_cycle_form, false);
	const latest = cycles.cycle_span([dates.str(dates.now())], [dates.str(dates.now())], 0);
	assert.equal(latest.days, 1);
	assert.equal(latest.new_cycle_form, true);
	assert.deepEqual(cycles.peak_follow_days("2026-03-30", 5), [
		{ date: "2026-03-31", n: 1 }, { date: "2026-04-01", n: 2 }, { date: "2026-04-02", n: 3 }, { date: "2026-04-04", n: 5 }]);
	assert.deepEqual(cycles.counter_days("2026-03-30", 3), [{ date: "2026-03-30", n: 1 }, { date: "2026-03-31", n: 2 }, { date: "2026-04-01", n: 3 }]);
	assert.equal(cycles.nfp_method_from_api("fertilityCare", true), 4);
	assert.equal(cycles.nfp_method_from_api("unknown", false), 2);
});

// The days of a cycle from letters, one per day from `from`: R G Y a stamp, B the white one with a baby, g a green one with a baby, N not
// observed, P paused, T a temperature alone, "." nothing; `more` adds fields to a day, by its number.
function chart(from, letters, more = {}) {
	const shapes = { R: { stampColor: "Red" }, G: { stampColor: "Green" }, Y: { stampColor: "Yellow" }, B: { stampColor: "White", stampBaby: true }, g: { stampColor: "Green", stampBaby: true }, N: { dayNotObserved: true }, P: { observationPaused: true }, T: { temperature: 36.6 } };
	const days = {};
	[...letters].forEach((letter, i) => {
		if (shapes[letter] || more[i + 1]) days[dates.add_days(from, i)] = { ...shapes[letter], ...more[i + 1] };
	});
	return days;
}
const MUCUS = { fc: false, temperature: false };

test("cycle stats: a day is of the kind the timeline draws", () => {
	const mucus_temp = { fc: false, temperature: true }, fc = { fc: true, temperature: false };
	assert.equal(stats.day_kind(undefined, MUCUS), "to_fill");
	assert.equal(stats.day_kind({ stampColor: "Green", stampBaby: true }, MUCUS), "G");   // a coloured stamp with a baby: its colour
	assert.equal(stats.day_kind({ stampColor: "White", stampBaby: true }, MUCUS), "BB");
	assert.equal(stats.day_kind({ stampColor: "White" }, MUCUS), "to_fill");
	assert.equal(stats.day_kind({ dayNotObserved: true, stampColor: "Red" }, MUCUS), "not_observed");
	assert.equal(stats.day_kind({ observationPaused: true, stampColor: "Red" }, MUCUS), "paused");
	assert.equal(stats.day_kind({ temperature: 36.5 }, MUCUS), "to_fill");   // a temperature the method does not show
	assert.equal(stats.day_kind({ temperature: 36.5 }, mucus_temp), "none");
	assert.equal(stats.day_kind({ codifiedMucusSensation: "10" }, fc), "none");
	assert.equal(stats.day_kind({ codifiedMucusSensation: "10" }, MUCUS), "to_fill");
	assert.equal(stats.day_kind({ codifiedBleedingBrown: true, codifiedMucusObservation: [] }, fc), "none");
	assert.equal(stats.day_kind({ codifiedMucusSensation: "0", codifiedMucusObservation: [] }, fc), "none");
	assert.equal(stats.day_kind({ codifiedBleedingBrown: false, codifiedMucusObservation: [] }, fc), "to_fill");
	assert.equal(stats.day_kind({ sexUnion: true, isPeak: true, comment: "x", freeMucusSensation: ["a"] }, MUCUS), "to_fill");
});

test("cycle stats: the days of a cycle by kind, filled in, in a row, the peak, intercourse", () => {
	const from = "2026-03-01";
	//                          1234567890123456789012345
	const days = chart(from, "RRRRGG.GGBBNBBgggGGG..GG.", { 7: { sexUnion: true }, 14: { isPeak: true }, 20: { sexUnion: true } });
	const cycle = stats.cycle_stats(days, from, dates.add_days(from, 24), MUCUS);
	assert.equal(cycle.total, 25);
	assert.deepEqual(cycle.kinds, { R: 4, G: 12, Y: 0, BB: 4, none: 0, not_observed: 1, to_fill: 4, paused: 0 });
	assert.deepEqual(cycle.to_fill, [7, 21, 22, 25]);
	assert.equal(cycle.streak, 2);    // days 23 and 24: the last day is still to fill in
	assert.equal(cycle.longest, 13);  // days 8 to 20
	assert.equal(cycle.peak, 14);
	assert.deepEqual(cycle.baby, { first: 10, last: 17, days: 8 });   // the day not observed between baby days is one of them
	assert.equal(cycle.temperature, null);
	assert.deepEqual(cycle.words, []);
	assert.equal(stats.filled_percent(cycle), 84);
});

test("cycle stats: temperatures and keywords, as the method shows them", () => {
	const from = "2026-03-01";
	const days = chart(from, "TTG.N", { 1: { temperature: 36.4 }, 3: { temperature: 36.9, freeMucusObservation: ["a", "b"], freeMucusSensation: ["a"] }, 4: { freeOther: ["b"] }, 5: { temperature: 37.2, freeMucusObservation: ["c"] } });
	const with_temperature = stats.cycle_stats(days, from, "2026-03-05", { fc: false, temperature: true });
	assert.deepEqual(with_temperature.kinds, { R: 0, G: 1, Y: 0, BB: 0, none: 2, not_observed: 1, to_fill: 1, paused: 0 });
	const { count, mean, min, max } = with_temperature.temperature;   // not the day not observed
	assert.deepEqual([count, min, max], [3, 36.4, 36.9]);
	assert.ok(Math.abs(mean - 36.633) < 0.001);
	assert.deepEqual(with_temperature.words, [["a", 1], ["b", 2]].reverse());   // on the most days first, a word counted once a day
	assert.equal(stats.cycle_stats(days, from, "2026-03-05", MUCUS).temperature, null);
	assert.deepEqual(stats.cycle_stats(days, from, "2026-03-05", { fc: true, temperature: false }).words, []);
});

test("cycle stats: a cycle closed by a pause, a cycle filled in", () => {
	const paused = stats.cycle_stats(chart("2026-03-01", "RRGGP"), "2026-03-01", "2026-03-05", MUCUS);
	assert.equal(paused.kinds.paused, 1);
	assert.equal(stats.filled_percent(paused), 100);   // the pause is written down, not to fill in
	const full = stats.cycle_stats(chart("2026-03-01", "RRGNG"), "2026-03-01", "2026-03-05", MUCUS);
	assert.deepEqual([full.streak, full.longest, full.to_fill.length], [5, 5, 0]);
	const today_left = stats.cycle_stats(chart("2026-03-01", "RRGG."), "2026-03-01", "2026-03-05", MUCUS);
	assert.deepEqual([today_left.streak, today_left.to_fill], [4, [5]]);
	const empty = stats.cycle_stats({}, "2026-03-01", "2026-03-03", MUCUS);
	assert.deepEqual([empty.streak, empty.longest, empty.baby, empty.peak, stats.filled_percent(empty)], [0, 0, null, null, 0]);
});

test("cycle stats: the baby period takes the unknown days around it, unless they reach an end of the cycle", () => {
	const shape = (letters) => [...letters].map((letter) => ({ kind: { ".": "to_fill", N: "not_observed", B: "BB", g: "G", G: "G", P: "paused" }[letter], baby: letter == "B" || letter == "g" }));
	assert.equal(stats.baby_period(shape("GGGG"), null), null);
	assert.equal(stats.baby_period(shape("G..N.G"), null), null);   // unknown days with no baby day next to them
	assert.deepEqual(stats.baby_period(shape("GG..BB.N.GG"), null), { first: 3, last: 9, days: 7 });
	assert.deepEqual(stats.baby_period(shape("..BB.."), null), { first: 3, last: 4, days: 2 });   // they reach the first and the last day
	assert.deepEqual(stats.baby_period(shape("GBB.P"), null), { first: 2, last: 4, days: 3 });     // a pause is a known day
	assert.deepEqual(stats.baby_period(shape("GB.gGG.BG"), null), { first: 2, last: 4, days: 3 });   // two periods: the longest
	assert.deepEqual(stats.baby_period(shape("GB.gG..BG"), null), { first: 6, last: 8, days: 3 });   // two as long: the latest
	// the choice among the periods: with a peak, the one that holds it, else the latest before it; else the longest, the latest of equals
	const days = shape("GGBGGGGBBBGGGBBBBGGG");
	assert.deepEqual(stats.baby_period(days, null), { first: 14, last: 17, days: 4 });
	assert.deepEqual(stats.baby_period(days, 9), { first: 8, last: 10, days: 3 });
	assert.deepEqual(stats.baby_period(days, 11), { first: 8, last: 10, days: 3 });
	assert.deepEqual(stats.baby_period(days, 2), { first: 14, last: 17, days: 4 });
	assert.deepEqual(stats.baby_period(shape("GGBBGGGBBG"), null), { first: 8, last: 9, days: 2 });
});

test("cycle stats: shares in percent, what a cycle filled in is told, runs of days", () => {
	assert.deepEqual([stats.percent(0, 29), stats.percent(29, 29), stats.percent(2, 29), stats.percent(1, 8)], [0, 100, 7, 13]);
	assert.deepEqual([stats.percent(1, 300), stats.percent(299, 300), stats.percent(3, 0)], [1, 99, 0]);   // never 0 or 100 when it is not
	const filled = (to_fill, total) => stats.filled_percent({ kinds: { to_fill }, total });
	assert.deepEqual([filled(0, 29), filled(2, 29), filled(1, 8), filled(1, 300), filled(300, 300)], [100, 93, 87, 99, 0]);
	assert.deepEqual([100, 99, 95, 94, 90, 89, 80, 79, 60, 59, 0].map(stats.fill_level), ["full", "95", "95", "90", "90", "80", "80", "60", "60", "low", "low"]);
	assert.deepEqual(stats.day_runs([3, 8, 9, 10, 12]), [{ first: 3, last: 3 }, { first: 8, last: 10 }, { first: 12, last: 12 }]);
	assert.deepEqual(stats.day_runs([]), []);
	// what is tapped to open the days to fill in: a run of two is two days, a longer run stays one
	assert.deepEqual(stats.todo_runs([3, 4, 8, 9, 10, 12, 20, 21, 22, 23]), [{ first: 3, last: 3 }, { first: 4, last: 4 }, { first: 8, last: 10 }, { first: 12, last: 12 }, { first: 20, last: 23 }]);
	assert.deepEqual(stats.todo_runs([32, 33]), [{ first: 32, last: 32 }, { first: 33, last: 33 }]);
	assert.deepEqual(stats.todo_runs([]), []);
});

test("cycle stats: the averages of the complete cycles before", () => {
	const starts = ["2026-05-01", "2026-04-03", "2026-03-06", "2026-02-06"];   // three cycles of 28 days before the latest
	const days = { "2026-04-16": { isPeak: true }, "2026-03-10": { isPeak: true }, "2026-03-20": { isPeak: true } };
	const before = stats.previous_cycles(starts, [], days, "2026-05-01");
	assert.equal(before.cycles, 3);
	assert.deepEqual(before.length, { count: 3, mean: 28, min: 28, max: 28 });
	assert.deepEqual(before.peak, { count: 2, mean: 14.5, min: 14, max: 15 });   // the latest peak of a cycle; one has none
	assert.deepEqual(before.after_peak, { count: 2, mean: 13.5, min: 13, max: 14 });
	assert.equal(stats.previous_cycles(starts, [], days, "2026-04-03").cycles, 2);   // only the cycles before
	const paused = stats.previous_cycles(starts, ["2026-03-25"], days, "2026-05-01");   // a cycle ended by a pause is not one
	assert.deepEqual([paused.cycles, paused.peak.count], [2, 1]);
	const first = stats.previous_cycles(starts, [], days, "2026-02-06");
	assert.deepEqual(first, { cycles: 0, length: null, peak: null, after_peak: null });
	const many = Array.from({ length: 10 }, (_, i) => dates.add_days("2026-09-01", -28 * i));
	assert.equal(stats.previous_cycles(many, [], {}, many[0]).cycles, stats.PREVIOUS_CYCLES);
});
