## 1. Database

- [ ] 1.1 Add migration `supabase/migrations/<timestamp>_ai_suggestions.sql` (table, partial indexes on both keys, RLS enabled with no policies, `revoke all` from `anon` and `authenticated`, `ponytail:` note on candidate cleanup); verify `supabase db reset` applies it (Maks runs it)
- [ ] 1.2 Extend `tests/integration/rls.test.js`: alice and anon cannot select, insert, update or delete `ai_suggestions`; the service role can insert; verify Maks runs it green

## 2. Edge function

- [x] 2.1 Add `supabase/functions/autofill/cache.ts` with a pure `cacheKey(term)` and verify a unit test covers spaces, case, umlauts and ß
- [ ] 2.2 In `index.ts`, add the lookup before the cap (two `.eq()` queries, newest confirmed, errors treated as a miss), insert a candidate after a valid `ok` result (store failure still replies with senses and a null id), and extend `reply()` to `{status, senses, suggestion_id, confirmed}`; verify by the manual check in 4.2
- [ ] 2.3 Add the `{action: "confirm"}` branch (UUID and integer checks, range check against stored senses, update only where `status = 'candidate'`, no `ai_calls` row); verify with `curl` as alice: valid confirm, out-of-range index, unknown id, extra `senses` field ignored (Maks runs it)

## 3. Client

- [x] 3.1 In `src/js/lib/ai.js` pass `suggestionId` and `confirmed` through `suggest()` and add `confirmSuggestion(id, senseIndex)`; verify `tests/unit/ai.test.js` covers the new fields, confirm success, failure and timeout
- [x] 3.2 Add pure `matchesSense(value, sense)` to `src/js/lib/word-form.js`; verify `tests/unit/word-form.test.js` covers unchanged, each compared field changed, and notes and tags ignored
- [ ] 3.3 In `src/js/pages/add.js` track the picked sense index and suggestion, and after a successful save call `confirmSuggestion` without awaiting when the senses were a candidate and `matchesSense` holds; verify by the e2e in 4.1

## 4. End-to-end and manual checks

- [ ] 4.1 Extend `tests/e2e/autofill.spec.js` (stubbed function): unchanged pick sends one confirm with the stubbed id and index; edited pick sends none; `confirmed: true` response sends none; failing confirm still shows "Word saved"; Maks runs `npm test`
- [ ] 4.2 Manual with `supabase functions serve autofill`: request `Bank` as alice, save unchanged, request `bank ` as bob; bob's response has `confirmed: true`, the same senses, and no new `ai_calls` row; also check a hit is served when bob is over the cap

## 5. Docs

- [x] 5.1 Hand Maks the proposed CLAUDE.md and SPEC.md edits from design.md ("Proposed doc updates"); do not edit those files
