## Context

See proposal.md for motivation. `words.js` renders rows from `<template id="row-template">` with the word cell (`.v-word`, article badge from `articleBadge()`, hint line), translations, due, and an "Edit" button. `db.js` reads words only through `activeWords(pairId, ...)`, which adds `deleted_at is null`. Pages are listed in `vite.config.js` (`pages` array), and nav `current` is `n.id === page`. Words is not a `?id` page today; `?edit=<id>` opens the edit dialog.

## Goals / Non-Goals

**Goals:**
- Reuse the existing word rendering helpers (`articleBadge`, `wordLabel`) and the session and load-error patterns.

**Non-Goals:**
- Editing or deleting from the word page (Edit stays in the Words list).
- Plural, verb forms, notes, tags, card schedule or review history on the page (not asked for; easy to add later from the same row).
- Previous and next word navigation.

## Decisions

**Getter.** `db.js` gets `getWord(id)`: `supabase.from('words').select('*').eq('id', id).is('deleted_at', null).maybeSingle()`, returning the row or `null`. It does not filter by pair: RLS already limits rows to the caller, and an id link from Words always names the active pair. Alternative: reuse `activeWords(pairId)` and pass the pair; it adds a profile dependency for no gain on a single-pair app. Rejected.

**Malformed ids.** A pure `isWordId(value)` (UUID shape) in `src/js/lib/word-list.js` runs before the query, so `?id=abc` shows "Word not found" instead of a Postgres cast error that would look like a load failure. Unit-tested.

**Page.** `src/pages/word.html` (base layout, narrow column) holds a header with the "Back to words" link styled as a button with an `Esc` chip, sections for hint, part of speech, translations and examples, a "Word not found" section and a load-error section with "Retry". `src/js/pages/word.js`: `requireSetup()`, read `id`, `getWord`, fill with `textContent`, hide empty sections, set `document.title` to the word label. Escape calls `location.assign('/words.html')`. "Back to words" is a plain link to `/words.html`, not `history.back()`, so it works when the page was opened directly.

**Words marked current.** The `word` page id maps to the Words nav entry: nav entries get an optional `pages` list (`['words', 'word']`) and `current` is `n.id === page || n.pages?.includes(page)`. Alternative: no current link on the word page; the spec asks for Words marked.

**Row link.** The template's `.v-word` becomes an `<a class="v-word" href="/word.html?id=...">`, so keyboard and middle-click work. One `click` listener on `#rows` opens the row's link unless the click was on a button or a link, or text is selected. Alternative: a click handler per row without a link; not keyboard reachable. Rejected.

**Tests.**
- Unit: `isWordId`.
- E2E (`words.spec.js`): seed a noun with examples; click its translations cell, see the badge, hint, part of speech, translations and examples; press Escape, back on Words; "Edit" still opens the dialog; open a deleted word's id and `?id=abc`, see "Word not found".

## Risks / Trade-offs

- [Row click fires while selecting text in a row] → the listener ignores clicks when `getSelection()` is not collapsed.
- [Escape on the word page later conflicts with a dialog] → there is no dialog on the page; revisit if one is added.

## Migration Plan

No schema or function changes. Add `word` to the Vite `pages` list so the build emits `word.html`. Rollback is reverting the client files.
