// Daily & Weekly quests screen

import { getQuests, createQuest, updateQuest, deleteQuest, completeQuest } from '../supabase.js';
import { showToast, showLevelUpBanner, showStatBoost } from '../utils/animations.js';

const DIFFICULTY_XP    = { easy: 25, medium: 50, hard: 100, legendary: 250 };
const CATEGORY_ICONS   = { health: '❤️', mind: '🧠', work: '💼', finance: '💰', relationships: '🤝' };
const DIFFICULTY_ICONS = { easy: '🟢', medium: '🟡', hard: '🟠', legendary: '🔴' };

const DAILY_PRESETS = [
  { title: 'Walk 10,000 steps',          category: 'health', difficulty: 'medium', frequency: 'daily', description: 'Hit your daily step goal' },
  { title: 'Eat 5x Fruit and Vegetables',category: 'health', difficulty: 'easy',   frequency: 'daily', description: 'Five portions of fruit or veg today' },
];

const WEEKLY_PRESETS = [
  { title: 'Do 2x new things',  category: 'mind',          difficulty: 'medium', frequency: 'weekly', description: 'Try two things you haven\'t done before this week' },
  { title: 'Talk to 3x people', category: 'relationships', difficulty: 'easy',   frequency: 'weekly', description: 'Have a meaningful conversation with three people' },
];

// ─── DATE HELPERS ────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0]; }

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function isCompletedToday(quest) {
  return quest.last_completed === today();
}

function isCompletedThisWeek(quest) {
  if (!quest.last_completed) return false;
  return quest.last_completed >= getWeekStart();
}

function isDone(quest) {
  return quest.frequency === 'weekly' ? isCompletedThisWeek(quest) : isCompletedToday(quest);
}

function hasActiveStreak(quest) {
  if (!quest.last_completed || quest.streak < 2) return false;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastWeek  = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  if (quest.frequency === 'weekly') return quest.last_completed >= lastWeek;
  return quest.last_completed === yesterday || quest.last_completed === today();
}

function isOverdue(quest) {
  if (!quest.deadline) return false;
  return quest.deadline < today() && !isDone(quest);
}

// ─── MAIN RENDER ─────────────────────────────────────────────────────────────

export async function renderQuests(userId, container, onXPUpdate) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const quests = await getQuests(userId);
  render(quests, container, userId, onXPUpdate, 'daily');
}

