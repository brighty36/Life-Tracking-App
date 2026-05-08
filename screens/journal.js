// Journal screen — activity log

import { getActivityLog, deleteActivityLog, getReflection } from '../supabase.js';
import { showToast } from '../utils/animations.js';

const ENTRY_META = {
  quest_complete:  { icon: 'QC', label: 'Quest Complete',   color: 'green'  },
  reward_redeemed: { icon: 'RW', label: 'Reward Redeemed',  color: 'gold'   },
  level_up:        { icon: 'LV', label: 'Level Up!',        color: 'purple' },
  stat_boost:      { icon: 'ST', label: 'Stat Boost',       color: 'blue'   },
  monthly_reset:   { icon: 'MR', label: 'Month Reset',      color: 'purple' },
  reflection:      { icon: 'RF', label: 'Reflection',       color: 'blue'   },
};

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'quests',      label: 'Quests',      types: ['quest_complete'] },
  { key: 'rewards',     label: 'Rewards',     types: ['reward_redeemed'] },
  { key: 'reflections', label: 'Reflections', types: ['reflection', 'monthly_reset'] },
];

const MOODS = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great'];

export async function renderJournal(userId, container, onXPUpdate) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const entries = await getActivityLog(userId, 100);
  render(entries, userId, container, onXPUpdate, 'all');
}

function filterEntries(entries, filterKey) {
  if (filterKey === 'all') return entries;
  const f = FILTERS.find(f => f.key === filterKey);
  return f ? entries.filter(e => f.types.includes(e.entry_type)) : entries;
}

