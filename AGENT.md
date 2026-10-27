# AGENT.md

Working notes for coding agents (and for people) changing the moncycle.app web app. The README says how to run it; the API it talks to
(MCA-backend-and-API) has its own AGENT.md, and its OpenAPI file is the contract: this repository keeps no copy. The calls of the app
are built with `moncycle_config.api_url(path)` from `src/config.json`; every path must be a path of that contract. Text a user reads
stays French, code and comments English. The app is a **wellbeing** application: no "health" wording, no identity.

## jQuery is deprecated

jQuery (`src/vendor/jquery.min.js`) stays in the project only until the existing code is migrated; it is **deprecated**.

- **Do not use jQuery in any new code**: no `$(...)`, no `$.ajax`/`$.get`, no jQuery plugin. Use plain JS: `document.querySelector`,
  `addEventListener`, `classList`, `hidden`, `textContent`, `append()`, `fetch` (through `moncycle_config.fetch`), `Array.prototype.map`.
- **When a change touches code that uses jQuery, migrate that code to plain JS in the same change**, within the scope of the task: the
  function, handler or block you edit, not the whole file. Do not leave a mix of both in one function. Keep the behaviour the same
  (the rules below still hold: user text through `textContent` or text nodes, never as HTML).
- Do not start a repository-wide rewrite on your own, and do not add jQuery back to a page that no longer loads it. When the last
  use is gone, the `jquery` dependency and its `<script>` tags can be removed.

## The web client

`src/js/`. The Content-Security-Policy is `script-src 'self'`:

- **No inline script and no inline handler anywhere.** Every page loads its own file with `defer` (`js/auth.js`, `js/register.js`,
  `js/settings.js`, `js/tableau.js`, `js/swagger-init.js`).
- **Nothing a user can store goes into the page as HTML.** Names, comments and labels go through `.text()`, `.val()` or text nodes
  (`settings_say()` for a server message). jQuery's `append(string)` reads a `<` or an entity in a string as HTML, so a text
  is `document.createTextNode()`. The terms of service (`TERMS_OF_SERVICE_URL`, `termsOfServiceUrl`) come from outside and are never read by
  the page: a sandboxed iframe (`sandbox` without `allow-scripts`, `referrerpolicy="no-referrer"`), and the CSP's `frame-src` names its
  origin. The news banner is a JSON file (`NEWS_URL`, the `newsUrl` of `GET /api/v2/server_info`): `js/news.js` (`moncycle_news.load`) fetches it
  (no cookie, no referrer), checks type, size, shape and the https link, and gives the French item, drawn with `.text()` only, by the
  timeline's banner and the settings' "Tech 4 Fertility actualités" panel; on any problem there is no item and the details go to the console. "OK merci" hides the article (its link) it was clicked on.
- **Forms carry the data, the script only submits it.** Every value sent to the remote API lives in an HTML `<form>` of the page: a
  visible field for what the user fills in, a hidden one (`<input type="hidden">`) for what the user need not know. The script catches
  the form's `submit` event (`preventDefault()`), reads the form, builds the JSON body, calls the API and shows the answer; it holds
  no value of its own that goes into the request. Where a page or function does not follow this yet (a body put together in the
  script, a click handler on a button that sends), bring it to this shape in the same change whenever the task touches that area, and
  do not copy the old pattern into new code. **One exception: the queue of `store.js`** (`data_pending`, `data_pending_descriptions`)
  is sent from localStorage, because localStorage survives a reload of the page and the form does not. What enters the queue still
  comes from a form's `submit`.
- **`store.js` is the local copy** (localStorage, in the API's own JSON): `data_day_YYYY-MM-DD`, `data_account` (the account of
  `GET /api/v2/account` plus the lists of cycles and pauses of the sync plus `newsUrl` of `server_info`), `data_account_etag`,
  `data_descriptions`, `data_pending` (the queue of unsent days), `data_pending_descriptions` (descriptions made here that the server
  has not created), `data_last_sync`, `data_version`. It runs the sync (`GET /api/v2/server_info` once for the version, `GET /api/v2/account`
  with its ETag, then `GET /api/v2/timeline_sync?since=`, one answer, not paged), the queue and its retries, and the end of the session
  (a 401 `unauthorized` empties all of localStorage through `moncycle_store.clear_storage()`, the one place that empties it; the
  sign-in, sign-up and settings pages call it too).
  - A day refused as late (409 `stale_write`) is dropped from the queue and downloaded again, like any refusal.
  - A description made in the day form is shown at once from `moncycle_store.all_descriptions()` (the server's list plus the unsent
    ones, which have no id); a chip stands for a description by its **name**, which is what a day carries it by.
  - It holds no text and draws nothing: `tableau.js` (the timeline) listens to its events (`changed`, `status`, `sent`, `failed`).
    `settings.js` only loads it, so that a 401 ends the session there too, and asks for a sync after a change.
  - Bump `moncycle_store.schema` when what is stored changes shape: copies of another schema are dropped. An update of the app
    (`moncycle_store.schema`, or the `appVersion` of `server_info`, changes) drops the copy and reloads the page. Neither a build nor a
    commit is in `server_info`: a server update that keeps `APP_VERSION` does not reach a page that is open.
  - Exports are fetched and saved as a blob (`moncycle_store.download()`): the API answers its errors in JSON.
- **A request to the API carries no cache-buster** (`cache: false` adds `_=...`, an unknown query parameter, which is refused).


- **`config.js` and `compat.js`** (added by the split): `config.js` reads `config.json` before the page's code runs (jQuery's ready is held),
  builds the API addresses, and in remote mode (the API on another origin) keeps the token (`auth_token`, outside the `data_*` copy) and
  sends it as `Authorization: Bearer`. `compat.js` compares the API's `appVersion` with the range of `version.json`; out of it, `store.js`
  sends nothing and keeps the queue and the copy.
