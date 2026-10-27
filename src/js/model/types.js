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

/* The shapes of the contract (api/moncycle_app_open_api.yaml), as JSDoc types for the editor. No code. */

/**
 * @typedef {Object} ApiError  the "error" of an answer that failed
 * @property {string} code
 * @property {string} message
 * @property {{issues?: {field: string, code: string, message: string}[], captchaRequired?: boolean}} [details]
 */

/**
 * @typedef {Object} Account  GET /account, plus allCyclesFirstDay and allObservationPausedDates of GET /timeline_sync and newsUrl of GET /server_info
 * @property {number} userId
 * @property {string} nickname
 * @property {"cervicalMucus"|"fertilityCare"} method
 * @property {boolean} temperatureTracking
 * @property {boolean} timelineAscending
 * @property {string} [language]
 * @property {string[]} allCyclesFirstDay  newest first
 * @property {string[]} allObservationPausedDates  newest first
 */

/**
 * @typedef {Object} Day  one day, as the API gives it (a date with nothing stored is a full day with empty values)
 * @property {string} date  YYYY-MM-DD
 * @property {string|null} cycleStartDate
 * @property {number|null} cycleDay
 * @property {boolean} cycleFirstDay
 * @property {boolean} dayNotObserved
 * @property {"Red"|"Green"|"Yellow"|"White"|null} stampColor
 * @property {boolean} stampBaby
 * @property {boolean} isPeak
 * @property {number|null} counterStart
 * @property {boolean} sexUnion
 * @property {boolean} observationPaused
 * @property {string[]} freeMucusObservation
 * @property {string[]} freeMucusSensation
 * @property {string[]} freeOther
 * @property {number|null} temperature
 * @property {string|null} temperatureTime
 * @property {"Up"|"Down"|"Right"|null} codifiedArrow
 * @property {string} comment
 * @property {string|null} lastWriteClientUtc
 * @property {string|null} lastWriteDb
 */

/**
 * @typedef {Object} Description  a keyword of the days; `type` is "observation", "sensation" or "undefined"
 * @property {number|null} id  null for one made here that the server has not created yet
 * @property {string} name
 * @property {"observation"|"sensation"|"undefined"} type
 * @property {number} useCount
 */

/**
 * @typedef {Object} Cycle  a cycle as the timeline draws it
 * @property {string} start  first day, YYYY-MM-DD
 * @property {number} days
 */

export {};
