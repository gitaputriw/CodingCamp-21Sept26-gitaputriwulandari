// Expense and Budget Visualizer — application logic

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'expense_tracker_transactions';

// ─── Storage Module ──────────────────────────────────────────────────────────

/**
 * Custom error class for localStorage read/write failures.
 * Identified by { type: 'storage' } so callers can distinguish it
 * from unrelated programming errors.
 */
class StorageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageError';
    this.type = 'storage';
  }
}

const Storage = {
  /**
   * Reads and parses the transaction array from localStorage.
   * @returns {Transaction[]} Parsed array, or [] when the key is absent.
   * @throws {StorageError} When localStorage is unavailable or the stored value is not valid JSON.
   */
  load() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      throw new StorageError('localStorage is unavailable: ' + e.message);
    }

    // Key not yet written — treat as empty list
    if (raw === null) {
      return [];
    }

    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new StorageError('Transaction data is corrupted and could not be loaded.');
    }
  },

  /**
   * Serialises the transaction array and writes it to localStorage.
   * @param {Transaction[]} transactions
   * @throws {StorageError} When the write to localStorage fails.
   */
  save(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      throw new StorageError('Could not save transactions: ' + e.message);
    }
  },
};

// ─── Validator Module ─────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];
const MAX_AMOUNT = 999_999_999.99;

/**
 * Validates the three fields from the Transaction_Form.
 *
 * @param {string} name        - Raw value from #item-name
 * @param {string} amountStr   - Raw value from #item-amount
 * @param {string} category    - Raw value from #item-cat
 * @returns {{ valid: true } | { valid: false, errors: { name?: string, amount?: string, category?: string } }}
 */
function validateForm(name, amountStr, category) {
  const errors = {};

  // ── Name validation ────────────────────────────────────────────────────────
  if (!name || name.trim().length === 0) {
    errors.name = 'Item name is required.';
  } else if (name.length > 100) {
    errors.name = 'Item name must be 100 characters or fewer.';
  }

  // ── Amount validation ──────────────────────────────────────────────────────
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

  // ── Category validation ────────────────────────────────────────────────────
  if (!VALID_CATEGORIES.includes(category)) {
    errors.category = 'Please select a category.';
  }

  if (Object.keys(errors).length === 0) {
    return { valid: true };
  }

  return { valid: false, errors };
}

// ─── Render Functions ─────────────────────────────────────────────────────────

/**
 * Updates the #balance-display element with the sum of all transaction amounts.
 * Formats the total as USD currency with exactly two decimal places.
 * Handles empty arrays (shows $0.00) and negative sums (shows e.g. -$12.50).
 *
 * @param {Transaction[]} transactions
 */
function renderBalance(transactions) {
  const sum = transactions.reduce((acc, t) => acc + t.amount, 0);

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(sum);
  document.getElementById('balance-display').textContent = formatted;
}

/**
 * Renders the transaction list into #transaction-list.
 * Displays transactions in reverse chronological order (most recent first).
 * Shows #empty-state when there are no transactions.
 * Attaches a single delegated click listener to handle deletes.
 *
 * @param {Transaction[]} transactions
 */
function renderList(transactions) {
  const list = document.getElementById('transaction-list');
  const emptyState = document.getElementById('empty-state');

  // Clear existing content
  list.innerHTML = '';

  if (transactions.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Iterate in reverse so most recent appears first
  for (let i = transactions.length - 1; i >= 0; i--) {
    const tx = transactions[i];

    const li = document.createElement('li');
    li.dataset.id = tx.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tx-name';
    nameSpan.textContent = tx.name;

    const amountSpan = document.createElement('span');
    amountSpan.className = 'tx-amount';
    amountSpan.textContent = formatter.format(tx.amount);

    const catSpan = document.createElement('span');
    catSpan.className = 'tx-cat';
    catSpan.textContent = tx.category;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.dataset.id = tx.id;
    deleteBtn.textContent = 'Delete';

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(catSpan);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  }

  // Attach a single delegated click listener by cloning the node to remove any
  // previously attached listeners, then re-attaching a fresh one.
  const freshList = list.cloneNode(true);
  list.parentNode.replaceChild(freshList, list);

  freshList.addEventListener('click', (event) => {
    if (event.target.classList.contains('btn-delete')) {
      handleDelete(event.target.dataset.id);
    }
  });
}

// ─── Chart Instance ───────────────────────────────────────────────────────────

let chartInstance = null;

// ─── renderChart ──────────────────────────────────────────────────────────────

/**
 * Renders a pie chart of spending by category into #spending-chart.
 * Destroys and recreates the Chart.js instance on each call so segment
 * count changes are handled cleanly.
 *
 * @param {Transaction[]} transactions
 */
function renderChart(transactions) {
  // 1. Aggregate amounts by category
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach(function (t) {
    totals[t.category] += t.amount;
  });

  // 2. Filter to categories with a positive total
  const labels = Object.keys(totals).filter(function (k) { return totals[k] > 0; });
  const data   = labels.map(function (k) { return totals[k]; });

  const canvas      = document.getElementById('spending-chart');
  const placeholder = document.getElementById('chart-placeholder');

  // 3. Guard: Chart.js CDN failed to load
  if (typeof Chart === 'undefined') {
    canvas.classList.add('hidden');
    placeholder.textContent = 'Chart unavailable — Chart.js failed to load.';
    placeholder.classList.remove('hidden');
    return;
  }

  // 4. No positive-amount categories — show placeholder
  if (labels.length === 0) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    canvas.classList.add('hidden');
    placeholder.classList.remove('hidden');
    return;
  }

  // 5. Render (or re-render) the chart
  placeholder.classList.add('hidden');
  canvas.classList.remove('hidden');

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
      }],
    },
    options: { responsive: true },
  });
}

