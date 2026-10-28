# Catalogs (src/i18n)

Every text a person reads comes from `fr.json` (French, the only catalog that ships, and the fallback for any language or key that is
missing). Nothing else holds a sentence: not the JavaScript, not the screens' HTML, except the two places a crawler or a browser
without script reads (the link preview of `index.html` and its `<noscript>` message).

## The format

A flat object, keys `screen.thing`: `timeline.cycle_title`, `settings.delete_confirm`, `common.error_unknown`, `calendar.months_short`.

| value | meaning |
|---|---|
| `"text {name}"` | `t(key, {name: ...})`. `{name}` is replaced; the text is plain, never HTML |
| `{"one": "...", "other": "..."}` | a plural: `t(key, {count: n})` picks the form with `Intl.PluralRules(meta.locale)`. Other categories (`zero`, `two`, `few`, `many`) are allowed |
| `["jan", "fév", ...]` | a list (`calendar.months_short`, `months_long`, `weekdays`), read with `t_list(key)` |
| `"key._comment"` | a note for translators about `key`; never shown |

A group of keys under a prefix is read as a lookup by `t_map("settings.export_errors")` (the last part of the key is the API's error code).
Markup inside a sentence: the key holds `{end}` and the code gives `t_node(key, {end: node})` the element to put there. In a screen's
HTML, a `data-i18n="key"` element lists its inline children with `data-slot="name"`: they take the place of `{name}`.

`meta.locale` (`fr-FR`) is the locale of numbers (`Intl.NumberFormat`). Dates are not formatted by `Intl`: the names and the layouts are
catalog entries (`calendar.date_short` is `{day} {month}`), so the output is the app's own.

Not language, so not here: CSS class names, element ids, form field names, FertilityCare codes (`VL`, `10KL`, `X1`).

## In the markup

- `data-i18n="key"` sets the text of the element. Leave the element empty.
- `data-i18n-attr="placeholder:key;title:key;value:key"` sets attributes (`placeholder`, `title`, `alt`, `aria-label`, the `value` of a button).

`i18n.apply(root)` fills them; the page does it once the catalog is read, and again when the language changes.

## Adding a language

1. Copy `fr.json` to `<code>.json` (lower case, as in `en.json`) and translate the values. Keep every key and every `{placeholder}`.
   Give each plural the forms its language needs. Set `meta.locale` (`en-US`). Keep the calendar layouts and names in your language.
2. That is all: `languages.json` already lists the seven languages of the API with their endonyms (the same in every language), and the
   language is chosen from the account, the sign-up form, then the browser (`i18n.resolve_language`). A key missing from your file shows
   the French text.
3. `npm test` checks that `fr.json` and the code agree (every key used exists, none is unused). Check your file with the same keys.
