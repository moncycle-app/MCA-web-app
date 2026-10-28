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
import { state } from "/screens/timeline/state.js";

const $ = globalThis.$;

export function cycle2graph(id) {
	const temp_chart = new Chart($(`#canvas-c-${id}`), {
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
	state.graphs[id] = temp_chart;
}

export function graph_update(id) {
	let vide = true;
	for (let k in state.graph_data[id]) if (vide && !isNaN(state.graph_data[id][k])) vide = false;
	$("#graph-c-" + id).attr("vide", vide ? 1 : 0);
	if (vide) $("#graph-c-" + id).hide();
	else {
		if (!$("#contenu-c-" + id).is(":hidden")) $("#graph-c-" + id).show();
		state.graphs[id].data.datasets[0].data = state.graph_data[id];
		state.graphs[id].update();
	}
	if (!vide && (state.constante.nfp_method==1 || state.constante.nfp_method==4)) {
		state.graphs[id].data.datasets = state.graphs[id].data.datasets.slice(0,1);
		state.graphs[id].update();
	}
}

export function graph_preparation_data(data) {
	$.each(data, function(o_date, o_data) {
		if (state.graph_data[o_data.cycle] == undefined) state.graph_data[o_data.cycle] = {};
		let date = dates.parse(o_date);
		let label = date_short(date);
		state.graph_data[o_data.cycle][label] = parseFloat(o_data.temperature);
		if (state.graphs[o_data.cycle]) graph_update(o_data.cycle);
	});
}