function render(entries, userId, container, onXPUpdate, activeFilter) {
  const visible = filterEntries(entries, activeFilter);

  container.innerHTML = `
    <div class="journal-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Journal</h2>
          <p class="screen-sub">Your adventure log</p>
        </div>
      </div>

      <div class="tab-row">
        ${FILTERS.map(f => `
          <button class="tab-btn ${f.key === activeFilter ? 'active' : ''}" data-filter="${f.key}">
            ${f.label}
          </button>
        `).join('')}
      </div>

      <div class="journal-list" id="journal-list">
        ${visible.length === 0
          ? `<div class="empty-state">No entries here yet.</div>`
          : visible.map(e => renderEntry(e)).join('')}
      </div>
    </div>

    <!-- Reflection detail modal -->
    <div class="modal-overlay hidden" id="reflection-modal">
      <div class="modal reflection-detail-modal">
        <h3 class="modal-title" id="reflection-modal-title">Reflection</h3>
        <div id="reflection-modal-body" class="reflection-detail-body"></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-reflection-modal">Close</button>
        </div>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div class="modal-overlay hidden" id="delete-entry-modal">
      <div class="modal">
        <h3 class="modal-title">Remove Entry?</h3>
        <p class="modal-body">This will permanently remove this journal entry.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-delete-entry">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-entry">Remove</button>
        </div>
      </div>
    </div>
  `;

  let deletingEntryId = null;

  // ── Filter tabs ────────────────────────────────────────────────────────────
  container.querySelector('.tab-row').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    render(entries, userId, container, onXPUpdate, btn.dataset.filter);
  });

  // ── Reflection detail ──────────────────────────────────────────────────────
  document.getElementById('journal-list').addEventListener('click', async (e) => {
    if (e.target.closest('.delete-entry-btn')) return;
    const btn = e.target.closest('.view-reflection-btn');
    if (!btn) return;

    const date = btn.dataset.date;
    const modal = document.getElementById('reflection-modal');
    const body  = document.getElementById('reflection-modal-body');
    const title = document.getElementById('reflection-modal-title');

    title.textContent = formatDisplayDate(date);
    body.innerHTML = `<div class="loading-spinner"></div>`;
    modal.classList.remove('hidden');

    try {
      const r = await getReflection(userId, date);
      if (!r) { body.innerHTML = `<p class="text-muted">No reflection found for this date.</p>`; return; }

      const moodEmoji = r.mood ? MOODS[r.mood] : null;
      body.innerHTML = `
        ${moodEmoji ? `<div class="reflection-detail-mood">${moodEmoji}</div>` : ''}
        ${r.things_learnt ? `
          <div class="reflection-detail-section">
            <div class="reflection-detail-label">Things I learnt</div>
            <p>${escapeHtml(r.things_learnt)}</p>
          </div>` : ''}
        ${r.proud_of ? `
          <div class="reflection-detail-section">
            <div class="reflection-detail-label">Things I am proud of</div>
            <p>${escapeHtml(r.proud_of)}</p>
          </div>` : ''}
        ${r.troubled_by ? `
          <div class="reflection-detail-section">
            <div class="reflection-detail-label">Things that troubled me</div>
            <p>${escapeHtml(r.troubled_by)}</p>
          </div>` : ''}
        ${r.grateful_for ? `
          <div class="reflection-detail-section">
            <div class="reflection-detail-label">Things I am grateful for</div>
            <p>${escapeHtml(r.grateful_for)}</p>
          </div>` : ''}
      `;
    } catch {
      body.innerHTML = `<p class="text-muted">Failed to load reflection.</p>`;
    }
  });

  document.getElementById('close-reflection-modal').addEventListener('click', () => {
    document.getElementById('reflection-modal').classList.add('hidden');
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  document.getElementById('journal-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-entry-btn');
    if (!btn) return;
    deletingEntryId = btn.dataset.id;
    document.getElementById('delete-entry-modal').classList.remove('hidden');
  });

  document.getElementById('cancel-delete-entry').addEventListener('click', () => {
    document.getElementById('delete-entry-modal').classList.add('hidden');
    deletingEntryId = null;
  });

  document.getElementById('confirm-delete-entry').addEventListener('click', async () => {
    if (!deletingEntryId) return;
    try {
      const updatedProfile = await deleteActivityLog(deletingEntryId);
      entries.splice(entries.findIndex(e => e.id === deletingEntryId), 1);
      document.getElementById('delete-entry-modal').classList.add('hidden');
      deletingEntryId = null;
      if (updatedProfile && onXPUpdate) onXPUpdate(updatedProfile);
      render(entries, userId, container, onXPUpdate, activeFilter);
    } catch {
      showToast('Failed to remove entry', 'error');
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
}

function renderEntry(entry) {
  const meta    = ENTRY_META[entry.entry_type] || { icon: 'AC', label: 'Activity', color: 'default' };
  const date    = new Date(entry.created_at);
  const timeStr = formatRelativeTime(date);
  const xpStr   = entry.xp_delta > 0
    ? `<span class="gold">+${entry.xp_delta} XP</span>`
    : entry.xp_delta < 0
    ? `<span class="xp-negative">${entry.xp_delta} XP</span>`
    : '';

  // Extract YYYY-MM-DD from reflection description
  const reflectionDate = entry.entry_type === 'reflection'
    ? (entry.description.match(/(\d{4}-\d{2}-\d{2})/) || [])[1]
    : null;

  return `
    <div class="journal-entry entry-${meta.color}" data-id="${entry.id}">
      <div class="entry-icon color-${meta.color}">${meta.icon}</div>
      <div class="entry-body">
        <div class="entry-header">
          <span class="entry-type">${meta.label}</span>
          ${xpStr}
        </div>
        <div class="entry-desc">${entry.description}</div>
        <div class="entry-footer">
          <span class="entry-time">${timeStr}</span>
          ${reflectionDate ? `<button class="btn-link view-reflection-btn" data-date="${reflectionDate}">Read full →</button>` : ''}
        </div>
      </div>
      <button class="icon-btn delete-entry-btn" data-id="${entry.id}" title="Remove entry">Del</button>
    </div>
  `;
}

function formatRelativeTime(date) {
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDisplayDate(dateStr) {
  const d         = new Date(dateStr + 'T00:00:00');
  const todayStr  = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === todayStr)  return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}