function render(quests, container, userId, onXPUpdate, activeTab = 'daily') {
  const daily   = quests.filter(q => q.frequency !== 'weekly');
  const weekly  = quests.filter(q => q.frequency === 'weekly');
  const current = activeTab === 'daily' ? daily : weekly;
  const done    = current.filter(isDone).length;

  container.innerHTML = `
    <div class="quests-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Quests</h2>
          <p class="screen-sub">${done}/${current.length} completed</p>
        </div>
        <div class="quest-header-btns">
          <button class="btn btn-ghost btn-sm" id="presets-btn">⚡ Presets</button>
          <button class="btn btn-primary" id="add-quest-btn">+ Add</button>
        </div>
      </div>

      <!-- Frequency tabs -->
      <div class="tab-row">
        <button class="tab-btn ${activeTab === 'daily' ? 'active' : ''}" data-tab="daily">
          ☀️ Daily <span class="tab-count">${daily.filter(isDone).length}/${daily.length}</span>
        </button>
        <button class="tab-btn ${activeTab === 'weekly' ? 'active' : ''}" data-tab="weekly">
          📅 Weekly <span class="tab-count">${weekly.filter(isDone).length}/${weekly.length}</span>
        </button>
      </div>

      <div class="progress-track">
        <div class="progress-fill" id="daily-progress"
             style="width:${current.length ? (done / current.length * 100) : 0}%"></div>
      </div>

      <div class="quest-list" id="quest-list">
        ${current.length === 0
          ? `<div class="empty-state">No ${activeTab} quests yet.<br>Add one or pick a preset!</div>`
          : current.map(q => renderQuestCard(q)).join('')}
      </div>
    </div>

    <!-- Add / Edit modal -->
    <div class="modal-overlay hidden" id="quest-modal">
      <div class="modal modal-wide">
        <h3 class="modal-title" id="quest-modal-title">New Quest</h3>
        <input class="input" id="quest-title" placeholder="Quest title…" maxlength="80" />
        <textarea class="input textarea" id="quest-desc" placeholder="Description (optional)…" rows="2"></textarea>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="input" id="quest-category">
              <option value="health">❤️ Health</option>
              <option value="mind">🧠 Mind</option>
              <option value="work">💼 Work</option>
              <option value="finance">💰 Finance</option>
              <option value="relationships">🤝 Relationships</option>
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
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Frequency</label>
            <select class="input" id="quest-frequency">
              <option value="daily">☀️ Daily</option>
              <option value="weekly">📅 Weekly</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Deadline (optional)</label>
            <input class="input" id="quest-deadline" type="date" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-quest-modal">Cancel</button>
          <button class="btn btn-primary" id="save-quest-btn">Save Quest</button>
        </div>
      </div>
    </div>

    <!-- Presets modal -->
    <div class="modal-overlay hidden" id="presets-modal">
      <div class="modal modal-wide">
        <h3 class="modal-title">⚡ Preset Missions</h3>
        <p class="modal-body">Tap a preset to add it to your quests instantly.</p>

        <div class="preset-section-label">☀️ Daily</div>
        <div class="preset-list">
          ${DAILY_PRESETS.map((p, i) => renderPresetCard(p, i, 'daily', quests)).join('')}
        </div>

        <div class="preset-section-label">📅 Weekly</div>
        <div class="preset-list">
          ${WEEKLY_PRESETS.map((p, i) => renderPresetCard(p, i, 'weekly', quests)).join('')}
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-presets-modal">Close</button>
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

  let editingQuestId  = null;
  let deletingQuestId = null;

  // ─── TABS ────────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => render(quests, container, userId, onXPUpdate, btn.dataset.tab));
  });

  // ─── ADD QUEST ───────────────────────────────────────────────────────────
  document.getElementById('add-quest-btn').addEventListener('click', () => openQuestModal(null, activeTab));
  document.getElementById('close-quest-modal').addEventListener('click', () => {
    document.getElementById('quest-modal').classList.add('hidden');
  });

  function openQuestModal(quest, tab = 'daily') {
    editingQuestId = quest ? quest.id : null;
    document.getElementById('quest-modal-title').textContent = quest ? 'Edit Quest' : 'New Quest';
    document.getElementById('quest-title').value      = quest ? quest.title : '';
    document.getElementById('quest-desc').value       = quest ? (quest.description || '') : '';
    document.getElementById('quest-category').value   = quest ? quest.category : 'health';
    document.getElementById('quest-difficulty').value = quest ? quest.difficulty : 'easy';
    document.getElementById('quest-frequency').value  = quest ? quest.frequency : tab;
    document.getElementById('quest-deadline').value   = quest ? (quest.deadline || '') : '';
    document.getElementById('quest-modal').classList.remove('hidden');
    document.getElementById('quest-title').focus();
  }

  document.getElementById('save-quest-btn').addEventListener('click', async () => {
    const title       = document.getElementById('quest-title').value.trim();
    const description = document.getElementById('quest-desc').value.trim() || null;
    const category    = document.getElementById('quest-category').value;
    const difficulty  = document.getElementById('quest-difficulty').value;
    const frequency   = document.getElementById('quest-frequency').value;
    const deadline    = document.getElementById('quest-deadline').value || null;

    if (!title) { showToast('Please enter a quest title', 'error'); return; }

    try {
      if (editingQuestId) {
        const updated = await updateQuest(editingQuestId, { title, description, category, difficulty, frequency, deadline });
        quests.splice(quests.findIndex(q => q.id === editingQuestId), 1, updated);
      } else {
        const newQ = await createQuest(userId, { title, description, category, difficulty, frequency, deadline, is_recurring: true });
        quests.push(newQ);
      }
      document.getElementById('quest-modal').classList.add('hidden');
      render(quests, container, userId, onXPUpdate, frequency);
    } catch { showToast('Failed to save quest', 'error'); }
  });

  // ─── PRESETS ─────────────────────────────────────────────────────────────
  document.getElementById('presets-btn').addEventListener('click', () => {
    document.getElementById('presets-modal').classList.remove('hidden');
  });
  document.getElementById('close-presets-modal').addEventListener('click', () => {
    document.getElementById('presets-modal').classList.add('hidden');
  });

  document.querySelectorAll('.preset-add-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx  = parseInt(btn.dataset.idx);
      const type = btn.dataset.type;
      const preset = type === 'daily' ? DAILY_PRESETS[idx] : WEEKLY_PRESETS[idx];
      btn.disabled = true;
      btn.textContent = 'Adding…';
      try {
        const newQ = await createQuest(userId, { ...preset, is_recurring: true });
        quests.push(newQ);
        btn.textContent = '✓ Added';
        btn.classList.add('btn-added');
        showToast(`"${preset.title}" added!`, 'success');
      } catch {
        showToast('Failed to add preset', 'error');
        btn.disabled = false;
        btn.textContent = '+ Add';
      }
    });
  });

  // ─── QUEST LIST ACTIONS ──────────────────────────────────────────────────
  document.getElementById('quest-list').addEventListener('click', async (e) => {
    const card = e.target.closest('.quest-card');
    if (!card) return;
    const questId = card.dataset.id;
    const quest   = quests.find(q => q.id === questId);
    if (!quest) return;

    if (e.target.closest('.complete-btn')) {
      if (isDone(quest)) return;
      const btn = e.target.closest('.complete-btn');
      btn.disabled = true;
      try {
        const result = await completeQuest(userId, quest);
        quest.last_completed = today();
        quest.streak = result.profile ? quest.streak + 1 : 1;

        showStatBoost(result.statKey, result.statBoost);
        if (result.leveledUp) showLevelUpBanner(result.newLevel, result.className);
        if (onXPUpdate) onXPUpdate(result.profile);

        showToast(`+${quest.xp_reward} XP earned!`, 'success');
        render(quests, container, userId, onXPUpdate, activeTab);
      } catch (err) {
        showToast('Failed to complete quest', 'error');
        btn.disabled = false;
      }
      return;
    }

    if (e.target.closest('.edit-quest-btn')) { openQuestModal(quest); return; }

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
      quests.splice(quests.findIndex(q => q.id === deletingQuestId), 1);
      document.getElementById('delete-quest-modal').classList.add('hidden');
      deletingQuestId = null;
      render(quests, container, userId, onXPUpdate, activeTab);
    } catch { showToast('Failed to delete quest', 'error'); }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
}

// ─── CARD RENDERERS ──────────────────────────────────────────────────────────

function renderQuestCard(quest) {
  const done    = isDone(quest);
  const overdue = isOverdue(quest);
  const streak  = hasActiveStreak(quest);
  const catIcon = CATEGORY_ICONS[quest.category] || '📋';
  const diffBadge = `<span class="badge badge-${quest.difficulty}">${DIFFICULTY_ICONS[quest.difficulty]} ${quest.difficulty}</span>`;
  const deadlineStr = quest.deadline
    ? `<span class="quest-deadline ${overdue ? 'overdue' : ''}">📅 ${formatDate(quest.deadline)}</span>`
    : '';

  return `
    <div class="quest-card card ${done ? 'quest-done' : ''} ${overdue ? 'quest-overdue' : ''}" data-id="${quest.id}">
      <div class="quest-main">
        <div class="quest-left">
          <button class="complete-btn ${done ? 'done' : ''}" ${done ? 'disabled' : ''}>
            ${done ? '✓' : '○'}
          </button>
          <div class="quest-details">
            <div class="quest-title-row">
              <span class="quest-title">${quest.title}</span>
              ${streak ? `<span class="streak-badge" title="${quest.streak} streak">🔥 ${quest.streak}</span>` : ''}
            </div>
            ${quest.description ? `<div class="quest-description">${quest.description}</div>` : ''}
            <div class="quest-meta">
              <span class="quest-cat">${catIcon} ${quest.category}</span>
              ${diffBadge}
              <span class="quest-xp gold">+${quest.xp_reward} XP</span>
              ${deadlineStr}
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

function renderPresetCard(preset, idx, type, existingQuests) {
  const alreadyAdded = existingQuests.some(
    q => q.title === preset.title && q.frequency === preset.frequency
  );
  const catIcon = CATEGORY_ICONS[preset.category] || '📋';
  return `
    <div class="preset-card">
      <div class="preset-info">
        <div class="preset-title">${catIcon} ${preset.title}</div>
        <div class="preset-meta">
          <span class="badge badge-${preset.difficulty}">${preset.difficulty}</span>
          <span class="gold" style="font-size:0.75rem">+${({ easy:25,medium:50,hard:100,legendary:250 })[preset.difficulty]} XP</span>
        </div>
        ${preset.description ? `<div class="preset-desc">${preset.description}</div>` : ''}
      </div>
      <button
        class="btn btn-sm ${alreadyAdded ? 'btn-added' : 'btn-primary'} preset-add-btn"
        data-idx="${idx}" data-type="${type}"
        ${alreadyAdded ? 'disabled' : ''}
      >${alreadyAdded ? '✓ Added' : '+ Add'}</button>
    </div>
  `;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
