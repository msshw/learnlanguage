## Context

See proposal.md for motivation. Current state:

- `design/tokens.css` sets `.app`, `.app .v-sidebar` and `.focus` to `min-height: 800px` and switches the sidebar to a wrapping row below 721px. `design/` is not edited, so every override goes in `src/styles/main.css`, which imports the design files first.
- Nav data lives in `vite.config.js` (`nav` array: id, href, label, `key: 'N'` on Add word, `dueCount` on Review) and is rendered by `src/components/sidebar.html` (`.v-nav` links, `.v-key` chip, `#nav-due` pill).
- `src/js/lib/shortcut.js` has a pure `isAddShortcut(event, pathname)` (Alt+A by `event.code`, N outside fields and dialogs) and `installShortcut()`, imported by `base.html` only when the page has the sidebar. Review, sign-in and Setup are `nosidebar`, so no shortcut runs there. The main `app-shell` spec still has a Review scenario for Alt+A that the code never served; this change drops it.
- Add word: `add.html` has `autofocus` on `#term-input`, but `<body>` is `hidden` until `requireSetup()` reveals it, so autofocus fires on a hidden element and is lost. `add.js` only calls `termInput.focus()` inside `showTermStep()`, which is not run on load.

## Goals / Non-Goals

**Goals:**
- One source for nav items, letters and icons (`vite.config.js`), used by the markup, the chips and the key handler.
- Shortcut matching stays a pure, unit-tested function.

**Non-Goals:**
- Focus outline restyling (dropped by Maks).
- A top menu or collapse behavior on phones; the existing narrow layout stays.
- Configurable shortcut letters.

## Decisions

**Nav data carries the shortcut.** Each `nav` entry gets `code` (`KeyH`, `KeyR`, `KeyA`, `KeyW`, `KeyS`), `chip` (`Alt+H` ...) and `icon` (one SVG path string). `sidebar.html` renders `data-code`, `aria-keyshortcuts` (`Alt+A N` for Add word), the chip, an inline `<svg aria-hidden="true"><path d="{{icon}}"/></svg>` and the label in its own span. Alternative: one partial per icon with dynamic partial lookup; more files for the same result. Rejected. An icon library would be a new dependency. Rejected.

**Matching by `event.code`.** `shortcut.js` gets a pure `shortcutTarget(event, pathname, links)` where `links` is `[{code, href}]` read from the sidebar's `data-code` attributes. Alt with no Ctrl, Meta or Shift and a matching code returns the href unless it is the current path; plain `KeyN` with no modifier, outside fields and dialogs, returns `/add.html`. `installShortcut()` calls `preventDefault()` and `location.assign()` on a hit. `event.code` ignores what Option types on a Mac ("ß", "å", "∑"). `isAddShortcut` is replaced and its tests are rewritten for the new function.

**Alt shortcuts also work inside fields.** Same as Alt+A today. On a Mac this means Option+S cannot type "ß" in a field on a sidebar page (Add word, Words search and edit dialog). Maks accepted checking this in the browser; see Risks.

**Full-height layout in `main.css`.** `html, body { margin: 0; min-height: 100%; }`, `.app { min-height: 100dvh; }`, `.focus { min-height: 100dvh; }`. Above 720px only: `.app .v-sidebar { position: sticky; top: 0; height: 100dvh; min-height: 0; overflow-y: auto; }`. `dvh` avoids the mobile URL bar jump; `100vh` is the fallback line before it.

**Collapse state.** `sidebar.js` gets `installSidebarToggle()`: reads `localStorage['sidebar-collapsed']` in try/catch, sets `is-collapsed` on `.v-sidebar` and `aria-expanded` on the toggle, and writes on click (also in try/catch). The toggle is a `<button>` at the bottom of the sidebar (`margin-top: auto`) with `aria-label` "Collapse sidebar" or "Expand sidebar" and a chevron icon. Collapsed CSS: sidebar width 64px, labels visually hidden (still the accessible name), brand text hidden, due pill as a small badge on the icon. The toggle is hidden below 721px. Body stays hidden until the session check, so applying the class on load causes no flash. Alternative: a cookie or profile column; per device is what Maks asked for. Rejected.

**Shortcut chip as hover tooltip.** The `.v-key` chip stays in the markup (`aria-hidden`, so it is not read twice; `aria-keyshortcuts` carries the shortcut) but is `display: none` until `.v-nav:hover` or `.v-nav:focus-visible`, then it is absolutely positioned to the right of the link, outside the sidebar, using the chip look plus `--surface-raised` and `--shadow-press`. Pure CSS, no JS. The sidebar's `overflow-y: auto` would clip it, so it is removed (five links; the sticky sidebar gets `z-index` to sit above the main area). Collapsed, the chip gets the label via `data-label` and a `::before`, replacing the native `title` tooltip, which is removed from the links so two tooltips never show. Below 721px the tooltip is hidden. Alternative: JS-positioned tooltip; more code for the same result. Rejected.

**Term field focus.** `add.js` calls `termInput.focus()` once after `requireSetup()` resolves (the body is visible by then). The `autofocus` attribute stays for the case where the body is already visible.

**Tests.**
- Unit: `shortcutTarget` for each letter, "ß" as `event.key` with `KeyS`, current page, extra modifiers, N in and out of a field and a dialog.
- E2E (`polish.spec.js`): Alt+W from Home; Alt+H with the Words search focused leaves the field empty; collapse on Home, open Words, still collapsed, expand; sidebar bottom equals the viewport height on a tall window and after scrolling Words; Review footer bottom equals the viewport height; Add word input is `document.activeElement` after load and after Alt+A.

## Risks / Trade-offs

- [Option+S cannot type "ß" in fields on sidebar pages on a Mac] → Maks checks in the browser. If it gets in the way, the fix is one line in `shortcutTarget` (ignore Alt shortcuts inside fields except Alt+A); it would change the spec scenario "While typing in a field".
- [Alt+letter opens the menu bar in some Windows and Linux browsers] → `preventDefault()` on keydown covers Chrome and Edge; Firefox may still flash its menu on Alt release. Accepted for a desktop Mac-first user.
- [Sticky sidebar taller than short windows] → five links and a toggle need about 330px; a window shorter than that cuts the toggle off, since the sidebar no longer scrolls (needed so the tooltip is not clipped). Accepted.
- [Design files drift from the overrides] → each override in `main.css` has a one-line comment naming the `design/` rule it replaces.

## Migration Plan

No database or function changes. Ship with the site. Rollback is reverting the client files.
