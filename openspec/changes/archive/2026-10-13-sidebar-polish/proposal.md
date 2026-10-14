## Why

The page does not fill the viewport: `html`/`body` are not full width, `.app` and `.focus` use a fixed `min-height: 800px`, so the sidebar stops short on tall screens and the Review key hints float mid-page. The menu also has no shortcuts beyond N for Add word, and the sidebar cannot be hidden.

## What Changes

- `html`, `body` and `.app` fill the viewport (width and height); the sidebar is sticky and reaches the bottom; `.focus` fills the viewport so its footer hints sit at the bottom.
- Every sidebar link gets an Alt+letter shortcut (Add word Alt+A, Words Alt+W, Settings Alt+S, plus Home and Review), matched with `event.code` so Mac option-key characters (for example Alt+S giving "ß") do not interfere. Shortcut chips (`v-key`) show next to each link.
- Add word focuses the term input on load.
- The sidebar is collapsible with a toggle button; collapsed, it shows only an icon per item. The state is kept per device in `localStorage`.
- Overrides live in `src/styles/main.css`; `design/` files are not edited.

## Capabilities

### New Capabilities

### Modified Capabilities
- `app-shell`: full-height sidebar, collapsible sidebar with icons, Alt+letter navigation shortcuts with chips, viewport-filling focus layout.
- `word-entry`: term input is focused when Add word opens.

## Impact

`src/styles/main.css`, `src/layouts/base.html`, `src/components/sidebar.html`, `src/js/lib/shortcut.js`, `src/js/lib/sidebar.js`, `vite.config.js` (nav data), `src/js/pages/add.js`, unit and e2e tests. No schema, edge function or dependency changes.
