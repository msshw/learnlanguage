## 1. Pure logic

- [x] 1.1 Add `usageSummary` to `supabase/functions/autofill/cost.ts` and verify a unit test covers zero, a typical month and rounding to 6 decimals
- [x] 1.2 Add `src/js/lib/settings.js` with `parseLimit` and `formatUsage`, and verify unit tests cover 0, 100, 101, -1, 2.5, empty, text, and the usage forms "$0.00", "less than $0.01", "$0.50 of $2.00"
- [x] 1.3 Add `localDate(now, tz)` to `time.js` and `src/js/lib/export.js` (`buildExport`, `exportFilename`), and verify unit tests cover the file shape, empty arrays, deleted words kept, and the filename date across the 04:00 boundary and a timezone edge
- [x] 1.4 Add `src/js/lib/error-bar.js` rules as a pure `shouldShow` plus the DOM installer, and `src/js/lib/shortcut.js` with a pure `isAddShortcut`; verify unit tests cover ignored ResizeObserver and "Script error." events, Alt+A on another page, on `/add.html`, with extra modifiers and with `event.key` "å"

## 2. Edge function and client calls

- [x] 2.1 Add the `{action: "usage"}` branch to `supabase/functions/autofill/index.ts` (session check first, shared month-spend read, no model call, no `ai_calls` row, `{status:"error"}` when unreadable) and verify with `curl` as alice returning `spent_usd` and `cap_usd` (Maks runs it)
- [x] 2.2 Add `getUsage` to `ai.js`, `updateProfileLimit` and `exportRows` to `db.js`; verify unit tests for `getUsage` (success, error status, throw, 8 s timeout) and that existing tests still pass

## 3. Settings page

- [x] 3.1 Build `settings.html` and `settings.js`: pair line, limit form with "Save limit" and Enter, usage line with Loading and Usage unavailable, export button with disabled state and inline error, "Sign out" with inline error; verify by the settings e2e in 6.2
- [x] 3.2 Update the `app-shell` expectations: remove the placeholder text and check the existing e2e specs still pass with the new Settings page

## 4. Layout features

- [x] 4.1 Add the error bar and shortcut imports to `base.html` (shortcut only with the sidebar), and verify by the e2e in 6.3 and the unit tests from 1.4
- [x] 4.2 Create `public/manifest.webmanifest`, `scripts/make-icons.mjs` (zlib PNG encoder) and run it once to produce `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`; verify a unit test reads the manifest fields and the PNG header dimensions
- [x] 4.3 Create `public/sw.js` and `src/js/lib/pwa.js`, link the manifest, theme color and apple-touch-icon in `base.html`, and register the worker in production builds only; verify `vite build` output contains `sw.js` and `manifest.webmanifest`, and Maks installs from Chrome on `vite preview`

## 5. Docs

- [x] 5.1 Note the Alt+A shortcut and the production-only worker in `docs/deploy.md` and list the SPEC.md edits Maks makes (password reset to "After the MVP", tick M3 and M4 acceptance criteria)

## 6. End-to-end

- [x] 6.1 Add a review e2e: seed three words with due cards through the service role, answer all correctly with the keyboard, reach the summary and check the logged answers; verify it passes (Maks runs it)
- [x] 6.2 Add a settings e2e: stubbed usage text, save the limit and reload, reject 101, export download parsed as JSON including a deleted word, sign out and redirect; verify it passes (Maks runs it)
- [x] 6.3 Add an error-bar e2e (a thrown error shows the bar once, Dismiss hides it), a shortcut e2e (Alt+A from Home and from Review), and a mobile e2e at 390 px width checking no horizontal page scroll on every page; verify they pass (Maks runs it)
