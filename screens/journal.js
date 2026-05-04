// Journal screen — activity log

import { getActivityLog } from '../supabase.js';

const ENTRY_META = {
  quest_complete:  { icon: '⚔️',  label: 'Quest Complete',   color: 'green'  },
  reward_redeemed: { icon: '🎁',  label: 'Reward Redeemed',  color: 'gold'   },
  level_up:        { icon: '⭐',  label: 'Level Up!',        color: 'purple' },
  stat_boost:      { icon: '📈',  label: 'Stat Boost',       color: 'blue'   },
};

export async function renderJournal(userId, container) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const entries = await getActivityLog(userId, 100);
  render(entries, container);
}

function render(entries, container) {
  container.innerHTML = `
    <div class="journal-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Journal</h2>
          <p class="screen-sub">Your adventure log</p>
        </div>
      </div>

      <div class="journal-list">
        ${entries.length === 0
          ? `<div class="empty-state">No activity yet.<br>Complete a quest to start your journey!</div>`
          : entries.map(e => renderEntry(e)).join('')}
      </div>
    </div>
  `;
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
    <div class="journal-entry entry-${meta.color}">
      <div class="entry-icon">${meta.icon}</div>
      <div class="entry-body">
        <div class="entry-header">
          <span class="entry-type">${meta.label}</span>
          ${xpStr}
        </div>
        <div class="entry-desc">${entry.description}</div>
        <div class="entry-time">${timeStr}</div>
      </div>
    </div>
  `;
}

function formatRelativeTime(date) {
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
