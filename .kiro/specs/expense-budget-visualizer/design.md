# Design Document: Expense and Budget Visualizer

## Overview

The Expense and Budget Visualizer is a fully client-side single-page application (SPA) delivered as a static HTML file. It requires no server, no build pipeline, and no package manager — the user opens `index.html` directly in a browser. All state is persisted in the browser's `localStorage` and all UI is rendered by a single JavaScript file (`js/app.js`) that is loaded as a classic `<script>` tag at the bottom of the `<body>`.

The application has four visible UI regions that must stay in sync at all times:

1. **Transaction Form** — captures new expense entries
2. **Transaction List** — shows the full spending history with per-item delete
3. **Balance Display** — shows the running total
4. **Spending Chart** — a Chart.js pie chart of category totals

Because there is no reactive framework, the synchronization strategy is an explicit **render cycle**: any mutation to the transaction array (add or delete) triggers a single `render()` call that refreshes all four regions atomically before returning.

---

## Architecture

### Module Boundaries (single-file)

Since the entire application lives in one JavaScript file (`js/app.js`), logical separation is achieved through clearly named function groups:

```
js/app.js
├── Constants            — CATEGORIES, STORAGE_KEY, currency formatter
├── Storage module       — load(), save()
├── Validator module     — validateForm()
├── State                — in-memory transactions array
├── Render functions     — renderList(), renderBalance(), renderChart()
├── render()             — master render cycle (calls all three above)
├── Event handlers       — handleSubmit(), handleDelete()
└── Bootstrap            — DOMContentLoaded initializer
```

### Data Flow

```
User Action
    │
    ▼
Event Handler (handleSubmit / handleDelete)
    │
    ├─► Validator (validateForm) — on submit only; aborts on failure
    │
    ├─► Mutate State (push / splice transactions array)
    │
    ├─► Storage.save() — persist immediately; revert + show error on failure
    │
    └─► render() ──┬─► renderList()
                   ├─► renderBalance()
                   └─► renderChart()
```

### Chart.js Integration

Chart.js is loaded from a CDN `<script>` tag in `index.html` before `js/app.js`. The first call to `renderChart()` instantiates a `Chart` object on a `<canvas>` element and stores the instance in a module-level variable (`chartInstance`). Subsequent calls call `chartInstance.destroy()` then recreate it, which is the safest way to update a Chart.js pie chart when the number of segments may change.

### Responsive Layout

CSS Flexbox / Grid is used in `css/style.css`:

- **≥ 768 px**: two-column layout — form + chart in one column, transaction list + balance in the other (or form on left, list+chart on right — see Components section).
- **< 768 px**: single-column stacking, 100 % viewport width, no horizontal scroll.

---

## Components and Interfaces

### 1. HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense Tracker</h1>
    <div id="balance-display">$0.00</div>      <!-- Balance_Display -->
  </header>

  <main class="app-grid">
    <!-- Left column (≥768 px) -->
    <section class="col-left">
      <form id="transaction-form">             <!-- Transaction_Form -->
        <input  id="item-name"   type="text"  />
        <span   id="err-name"    class="error"></span>
        <input  id="item-amount" type="number"/>
        <span   id="err-amount"  class="error"></span>
        <select id="item-cat">                 <!-- Food / Transport / Fun -->
          <option value="">-- Select Category --</option>
          <option value="Food">Food</option>
          <option value="Transport">Transport</option>
          <option value="Fun">Fun</option>
        </select>
        <span   id="err-cat"     class="error"></span>
        <button type="submit">Add Transaction</button>
        <p      id="err-storage" class="error hidden"></p>
      </form>
    </section>

    <!-- Right column (≥768 px) -->
    <section class="col-right">
      <div id="transaction-list-wrapper">
        <ul id="transaction-list"></ul>        <!-- Transaction_List -->
        <p  id="empty-state" class="hidden">No transactions yet.</p>
        <p  id="err-load"    class="hidden">Could not load transaction history.</p>
      </div>
      <div id="chart-wrapper">
        <canvas id="spending-chart"></canvas>
        <p id="chart-placeholder" class="hidden">No spending data available.</p>
      </div>
    </section>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="js/app.js"></script>
