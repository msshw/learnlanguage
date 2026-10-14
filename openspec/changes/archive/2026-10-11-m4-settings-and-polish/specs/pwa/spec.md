## ADDED Requirements

### Requirement: Web app manifest
Every page SHALL link a web app manifest that gives the app a name, a short name, start URL `/`, standalone display, theme and background colors, and icons of 192 by 192 and 512 by 512 pixels plus a maskable icon. All referenced icon files SHALL exist at their sizes.

#### Scenario: Manifest linked
- **WHEN** any page is loaded
- **THEN** a manifest link is present and the manifest parses with every required field

#### Scenario: Icons exist
- **WHEN** the manifest icons are fetched
- **THEN** each file exists and has the declared dimensions

### Requirement: Installable
In a production build served over a secure origin (localhost counts), Chrome SHALL offer to install the app.

#### Scenario: Install from Chrome
- **WHEN** the production build is served locally and opened in Chrome
- **THEN** Chrome offers to install it and the installed app opens Home

### Requirement: Static shell caching only
A service worker SHALL cache only same-origin static files: built assets cache-first, everything else network-first with the cached copy as fallback. It SHALL NOT cache cross-origin requests (database, auth, function calls), non-GET requests or failed responses. Data SHALL always need a connection.

#### Scenario: Data not cached
- **WHEN** the app calls the database or the autofill function
- **THEN** the service worker does not store or answer the request

#### Scenario: Offline
- **WHEN** the device is offline and a page is opened
- **THEN** the cached shell opens and data loads fail with the normal load error message

### Requirement: Registration and updates
The service worker SHALL register on every page in production builds only, never in the dev server. A new deploy SHALL replace the old worker and delete older caches, so users do not stay on a stale shell.

#### Scenario: Dev server
- **WHEN** the app runs on the Vite dev server
- **THEN** no service worker is registered

#### Scenario: New version
- **WHEN** a new worker version activates
- **THEN** caches from older versions are deleted
