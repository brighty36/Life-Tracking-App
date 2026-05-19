// Character screen

import { getProfile, getStats, updateProfile, checkAndResetMonth, getMonthlyCategoryXP } from '../supabase.js';
import { statLabel, getEffectiveDailyXP } from '../utils/xp.js';
import { animateXPBar, showToast } from '../utils/animations.js';

const AVATAR_COLORS = ['#1558f6','#6d28d9','#059669','#dc2626','#d97706','#0891b2','#7c3aed','#be185d'];

function avatarColor(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = ((h << 5) - h) + username.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export async function renderCharacter(userId, container) {
  container.innerHTML = `<div class="loading-spinner"></div>`;

  await checkAndResetMonth(userId);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [profile, stats, monthlyXP] = await Promise.all([
    getProfile(userId),
    getStats(userId),
    getMonthlyCategoryXP(userId, currentMonth),
  ]);

  const dailyXP    = getEffectiveDailyXP(profile);
  const lifetimeXP = profile.lifetime_xp || 0;

  const resolvedStats = {
    health:        stats.health        ?? 0,
    intellect:     stats.intellect     ?? 0,
    work:          stats.work          ?? stats.ambition ?? 0,
    wealth:        stats.wealth        ?? 0,
    relationships: stats.relationships ?? 0,
  };

  const color    = avatarColor(profile.username);
  const initials = profile.username.slice(0, 2).toUpperCase();

  container.innerHTML = `
    <div class="character-screen">
      <div class="character-hero card">
        <div class="avatar-initials avatar-lg" style="background:${color}">${initials}</div>
        <div class="character-info">
          <div class="character-name-row">
            <span class="character-name" id="char-name">${profile.username}</span>
            <button class="icon-btn" id="edit-name-btn" title="Edit name">Edit</button>
          </div>
        </div>
      </div>

      <div class="xp-section card">
        <div class="xp-dual-row">
          <div class="xp-block">
            <span class="xp-block-label">Daily XP</span>
            <span class="xp-block-value">${dailyXP.toLocaleString()}</span>
          </div>
          <div class="xp-block-divider"></div>
          <div class="xp-block">
            <span class="xp-block-label">Lifetime XP</span>
            <span class="xp-block-value">${lifetimeXP.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        ${renderStatCard('health',        'Health',        resolvedStats.health,        'stat-red',    monthlyXP.health        || 0)}
        ${renderStatCard('intellect',     'Intellect',     resolvedStats.intellect,     'stat-purple', monthlyXP.intellect     || 0)}
        ${renderStatCard('work',          'Work',          resolvedStats.work,          'stat-blue',   monthlyXP.work          || 0)}
        ${renderStatCard('wealth',        'Wealth',        resolvedStats.wealth,        'stat-amber',  monthlyXP.wealth        || 0)}
        ${renderStatCard('relationships', 'Relationships', resolvedStats.relationships, 'stat-green',  monthlyXP.relationships || 0)}
      </div>
    </div>

    <!-- Name edit modal -->
    <div class="modal-overlay hidden" id="name-modal">
      <div class="modal">
        <h3 class="modal-title">Edit Name</h3>
        <input class="input" id="name-input" maxlength="30" value="${profile.username}" />
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-name-modal">Cancel</button>
          <button class="btn btn-primary" id="save-name-btn">Save</button>
        </div>
      </div>
    </div>
  `;

  // Animate stat bars
  requestAnimationFrame(() => {
    ['health','intellect','work','wealth','relationships'].forEach(stat => {
      const bar = document.getElementById(`stat-bar-${stat}`);
      if (bar) animateXPBar(bar, 0, resolvedStats[stat], 600);
    });
  });

  // Name edit
  document.getElementById('edit-name-btn').addEventListener('click', () => {
    document.getElementById('name-modal').classList.remove('hidden');
    document.getElementById('name-input').focus();
  });
  document.getElementById('close-name-modal').addEventListener('click', () => {
    document.getElementById('name-modal').classList.add('hidden');
  });
  document.getElementById('save-name-btn').addEventListener('click', async () => {
    const name = document.getElementById('name-input').value.trim();
    if (!name) return;
    try {
      await updateProfile(userId, { username: name });
      document.getElementById('char-name').textContent = name;
      document.getElementById('name-modal').classList.add('hidden');
      showToast('Name updated!', 'success');
    } catch { showToast('Failed to update name', 'error'); }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
}

function renderStatCard(stat, label, value, colorClass, monthlyXp) {
  return `
    <div class="stat-card card">
      <div class="stat-card-header">
        <span class="stat-dot ${colorClass}"></span>
        <span class="stat-label">${label}</span>
        <span class="stat-value ${colorClass}">${value}</span>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill ${colorClass}" id="stat-bar-${stat}" style="width:0%"></div>
      </div>
      <div class="stat-tier">${statLabel(value)}</div>
      ${monthlyXp > 0 ? `<div class="stat-monthly-xp">${monthlyXp.toLocaleString()} XP this month</div>` : ''}
    </div>
  `;
}
