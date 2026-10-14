## Why

The app now supports native languages other than English (Russian at launch), but its interface is English only. A user whose native language is Russian should read the whole interface in Russian, the same language the AI already uses for translations and feedback.

## What Changes

- The interface language follows the active pair's native language, for every native language in the supported list (`en` and `ru` at launch). Switching pairs switches the interface.
- Before a pair exists (sign-in, setup): sign-in uses the browser language when it is a supported native language, otherwise English. Setup re-renders live in the chosen native language.
- All user-facing text on non-admin pages comes from per-language dictionaries (static HTML text and text set from JS). English is the fallback for a missing key.
- Language names in pickers and the switcher are shown in the interface language.
- Counts that change wording (words, cards, days) use plural rules of the interface language.
- `<html lang>` follows the interface language.
- A unit test keeps all dictionaries on the same keys and placeholders, so a new native language cannot ship half translated.
- Out of scope: admin pages, error messages returned by edge functions (they stay English until a proper UI error handling change), AI output (already in the native language).

## Capabilities

### New Capabilities
- `ui-language`: how the interface language is chosen, what is translated, fallback, plurals and the dictionary parity rule.

### Modified Capabilities

None. Setup's live re-render is stated in `ui-language`; no existing requirement text changes.

## Impact

- New pure module `src/js/lib/i18n.js` (`t`, plural helper, language pick) and dictionaries `src/js/lib/i18n/en.js`, `ru.js`.
- Every non-admin page module and the partials (`sidebar.html`, `word-form.html`) move their text to dictionary keys.
- `base.html` `lang` attribute set at runtime; last language cached in `localStorage` to avoid a flash.
- CLAUDE.md and SPEC.md get a short rule and note (see design.md, approved by Maks).
- No schema change, no new dependency.
