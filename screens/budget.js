// Budget tracking screen — income & expense log with monthly view

import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from '../supabase.js';
import { showToast } from '../utils/animations.js';

const CURRENCY = '£';

const EXPENSE_CATEGORIES = [
  { value: 'housing',       label: '🏠 Housing' },
  { value: 'food',          label: '🍔 Food & Drink' },
  { value: 'transport',     label: '🚗 Transport' },
  { value: 'entertainment', label: '🎮 Entertainment' },
  { value: 'shopping',      label: '🛍️ Shopping' },
  { value: 'health',        label: '💊 Health' },
  { value: 'subscriptions', label: '📱 Subscriptions' },
  { value: 'travel',        label: '✈️ Travel' },
  { value: 'utilities',     label: '🔧 Utilities' },
  { value: 'other',         label: '🎁 Other' },
];

const INCOME_CATEGORIES = [
  { value: 'salary',     label: '💼 Salary' },
  { value: 'freelance',  label: '💸 Freelance' },
  { value: 'gift',       label: '🎁 Gift' },
  { value: 'investment', label: '📈 Investment' },
  { value: 'other',      label: '💰 Other Income' },
];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

function categoryLabel(value) {
  return (ALL_CATEGORIES.find(c => c.value === value) || { label: value }).label;
}

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function renderBudget(userId, container) {
  container.innerHTML = `<div class="loading-spinner"></div>`;

  const now = new Date();
  const state = { year: now.getFullYear(), month: now.getMonth() + 1 };

  let transactions = await getTransactions(userId, state.year, state.month);
  render(transactions, state, container, userId);
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

function render(transactions, state, container, userId) {
  const { year, month } = state;

  const income   = transactions.filter(t => t.type === 'income');
  const expenses = transactions.filter(t => t.type === 'expense');

  const totalIn  = income.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = expenses.reduce((s, t) => s + parseFloat(t.amount), 0);
  const net      = totalIn - totalOut;

  const breakdown = buildCategoryBreakdown(expenses);

  // Determine if we can go forward (don't exceed current month)
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);

  container.innerHTML = `
    <div class="budget-screen">

      <!-- Header -->
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Budget</h2>
          <p class="screen-sub">Income &amp; expenses</p>
        </div>
        <button class="btn btn-primary" id="add-tx-btn">+ Add</button>
      </div>

      <!-- Month navigator -->
      <div class="month-nav card">
        <button class="icon-btn month-prev" id="month-prev">◀</button>
        <span class="month-label">${MONTH_NAMES[month - 1]} ${year}</span>
        <button class="icon-btn month-next" id="month-next" ${isCurrentMonth ? 'disabled' : ''}>▶</button>
      </div>

      <!-- Summary -->
      <div class="budget-summary">
        <div class="summary-card card summary-in">
          <div class="summary-icon">💚</div>
          <div class="summary-label">Total In</div>
          <div class="summary-amount">${CURRENCY}${fmt(totalIn)}</div>
        </div>
        <div class="summary-card card summary-out">
          <div class="summary-icon">🔴</div>
          <div class="summary-label">Total Out</div>
          <div class="summary-amount">${CURRENCY}${fmt(totalOut)}</div>
        </div>
        <div class="summary-card card summary-net">
          <div class="summary-icon">${net >= 0 ? '✨' : '⚠️'}</div>
          <div class="summary-label">Net</div>
          <div class="summary-amount ${net >= 0 ? 'amount-positive' : 'amount-negative'}">
            ${net >= 0 ? '+' : ''}${CURRENCY}${fmt(Math.abs(net))}
          </div>
        </div>
      </div>

      <!-- Category breakdown -->
      ${breakdown.length > 0 ? `
        <div class="card">
          <div class="breakdown-title">Expenses by category</div>
          <div class="breakdown-list">
            ${breakdown.map(b => `
              <div class="breakdown-row">
                <span class="breakdown-cat">${categoryLabel(b.category)}</span>
                <span class="breakdown-amount amount-negative">${CURRENCY}${fmt(b.total)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Transaction list -->
      <div class="tx-list" id="tx-list">
        ${transactions.length === 0
          ? `<div class="empty-state">No transactions in ${MONTH_NAMES[month - 1]}.<br>Tap + Add to log one.</div>`
          : transactions.map(t => renderTxCard(t)).join('')}
      </div>
    </div>

    <!-- Add / Edit modal -->
    <div class="modal-overlay hidden" id="tx-modal">
      <div class="modal">
        <h3 class="modal-title" id="tx-modal-title">New Transaction</h3>

        <!-- Type toggle -->
        <div class="type-toggle" id="type-toggle">
          <button class="type-btn active" data-type="expense">Expense</button>
          <button class="type-btn" data-type="income">Income</button>
        </div>

        <input class="input" id="tx-title" placeholder="Description…" maxlength="80" />

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Amount (${CURRENCY})</label>
            <input class="input" id="tx-amount" type="number" min="0.01" step="0.01" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="input" id="tx-date" type="date" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="input" id="tx-category"></select>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-tx-modal">Cancel</button>
          <button class="btn btn-primary" id="save-tx-btn">Save</button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div class="modal-overlay hidden" id="delete-tx-modal">
      <div class="modal">
        <h3 class="modal-title">Delete Transaction?</h3>
        <p class="modal-body">This will permanently remove this transaction.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-delete-tx">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-tx">Delete</button>
        </div>
      </div>
    </div>
  `;

  let editingTxId  = null;
  let deletingTxId = null;

  // ─── MONTH NAVIGATION ────────────────────────────────────────────────────
  document.getElementById('month-prev').addEventListener('click', async () => {
    state.month -= 1;
    if (state.month < 1) { state.month = 12; state.year -= 1; }
    transactions = await getTransactions(userId, state.year, state.month);
    render(transactions, state, container, userId);
  });

  document.getElementById('month-next').addEventListener('click', async () => {
    if (isCurrentMonth) return;
    state.month += 1;
    if (state.month > 12) { state.month = 1; state.year += 1; }
    transactions = await getTransactions(userId, state.year, state.month);
    render(transactions, state, container, userId);
  });

  // ─── TYPE TOGGLE ─────────────────────────────────────────────────────────
  function setType(type) {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    populateCategories(type);
  }

  function populateCategories(type) {
    const sel  = document.getElementById('tx-category');
    const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    sel.innerHTML = cats.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
  }

  document.getElementById('type-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    setType(btn.dataset.type);
  });

  // ─── ADD / EDIT MODAL ────────────────────────────────────────────────────
  function openTxModal(tx = null) {
    editingTxId = tx ? tx.id : null;
    const type  = tx ? tx.type : 'expense';

    document.getElementById('tx-modal-title').textContent = tx ? 'Edit Transaction' : 'New Transaction';
    document.getElementById('tx-title').value  = tx ? tx.title : '';
    document.getElementById('tx-amount').value = tx ? tx.amount : '';
    document.getElementById('tx-date').value   = tx ? tx.date : new Date().toISOString().split('T')[0];

    // Reset toggle
    document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    populateCategories(type);
    if (tx) document.getElementById('tx-category').value = tx.category;

    document.getElementById('tx-modal').classList.remove('hidden');
    document.getElementById('tx-title').focus();
  }

  document.getElementById('add-tx-btn').addEventListener('click', () => openTxModal());
  document.getElementById('close-tx-modal').addEventListener('click', () => {
    document.getElementById('tx-modal').classList.add('hidden');
  });

  document.getElementById('save-tx-btn').addEventListener('click', async () => {
    const title    = document.getElementById('tx-title').value.trim();
    const amount   = parseFloat(document.getElementById('tx-amount').value);
    const date     = document.getElementById('tx-date').value;
    const category = document.getElementById('tx-category').value;
    const type     = document.querySelector('.type-btn.active')?.dataset.type || 'expense';

    if (!title)           { showToast('Please enter a description', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
    if (!date)            { showToast('Please select a date', 'error'); return; }

    const saveBtn = document.getElementById('save-tx-btn');
    saveBtn.disabled = true;

    try {
      if (editingTxId) {
        const updated = await updateTransaction(editingTxId, { title, amount, date, category, type });
        transactions.splice(transactions.findIndex(t => t.id === editingTxId), 1, updated);
      } else {
        const created = await createTransaction(userId, { title, amount, date, category, type });
        transactions.unshift(created);
        transactions.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
      }
      document.getElementById('tx-modal').classList.add('hidden');
      render(transactions, state, container, userId);
    } catch (err) {
      showToast('Failed to save transaction', 'error');
      saveBtn.disabled = false;
    }
  });

  // ─── LIST ACTIONS ────────────────────────────────────────────────────────
  document.getElementById('tx-list').addEventListener('click', (e) => {
    const card = e.target.closest('.tx-card');
    if (!card) return;
    const tx = transactions.find(t => t.id === card.dataset.id);
    if (!tx) return;

    if (e.target.closest('.edit-tx-btn'))   { openTxModal(tx); return; }
    if (e.target.closest('.delete-tx-btn')) {
      deletingTxId = tx.id;
      document.getElementById('delete-tx-modal').classList.remove('hidden');
    }
  });

  document.getElementById('cancel-delete-tx').addEventListener('click', () => {
    document.getElementById('delete-tx-modal').classList.add('hidden');
    deletingTxId = null;
  });

  document.getElementById('confirm-delete-tx').addEventListener('click', async () => {
    if (!deletingTxId) return;
    try {
      await deleteTransaction(deletingTxId);
      transactions.splice(transactions.findIndex(t => t.id === deletingTxId), 1);
      document.getElementById('delete-tx-modal').classList.add('hidden');
      deletingTxId = null;
      render(transactions, state, container, userId);
    } catch {
      showToast('Failed to delete transaction', 'error');
    }
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildCategoryBreakdown(expenses) {
  const map = {};
  for (const t of expenses) {
    map[t.category] = (map[t.category] || 0) + parseFloat(t.amount);
  }
  return Object.entries(map)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function renderTxCard(tx) {
  const isIncome = tx.type === 'income';
  const dateStr  = new Date(tx.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return `
    <div class="tx-card card" data-id="${tx.id}">
      <div class="tx-main">
        <div class="tx-left">
          <div class="tx-details">
            <div class="tx-title-row">
              <span class="tx-title">${tx.title}</span>
              <span class="tx-amount ${isIncome ? 'amount-positive' : 'amount-negative'}">
                ${isIncome ? '+' : '-'}${CURRENCY}${fmt(tx.amount)}
              </span>
            </div>
            <div class="tx-meta">
              <span class="tx-date">${dateStr}</span>
              <span class="tx-cat-badge tx-cat-${tx.type}">${categoryLabel(tx.category)}</span>
            </div>
          </div>
        </div>
        <div class="tx-actions">
          <button class="icon-btn edit-tx-btn" title="Edit">✏️</button>
          <button class="icon-btn delete-tx-btn" title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  `;
}
