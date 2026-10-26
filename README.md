# moncycle.app web app

The static web client of [moncycle.app](https://www.moncycle.app): HTML, CSS and JavaScript (jQuery, Chart.js), no build step. It talks to
the moncycle.app API, whose contract is `moncycle_app_open_api.yaml` **in the backend repository** (this repository keeps no copy). The
text of the pages is French.

## Run it

```sh
npm ci                      # installs jQuery and Chart.js and copies their dist files to src/vendor/ (postinstall)
npm run serve               # http://localhost:8080, extension-less addresses (/auth) work
node scripts/serve.mjs 8193 --api-url http://localhost:8003/api/v2   # try another API without editing config.json
npm test                    # node --test: compat rules and API address handling
```

## Where the API is: `src/config.json`

```json
{ "apiUrl": "/api/v2" }
```

`apiUrl` is the base URL of the contract, one of the `servers` of the OpenAPI file: `/api/v2` (the API of the same site, what the Docker
image serves) or a full link such as `https://tableau.moncycle.app/api/v2`. Always with the `/api/v2` part. Every call of the app is that
base plus a path of the contract (`/token`, `/day/2026-03-10`). A missing or invalid file falls back to `/api/v2` with a console warning.

- **Same origin:** the session is an HttpOnly cookie, as before.
- **Another origin ("remote"):** no cookie. The sign-in asks for the token alone, `js/config.js` keeps it in `localStorage`
  (`auth_token`) and sends `Authorization: Bearer` on every call; exports are fetched and saved as a blob. Logging out or a 401 empties
  the storage. The API's operator must allow the origin: `WEB_APP_ORIGINS` and CORS headers (backend README, "Remote web app").

## Hosting it on its own static server

Serve `src/` (after `npm ci`) from the root of a host: addresses are absolute (`/auth`). Map `/auth` to `auth.html` (nginx:
`try_files $uri $uri.html =404;`). The Content-Security-Policy of the image is a good start; for a remote API it needs the API origin in
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