</body>
```

### 2. Storage Module

| Function | Signature | Behaviour |
|---|---|---|
| `load()` | `() → Transaction[]` | Reads `localStorage[STORAGE_KEY]`, parses JSON. Returns `[]` on missing key. Throws `StorageError` on parse failure or `localStorage` unavailability. |
| `save(transactions)` | `(Transaction[]) → void` | Serialises array to JSON, writes to `localStorage`. Throws `StorageError` on write failure. |

**`StorageError`** is a plain `Error` subclass tagged with `{ type: 'storage' }` so event handlers can distinguish it from programming errors.

### 3. Validator Module

```js
// Returns { valid: true } or { valid: false, errors: { name?, amount?, category? } }
function validateForm(name, amountStr, category)
```

Rules (mirrors requirements exactly):

| Field | Rule |
|---|---|
| `name` | Non-empty string, 1–100 characters |
| `amount` | Parses to a finite number > 0 and ≤ 999,999,999.99 |
| `category` | One of `'Food'`, `'Transport'`, `'Fun'` |

### 4. Render Functions

#### `renderList(transactions)`
- Clears `#transaction-list` innerHTML.
- Shows `#empty-state` when array is empty; hides otherwise.
- Iterates transactions **in reverse** (index `n-1` → `0`), creates one `<li>` per entry:
  ```html
  <li data-id="<uuid>">
    <span class="tx-name">Lunch</span>
    <span class="tx-amount">$12.50</span>
    <span class="tx-cat">Food</span>
    <button class="btn-delete" data-id="<uuid>">Delete</button>
  </li>
  ```
- Attaches a single delegated `click` listener on `#transaction-list` (not per-button) to handle delete via `data-id`.

#### `renderBalance(transactions)`
- Computes `sum = transactions.reduce((acc, t) => acc + t.amount, 0)`.
- Formats with `Intl.NumberFormat` (currency USD, 2 decimal places).
- Updates `#balance-display` text content.

#### `renderChart(transactions)`
- Aggregates amounts by category:
  ```js
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach(t => totals[t.category] += t.amount);
  ```
- Filters out categories with total ≤ 0.
- If no categories remain, destroys `chartInstance` (if any), hides `<canvas>`, shows `#chart-placeholder`.
- Otherwise, shows `<canvas>`, hides placeholder, destroys previous `chartInstance`, creates new `Chart`.

### 5. Event Handlers

#### `handleSubmit(event)`
1. `event.preventDefault()`
2. Read form field values.
3. `validateForm(name, amountStr, category)` — display inline errors and return on failure.
4. Clear inline errors.
5. Build `Transaction` object (generate UUID via `crypto.randomUUID()`).
6. `Storage.save([...transactions, newTx])` — on `StorageError` show `#err-storage` and return.
7. Push `newTx` to `transactions`.
8. Reset form fields.
9. `render()`.

#### `handleDelete(event)`
- Triggered by delegated listener on `#transaction-list`.
- Finds `data-id` on the clicked button.
- Saves updated array (without the deleted item) — on `StorageError` show `#err-storage` and return.
- Splices item from `transactions`.
- `render()`.

### 6. Bootstrap (`DOMContentLoaded`)

```js
document.addEventListener('DOMContentLoaded', () => {
  try {
    transactions = Storage.load();
  } catch (e) {
    showLoadError();   // shows #err-load, keeps transactions = []
  }
  render();
  document.getElementById('transaction-form').addEventListener('submit', handleSubmit);
  // delete listener is delegated — attached once to #transaction-list inside renderList
});
```

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id        - UUID v4 (crypto.randomUUID())
 * @property {string} name      - Item name, 1–100 chars
 * @property {number} amount    - Positive number, > 0, ≤ 999,999,999.99
 * @property {'Food'|'Transport'|'Fun'} category
 * @property {string} createdAt - ISO 8601 timestamp (new Date().toISOString())
 */
