# moncycle.app web app

The static web client of [moncycle.app](https://www.moncycle.app): HTML, CSS and JavaScript (plain JS modules, Chart.js), no build step in development. It talks to
the moncycle.app API, whose contract is `moncycle_app_open_api.yaml` **in the backend repository** (this repository keeps no copy). The
text of the pages is English by default, or French (`src/i18n/`; see `src/i18n/README.md` for how the language is chosen).

## Run it

```sh
npm ci                      # installs Chart.js and copies its dist file to src/vendor/ (postinstall)
npm run serve               # http://localhost:8080, routes are in the hash: http://localhost:8080/#/auth
node scripts/serve.mjs 8193 --api-url http://localhost:8003/api/v3   # try another API without editing config.json
npm test                    # node --test: compat rules and API address handling
npm run build               # the production build: src/ to dist/ (below)
```

## Where the API is: `src/config.json`

```json
{ "apiUrl": "/api/v3" }
```

`apiUrl` is the base URL of the contract, one of the `servers` of the OpenAPI file: `/api/v3` (the API of the same site, what the Docker
image serves) or a full link such as `https://tableau.moncycle.app/api/v3`. Always with the `/api/v3` part. Every call of the app is that
base plus a path of the contract (`/token`, `/day/2026-03-10`). A missing or invalid file falls back to `/api/v3` with a console warning.

- **Same origin:** the session is an HttpOnly cookie, as before.
- **Another origin ("remote"):** no cookie. The sign-in asks for the token alone, `js/config.js` keeps it in `localStorage`
  (`auth_token`) and sends `Authorization: Bearer` on every call; exports are fetched and saved as a blob. Logging out or a 401 empties
  the storage. The API's operator must allow the origin: `WEB_APP_ORIGINS` and CORS headers (backend README, "Remote web app").

## Production build

`npm run build` (`scripts/build.mjs`, esbuild) writes `dist/`, which the Docker image serves; `src/` stays what dev serves, as it is.

- `assets/main-<hash>.js`: the app, bundled from `js/main.js` and minified, with shared chunks, one chunk per screen and one for Chart.js
  (`assets/auto-<hash>.js`), loaded on demand. `assets/app-<hash>.css`: the stylesheets of `index.html`, in their order; the font they
  use is in `assets/` with a hash too. A hashed name changes with its content, so these files can be cached for good.
- `index.html` points at those files (and preloads the entry's chunk). What the app fetches by its name keeps it and is copied: the screens'
  markup, `i18n/*.json` (minified), `config.json`, `version.json` (byte for byte: run `scripts/stamp_version.mjs` first), `img/`, the favicons.
- No source map. The build fails on an esbuild warning, a file `index.html` or a screen points at that is missing, or an inline script or
  handler. The same sources give the same names.
- `node scripts/serve.mjs --root dist` serves it, `BUILT=1 npm run test:e2e` runs the end-to-end tests on it.

## Hosting it on its own static server

Copy `dist/` (after `npm ci` and `npm run build`; `src/` works too, unbundled) to any directory of any static host, an FTP space included: nothing to configure. The routes are in the hash
(`index.html#/auth`, `#/settings/notifications`) and every path in the code is relative to `index.html`, so the folder works at the root of a
host or in a sub-directory, with no rewrite and no `config.json` (the API is then `api/v3` of the same site; `config.json` points elsewhere).
The Content-Security-Policy of the image is a good start; for a remote API it needs the API origin in
`connect-src` (and `form-action`, `img-src data: blob:`). Set the API's `APP_URL` to the public URL of this site: it builds the links of the mails.

## Versions

`src/version.json` holds the web app's version (SemVer, `1.0.0dev`) and `api: {min, max}`, the range of API generations it was tested
with. The API tells its generation as `appVersion` in `GET /server_info` (`16`, `16dev`, `v16`; anything else, like a git describe form,
is "unknown" and never blocks).

- At run time (`js/store.js`, `js/compat.js`): out of the range, a notice stops the app, nothing is sent, and the queue and the local copy
  are left untouched.
- At build time: `node scripts/check_api_compat.mjs <backend>/www_data/constants.php` exits 1 when the backend is out of the range (the
  Docker build runs it).
- Policy: `api.max` is raised only after testing against that API; `api.min` is raised when the app relies on a new feature.
  `build` and `commit` are stamped by the image build.

## License

CC-BY-NC-SA-4.0, see `LICENSE`.
