/* moncycle.app
**
** Copyright (C) 2021-2026 Tech 4 Fertility, aka. T4F (https://tech4fertility.org)
** SPDX-License-Identifier: AGPL-3.0-or-later
**
** https://www.moncycle.app
*/

/* The page of the terms of service for a language. server_info tells `termsOfServiceUrls` (an object, a lowercase language code to an https page,
** only the languages the server has a page for) and `termsOfServiceUrl` (the default page, English on the official instance). The page of the
** language asked for is used when there is one, else the default, else none (null). A new language needs nothing here: the server lists it. */
import { requested_language } from "./i18n.js";

const HTTPS = /^https:\/\//i;

export function terms_url(info, language = requested_language()) {
	const by_language = (info && typeof info.termsOfServiceUrls === "object" && info.termsOfServiceUrls) || {};
	const own = by_language[String(language).toLowerCase()];
	if (HTTPS.test(own || "")) return own;
	const fallback = info && info.termsOfServiceUrl;
	return HTTPS.test(fallback || "") ? fallback : null;
}
