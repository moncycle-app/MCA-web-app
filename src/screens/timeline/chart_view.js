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
import * as dates from "/js/model/dates.js";
import { date_short } from "/js/core/i18n.js";
import { by_id, display, is_hidden } from "/js/core/dom.js";
import { load_chart } from "/js/vendor/chart.js";
import { state } from "/screens/timeline/state.js";

// The chart of a cycle, once Chart.js is there (it is loaded when the first one is asked for); then it is drawn from the data held.
export async function cycle2graph(id) {
	const Chart = await load_chart();
	// the cycles can have been drawn again, or the screen left, while the library came
	const canvas = by_id(`canvas-c-${id}`);
	if (!canvas || state.graphs[id]) return;
	state.graphs[id] = new Chart(canvas, {
		type: 'line',
		data: {
			datasets: [{
				data: state.graph_data[id],
				fill: false,
				borderColor: '#1e824c',
				tension: 0.1,
			}]
		},
		options: {
			responsive:true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false
				}
			}
		}
	});
	graph_update(id);
}

export function graph_update(id) {
	// the chart is made when the library has come; it is updated from the data then
	if (!state.graphs[id]) return;
	let vide = true;
	for (let k in state.graph_data[id]) if (vide && !isNaN(state.graph_data[id][k])) vide = false;
	const box = by_id("graph-c-" + id);
	box.setAttribute("vide", vide ? 1 : 0);
	if (vide) display(box, false);
	else {
		if (!is_hidden(by_id("contenu-c-" + id))) display(box, true);
		state.graphs[id].data.datasets[0].data = state.graph_data[id];
		state.graphs[id].update();
	}
	if (!vide && (state.constante.nfp_method==1 || state.constante.nfp_method==4)) {
		state.graphs[id].data.datasets = state.graphs[id].data.datasets.slice(0,1);
		state.graphs[id].update();
	}
}

export function graph_preparation_data(data) {
	Object.entries(data).forEach(function ([o_date, o_data]) {
		if (state.graph_data[o_data.cycle] == undefined) state.graph_data[o_data.cycle] = {};
		let date = dates.parse(o_date);
		let label = date_short(date);
		state.graph_data[o_data.cycle][label] = parseFloat(o_data.temperature);
		if (state.graphs[o_data.cycle]) graph_update(o_data.cycle);
	});
}
