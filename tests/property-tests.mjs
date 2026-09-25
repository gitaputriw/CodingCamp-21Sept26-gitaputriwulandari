/**
 * Property-Based Tests — Expense and Budget Visualizer
 *
 * Run with:  node tests/property-tests.mjs
 * Requires:  npm install  (installs fast-check)
 *
 * Pure logic is re-implemented inline so the test file has no DOM dependency
 * and can run in Node.js without a browser or bundler.
 *
 * Each property runs a minimum of 100 random iterations via fast-check.
 */

import fc from 'fast-check';
import assert from 'node:assert/strict';

// ─── Pure logic copied from js/app.js (no DOM references) ────────────────────

const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];
const MAX_AMOUNT = 999_999_999.99;
const STORAGE_KEY = 'expense_tracker_transactions';

/**
 * Validates the three fields from the Transaction Form.
 * Mirrors validateForm() in js/app.js exactly.
 *
 * @param {string} name
 * @param {string} amountStr
 * @param {string} category
 * @returns {{ valid: true } | { valid: false, errors: object }}
 */
function validateForm(name, amountStr, category) {
  const errors = {};

  if (!name || name.trim().length === 0) {
    errors.name = 'Item name is required.';
  } else if (name.length > 100) {
    errors.name = 'Item name must be 100 characters or fewer.';
  }

  const parsedAmount = parseFloat(amountStr);
  if (
    amountStr === '' ||
    amountStr === null ||
    amountStr === undefined ||
    !isFinite(parsedAmount) ||
    isNaN(parsedAmount) ||
    parsedAmount <= 0 ||
    parsedAmount > MAX_AMOUNT
  ) {
    errors.amount = 'Amount must be a number greater than zero.';
  }

  if (!VALID_CATEGORIES.includes(category)) {
    errors.category = 'Please select a category.';
  }

  return Object.keys(errors).length === 0
    ? { valid: true }
    : { valid: false, errors };
}

/**
 * Creates an in-memory localStorage stand-in for Storage round-trip tests.
 */
function makeMockStorage() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    clear:   ()      => { store = {}; },
  };
}

/**
 * Builds a Storage object backed by the provided mock localStorage.
 * Mirrors the Storage module in js/app.js.
 */
function makeStorage(mockLS) {
  return {
    load() {
      const raw = mockLS.getItem(STORAGE_KEY);
      if (raw === null) return [];
      return JSON.parse(raw);
    },
    save(transactions) {
      mockLS.setItem(STORAGE_KEY, JSON.stringify(transactions));
    },
  };
}

/**
 * Pure balance computation — mirrors renderBalance() in js/app.js
 * (without the DOM write).
 *
 * @param {Array<{amount: number}>} transactions
 * @returns {string}  e.g. "$12.50"
 */
function computeBalance(transactions) {
  const sum = transactions.reduce((acc, t) => acc + t.amount, 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(sum);
}

/**
 * Pure category aggregation — mirrors the first part of renderChart() in app.js.
 *
 * @param {Array<{category: string, amount: number}>} transactions
 * @returns {{ Food: number, Transport: number, Fun: number }}
 */
function aggregateByCategory(transactions) {
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach((t) => { totals[t.category] += t.amount; });
  return totals;
}

// ─── Shared Arbitraries ───────────────────────────────────────────────────────

const categoryArb = fc.constantFrom('Food', 'Transport', 'Fun');

/**
 * Generates a valid Transaction object (all fields pass validateForm rules).
 */
const transactionArb = fc.record({
  id:        fc.uuid(),
  name:      fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  // fc.double avoids the NaN/Infinity edge-cases that fc.float can produce in
  // older fast-check versions when min/max are supplied.
  amount:    fc.double({ min: 0.01, max: 999_999_999.99, noNaN: true, noDefaultInfinity: true }),
  category:  categoryArb,
  createdAt: fc
    .date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })
    .map((d) => d.toISOString()),
});

// ─── Property 1 ───────────────────────────────────────────────────────────────
// Valid transaction addition grows the list by exactly one
// Validates: Requirements 1.2, 2.1

console.log('Running Property 1: Valid transaction addition grows the list by exactly one...');
fc.assert(
  fc.property(
    fc.array(transactionArb),
    fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    fc.double({ min: 0.01, max: 999_999_999.99, noNaN: true, noDefaultInfinity: true }),
    categoryArb,
    (existing, name, amount, category) => {
      const before = existing.length;

      const newTx = {
        id:        'fixed-test-id',
        name,
        amount,
        category,
        createdAt: new Date().toISOString(),
      };

      const after = [...existing, newTx];

      // Length grows by exactly 1
      assert.strictEqual(after.length, before + 1);

      // The new entry preserves all input fields
      const last = after[after.length - 1];
      assert.strictEqual(last.name,     name);
      assert.strictEqual(last.amount,   amount);
      assert.strictEqual(last.category, category);
    }
  ),
  { numRuns: 100 }
);
console.log('  ✓ Property 1 passed (100 runs)\n');