```

### Storage Format

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": "2025-07-16T08:30:00.000Z"
  }
]
```

Key: `"expense_tracker_transactions"` (constant `STORAGE_KEY`).

### Chart Data Shape (internal — passed to Chart.js)

```js
{
  labels: ['Food', 'Transport'],         // only categories with total > 0
  datasets: [{
    data: [45.00, 20.00],
    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']  // Food, Transport, Fun
  }]
}
```

### Validation Result

```js
// Success
{ valid: true }

// Failure
{
  valid: false,
  errors: {
    name: 'Item name is required.' | 'Item name must be 100 characters or fewer.',
    amount: 'Amount must be a number greater than zero.',
    category: 'Please select a category.'
  }
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction addition grows the list by exactly one

*For any* existing transaction list and any valid transaction input (non-empty name ≤ 100 chars, amount > 0, valid category), adding the transaction SHALL result in a transaction list whose length is exactly one greater than before and whose last-added entry preserves all input fields.

**Validates: Requirements 1.2, 2.1**

---

### Property 2: Whitespace-only and empty names are rejected

*For any* string composed entirely of whitespace characters (including the empty string), submitting it as the item name SHALL be rejected by the Validator and the transaction list SHALL remain unchanged.

**Validates: Requirements 1.3**

---

### Property 3: Non-positive and non-numeric amounts are rejected

*For any* input string that either does not parse to a finite number, parses to zero, or parses to a negative number, submitting it as the amount SHALL be rejected by the Validator and the transaction list SHALL remain unchanged.

**Validates: Requirements 1.4**

---

### Property 4: Transaction serialization round-trip preserves data

*For any* array of Transaction objects, serializing it to Local Storage and then deserializing it SHALL produce an array structurally equal to the original (same length, same `id`, `name`, `amount`, `category`, and `createdAt` on every element).

**Validates: Requirements 5.1, 5.2, 5.3**

---

### Property 5: Balance equals sum of all transaction amounts

*For any* non-empty set of transactions, the value displayed in Balance_Display SHALL equal the arithmetic sum of all transaction amounts, formatted to exactly two decimal places.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 6: Chart segment proportions match category totals

*For any* set of transactions containing at least one positive-amount entry, each rendered chart segment's proportional size SHALL equal that category's total amount divided by the sum of all category totals, within floating-point precision.

**Validates: Requirements 4.1**

---

### Property 7: Deleting a transaction removes it from list and storage

*For any* transaction list containing at least one transaction, deleting a transaction by its `id` SHALL result in a list that no longer contains an entry with that `id`, and the updated list persisted to Local Storage SHALL also not contain that `id`.

**Validates: Requirements 2.4, 5.2**

---

### Property 8: Transaction list renders in reverse chronological order

*For any* transaction list with two or more entries, the rendered HTML list SHALL display transactions in descending `createdAt` order (most recent first).

**Validates: Requirements 2.3**

---

## Error Handling

| Scenario | Detection | Response |
|---|---|---|
| `localStorage` unavailable on load | `try/catch` around `Storage.load()` in bootstrap | Show `#err-load`, initialise with empty array, allow full interaction |
| `localStorage` unavailable on save | `try/catch` around `Storage.save()` in handlers | Show `#err-storage`, do NOT mutate state or rerender |
| Corrupted JSON in `localStorage` | `JSON.parse` throws inside `Storage.load()` | Same as unavailable on load — show `#err-load`, empty array |
| Write failure after add | `Storage.save()` throws after form submit | Show `#err-storage`, do not push to array, do not reset form |
| Write failure after delete | `Storage.save()` throws after delete click | Show `#err-storage`, do not splice from array |
| Validation failure | `validateForm()` returns `{ valid: false }` | Display inline error spans adjacent to offending fields, prevent submission |
| Chart.js not loaded (CDN failure) | Guard `typeof Chart === 'undefined'` in `renderChart()` | Show fallback message inside `#chart-wrapper`, do not throw |

