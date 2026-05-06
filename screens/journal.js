// Journal screen — activity log

import { getActivityLog, deleteActivityLog } from '../supabase.js';
import { showToast } from '../utils/animations.js';

const ENTRY_META = {
  quest_complete:  { icon: '⚔️',  label: 'Quest Complete',   color: 'green'  },
  reward_redeemed: { icon: '🎁',  label: 'Reward Redeemed',  color: 'gold'   },
  level_up:        { icon: '⭐',  label: 'Level Up!',        color: 'purple' },
  stat_boost:      { icon: '📈',  label: 'Stat Boost',       color: 'blue'   },
  monthly_reset:   { icon: '🔄',  label: 'Month Reset',      color: 'purple' },
  reflection:      { icon: '🪞',  label: 'Reflection',       color: 'blue'   },
};

export async function renderJournal(userId, container, onXPUpdate) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const entries = await getActivityLog(userId, 100);
  render(entries, container, onXPUpdate);
}

function render(entries, container, onXPUpdate) {
  container.innerHTML = `
    <div class="journal-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Journal</h2>
          <p class="screen-sub">Your adventure log</p>
        </div>
      </div>

      <div class="journal-list" id="journal-list">
        ${entries.length === 0
          ? `<div class="empty-state">No activity yet.<br>Complete a quest to start your journey!</div>`
          : entries.map(e => renderEntry(e)).join('')}
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
      render(entries, container, onXPUpdate);
    } catch {
      showToast('Failed to remove entry', 'error');
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
}

function renderEntry(entry) {
  const meta = ENTRY_META[entry.entry_type] || { icon: '📝', label: 'Activity', color: 'default' };
  const date = new Date(entry.created_at);
  const timeStr = formatRelativeTime(date);
  const xpStr = entry.xp_delta > 0
    ? `<span class="gold">+${entry.xp_delta} XP</span>`
    : entry.xp_delta < 0
    ? `<span class="xp-negative">${entry.xp_delta} XP</span>`
    : '';

  return `
    <div class="journal-entry entry-${meta.color}" data-id="${entry.id}">
      <div class="entry-icon">${meta.icon}</div>
      <div class="entry-body">
        <div class="entry-header">
          <span class="entry-type">${meta.label}</span>
          ${xpStr}
        </div>
        <div class="entry-desc">${entry.description}</div>
        <div class="entry-time">${timeStr}</div>
      </div>
      <button class="icon-btn delete-entry-btn" data-id="${entry.id}" title="Remove entry">🗑️</button>
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
