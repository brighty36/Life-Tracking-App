// Activity screen — Tasks / Projects / Quests

import { getQuests, createQuest, updateQuest, deleteQuest, completeQuest,
         getObjectives, createObjective, updateObjective, deleteObjective } from '../supabase.js';
import { showToast, showLevelUpBanner, showStatBoost } from '../utils/animations.js';
import { attachCalendar, todayStr, endOfWeek } from '../utils/calendar.js';

const DIFFICULTY_XP = { fun: 0, quick: 5, easy: 25, medium: 50, hard: 100, legendary: 250 };
const DIFFICULTY_ICONS = { fun: '🎉', quick: '⚡', easy: '🟢', medium: '🟡', hard: '🟠', legendary: '🔴' };
const CATEGORY_ICONS = {
  health: '❤️', mind: '🧠', work: '💼', finance: '💰', relationships: '🤝',
};
const OBJ_CATEGORY_ICONS = { health: '💪', mind: '🧠', career: '🎯', finance: '💰' };
const ALL_CATEGORIES = ['health','mind','work','finance','relationships'];

// Tab → DB frequency mapping
const TAB_FREQ = { task: 'daily', project: 'weekly' };

const PRESETS = [
  { title: 'Walk 10,000 Steps',                 category: 'health',        difficulty: 'medium', description: 'Hit your daily step goal' },
  { title: 'Eat 5 x Fruit and Veg',             category: 'health',        difficulty: 'medium', description: 'Five portions of fruit or veg today' },
  { title: 'Have a meaningful conversation',     category: 'relationships', difficulty: 'medium', description: 'Connect with someone on a deeper level' },
  { title: 'Try something new',                  category: 'mind',          difficulty: 'easy',   description: 'Step outside your comfort zone' },
  { title: 'Do something nice for someone else', category: 'relationships', difficulty: 'easy',   description: 'Spread kindness today' },
];

