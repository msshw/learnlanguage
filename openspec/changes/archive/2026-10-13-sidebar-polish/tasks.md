## 1. Shortcuts

- [x] 1.1 Replace `isAddShortcut` in `src/js/lib/shortcut.js` with a pure `shortcutTarget(event, pathname, links)` and make `installShortcut()` read the links from the sidebar's `data-code` attributes; verify by rewriting the shortcut unit tests in `tests/unit/layout-features.test.js` for every letter, `event.key` "ß" with `KeyS`, the current page, extra modifiers, and N inside and outside a field and a dialog
- [x] 1.2 Add `code`, `chip` and `icon` to each `nav` entry in `vite.config.js` and render `data-code`, `aria-keyshortcuts`, the chip, the inline SVG icon and a label span in `src/components/sidebar.html`; verify the built HTML of Home shows five chips and five icons

## 2. Layout

- [x] 2.1 Add the full-height overrides to `src/styles/main.css` (`html`, `body`, `.app`, `.focus`, sticky `.v-sidebar` above 720px), each with a comment naming the `design/tokens.css` rule it replaces; verify by the layout e2e in 4.1
- [x] 2.2 Add the collapsed sidebar styles (64px column, hidden labels kept as accessible names, hidden chips and brand text, due pill badge, toggle hidden below 721px) to `src/styles/main.css`; verify by the collapse e2e in 4.1

- [x] 2.3 Show the Alt chip only as a right-side hover and focus-visible tooltip (label included when collapsed): `sidebar.html` (drop `title`, `data-label` on the chip), `main.css` (no `overflow-y` on the sidebar); verify by the tooltip e2e in `tests/e2e/polish.spec.js`; Maks runs `npm test`

## 3. Behavior

- [x] 3.1 Add the toggle button to `sidebar.html` and `installSidebarToggle()` to `src/js/lib/sidebar.js` (localStorage `sidebar-collapsed` in try/catch, `is-collapsed` class, `aria-expanded`, `aria-label`), called from `base.html`; verify the state survives navigation and a blocked storage still lets the toggle work on the page
- [x] 3.2 Focus `#term-input` in `src/js/pages/add.js` after `requireSetup()` resolves; verify by the focus e2e in 4.1

## 4. End-to-end

- [x] 4.1 Extend `tests/e2e/polish.spec.js`: Alt+W from Home, Alt+H with the Words search focused (field stays empty), N on Home, collapse on Home then Words still collapsed then expand, sidebar bottom equals viewport height on a tall window and after scrolling Words, Review footer at the viewport bottom, Add word input focused after load and after Alt+A; Maks runs `npm test`
- [ ] 4.2 Maks checks in the browser on a Mac: Option+S navigates to Settings, and notes whether losing "ß" via Option+S in the Add word field is acceptable
