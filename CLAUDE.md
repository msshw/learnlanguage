# CLAUDE.md

Personal vocabulary trainer for a language you learn from your own (German ← English first): typed reviews on an FSRS schedule, with AI auto-fill when adding words. `SPEC.md` is the source of truth. Work on one milestone at a time (SPEC.md §8).

## How to work

- Before writing code, read the SPEC.md sections the current milestone touches.
- Stay inside the current milestone. Do not build features from later milestones or "After the MVP".
- Run the checks yourself: `npm test`, the build, `supabase db reset`, `supabase functions serve` and curl checks against local functions. Maks reviews the result in the browser as a user and product manager. Ask him only for what you cannot do (a browser check, a secret, an interactive login).
- Delegate runs to a subagent on the cheapest model that fits (haiku for running commands and reporting output, sonnet to diagnose a failure). The subagent reports the commands run, pass/fail counts and exact error text, and does not edit code unless asked. Do not stub or skip a failing check to make it pass.
- The Supabase CLI is installed with Homebrew (`supabase ...`); `npx supabase ...` also works and runs the version pinned in `package.json`. Allowed check commands are listed in `.claude/settings.json`.
- Checks run against local Supabase only. Never run them against a cloud project, and never print secrets.
- Before changing code that has been revised several times, first report its current actual state, then change it.
- If the spec is ambiguous or conflicts with existing code, stop and ask. Never edit SPEC.md; propose the change instead.
- Do not add dependencies beyond those named in SPEC.md without asking.

## Specs and docs

- `SPEC.md` is the product spec. `openspec/specs/` holds one spec per capability and is the source of truth for current behaviour. Read the relevant capability spec before changing behaviour.
- Plan a behaviour change as an OpenSpec change (`openspec/changes/<name>`: proposal, specs, design, tasks), apply it, then archive it. Archiving syncs the change's specs into `openspec/specs/`, so do not archive before the work is done.
- When a change alters the data model, an AI contract or an architecture rule, list the matching SPEC.md or CLAUDE.md edits under "Proposed doc updates" in its `design.md`. Maks approves them; only then are they applied.
- `docs/` is for operational steps (deploy, local setup), not behaviour rules.

## Stack

- Client: vanilla JS (ES modules), HTML, CSS. No framework, no TypeScript on the client.
- Build: Vite multi-page, an HTML partials plugin for `src/layouts` and `src/components`, Tailwind as a Vite plugin.
- Backend: Supabase (Postgres, auth, edge functions in TypeScript on Deno), `supabase-js`.
- Scheduling: `ts-fsrs`, default parameters.
- Tests: Vitest (unit), Playwright (end-to-end against local Supabase, autofill stubbed).

Commands (for reference; Maks runs them):

- `npm run dev`: Vite dev server
- `npm test`: unit and end-to-end tests
- `supabase start` / `supabase db reset`: local Supabase, reapply migrations and seed
- `supabase functions serve autofill`: local edge function

## Architecture rules

- `src/js/lib/scheduler.js`, `grader.js`, `queue.js`, `practice-queue.js`, `practice.js`, `languages.js` and `time.js` are pure: no DOM, no network, no `Date.now()` inside. Pass `now` in.
- Only `db.js` imports `supabase-js`. Pages go through `lib`, never query directly.
- `src/js/lib/languages.js` is a copy of `supabase/functions/_shared/languages.ts`; change both, a unit test keeps them equal.
- Only `ai.js` calls AI, and only through the AI edge functions (`autofill`, `check-sentence`). Never call the Anthropic API from the client.
- Admin actions on shared suggestions go only through the `admin` edge function, which checks `is_admin` on every request.
- No secrets in the repo or the client bundle. `ANTHROPIC_API_KEY` lives in Supabase function secrets only.
- Model ID and per-token prices live in one config constant, `supabase/functions/_shared/config.ts`.
- Page modules: check session, load data through `lib`, render with DOM APIs and `<template>` elements.
- Insert user content with `textContent`, never `innerHTML`.

## Data rules

- Every table has `user_id` and RLS (`user_id = auth.uid()`), except `ai_suggestions` and `rejected_senses`: shared, no `user_id`, RLS on with no policies, service role only (the `autofill`, `check-sentence` and `admin` functions).
- A language pair's languages never change after creation; functions take a pair only from the database and accept only pairs in the supported list.
- No client DELETE on any table. Words use `deleted_at`; every query on words excludes deleted rows.
- `review_logs` is append-only.
- Schema changes go in a new migration file. Never edit a migration that has been applied.
- Timestamps are stored in UTC. "Today" always comes from `time.js` (profile timezone, 04:00 rollover).

## UI

- Desktop-first, keyboard-first: every Review action works from the keyboard. Mobile only needs to be usable.
- Minimal and quiet: muted colors, generous spacing, no decoration.

## UI copy

- Sentence case everywhere; no title case.
- No em dashes.
- Imperative button labels ("Save word", "Start review"); never a question as a button label.
- Plain, specific words. No hype or filler vocabulary, no forced lists of three.
