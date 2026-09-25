# Implementation Plan: Expense and Budget Visualizer

## Overview

Implement a fully client-side expense tracker as three files: `index.html`, `css/style.css`, and `js/app.js`. No build tools, no npm — Chart.js is loaded via CDN. All state lives in `localStorage` and is synchronized through an explicit `render()` cycle that refreshes the transaction list, balance display, and pie chart atomically on every mutation.

## Tasks

- [x] 1. Scaffold project files and HTML structure
  - Create `index.html` with `<header>` (balance display), `<main class="app-grid">` containing `.col-left` (transaction form) and `.col-right` (transaction list + chart wrapper)
  - Add all required element IDs: `#balance-display`, `#transaction-form`, `#item-name`, `#item-amount`, `#item-cat`, `#err-name`, `#err-amount`, `#err-cat`, `#err-storage`, `#transaction-list`, `#empty-state`, `#err-load`, `#spending-chart`, `#chart-placeholder`
  - Add the Chart.js CDN `<script>` tag before `js/app.js`
  - Create empty `css/style.css` and `js/app.js` files
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. Implement CSS layout and visual styles
  - [x] 2.1 Implement responsive two-column and single-column layout
    - Write CSS Flexbox/Grid rules for `.app-grid`: two-column (each 40–60% wide) at `≥768px`, single-column stacking below `768px` with no horizontal scroll
    - Style `<header>` with `#balance-display` visually prominent above the main content
    - Add `.hidden` utility class (`display: none`)
    - _Requirements: 7.4, 7.5, 3.1_
  - [x] 2.2 Style transaction form, list, and chart components
    - Style `#transaction-form` inputs, select, and submit button
    - Style `#transaction-list` as a scrollable container (overflow-y scroll) with per-item layout (name, amount, category, delete button)
    - Style `.error` inline error spans (visible when non-empty, distinct color)
    - Style `#chart-wrapper` and `#balance-display` currency formatting presentation
    - _Requirements: 1.1, 2.2, 3.1_

