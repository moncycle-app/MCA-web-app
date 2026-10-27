// Characterisation of the pure parts of tableau.js (FertilityCare notation, day mapping), imported with no DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { install } from "./support/browser_stub.mjs";
install();
const { moncycle_app: app } = await import("/js/tableau.js");

test("parse_fc_note", () => {
	const note = app.parse_fc_note("VL 10KL X1");
	assert.equal(note.VL, true);
	assert.equal(note.X1, true);
	assert.equal(note["10"], true);
	assert.equal(note.K, true);
	assert.equal(note.L, true);
	assert.equal(note.H, false);
});
test("fc_score_to_codified", () => {
	assert.deepEqual(JSON.parse(JSON.stringify(app.fc_score_to_codified("VL 10KL X1"))), {
		codifiedBleedingObservation: "VL", codifiedMucusSensation: "10", codifiedMucusObservation: "KL",
		codifiedNumberObservations: "X1", codifiedPainObservations: null,
	});
	assert.equal(app.fc_score_to_codified("").codifiedBleedingObservation, null);
});
test("fc_score_from_api", () => {
	const score = app.fc_score_from_api({ codifiedBleedingObservation: "VL", codifiedMucusSensation: "10", codifiedMucusObservation: "K", codifiedNumberObservations: "X1" });
	assert.equal(score, "VL 10 K X1");
	assert.equal(app.fc_score_from_api({}), "");
});
test("day_from_api", () => {
	const day = app.day_from_api({ date: "2026-03-10", stampColor: "Red", comment: "x", cycleDay: 3 });
	assert.equal(day.date_obs, "2026-03-10");
	assert.equal(day.pos, 3);
	assert.equal(day.stamp, "R");
	assert.equal(day.comment, "x");
	assert.equal(day.description.length, 0);
});
test("day_to_api", () => {
	const fields = [
		{ name: "date", value: "2026-03-10" }, { name: "stamp", value: "G" }, { name: "baby", value: "BB" },
		{ name: "temp", value: "36.5" }, { name: "comment", value: "<b>x</b>" }, { name: "is_peak", value: "1" },
		{ name: "description[]", value: "fatigue" },
	];
	const body = app.day_to_api(fields);
	assert.equal(body.date, "2026-03-10");
	assert.equal(body.stampColor, "Green");
	assert.equal(body.stampBaby, true);
	assert.equal(body.temperature, 36.5);
	assert.equal(body.isPeak, true);
	assert.equal(body.comment, "<b>x</b>");
	assert.equal(body.cycleFirstDay, false);
});
