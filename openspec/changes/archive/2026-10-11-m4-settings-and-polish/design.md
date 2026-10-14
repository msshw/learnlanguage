## Context

See proposal.md for motivation. Settings is a stub page; `signOut()` exists in `auth.js` without a button. `profiles` already allows an owner update (`new_words_per_day int check >= 0`). The month's AI cost is computed in the `autofill` function (`cost.ts`, token sums from `ai_usage_since`, prices in `config.ts`); the client cannot see prices. `vite.config.js` already sets `publicDir` to `../../public`, which does not exist yet. The base layout is the single place every page shares. Review ids for e2e: `answer`, `check`, `ratings`, `continue`, `view-summary`.

## Goals / Non-Goals

**Goals:**
- Every new behavior that is pure logic (limit parsing, usage text, export building, usage summary) is unit-tested.
- Layout-level features (error bar, shortcut, worker registration, manifest) are added once, in the base layout.

**Non-Goals:**
- Offline review, push notifications, update prompts for the service worker.
- Password reset, changing the language pair, timezone setting.
- Real icon artwork (placeholders only).

## Decisions

**Usage through the existing function.** `autofill` branches on `body.action === 'usage'` before the term checks, after the session check. A pure `usageSummary(inputTokens, outputTokens)` in `cost.ts` returns `{spent_usd, cap_usd}` (spend rounded to 6 decimals), and the month's spend read is extracted from the cap check so both paths share it. Alternative was a `cost_usd` column on `ai_calls`: it would put money in two places (tokens for the cap, cost for display). Rejected. A client-side token sum with copied prices would break the one-price-constant rule. Rejected.

**Client usage call.** `ai.js` gets `getUsage({invoke, timeoutMs = 8000})`, built like `suggest`, returning `{spent, cap}` or `null`. It reuses `invokeAutofill`. `settings.js` (a pure lib file, `src/js/lib/settings.js`) holds `parseLimit(raw)` and `formatUsage(spent, cap)`.

**Limit save.** `db.js` gets `updateProfileLimit(limit)` updating `new_words_per_day` for the current user. No migration: the profile update policy and the check constraint already exist. `parseLimit` accepts only whole numbers 0 to 100, and the number input also has `min`, `max`, `step`.

**Export.** `db.js` gets `exportRows()` that reads words (no deleted filter, deliberately separate from `activeWords`), cards and review_logs, each through `fetchAll` ordered by `id`, all three in one `Promise.all` so a failure anywhere throws before anything downloads. `export.js` (pure) has `buildExport(rows, now)` returning the object and `exportFilename(now, tz)` using the profile-timezone date. For that date, `time.js` gets one pure `localDate(now, tz)` (`YYYY-MM-DD`), unit-tested. The download uses a Blob, an object URL, an anchor with `download`, then revoke.

**Service worker.** `public/sw.js` with a `CACHE` version constant. `install`: `skipWaiting`. `activate`: delete every other cache, `clients.claim`. `fetch`: ignore non-GET and cross-origin; `/assets/` paths cache-first; all else network-first, store OK responses, fall back to the cache. Registered by `src/js/lib/pwa.js` only when `import.meta.env.PROD`. Page URLs are `/index`-less (`/`, `/words.html`), so navigation fallback is by exact request, which is enough for a shell cache. Alternative of precaching a build manifest needs a plugin; rejected as a new dependency.

**Manifest and icons.** `public/manifest.webmanifest`, linked from `base.html` with `theme-color` and an apple-touch-icon. `scripts/make-icons.mjs` writes `icon-192.png`, `icon-512.png` and `icon-maskable-512.png` using Node's `zlib` and a tiny PNG encoder (solid stone background with a simple "V" mark), run once by hand and the PNGs committed. A unit test checks manifest fields and reads PNG headers for dimensions.

**Error bar.** `error-bar.js` installs `error` and `unhandledrejection` listeners on import and builds the bar with DOM APIs (single element, reused). It ignores `error` events with no `error` object and messages starting with `ResizeObserver`. Imported from `base.html`, so it also covers sign-in and Setup. A pure `shouldShow(event)` carries the ignore rules and is unit-tested.

**Data load failure.** `showLoadError()` already implements the behavior and is used by `requireSetup` and `setup.js`; this change only specs it. `settings.js` page uses `requireSetup`, so it inherits it.

**Shortcut.** `shortcut.js` imported by `base.html` only when the sidebar shows (`{{#unless nosidebar}}`). Keydown: `event.altKey && event.code === 'KeyA'` with ctrl, meta and shift all false, and not already on `/add.html`; then `preventDefault()` and `location.assign('/add.html')`. `event.code` keeps it working on a Mac, where Option+A types "å" as `event.key`. A pure `isAddShortcut(event, pathname)` is unit-tested. Setup is marked `nosidebar`, so it is excluded.

**Tests.**
- Unit: `settings` lib (limit, usage text), `export`, `time.localDate`, `cost.usageSummary`, `ai.getUsage` (fake timers), error-bar `shouldShow`, shortcut predicate, manifest and icons.
- E2E: a review spec seeds three words through the service role with due cards, types the right answers, accepts the default ratings, and reaches the summary; a settings spec stubs the function for usage, saves a limit and reloads, rejects 101, downloads the export and parses it (a deleted word included), signs out and checks a protected page redirects; an error-bar spec throws from page script; a mobile spec at 390 px checks no page scrolls sideways.
- Manual (Maks): install from Chrome on `vite build` plus `vite preview`, look at the app on a phone.

## Risks / Trade-offs

- Stale shell after a deploy → HTML is network-first and the cache version is bumped by hand when `sw.js` changes; hashed assets cannot go stale.
- Service worker breaks the dev flow → registered in production builds only.
- Placeholder icons look rough → the manifest paths stay fixed, so replacing the three files is enough.
- Error bar noise → ignore rules plus a single reused bar; handled errors never reach it.
- Export of a very large account is built in memory → fine at personal scale (tens of thousands of rows); the `ponytail:` note marks the ceiling.
- Alt+A could collide with a browser or OS shortcut on some systems → it is one constant in `shortcut.js`.

## Migration Plan

No database changes. Deploy order when the cloud deploy resumes: function first (usage action), then the site. Rollback: remove the worker registration and bump the cache version to purge, which also needs a worker that unregisters itself; keep that in mind before shipping a broken worker.
