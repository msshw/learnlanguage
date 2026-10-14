# DESIGN.md

The visual design for Vocab. `design/tokens.css` holds every colour, font, spacing and radius value plus the app shell layout. `design/components.css` holds the component classes (`v-*`). Use these two files as the only source of visual values; don't hard-code colours or sizes elsewhere.

## Look

Soft and friendly. Warm paper surfaces, rounded shapes, one calm green (`--primary`) for actions, German words set large in Fraunces (a soft serif), UI text in Figtree. Light and dark follow the system setting.

## Rules

- One primary button per screen (`v-btn--primary`). Other actions: `v-btn--secondary` or `v-btn--ghost`; destructive: `v-btn--danger` with a confirm step.
- German nouns always show their article. In lists and pickers use the article badge (`v-art v-art--der|die|das`); on the review card colour the article text (`v-art-text--die`). The article word is always printed, so colour is never the only signal.
- Ratings and feedback reuse the article colours: Again = die (rose), Hard = das (amber), Good = primary (green), Easy = der (blue). Each rating always shows its label and key number.
- Every shortcut is shown as a `v-key` chip next to its action.
- Focus: 2px solid `--focus` ring, 2px offset, on every interactive element (already in components.css).
- Copy follows CLAUDE.md: sentence case, no em dashes, imperative buttons. Dates are relative where possible (Today, Tomorrow, In 4 days).

## Screens

**App shell (Home, Add word, Words, Settings).** `.app` row: `nav.v-sidebar` (232px, `--surface-sunken`) then `main.app-main` with `.app-inner` (max 880px, centred; 640px for Add word and Settings). Sidebar: `v-brand` ("V" mark + Vocab), then `v-nav` links; the current page has `aria-current="page"`; Review shows a `v-count` pill with due cards (hidden at 0); Add word shows its `N` key. Page title: `h1.page-title`.

**Review (focus mode).** No sidebar. `.focus` grid: top bar (`.focus-top`: ghost "End session" with Esc, `v-progress` bar, "Card 2 of 3"), body (`.focus-body`, card max 560px centred), footer key hints (`.focus-foot`).
- Prompt: `v-card v-review` with direction label (`v-review__dir`, plus `hint_en` on EN→DE, e.g. "English → German · bench (seat)"), the word (`h1.v-review__word`), part of speech (`v-review__meta`), `v-input v-input--answer`, primary "Check answer" with Enter.
- Feedback: the typed answer shown struck through when wrong, a `v-feedback` panel (`--good` "Correct" / "Correct, with a typo"; `--hard` "Right word, wrong article"; `--again` "Not quite") whose body repeats the full answer with article, plural and example sentence, then `v-rating` with four `v-rate` buttons (key, label, next interval as `<small>`), the grader's choice `aria-pressed="true"`, then primary "Next card" with Enter.
- Summary: card with `page-title` "All done for today!", next due time, three stat tiles (Reviewed / Remembered / To watch), a "Words to watch" list (cards rated Again or Hard this session, each with the reason), primary "Back home" and secondary "Add word".

**Home.** `page-title` greeting ("Good evening, Maks", by time of day), a large card with today's date, the due count in display type (64px), primary "Start review" with Enter and ghost "Add word" with N. Below, two small stat cards: words in vocabulary, new words today ("0 of 10"). Nothing due: the card says "All done for today" with the next due time, and Add word becomes primary.

**Add word.** Input with a secondary "Suggest" button (Enter). AI senses as `v-sense` options in a radiogroup (number key picks one), then a `v-card` with the editable fields (article, translations, plural, hint for English → German, verb forms when a verb) and primary "Save word". AI unavailable: no sense list, empty fields.

**Words.** Title with count, primary "Add word"; full-width search input; `v-card` holding `v-table`: word (`v-word` with badge, `hint_en` under it as `v-hint`), translations, next due (relative, `v-due`), ghost "Edit". Delete moves into the edit view (danger button + confirm).

**Settings.** Two `v-card` lists of rows (label + `v-hint` on the left, control on the right): language pair, new words per day (input + secondary Save), AI usage (text + `v-progress`), export (secondary), account (email + ghost Sign out).

**Sign in.** No sidebar. A centred column (max 400px) on `--surface`: a larger `v-brand` above a `v-card` form with `page-title` "Welcome back", a `v-hint` line, Email and Password as `v-field`, a full-width primary "Sign in" (large), and a "Forgot your password?" link. A failed sign-in shows a `v-feedback--again` panel above the button: "Email or password is wrong" / "Check both and try again."

**Setup.** Same centred layout (max 440px): `page-title` "Let's set you up", hint "You can change this later in Settings.", "I'm learning" as a selected `v-sense` option (Deutsch / German), "I speak" as a select styled with `v-input` and a hint, then a full-width primary "Start learning".
