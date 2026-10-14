# error-handling Specification

## Purpose
What the user sees when data fails to load or an unexpected error occurs: an inline message with Retry, and a global error bar.

## Requirements

### Requirement: Data load failure
When the data a page needs before it can show anything cannot be loaded (for example the profile), the page SHALL replace its content with "Could not load your data." and a "Retry" button, and SHALL NOT stay blank. "Retry" SHALL reload the page. Pages that show their own inline load message (Home, Words) keep that message and its Retry.

#### Scenario: Profile fails to load
- **WHEN** the profile request fails on any signed-in page
- **THEN** "Could not load your data." and a "Retry" button are shown

#### Scenario: Retry
- **WHEN** the user presses "Retry"
- **THEN** the page reloads and loads its data again

### Requirement: Global error bar
Every page SHALL show a small error bar when an uncaught error or an unhandled promise rejection occurs. The bar SHALL read "Something went wrong. Reload the page if it keeps happening." with a "Dismiss" button, SHALL appear at most once at a time, and SHALL log the error details to the console. Errors that the app already handles SHALL NOT show it. Browser-generated noise without an error object (ResizeObserver loop notices, cross-origin "Script error.") SHALL be ignored. Details SHALL be logged, never inserted into the page as HTML.

#### Scenario: Uncaught error
- **WHEN** an uncaught error is thrown on a page
- **THEN** the error bar appears and the error is logged to the console

#### Scenario: Unhandled rejection
- **WHEN** a promise rejects with no handler
- **THEN** the error bar appears

#### Scenario: Several errors
- **WHEN** a second error occurs while the bar is showing
- **THEN** there is still one bar

#### Scenario: Dismiss
- **WHEN** the user presses "Dismiss"
- **THEN** the bar disappears and shows again on the next error

#### Scenario: Handled error
- **WHEN** a caught error shows its own inline message
- **THEN** the error bar does not appear

#### Scenario: On every page
- **WHEN** an uncaught error occurs on the sign-in page
- **THEN** the error bar appears