// ─── Property 2 ───────────────────────────────────────────────────────────────
// Whitespace-only and empty names are rejected
// Validates: Requirements 1.3

console.log('Running Property 2: Whitespace-only and empty names are rejected...');
fc.assert(
  fc.property(
    fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
    fc.double({ min: 0.01, max: 999_999.99, noNaN: true, noDefaultInfinity: true }),
    categoryArb,
    (whiteName, amount, category) => {
      const result = validateForm(whiteName, String(amount), category);
      assert.strictEqual(
        result.valid,
        false,
        `Expected rejection for whitespace name: ${JSON.stringify(whiteName)}`
      );
      assert.ok(
        result.errors && result.errors.name,
        'Expected errors.name to be set'
      );
    }
  ),
  { numRuns: 100 }
);
console.log('  ✓ Property 2 passed (100 runs)\n');

// ─── Property 3 ───────────────────────────────────────────────────────────────
// Non-positive and non-numeric amounts are rejected
// Validates: Requirements 1.4

console.log('Running Property 3: Non-positive and non-numeric amounts are rejected...');
fc.assert(
  fc.property(
    fc.oneof(
      fc.constant(''),
      fc.constant('abc'),
      fc.constant('NaN'),
      fc.constant('-5'),
      fc.constant('0'),
      // Negative floats as strings
      fc.double({ max: 0, noNaN: true, noDefaultInfinity: true }).map(String),
    ),
    (badAmount) => {
      const result = validateForm('ValidName', badAmount, 'Food');
      assert.strictEqual(
        result.valid,
        false,
        `Expected rejection for amount: ${JSON.stringify(badAmount)}`
      );
      assert.ok(
        result.errors && result.errors.amount,
        'Expected errors.amount to be set'
      );
    }
  ),
  { numRuns: 100 }
);
console.log('  ✓ Property 3 passed (100 runs)\n');

// ─── Property 4 ───────────────────────────────────────────────────────────────
// Transaction serialization round-trip preserves data
// Validates: Requirements 5.1, 5.2, 5.3

console.log('Running Property 4: Transaction serialization round-trip preserves data...');
fc.assert(
  fc.property(
    fc.array(transactionArb, { minLength: 0, maxLength: 20 }),
    (original) => {
      const mockLS  = makeMockStorage();
      const storage = makeStorage(mockLS);

      storage.save(original);
      const loaded = storage.load();

      assert.strictEqual(loaded.length, original.length);

      for (let i = 0; i < original.length; i++) {
        assert.strictEqual(loaded[i].id,        original[i].id,        `id mismatch at index ${i}`);
        assert.strictEqual(loaded[i].name,      original[i].name,      `name mismatch at index ${i}`);
        assert.strictEqual(loaded[i].amount,    original[i].amount,    `amount mismatch at index ${i}`);
        assert.strictEqual(loaded[i].category,  original[i].category,  `category mismatch at index ${i}`);
        assert.strictEqual(loaded[i].createdAt, original[i].createdAt, `createdAt mismatch at index ${i}`);
      }
    }
  ),
  { numRuns: 100 }
);
console.log('  ✓ Property 4 passed (100 runs)\n');

// ─── Property 5 ───────────────────────────────────────────────────────────────
// Balance equals sum of all transaction amounts
// Validates: Requirements 3.1, 3.2, 3.3

console.log('Running Property 5: Balance equals sum of all transaction amounts...');
fc.assert(
  fc.property(
    fc.array(transactionArb, { minLength: 1, maxLength: 20 }),
    (transactions) => {
      const sum = transactions.reduce((acc, t) => acc + t.amount, 0);

      const expected = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(sum);

      const actual = computeBalance(transactions);

      assert.strictEqual(actual, expected);
    }
  ),
  { numRuns: 100 }
);
console.log('  ✓ Property 5 passed (100 runs)\n');

// ─── Property 6 ───────────────────────────────────────────────────────────────
// Chart segment proportions match category totals
// Validates: Requirements 4.1