- [x] 3. Implement Storage module in `js/app.js`
  - [x] 3.1 Implement `load()` and `save()` functions
    - Define `STORAGE_KEY = 'expense_tracker_transactions'`
    - `load()`: reads `localStorage[STORAGE_KEY]`, returns parsed array; returns `[]` on missing key; throws `StorageError` on `localStorage` unavailability or `JSON.parse` failure
    - `save(transactions)`: serialises array to JSON, writes to `localStorage`; throws `StorageError` on write failure
    - Define `StorageError` as an `Error` subclass with `{ type: 'storage' }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 3.2 Write property test for serialization round-trip (Property 4)
    - **Property 4: Transaction serialization round-trip preserves data**
    - Use `fc.array(...)` of generated `Transaction` objects; assert `load(save(arr))` produces structurally equal array (same `id`, `name`, `amount`, `category`, `createdAt` on every element)
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 4. Implement Validator module in `js/app.js`
  - [x] 4.1 Implement `validateForm(name, amountStr, category)`
    - Returns `{ valid: true }` when: name is 1–100 non-whitespace-only characters, amountStr parses to a finite number > 0 and ≤ 999,999,999.99, category is one of `'Food'`, `'Transport'`, `'Fun'`
    - Returns `{ valid: false, errors: { name?, amount?, category? } }` with the exact error message strings from the design on each failing field
    - _Requirements: 1.1, 1.3, 1.4, 1.5_
  - [x] 4.2 Write property test for whitespace name rejection (Property 2)
    - **Property 2: Whitespace-only and empty names are rejected**
    - Use `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))` as the name input; assert `validateForm` returns `{ valid: false }` for all such inputs
    - **Validates: Requirements 1.3**
  - [x] 4.3 Write property test for non-positive amount rejection (Property 3)
    - **Property 3: Non-positive and non-numeric amounts are rejected**
    - Use `fc.oneof(fc.constant(''), fc.constant('abc'), fc.float({ max: 0 }))` as the amount input; assert `validateForm` returns `{ valid: false }` for all such inputs
    - **Validates: Requirements 1.4**

- [x] 5. Checkpoint — Storage and Validator are complete
  - Ensure `load()`, `save()`, and `validateForm()` behave correctly per their unit-level checks before wiring them into the UI. Ask the user if questions arise.

- [x] 6. Implement render functions in `js/app.js`
  - [x] 6.1 Implement `renderBalance(transactions)`
    - Compute sum via `Array.reduce`; format with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })`
    - Update `#balance-display` text content; show `$0.00` when array is empty; show negative total with minus-sign prefix when sum < 0
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 6.2 Write property test for balance equality (Property 5)
    - **Property 5: Balance equals sum of all transaction amounts**
    - Generate arrays of transactions with known amounts; assert the numeric value extracted from `#balance-display` equals `amounts.reduce((a, b) => a + b, 0)` formatted to two decimal places
    - **Validates: Requirements 3.1, 3.2, 3.3**
  - [x] 6.3 Implement `renderList(transactions)`
    - Clear `#transaction-list` innerHTML; show `#empty-state` when array is empty, hide otherwise
    - Iterate in reverse (`n-1` → `0`), create `<li data-id="...">` with `.tx-name`, `.tx-amount` (two-decimal currency), `.tx-cat`, and `.btn-delete[data-id]` for each transaction
    - Attach a single delegated `click` listener on `#transaction-list` to call `handleDelete` via `data-id`
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  - [x] 6.4 Write property test for reverse-chronological render order (Property 8)
    - **Property 8: Transaction list renders in reverse chronological order**
    - Generate transaction arrays with distinct `createdAt` ISO timestamps; assert the rendered `<li>` elements appear in descending `createdAt` order
    - **Validates: Requirements 2.3**
  - [x] 6.5 Implement `renderChart(transactions)`
    - Aggregate amounts by category `{ Food: 0, Transport: 0, Fun: 0 }`; filter out categories with total ≤ 0
    - If no categories remain: destroy `chartInstance` if set, hide `<canvas>`, show `#chart-placeholder`
    - Otherwise: show `<canvas>`, hide `#chart-placeholder`, destroy previous `chartInstance`, create new `Chart` with pie type, tooltip showing category name + formatted total + percentage (one decimal place)
    - Guard against Chart.js CDN failure with `typeof Chart === 'undefined'` check; show fallback message in `#chart-wrapper`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 6.6 Write property test for chart segment proportions (Property 6)
    - **Property 6: Chart segment proportions match category totals**
    - Generate transaction arrays with at least one positive-amount entry; assert each segment's `data` value divided by the total equals `categoryTotal / grandTotal` within floating-point precision
    - **Validates: Requirements 4.1**
  - [x] 6.7 Implement master `render(transactions)` function
    - Calls `renderList(transactions)`, `renderBalance(transactions)`, `renderChart(transactions)` in sequence
    - This is the single synchronization point — every mutation goes through this function
    - _Requirements: 7.3_

- [x] 7. Implement event handlers in `js/app.js`
  - [x] 7.1 Implement `handleSubmit(event)`
    - `event.preventDefault()`; read `#item-name`, `#item-amount`, `#item-cat` values
    - Call `validateForm`; display inline errors in `#err-name`, `#err-amount`, `#err-cat` and return on failure
    - Clear inline errors on valid input
    - Build `Transaction` object: `{ id: crypto.randomUUID(), name, amount: parseFloat(amountStr), category, createdAt: new Date().toISOString() }`
    - Call `Storage.save([...transactions, newTx])`; on `StorageError` show `#err-storage` and return without mutating state
    - Push `newTx` to `transactions`; reset form fields; call `render(transactions)`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [x] 7.2 Write property test for valid transaction addition (Property 1)
    - **Property 1: Valid transaction addition grows the list by exactly one**
    - Use `fc.string({ minLength: 1, maxLength: 100 })`, `fc.float({ min: 0.01, max: 999999999.99 })`, `fc.constantFrom('Food','Transport','Fun')`; assert `transactions.length` increases by exactly 1 and the new entry preserves all input fields
    - **Validates: Requirements 1.2, 2.1**
  - [x] 7.3 Implement `handleDelete(event)` via delegated listener
    - Extract `data-id` from the clicked `.btn-delete` button
    - Build updated array without the matching `id`
    - Call `Storage.save(updatedArray)`; on `StorageError` show `#err-storage` and return without mutating state
    - Splice matching item from `transactions`; call `render(transactions)`
    - _Requirements: 2.4, 5.2_
  - [x] 7.4 Write property test for delete removes from list and storage (Property 7)
    - **Property 7: Deleting a transaction removes it from list and storage**
    - Generate a populated transaction array and a random target `id`; assert post-delete array does not contain any entry with that `id` and the serialised storage also does not contain that `id`
    - **Validates: Requirements 2.4, 5.2**