function isOverdue(quest) {
  if (!quest.deadline) return false;
  return quest.deadline < todayStr();
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function renderCats(category) {
  if (!category) return '';
  return category.split(',').map(c => {
    const key = c.trim();
    return `<span class="quest-cat">${CATEGORY_ICONS[key] || '📋'} ${key}</span>`;
  }).join('');
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function renderQuests(userId, container, onXPUpdate) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const [quests, objectives] = await Promise.all([
    getQuests(userId),
    getObjectives(userId),
  ]);
  render(quests, objectives, container, userId, onXPUpdate, 'task');
}

// ─── MAIN RENDER ─────────────────────────────────────────────────────────────

function render(quests, objectives, container, userId, onXPUpdate, activeTab = 'task') {
  const tasks    = quests.filter(q => q.frequency !== 'weekly');
  const projects = quests.filter(q => q.frequency === 'weekly');

  const tabCount = {
    task:     tasks.length,
    project:  projects.length,
    longterm: objectives.length,
  };

  container.innerHTML = `
    <div class="quests-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Activity</h2>
          <p class="screen-sub">${tabSubtitle(activeTab, tabCount)}</p>
        </div>
        <div class="quest-header-btns">
          ${activeTab !== 'longterm' ? `<button class="btn btn-ghost btn-sm" id="presets-btn">⚡ Presets</button>` : ''}
          <button class="btn btn-primary" id="add-main-btn">+ Add</button>
        </div>
      </div>

      <div class="tab-row">
        <button class="tab-btn ${activeTab === 'task'     ? 'active' : ''}" data-tab="task">
          ✅ Tasks <span class="tab-count">${tabCount.task}</span>
        </button>
        <button class="tab-btn ${activeTab === 'project'  ? 'active' : ''}" data-tab="project">
          📋 Projects <span class="tab-count">${tabCount.project}</span>
        </button>
        <button class="tab-btn ${activeTab === 'longterm' ? 'active' : ''}" data-tab="longterm">
          🎯 Quests <span class="tab-count">${tabCount.longterm}</span>
        </button>
      </div>

      ${activeTab !== 'longterm' ? `
        <div class="quest-list" id="quest-list">
          ${(activeTab === 'task' ? tasks : projects).length === 0
            ? `<div class="empty-state">No ${activeTab === 'task' ? 'tasks' : 'projects'} yet.<br>Add one or pick a preset!</div>`
            : (activeTab === 'task' ? tasks : projects).map(renderQuestCard).join('')}
        </div>
      ` : `
        <div class="obj-list" id="obj-list">
          ${objectives.length === 0
            ? `<div class="empty-state">No quests yet.<br>Set a long-term goal to get started!</div>`
            : objectives.map(renderObjCard).join('')}
        </div>
      `}
    </div>

    <!-- Activity add/edit modal -->
    <div class="modal-overlay hidden" id="quest-modal">
      <div class="modal modal-wide">
        <h3 class="modal-title" id="quest-modal-title">New Activity</h3>
        <input class="input" id="quest-title" placeholder="Title…" maxlength="80" />
        <textarea class="input textarea" id="quest-desc" placeholder="Description (optional)…" rows="2"></textarea>

        <div class="form-group">
          <label class="form-label">Categories</label>
          <div class="cat-chips" id="quest-categories">
            ${ALL_CATEGORIES.map(c => `
              <button type="button" class="cat-chip" data-cat="${c}">${CATEGORY_ICONS[c]} ${c}</button>
            `).join('')}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Difficulty</label>
            <select class="input" id="quest-difficulty">
              <option value="fun">🎉 Fun (0 XP)</option>
              <option value="quick">⚡ Quick (5 XP)</option>
              <option value="easy">🟢 Easy (25 XP)</option>
              <option value="medium" selected>🟡 Medium (50 XP)</option>
              <option value="hard">🟠 Hard (100 XP)</option>
              <option value="legendary">🔴 Legendary (250 XP)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Deadline (optional)</label>
            <div class="deadline-row">
              <input class="input" id="quest-deadline" placeholder="Pick a date…" />
              <div class="deadline-quick-btns">
                <button type="button" class="btn btn-xs btn-ghost" id="dl-today">Today</button>
                <button type="button" class="btn btn-xs btn-ghost" id="dl-week">Week</button>
                <button type="button" class="btn btn-xs btn-ghost" id="dl-clear">✕</button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-quest-modal">Cancel</button>
          <button class="btn btn-primary" id="save-quest-btn">Save</button>
        </div>
      </div>
    </div>

    <!-- Long-term quest add/edit modal -->
    <div class="modal-overlay hidden" id="obj-modal">
      <div class="modal modal-wide">
        <h3 class="modal-title" id="obj-modal-title">New Quest</h3>
        <input class="input" id="obj-title" placeholder="Quest title…" maxlength="100" />
        <textarea class="input textarea" id="obj-desc" placeholder="Description (optional)…" rows="2"></textarea>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="input" id="obj-category">
              <option value="health">💪 Health</option>
              <option value="mind">🧠 Mind</option>
              <option value="career">🎯 Career</option>
              <option value="finance">💰 Finance</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Progress (%)</label>
            <input class="input" id="obj-progress" type="number" min="0" max="100" value="0" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Milestones (one per line)</label>
          <textarea class="input textarea" id="obj-milestones" placeholder="e.g. Research options&#10;Make a plan&#10;Take first step" rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-obj-modal">Cancel</button>
          <button class="btn btn-primary" id="save-obj-btn">Save Quest</button>
        </div>
      </div>
    </div>

    <!-- Presets modal -->
    <div class="modal-overlay hidden" id="presets-modal">
      <div class="modal modal-wide">
        <h3 class="modal-title">⚡ Preset Missions</h3>
        <p class="modal-body">Tap a preset to add it instantly.</p>
        <div class="preset-list">
          ${PRESETS.map((p, i) => renderPresetCard(p, i, quests)).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-presets-modal">Close</button>
        </div>
      </div>
    </div>

    <!-- Progress modal -->
    <div class="modal-overlay hidden" id="progress-modal">
      <div class="modal">
        <h3 class="modal-title">Update Progress</h3>
        <div class="progress-input-group">
          <input class="input" id="progress-input" type="number" min="0" max="100" value="0" />
          <span class="progress-pct-label">%</span>
        </div>
        <input class="range-input" id="progress-range" type="range" min="0" max="100" value="0" />
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-progress-modal">Cancel</button>
          <button class="btn btn-primary" id="save-progress-btn">Update</button>
        </div>
      </div>
    </div>

    <!-- Delete activity modal -->
    <div class="modal-overlay hidden" id="delete-quest-modal">
      <div class="modal">
        <h3 class="modal-title">Delete Activity?</h3>
        <p class="modal-body">This will permanently delete this activity.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-delete-quest">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-quest">Delete</button>
        </div>
      </div>
    </div>

    <!-- Delete quest modal -->
    <div class="modal-overlay hidden" id="delete-obj-modal">
      <div class="modal">
        <h3 class="modal-title">Delete Quest?</h3>
        <p class="modal-body">This will permanently delete this goal.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-delete-obj">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-obj">Delete</button>
        </div>
      </div>
    </div>
  `;

  let editingQuestId  = null;
  let deletingQuestId = null;
  let editingObjId    = null;
  let progressObjId   = null;
  let deletingObjId   = null;
  let selectedCategories = ['health'];

  // ─── TABS ────────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => render(quests, objectives, container, userId, onXPUpdate, btn.dataset.tab));
  });

  // ─── ADD BUTTON ──────────────────────────────────────────────────────────
  document.getElementById('add-main-btn').addEventListener('click', () => {
    if (activeTab === 'longterm') openObjModal(null);
    else openQuestModal(null);
  });

  // ─── QUEST MODAL ─────────────────────────────────────────────────────────
  function openQuestModal(quest) {
    editingQuestId = quest ? quest.id : null;
    document.getElementById('quest-modal-title').textContent = quest ? 'Edit Activity' : 'New Activity';
    document.getElementById('quest-title').value      = quest ? quest.title : '';
    document.getElementById('quest-desc').value       = quest ? (quest.description || '') : '';
    document.getElementById('quest-difficulty').value = quest ? quest.difficulty : 'medium';
    document.getElementById('quest-deadline').value   = quest ? (quest.deadline || '') : '';

    // Init category chips
    selectedCategories = quest && quest.category
      ? quest.category.split(',').map(c => c.trim()).filter(Boolean)
      : ['health'];
    syncCategoryChips();

    document.getElementById('quest-modal').classList.remove('hidden');
    document.getElementById('quest-title').focus();
  }

  function syncCategoryChips() {
    document.querySelectorAll('.cat-chip').forEach(chip => {
      chip.classList.toggle('active', selectedCategories.includes(chip.dataset.cat));
    });
  }

  document.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.cat;
      if (selectedCategories.includes(cat)) {
        if (selectedCategories.length > 1) selectedCategories = selectedCategories.filter(c => c !== cat);
      } else {
        selectedCategories.push(cat);
      }
      syncCategoryChips();
    });
  });

  // Calendar & quick-date buttons
  const deadlineInput = document.getElementById('quest-deadline');
  attachCalendar(deadlineInput);
  document.getElementById('dl-today').addEventListener('click', () => {
    deadlineInput.value = todayStr();
    deadlineInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.getElementById('dl-week').addEventListener('click', () => {
    deadlineInput.value = endOfWeek();
    deadlineInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.getElementById('dl-clear').addEventListener('click', () => {
    deadlineInput.value = '';
  });

  document.getElementById('close-quest-modal').addEventListener('click', () => {
    document.getElementById('quest-modal').classList.add('hidden');
  });

  document.getElementById('save-quest-btn').addEventListener('click', async () => {
    const title       = document.getElementById('quest-title').value.trim();
    const description = document.getElementById('quest-desc').value.trim() || null;
    const difficulty  = document.getElementById('quest-difficulty').value;
    const deadline    = document.getElementById('quest-deadline').value || null;
    const category    = selectedCategories.join(',');
    const frequency   = TAB_FREQ[activeTab] || 'daily';

    if (!title) { showToast('Please enter a title', 'error'); return; }

    try {
      if (editingQuestId) {
        const updated = await updateQuest(editingQuestId, { title, description, category, difficulty, deadline });
        quests.splice(quests.findIndex(q => q.id === editingQuestId), 1, updated);
      } else {
        const newQ = await createQuest(userId, { title, description, category, difficulty, frequency, deadline, is_recurring: false });
        quests.push(newQ);
      }
      document.getElementById('quest-modal').classList.add('hidden');
      render(quests, objectives, container, userId, onXPUpdate, activeTab);
    } catch (err) {
      showToast('Failed to save activity', 'error');
    }
  });

  // ─── OBJ MODAL ───────────────────────────────────────────────────────────
  function openObjModal(obj) {
    editingObjId = obj ? obj.id : null;
    document.getElementById('obj-modal-title').textContent = obj ? 'Edit Quest' : 'New Quest';
    document.getElementById('obj-title').value    = obj ? obj.title : '';
    document.getElementById('obj-desc').value     = obj ? (obj.description || '') : '';
    document.getElementById('obj-category').value = obj ? obj.category : 'health';
    document.getElementById('obj-progress').value = obj ? obj.progress : 0;
    document.getElementById('obj-milestones').value = obj
      ? (obj.milestones || []).map(m => m.text || m).join('\n') : '';
    document.getElementById('obj-modal').classList.remove('hidden');
    document.getElementById('obj-title').focus();
  }

  document.getElementById('close-obj-modal').addEventListener('click', () => {
    document.getElementById('obj-modal').classList.add('hidden');
  });

  document.getElementById('save-obj-btn').addEventListener('click', async () => {
    const title         = document.getElementById('obj-title').value.trim();
    const description   = document.getElementById('obj-desc').value.trim();
    const category      = document.getElementById('obj-category').value;
    const progress      = parseInt(document.getElementById('obj-progress').value) || 0;
    const milestonesRaw = document.getElementById('obj-milestones').value.trim();
    const milestones    = milestonesRaw
      ? milestonesRaw.split('\n').filter(l => l.trim()).map(text => ({ text: text.trim(), done: false }))
      : [];
    if (!title) { showToast('Please enter a title', 'error'); return; }
    const payload = { title, description, category, progress: Math.min(100, Math.max(0, progress)), milestones, completed: progress >= 100 };
    try {
      if (editingObjId) {
        const updated = await updateObjective(editingObjId, payload);
        objectives.splice(objectives.findIndex(o => o.id === editingObjId), 1, updated);
      } else {
        objectives.unshift(await createObjective(userId, payload));
      }
      document.getElementById('obj-modal').classList.add('hidden');
      render(quests, objectives, container, userId, onXPUpdate, 'longterm');
    } catch { showToast('Failed to save quest', 'error'); }
  });

  // ─── PRESETS ─────────────────────────────────────────────────────────────
  const presetsBtn = document.getElementById('presets-btn');
  if (presetsBtn) {
    presetsBtn.addEventListener('click', () => document.getElementById('presets-modal').classList.remove('hidden'));
  }
  document.getElementById('close-presets-modal').addEventListener('click', () => {
    document.getElementById('presets-modal').classList.add('hidden');
  });
  document.querySelectorAll('.preset-add-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const preset = PRESETS[parseInt(btn.dataset.idx)];
      btn.disabled    = true;
      btn.textContent = 'Adding…';
      try {
        const newQ = await createQuest(userId, { ...preset, frequency: TAB_FREQ[activeTab] || 'daily', is_recurring: false });
        quests.push(newQ);
        btn.textContent = '✓ Added';
        btn.classList.add('btn-added');
        showToast(`"${preset.title}" added!`, 'success');
      } catch {
        showToast('Failed to add preset', 'error');
        btn.disabled    = false;
        btn.textContent = '+ Add';
      }
    });
  });

  // ─── QUEST LIST ACTIONS ──────────────────────────────────────────────────
  const questList = document.getElementById('quest-list');
  if (questList) {
    questList.addEventListener('click', async (e) => {
      const card = e.target.closest('.quest-card');
      if (!card) return;
      const quest = quests.find(q => q.id === card.dataset.id);
      if (!quest) return;

      if (e.target.closest('.complete-btn')) {
        const btn = e.target.closest('.complete-btn');
        btn.disabled = true;
        try {
          const result = await completeQuest(userId, quest);
          showStatBoost(result.statKey, result.statBoost);
          if (result.leveledUp) showLevelUpBanner(result.newLevel, result.className);
          if (onXPUpdate) onXPUpdate(result.profile);
          showToast(`+${quest.xp_reward} XP earned!`, 'success');
        } catch {
          showToast('Failed to complete activity', 'error');
        }
        btn.disabled = false;
        return;
      }

      if (e.target.closest('.edit-quest-btn'))   { openQuestModal(quest); return; }
      if (e.target.closest('.delete-quest-btn')) {
        deletingQuestId = quest.id;
        document.getElementById('delete-quest-modal').classList.remove('hidden');
        return;
      }
    });
  }

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
      render(quests, objectives, container, userId, onXPUpdate, activeTab);
    } catch { showToast('Failed to delete activity', 'error'); }
  });

  // ─── OBJ LIST ACTIONS ────────────────────────────────────────────────────
  const objList = document.getElementById('obj-list');
  if (objList) {
    objList.addEventListener('click', async (e) => {
      const card = e.target.closest('.obj-card');
      if (!card) return;
      const obj = objectives.find(o => o.id === card.dataset.id);
      if (!obj) return;

      if (e.target.closest('.edit-obj-btn'))   { openObjModal(obj); return; }
      if (e.target.closest('.delete-obj-btn')) {
        deletingObjId = obj.id;
        document.getElementById('delete-obj-modal').classList.remove('hidden');
        return;
      }
      if (e.target.closest('.update-progress-btn')) {
        progressObjId = obj.id;
        document.getElementById('progress-input').value = obj.progress;
        document.getElementById('progress-range').value = obj.progress;
        document.getElementById('progress-modal').classList.remove('hidden');
        return;
      }
      if (e.target.closest('.milestone-check')) {
        const idx = parseInt(e.target.closest('.milestone-check').dataset.idx);
        const milestones = [...(obj.milestones || [])];
        milestones[idx] = { ...milestones[idx], done: !milestones[idx].done };
        try {
          const updated = await updateObjective(obj.id, { milestones });
          objectives.splice(objectives.findIndex(o => o.id === obj.id), 1, updated);
          render(quests, objectives, container, userId, onXPUpdate, activeTab);
        } catch { showToast('Failed to update milestone', 'error'); }
      }
    });
  }

  document.getElementById('progress-range').addEventListener('input', e => {
    document.getElementById('progress-input').value = e.target.value;
  });
  document.getElementById('progress-input').addEventListener('input', e => {
    document.getElementById('progress-range').value = e.target.value;
  });
  document.getElementById('close-progress-modal').addEventListener('click', () => {
    document.getElementById('progress-modal').classList.add('hidden');
  });
  document.getElementById('save-progress-btn').addEventListener('click', async () => {
    if (!progressObjId) return;
    const clamped = Math.min(100, Math.max(0, parseInt(document.getElementById('progress-input').value) || 0));
    try {
      const updated = await updateObjective(progressObjId, { progress: clamped, completed: clamped >= 100 });
      objectives.splice(objectives.findIndex(o => o.id === progressObjId), 1, updated);
      document.getElementById('progress-modal').classList.add('hidden');
      progressObjId = null;
      render(quests, objectives, container, userId, onXPUpdate, 'longterm');
      if (clamped >= 100) showToast('Quest complete! 🎉', 'success');
    } catch { showToast('Failed to update progress', 'error'); }
  });

  document.getElementById('cancel-delete-obj').addEventListener('click', () => {
    document.getElementById('delete-obj-modal').classList.add('hidden');
    deletingObjId = null;
  });
  document.getElementById('confirm-delete-obj').addEventListener('click', async () => {
    if (!deletingObjId) return;
    try {
      await deleteObjective(deletingObjId);
      objectives.splice(objectives.findIndex(o => o.id === deletingObjId), 1);
      document.getElementById('delete-obj-modal').classList.add('hidden');
      deletingObjId = null;
      render(quests, objectives, container, userId, onXPUpdate, 'longterm');
    } catch { showToast('Failed to delete quest', 'error'); }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function tabSubtitle(tab, counts) {
  if (tab === 'task')     return `${counts.task} task${counts.task !== 1 ? 's' : ''}`;
  if (tab === 'project')  return `${counts.project} project${counts.project !== 1 ? 's' : ''}`;
  if (tab === 'longterm') return `${counts.longterm} long-term quest${counts.longterm !== 1 ? 's' : ''}`;
  return '';
}

// ─── CARD RENDERERS ──────────────────────────────────────────────────────────

function renderQuestCard(quest) {
  const overdue    = isOverdue(quest);
  const diffBadge  = `<span class="badge badge-${quest.difficulty}">${DIFFICULTY_ICONS[quest.difficulty] || ''} ${quest.difficulty}</span>`;
  const deadlineEl = quest.deadline
    ? `<span class="quest-deadline ${overdue ? 'overdue' : ''}">📅 ${formatDate(quest.deadline)}</span>`
    : '';

  return `
    <div class="quest-card card ${overdue ? 'quest-overdue' : ''}" data-id="${quest.id}">
      <div class="quest-main">
        <div class="quest-left">
          <button class="complete-btn" title="Complete">○</button>
          <div class="quest-details">
            <div class="quest-title-row">
              <span class="quest-title">${quest.title}</span>
            </div>
            ${quest.description ? `<div class="quest-description">${quest.description}</div>` : ''}
            <div class="quest-meta">
              ${renderCats(quest.category)}
              ${diffBadge}
              ${quest.xp_reward > 0 ? `<span class="quest-xp gold">+${quest.xp_reward} XP</span>` : ''}
              ${deadlineEl}
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

function renderPresetCard(preset, idx, existingQuests) {
  const alreadyAdded = existingQuests.some(q => q.title === preset.title);
  const catIcon = CATEGORY_ICONS[preset.category] || '📋';
  return `
    <div class="preset-card">
      <div class="preset-info">
        <div class="preset-title">${catIcon} ${preset.title}</div>
        <div class="preset-meta">
          <span class="badge badge-${preset.difficulty}">${DIFFICULTY_ICONS[preset.difficulty]} ${preset.difficulty}</span>
          ${DIFFICULTY_XP[preset.difficulty] > 0 ? `<span class="gold" style="font-size:0.75rem">+${DIFFICULTY_XP[preset.difficulty]} XP</span>` : ''}
        </div>
        ${preset.description ? `<div class="preset-desc">${preset.description}</div>` : ''}
      </div>
      <button class="btn btn-sm ${alreadyAdded ? 'btn-added' : 'btn-primary'} preset-add-btn"
        data-idx="${idx}" ${alreadyAdded ? 'disabled' : ''}
      >${alreadyAdded ? '✓ Added' : '+ Add'}</button>
    </div>
  `;
}

function renderObjCard(obj) {
  const catIcon  = OBJ_CATEGORY_ICONS[obj.category] || '📋';
  const milestones = obj.milestones || [];
  return `
    <div class="obj-card card ${obj.completed ? 'obj-complete' : ''}" data-id="${obj.id}">
      <div class="obj-header">
        <div class="obj-title-row">
          <span class="obj-title">${obj.title}</span>
          ${obj.completed ? '<span class="badge badge-legendary">✓ Complete</span>' : ''}
        </div>
        <div class="obj-actions">
          <button class="icon-btn edit-obj-btn" title="Edit">✏️</button>
          <button class="icon-btn delete-obj-btn" title="Delete">🗑️</button>
        </div>
      </div>
      ${obj.description ? `<p class="obj-desc">${obj.description}</p>` : ''}
      <div class="obj-meta">
        <span class="obj-cat">${catIcon} ${obj.category}</span>
        <span class="obj-pct gold">${obj.progress}%</span>
      </div>
      <div class="obj-progress-bar-track">
        <div class="obj-progress-fill ${obj.completed ? 'complete' : ''}" style="width:${obj.progress}%"></div>
      </div>
      ${milestones.length > 0 ? `
        <ul class="milestone-list">
          ${milestones.map((m, i) => `
            <li class="milestone-item ${m.done ? 'done' : ''}">
              <button class="milestone-check" data-idx="${i}">${m.done ? '✓' : '○'}</button>
              <span>${m.text || m}</span>
            </li>
          `).join('')}
        </ul>
      ` : ''}
      ${!obj.completed ? `<button class="btn btn-ghost btn-sm update-progress-btn">Update Progress</button>` : ''}
    </div>
  `;
}