// ─── Master Render Cycle ──────────────────────────────────────────────────────

/**
 * Refreshes all four UI regions atomically.
 * Called after every mutation to the transactions array.
 */
function render() {
  renderList(transactions);
  renderBalance(transactions);
  renderChart(transactions);
}

// ─── State ────────────────────────────────────────────────────────────────────

let transactions = [];

// ─── Event Handlers ───────────────────────────────────────────────────────────

/**
 * Handles the transaction form submission.
 * Validates fields, attempts a storage write BEFORE mutating in-memory state,
 * and resets the form only on success.
 *
 * @param {Event} event
 */
function handleSubmit(event) {
  event.preventDefault();

  const name      = document.getElementById('item-name').value.trim();
  const amountStr = document.getElementById('item-amount').value;
  const category  = document.getElementById('item-cat').value;

  // Clear previous inline errors
  document.getElementById('err-name').textContent    = '';
  document.getElementById('err-amount').textContent  = '';
  document.getElementById('err-cat').textContent     = '';
  var errStorage = document.getElementById('err-storage');
  errStorage.textContent = '';
  errStorage.classList.add('hidden');

  const result = validateForm(name, amountStr, category);
  if (!result.valid) {
    if (result.errors.name)     document.getElementById('err-name').textContent    = result.errors.name;
    if (result.errors.amount)   document.getElementById('err-amount').textContent  = result.errors.amount;
    if (result.errors.category) document.getElementById('err-cat').textContent     = result.errors.category;
    return;
  }

  const newTx = {
    id:        crypto.randomUUID(),
    name:      name,
    amount:    parseFloat(amountStr),
    category:  category,
    createdAt: new Date().toISOString(),
  };

  // Attempt storage write BEFORE mutating in-memory state (atomic)
  try {
    Storage.save([...transactions, newTx]);
  } catch (e) {
    errStorage.textContent = 'Could not save transaction. Please try again.';
    errStorage.classList.remove('hidden');
    return; // do NOT push to array, do NOT reset form
  }

  // Save succeeded — mutate state and update UI
  transactions.push(newTx);
  event.target.reset();
  render();
}

/**
 * Removes the transaction with the given id.
 * Called by the delegated click listener attached in renderList.
 * Attempts storage write BEFORE splicing from in-memory state (atomic).
 *
 * @param {string} id — UUID of the transaction to remove
 */
function handleDelete(id) {
  const index = transactions.findIndex(function (t) { return t.id === id; });
  if (index === -1) return; // guard: id not found

  const updated = transactions.filter(function (t) { return t.id !== id; });

  try {
    Storage.save(updated);
  } catch (e) {
    var errStorage = document.getElementById('err-storage');
    errStorage.textContent = 'Could not delete transaction. Please try again.';
    errStorage.classList.remove('hidden');
    return; // do NOT splice
  }

  transactions.splice(index, 1);
  render();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {

  // ── Browser compatibility detection ────────────────────────────────────────
  var missingFeatures = [];
  if (typeof localStorage === 'undefined') {
    missingFeatures.push('localStorage');
  }
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    missingFeatures.push('crypto.randomUUID');
  }
  if (typeof Intl === 'undefined' || typeof Intl.NumberFormat !== 'function') {
    missingFeatures.push('Intl.NumberFormat');
  }

  if (missingFeatures.length > 0) {
    var banner = document.createElement('div');
    banner.id = 'compat-warning';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;padding:0.75rem 1rem;margin:0.5rem;border-radius:4px;';
    banner.textContent = 'Your browser is missing required features (' + missingFeatures.join(', ') + ') and this app may not work correctly. Please use a modern browser.';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  // ── Load persisted data ────────────────────────────────────────────────────
  try {
    transactions = Storage.load();
  } catch (e) {
    var errLoad = document.getElementById('err-load');
    errLoad.classList.remove('hidden');
    errLoad.textContent = 'Could not load transaction history. Starting fresh.';
    transactions = [];
  }

  // ── Initial render ─────────────────────────────────────────────────────────
  render();

  // ── Attach form submit listener ────────────────────────────────────────────
  document.getElementById('transaction-form')
    .addEventListener('submit', handleSubmit);
  // Note: delete listener is delegated — attached once inside renderList on each render
});
