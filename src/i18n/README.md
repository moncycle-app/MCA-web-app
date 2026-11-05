# Catalogs (src/i18n)

Every text a person reads comes from a catalog: `en.json` (English, the default, and the fallback for any language or key that is
missing) or `fr.json` (French). Nothing else holds a sentence: not the JavaScript, not the screens' HTML, except the two places a crawler or a browser
without script reads (the link preview of `index.html` and its `<noscript>` message).

## The format

A flat object. Keys are English names, `screen.thing`, describing what the text is for (never a slice of its French wording): `timeline.cycle_title`, `settings.delete_confirm`, `common.error_unknown`, `calendar.weekdays`.

| value | meaning |
|---|---|
| `"text {name}"` | `t(key, {name: ...})`. `{name}` is replaced; the text is plain, never HTML |
| `{"one": "...", "other": "..."}` | a plural: `t(key, {count: n})` picks the form with `Intl.PluralRules(meta.locale)`. Other categories (`zero`, `two`, `few`, `many`) are allowed |
| `["jan", "fév", ...]` | a list (`calendar.weekdays`), read with `t_list(key)` |
| `"key._comment"` | a note for translators about `key`; never shown |

A group of keys under a prefix is read as a lookup by `t_map("settings.export_errors")` (the last part of the key is the API's error code).
Markup inside a sentence: the key holds `{end}` and the code gives `t_node(key, {end: node})` the element to put there. In a screen's
HTML, a `data-i18n="key"` element lists its inline children with `data-slot="name"`: they take the place of `{name}`.

`meta.locale` (`en-GB`, `fr-FR`) is the locale of numbers (`Intl.NumberFormat`). Dates are not formatted by `Intl`: the catalog holds the weekday names, the months (long and on 3 letters) and the layouts of the long date
(`calendar.date_long_day_first`, `calendar.date_long_month_first`), and `js/model/format.js` builds the compact date (`M 3 NOV`) and the long one
(`Mardi 3 novembre 2026`) in the order of the account's `dateOrder`, not the language's. No numeric date is shown; a date field is the browser's own `type="date"`.

Not language, so not here: CSS class names, element ids, form field names, FertilityCare codes (`VL`, `10KL`, `X1`).

## In the markup

- `data-i18n="key"` sets the text of the element. Leave the element empty.
- `data-i18n-attr="placeholder:key;title:key;value:key"` sets attributes (`placeholder`, `title`, `alt`, `aria-label`, the `value` of a button).

`i18n.apply(root)` fills them; the page does it once the catalog is read, and again when the language changes.

## Which language is shown

Only the languages in `LANGUAGES` (`js/core/i18n.js`: `EN`, `FR`) are offered; they are codes of the API, which knows seven (`EN FR ES DE
IT PL PT`) and stores one per account. English is the default.

- **Sign-up** (`/register`): the first field of the form is the language select. It starts on the language in use, which is the first of
  `navigator.languages` that we have, else English. Choosing one changes the screen at once and is what `POST /register` carries.
- **Not signed in** (`/auth`, `/verify_email`): the same language, with a select at the bottom of the screen. The choice lasts until the page
  is loaded again, and carries over to the other screens of the visit (sign-in to sign-up).
- **Signed in**: the language of the account (`language` of `GET /account`, from the local copy at once, then from the sync). An account in a
  language we have no catalog for (`ES`...) is read in the browser's language, else English. The language select is in the settings
  ("Mon suivi" / "About you"): it saves with `POST /account` and the screen is drawn again in the new language.

## Adding a language

1. Copy `en.json` to `<code>.json` (lower case) and translate the values. Keep every key and every `{placeholder}`.
   Give each plural the forms its language needs. Set `meta.locale` (`es-ES`). Keep the calendar layouts and names in your language.
2. Add its code to `LANGUAGES` in `js/core/i18n.js`. `languages.json` already holds the name of each of the seven languages of the API in
   that language (the same in every language); the selects read it. A key missing from your file shows the English text.
3. `npm test` checks that the catalogs and the code agree (every key used exists in `en.json` and `fr.json`, none is unused, both have the
   same keys). Add your file to that test.
