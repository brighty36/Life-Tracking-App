// Character screen

import { getProfile, getStats, updateProfile, checkAndResetMonth, getMonthlyCategoryXP } from '../supabase.js';
import { statLabel, getEffectiveDailyXP } from '../utils/xp.js';
import { animateXPBar, showToast } from '../utils/animations.js';

const AVATARS = ['⚔️','🧙','🏹','🛡️','🗡️','🔮','🦸','🧝','🐉','🌟','🦊','🐺','🦁','👑','💎','🔥','⚡','🌙','☀️','🎭'];

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

  container.innerHTML = `
    <div class="character-screen">
      <div class="character-hero card">
        <div class="avatar-wrapper" id="avatar-btn" title="Change avatar">
          <span class="avatar-emoji" id="avatar-display">${profile.avatar}</span>
          <span class="avatar-edit-hint">✏️</span>
        </div>
        <div class="character-info">
          <div class="character-name-row">
            <span class="character-name" id="char-name">${profile.username}</span>
            <button class="icon-btn" id="edit-name-btn" title="Edit name">✏️</button>
          </div>
        </div>
        <button class="btn btn-ghost switch-profile-btn" onclick="window.switchProfile()">Switch Profile</button>
      </div>

      <div class="xp-section card">
        <div class="xp-dual-row">
          <div class="xp-block">
            <span class="xp-block-label">Daily XP</span>
            <span class="xp-block-value gold">${dailyXP.toLocaleString()}</span>
          </div>
          <div class="xp-block-divider"></div>
          <div class="xp-block">
            <span class="xp-block-label">Lifetime XP</span>
            <span class="xp-block-value gold">${lifetimeXP.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        ${renderStatCard('health',        '❤️',  'Health',        resolvedStats.health,        'stat-red',    monthlyXP.health        || 0)}
        ${renderStatCard('intellect',     '🧠',  'Intellect',     resolvedStats.intellect,     'stat-purple', monthlyXP.intellect     || 0)}
        ${renderStatCard('work',          '💼',  'Work',          resolvedStats.work,          'stat-blue',   monthlyXP.work          || 0)}
        ${renderStatCard('wealth',        '💰',  'Wealth',        resolvedStats.wealth,        'stat-amber',  monthlyXP.wealth        || 0)}
        ${renderStatCard('relationships', '🤝',  'Relationships', resolvedStats.relationships, 'stat-green',  monthlyXP.relationships || 0)}
      </div>
    </div>

    <!-- Avatar picker modal -->
    <div class="modal-overlay hidden" id="avatar-modal">
      <div class="modal">
        <h3 class="modal-title">Choose Avatar</h3>
        <div class="avatar-grid" id="avatar-grid">
          ${AVATARS.map(a => `<button class="avatar-option ${a === profile.avatar ? 'selected' : ''}" data-avatar="${a}">${a}</button>`).join('')}
        </div>
        <button class="btn btn-ghost" id="close-avatar-modal">Cancel</button>
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

  // Avatar picker
  document.getElementById('avatar-btn').addEventListener('click', () => {
    document.getElementById('avatar-modal').classList.remove('hidden');
  });
  document.getElementById('close-avatar-modal').addEventListener('click', () => {
    document.getElementById('avatar-modal').classList.add('hidden');
  });
  document.getElementById('avatar-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('.avatar-option');
    if (!btn) return;
    const avatar = btn.dataset.avatar;
    try {
      await updateProfile(userId, { avatar });
      document.getElementById('avatar-display').textContent = avatar;
      document.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('avatar-modal').classList.add('hidden');
      showToast('Avatar updated!', 'success');
    } catch { showToast('Failed to update avatar', 'error'); }
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

function renderStatCard(stat, icon, label, value, colorClass, monthlyXp) {
  return `
    <div class="stat-card card">
      <div class="stat-card-header">
        <span class="stat-icon">${icon}</span>
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
