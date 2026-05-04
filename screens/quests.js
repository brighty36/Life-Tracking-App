// Daily quests screen

import { getQuests, createQuest, updateQuest, deleteQuest, completeQuest } from '../supabase.js';
import { showToast, showLevelUpBanner, showStatBoost, animateXPBar } from '../utils/animations.js';

const DIFFICULTY_XP   = { easy: 25, medium: 50, hard: 100, legendary: 250 };
const CATEGORY_ICONS  = { health: '💪', mind: '🧠', career: '🎯', finance: '💰' };
const DIFFICULTY_ICONS = { easy: '🟢', medium: '🟡', hard: '🟠', legendary: '🔴' };

function isCompletedToday(quest) {
  if (!quest.last_completed) return false;
  const today = new Date().toISOString().split('T')[0];
  return quest.last_completed === today;
}

function hasActiveStreak(quest) {
  if (!quest.last_completed) return false;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  return quest.last_completed === yesterday || quest.last_completed === today;
}

export async function renderQuests(userId, container, onXPUpdate) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const quests = await getQuests(userId);
  render(quests, container, userId, onXPUpdate);
}

function render(quests, container, userId, onXPUpdate) {
  const total = quests.length;
  const done  = quests.filter(isCompletedToday).length;

  container.innerHTML = `
    <div class="quests-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Daily Quests</h2>
          <p class="screen-sub">${done}/${total} completed today</p>
        </div>
        <button class="btn btn-primary" id="add-quest-btn">+ Add Quest</button>
      </div>

      <div class="progress-track">
        <div class="progress-fill" id="daily-progress" style="width:${total ? (done/total*100) : 0}%"></div>
      </div>

      <div class="quest-list" id="quest-list">
        ${quests.length === 0
          ? `<div class="empty-state">No quests yet.<br>Add your first daily quest!</div>`
          : quests.map(q => renderQuestCard(q)).join('')}
      </div>
    </div>

    <!-- Add / Edit modal -->
    <div class="modal-overlay hidden" id="quest-modal">
      <div class="modal">
        <h3 class="modal-title" id="quest-modal-title">New Quest</h3>
        <input class="input" id="quest-title" placeholder="Quest title…" maxlength="80" />
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="input" id="quest-category">
              <option value="health">💪 Health</option>
              <option value="mind">🧠 Mind</option>
              <option value="career">🎯 Career</option>
              <option value="finance">💰 Finance</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Difficulty</label>
            <select class="input" id="quest-difficulty">
              <option value="easy">Easy (25 XP)</option>
              <option value="medium">Medium (50 XP)</option>
              <option value="hard">Hard (100 XP)</option>
              <option value="legendary">Legendary (250 XP)</option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-quest-modal">Cancel</button>
          <button class="btn btn-primary" id="save-quest-btn">Save Quest</button>
        </div>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div class="modal-overlay hidden" id="delete-quest-modal">
      <div class="modal">
        <h3 class="modal-title">Delete Quest?</h3>
        <p class="modal-body">This will permanently delete the quest and its streak.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-delete-quest">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-quest">Delete</button>
        </div>
      </div>
    </div>
  `;

  let editingQuestId = null;
  let deletingQuestId = null;

  // ─── ADD QUEST ───────────────────────────────────────────────────────────
  document.getElementById('add-quest-btn').addEventListener('click', () => {
    editingQuestId = null;
    document.getElementById('quest-modal-title').textContent = 'New Quest';
    document.getElementById('quest-title').value = '';
    document.getElementById('quest-category').value = 'health';
    document.getElementById('quest-difficulty').value = 'easy';
    document.getElementById('quest-modal').classList.remove('hidden');
    document.getElementById('quest-title').focus();
  });

  document.getElementById('close-quest-modal').addEventListener('click', () => {
    document.getElementById('quest-modal').classList.add('hidden');
  });

  document.getElementById('save-quest-btn').addEventListener('click', async () => {
    const title      = document.getElementById('quest-title').value.trim();
    const category   = document.getElementById('quest-category').value;
    const difficulty = document.getElementById('quest-difficulty').value;
    if (!title) { showToast('Please enter a quest title', 'error'); return; }

    try {
      if (editingQuestId) {
        const updated = await updateQuest(editingQuestId, { title, category, difficulty });
        quests.splice(quests.findIndex(q => q.id === editingQuestId), 1, updated);
      } else {
        const newQ = await createQuest(userId, { title, category, difficulty, is_recurring: true });
        quests.push(newQ);
      }
      document.getElementById('quest-modal').classList.add('hidden');
      render(quests, container, userId, onXPUpdate);
    } catch (err) {
      showToast('Failed to save quest', 'error');
    }
  });

  // ─── QUEST LIST ACTIONS ──────────────────────────────────────────────────
  document.getElementById('quest-list').addEventListener('click', async (e) => {
    const card = e.target.closest('.quest-card');
    if (!card) return;
    const questId = card.dataset.id;
    const quest   = quests.find(q => q.id === questId);
    if (!quest) return;

    // Complete button
    if (e.target.closest('.complete-btn')) {
      if (isCompletedToday(quest)) return;
      const btn = e.target.closest('.complete-btn');
      btn.disabled = true;
      try {
        const result = await completeQuest(userId, quest);
        quest.last_completed = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        quest.streak = quest.last_completed === yesterday ? quest.streak + 1 : 1;

        showStatBoost(result.statKey, result.statBoost);
        if (result.leveledUp) showLevelUpBanner(result.newLevel, result.className);
        if (onXPUpdate) onXPUpdate(result.profile);

        card.classList.add('quest-done');
        card.querySelector('.complete-btn').textContent = '✓';
        const doneEl = document.querySelector('.screen-sub');
        const doneNow = quests.filter(isCompletedToday).length;
        if (doneEl) doneEl.textContent = `${doneNow}/${quests.length} completed today`;
        const bar = document.getElementById('daily-progress');
        if (bar) bar.style.width = `${(doneNow / quests.length) * 100}%`;
        showToast(`+${quest.xp_reward} XP earned!`, 'success');
      } catch (err) {
        showToast('Failed to complete quest', 'error');
        btn.disabled = false;
      }
      return;
    }

    // Edit button
    if (e.target.closest('.edit-quest-btn')) {
      editingQuestId = questId;
      document.getElementById('quest-modal-title').textContent = 'Edit Quest';
      document.getElementById('quest-title').value = quest.title;
      document.getElementById('quest-category').value = quest.category;
      document.getElementById('quest-difficulty').value = quest.difficulty;
      document.getElementById('quest-modal').classList.remove('hidden');
      document.getElementById('quest-title').focus();
      return;
    }

    // Delete button
    if (e.target.closest('.delete-quest-btn')) {
      deletingQuestId = questId;
      document.getElementById('delete-quest-modal').classList.remove('hidden');
      return;
    }
  });

  // Delete confirm
  document.getElementById('cancel-delete-quest').addEventListener('click', () => {
    document.getElementById('delete-quest-modal').classList.add('hidden');
    deletingQuestId = null;
  });
  document.getElementById('confirm-delete-quest').addEventListener('click', async () => {
    if (!deletingQuestId) return;
    try {
      await deleteQuest(deletingQuestId);
      const idx = quests.findIndex(q => q.id === deletingQuestId);
      if (idx > -1) quests.splice(idx, 1);
      document.getElementById('delete-quest-modal').classList.add('hidden');
      deletingQuestId = null;
      render(quests, container, userId, onXPUpdate);
    } catch (err) {
      showToast('Failed to delete quest', 'error');
    }
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

function renderQuestCard(quest) {
  const done    = isCompletedToday(quest);
  const streak  = hasActiveStreak(quest);
  const diffBadge = `<span class="badge badge-${quest.difficulty}">${DIFFICULTY_ICONS[quest.difficulty]} ${quest.difficulty}</span>`;
  const catIcon  = CATEGORY_ICONS[quest.category] || '📋';

  return `
    <div class="quest-card card ${done ? 'quest-done' : ''}" data-id="${quest.id}">
      <div class="quest-main">
        <div class="quest-left">
          <button class="complete-btn ${done ? 'done' : ''}" ${done ? 'disabled' : ''}>
            ${done ? '✓' : '○'}
          </button>
          <div class="quest-details">
            <div class="quest-title-row">
              <span class="quest-title">${quest.title}</span>
              ${streak && quest.streak > 1 ? `<span class="streak-badge" title="${quest.streak} day streak">🔥 ${quest.streak}</span>` : ''}
            </div>
            <div class="quest-meta">
              <span class="quest-cat">${catIcon} ${quest.category}</span>
              ${diffBadge}
              <span class="quest-xp gold">+${quest.xp_reward} XP</span>
            </div>
          </div>
        </div>
        <div class="quest-actions">
          <button class="icon-btn edit-quest-btn" title="Edit">✏️</button>
          <button class="icon-btn delete-quest-btn" title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  `;
}