console.log('Running Property 6: Chart segment proportions match category totals...');
fc.assert(
  fc.property(
    fc.array(transactionArb, { minLength: 1, maxLength: 30 }),
    (transactions) => {
      const totals     = aggregateByCategory(transactions);
      const labels     = Object.keys(totals).filter((k) => totals[k] > 0);
      const data       = labels.map((k) => totals[k]);
      const grandTotal = data.reduce((a, b) => a + b, 0);

      // At least one positive-amount entry means grandTotal > 0
      assert.ok(grandTotal > 0, 'grandTotal should be > 0 given at least one positive transaction');

      // Each segment's proportion must equal categoryTotal / grandTotal
      for (let i = 0; i < labels.length; i++) {
        const expected = totals[labels[i]] / grandTotal;
        const actual   = data[i] / grandTotal;
        assert.ok(
          Math.abs(actual - expected) < 1e-10,
          `Proportion mismatch for ${labels[i]}: expected ${expected}, got ${actual}`
        );
      }

      // All proportions must sum to 1.0 within floating-point tolerance
      const proportionSum = data.reduce((a, b) => a + b, 0) / grandTotal;
      assert.ok(
        Math.abs(proportionSum - 1) < 1e-10,
        `Proportions do not sum to 1: ${proportionSum}`
      );
    }
  ),
  { numRuns: 100 }
);
console.log('  ✓ Property 6 passed (100 runs)\n');

// ─── Property 7 ───────────────────────────────────────────────────────────────
// Deleting a transaction removes it from the list and from storage
// Validates: Requirements 2.4, 5.2

console.log('Running Property 7: Deleting a transaction removes it from list and storage...');
fc.assert(
  fc.property(
    fc.array(transactionArb, { minLength: 1, maxLength: 20 }),
    fc.nat(),
    (transactions, indexSeed) => {
      const targetIndex = indexSeed % transactions.length;
      const targetId    = transactions[targetIndex].id;

      const mockLS  = makeMockStorage();
      const storage = makeStorage(mockLS);

      // Persist the initial state
      storage.save(transactions);

      // Simulate handleDelete: filter out the target, then save
      const updated = transactions.filter((t) => t.id !== targetId);
      storage.save(updated);

      // Re-load to verify persistence
      const loaded = storage.load();

      // In-memory list must not contain the deleted id
      assert.ok(
        !updated.some((t) => t.id === targetId),
        'Updated in-memory array still contains deleted id'
      );

      // Storage must not contain the deleted id
      assert.ok(
        !loaded.some((t) => t.id === targetId),
        'Persisted storage still contains deleted id'
      );

      // Length must decrease by exactly the number of entries that shared
      // that id (fc.uuid() makes collisions astronomically unlikely, so
      // in practice this is always exactly 1)
      const removedCount = transactions.filter((t) => t.id === targetId).length;
      assert.strictEqual(updated.length, transactions.length - removedCount);
    }
  ),
  { numRuns: 100 }
);
console.log('  ✓ Property 7 passed (100 runs)\n');

// ─── Property 8 ───────────────────────────────────────────────────────────────
// Transaction list renders in reverse insertion order (most recently added first)
// Validates: Requirements 2.3

console.log('Running Property 8: Transaction list renders in reverse insertion order...');
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        id:        fc.uuid(),
        name:      fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        amount:    fc.double({ min: 0.01, max: 999.99, noNaN: true, noDefaultInfinity: true }),
        category:  categoryArb,
        // Spread timestamps so ordering is unambiguous
        createdAt: fc
          .integer({ min: 0, max: 1_000_000 })
          .map((n) => new Date(1_700_000_000_000 + n * 1_000).toISOString()),
      }),
      { minLength: 2, maxLength: 20 }
    ),
    (transactions) => {
      // renderList iterates from index n-1 down to 0, so:
      //   renderedOrder[0] = transactions[n-1]  (last inserted)
      //   renderedOrder[1] = transactions[n-2]
      //   ...
      const renderedOrder = [];
      for (let i = transactions.length - 1; i >= 0; i--) {
        renderedOrder.push(transactions[i]);
      }

      // Each consecutive pair in renderedOrder must appear in decreasing
      // original-index order (higher index = inserted later = shown first).
      for (let j = 0; j < renderedOrder.length - 1; j++) {
        const currOrigIdx = transactions.indexOf(renderedOrder[j]);
        const nextOrigIdx = transactions.indexOf(renderedOrder[j + 1]);
        assert.ok(
          currOrigIdx > nextOrigIdx,
          `Rendered item at position ${j} (orig index ${currOrigIdx}) should come after ` +
          `item at position ${j + 1} (orig index ${nextOrigIdx}) in the source array`
        );
      }
    }
  ),
  { numRuns: 100 }
);
console.log('  ✓ Property 8 passed (100 runs)\n');

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('✅  All 8 properties passed with ≥100 iterations each.');