All error messages shown to the user are non-blocking — they appear inline and do not use `alert()` or `confirm()`. Storage errors are dismissible (a close button) or overwritten on the next successful operation.

---

## Testing Strategy

### Unit Tests (Vanilla JS — no framework required)

Focus on pure logic that does not touch the DOM:

| Test Subject | What to Test | Type |
|---|---|---|
| `validateForm` | Valid inputs return `{ valid: true }` | Example |
| `validateForm` | Empty/whitespace names are rejected | Example + Property 2 |
| `validateForm` | Zero, negative, non-numeric amounts are rejected | Example + Property 3 |
| `validateForm` | Names > 100 chars are rejected | Edge case |
| `validateForm` | All three valid categories are accepted | Example |
| `Storage.load` | Returns `[]` for missing key | Example |
| `Storage.load` | Returns parsed array for valid JSON | Example |
| `Storage.load` | Throws on corrupted JSON | Edge case |
| `Storage.save` | Serialised output round-trips to original data | Property 4 |
| `renderBalance` | Sum of amounts matches displayed value | Property 5 |
| Category aggregation | Totals per category are correct before chart render | Property 6 |
| Reverse-order rendering | List items are in descending `createdAt` order | Property 8 |

### Property-Based Tests

The feature involves input validation (with a large input space of strings and numbers) and serialization — both are well-suited for property-based testing. Use **fast-check** (loaded via CDN or a simple `<script>` in a test HTML harness) since there is no build toolchain.

**Property test library:** [fast-check](https://fast-check.io/) — can be loaded via CDN for use in a browser-based test runner or via `<script type="module">` in a test HTML file.

Each property test runs **minimum 100 iterations**.

| Property | fast-check Arbitraries | Tag |
|---|---|---|
| **Property 1** — Valid addition grows list by 1 | `fc.string({ minLength: 1, maxLength: 100 })`, `fc.float({ min: 0.01, max: 999999999.99 })`, `fc.constantFrom('Food','Transport','Fun')` | Feature: expense-budget-visualizer, Property 1: Valid transaction addition grows the list by exactly one |
| **Property 2** — Whitespace names rejected | `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))` | Feature: expense-budget-visualizer, Property 2: Whitespace-only and empty names are rejected |
| **Property 3** — Non-positive amounts rejected | `fc.oneof(fc.constant(''), fc.constant('abc'), fc.float({ max: 0 }))` | Feature: expense-budget-visualizer, Property 3: Non-positive and non-numeric amounts are rejected |
| **Property 4** — Serialisation round-trip | Array of generated `Transaction` objects | Feature: expense-budget-visualizer, Property 4: Transaction serialization round-trip preserves data |
| **Property 5** — Balance equals sum | Array of generated transactions with known amounts | Feature: expense-budget-visualizer, Property 5: Balance equals sum of all transaction amounts |
| **Property 6** — Chart proportions | Arrays of transactions grouped by category | Feature: expense-budget-visualizer, Property 6: Chart segment proportions match category totals |
| **Property 7** — Delete removes from list and storage | Populated transaction arrays, random target id | Feature: expense-budget-visualizer, Property 7: Deleting a transaction removes it from list and storage |
| **Property 8** — Reverse-chronological order | Transactions with distinct `createdAt` values | Feature: expense-budget-visualizer, Property 8: Transaction list renders in reverse chronological order |

### Integration / Smoke Tests

Manual browser-based checks (or automated with Playwright/Puppeteer if the team adds them later):

| Check | Type |
|---|---|
| App loads with no console errors in Chrome, Firefox, Edge, Safari | Smoke |
| Chart.js segment renders after adding a transaction | Integration |
| Data persists after page reload | Integration |
| Responsive layout switches at 768 px breakpoint | Integration |
| App displays load error when `localStorage` is disabled | Integration |