- [x] 8. Implement Bootstrap and error handling in `js/app.js`
  - [x] 8.1 Implement `DOMContentLoaded` bootstrap
    - Wrap `Storage.load()` in `try/catch`; on `StorageError` show `#err-load` and keep `transactions = []`
    - Call `render(transactions)` after load
    - Attach `handleSubmit` to `#transaction-form` submit event
    - _Requirements: 5.3, 5.4, 2.6, 2.3_
  - [x] 8.2 Implement storage write-failure revert on add and delete
    - Confirm that `handleSubmit` does NOT push to `transactions` when `Storage.save()` throws — state is untouched and form is not reset
    - Confirm that `handleDelete` does NOT splice from `transactions` when `Storage.save()` throws — state is untouched
    - Show `#err-storage` message in both failure paths
    - _Requirements: 1.7, 5.5_

- [ ] 9. Checkpoint — Full render cycle wired and error paths covered
  - Open `index.html` in a browser and manually verify: add a transaction, confirm all three regions update; delete a transaction, confirm all three regions update; disable localStorage, confirm error messages appear; reload page, confirm data persists. Ask the user if questions arise.

- [x] 10. Browser compatibility and performance polish
  - [x] 10.1 Add unsupported-browser detection
    - On page load, detect if the browser is outside the current stable releases of Chrome, Firefox, Edge, and Safari using user-agent feature detection; display a non-blocking banner listing supported browsers
    - _Requirements: 7.1, 7.6_
  - [x] 10.2 Verify performance budgets via code review
    - Audit `js/app.js` to confirm all mutations complete within their timing budgets (Storage write ≤ 200 ms, full render cycle ≤ 200 ms, chart update ≤ 1 s) — no external profiling tooling required, just confirm no synchronous blocking work outside these paths
    - _Requirements: 7.2, 7.3_

- [x] 11. Final checkpoint — All tests pass and spec requirements met
  - Run all property-based test HTML harnesses in the browser; verify all 8 properties pass with ≥ 100 iterations each
  - Confirm the file structure matches exactly: `index.html`, `css/style.css`, `js/app.js` (plus optional `assets/`)
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use **fast-check** loaded via CDN in a standalone test HTML file — no npm or build step required
- Each property test must run a minimum of 100 iterations
- The delete event listener is delegated to `#transaction-list` (attached once inside `renderList`) — not per-button
- `chartInstance` is a module-level variable; always call `.destroy()` before recreating to avoid Chart.js canvas reuse warnings
- The `render()` function is the single synchronization point — never mutate `transactions` without calling it afterwards

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "4.1"] },
    { "id": 2, "tasks": ["3.2", "4.2", "4.3", "6.1", "6.3", "6.5"] },
    { "id": 3, "tasks": ["6.2", "6.4", "6.6", "6.7", "7.1", "7.3"] },
    { "id": 4, "tasks": ["7.2", "7.4", "8.1"] },
    { "id": 5, "tasks": ["8.2"] },
    { "id": 6, "tasks": ["10.1", "10.2"] }
  ]
}
```
