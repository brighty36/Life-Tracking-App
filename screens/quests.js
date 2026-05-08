// Activity screen — Tasks / Projects / Quests

import { getQuests, createQuest, updateQuest, deleteQuest, completeQuest,
         getObjectives, createObjective, updateObjective, deleteObjective } from '../supabase.js';
import { showToast, showLevelUpBanner, showStatBoost } from '../utils/animations.js';
import { attachCalendar, todayStr, endOfWeek } from '../utils/calendar.js';

const DIFFICULTY_XP    = { fun: 0, quick: 5, easy: 25, medium: 50, hard: 100, legendary: 250 };
const DIFFICULTY_ICONS = { fun: '', quick: '', easy: '', medium: '', hard: '', legendary: '' };
const CATEGORY_ICONS   = { health: '', mind: '', work: '', finance: '', relationships: '' };
const ALL_CATEGORIES   = ['health','mind','work','finance','relationships'];

const TAB_FREQ = { task: 'daily', project: 'weekly' };

const SORT_LABELS = {
  custom:   'Custom',
  alpha:    'A–Z',
  deadline: 'Due',
  xp:       'XP',
  category: 'Cat',
  created:  'Created',
};

// Module-level sort state, used by card renderers
let _activeSort = 'custom';

const PRESETS = [
  { title: 'Walk 10,000 Steps',                 category: 'health',        difficulty: 'medium', description: 'Hit your daily step goal' },
  { title: 'Eat 5 x Fruit and Veg',             category: 'health',        difficulty: 'medium', description: 'Five portions of fruit or veg today' },
  { title: 'Have a meaningful conversation',     category: 'relationships', difficulty: 'medium', description: 'Connect with someone on a deeper level' },
  { title: 'Try something new',                  category: 'mind',          difficulty: 'easy',   description: 'Step outside your comfort zone' },
  { title: 'Do something nice for someone else', category: 'relationships', difficulty: 'easy',   description: 'Spread kindness today' },
];

function isDone(quest) { return quest.last_completed === todayStr(); }
function isOverdue(quest) { return !!quest.deadline && quest.deadline < todayStr(); }

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function renderCats(category) {
  if (!category) return '';
  return category.split(',').map(c => {
    const k = c.trim();
    return `<span class="quest-cat">${k}</span>`;
  }).join('');
}

// ─── SORT / ORDER HELPERS ─────────────────────────────────────────────────────

function getCustomOrder(userId, tab) {
  try { return JSON.parse(localStorage.getItem(`life-rpg-order-${userId}-${tab}`)) || []; }
  catch { return []; }
}

function saveCustomOrder(userId, tab, ids) {
  localStorage.setItem(`life-rpg-order-${userId}-${tab}`, JSON.stringify(ids));
}

function applySort(items, sortBy, userId, tab) {
  if (sortBy === 'custom') {
    const order = getCustomOrder(userId, tab);
    if (!order.length) return [...items];
    const orderMap = Object.fromEntries(order.map((id, i) => [id, i]));
    return [...items].sort((a, b) => (orderMap[a.id] ?? 9999) - (orderMap[b.id] ?? 9999));
  }
  const sorted = [...items];
  if (sortBy === 'alpha')    return sorted.sort((a, b) => a.title.localeCompare(b.title));
  if (sortBy === 'deadline') return sorted.sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });
  if (sortBy === 'xp')       return sorted.sort((a, b) => (b.xp_reward ?? b.progress ?? 0) - (a.xp_reward ?? a.progress ?? 0));
  if (sortBy === 'category') return sorted.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  if (sortBy === 'created')  return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return items;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function renderQuests(userId, container, onXPUpdate) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const [quests, objectives] = await Promise.all([getQuests(userId), getObjectives(userId)]);
  render(quests, objectives, container, userId, onXPUpdate, 'task', 'custom');
}

// ─── MAIN RENDER ─────────────────────────────────────────────────────────────

function render(quests, objectives, container, userId, onXPUpdate, activeTab = 'task', activeSort = 'custom') {
  _activeSort = activeSort;

  const tasks    = quests.filter(q => q.frequency !== 'weekly');
  const projects = quests.filter(q => q.frequency === 'weekly');

  // Apply sort/order
  const sortedTasks       = applySort(tasks,       activeSort, userId, 'task');
  const sortedProjects    = applySort(projects,    activeSort, userId, 'project');
  const sortedObjectives  = applySort(objectives,  activeSort, userId, 'longterm');

  // Build parent-child maps
  const tasksByProject    = groupBy(tasks,    q => q.parent_quest_id);
  const projectsByObj     = groupBy(projects, p => p.objective_id);
  const projectMap        = Object.fromEntries(projects.map(p => [p.id, p]));
  const objectiveMap      = Object.fromEntries(objectives.map(o => [o.id, o]));

  const counts = { task: tasks.length, project: projects.length, longterm: objectives.length };

  const sortBarEntries = activeTab === 'longterm'
    ? [['custom','Custom'],['alpha','A–Z'],['category','Cat'],['created','Created']]
    : Object.entries(SORT_LABELS);
  const sortBar = `
    <div class="sort-bar">
      <span class="sort-label">Sort:</span>
      ${sortBarEntries.map(([key, label]) => `
        <button class="sort-btn ${activeSort === key ? 'active' : ''}" data-sort="${key}">${label}</button>
      `).join('')}
    </div>
  `;

  container.innerHTML = `
    <div class="quests-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Activity</h2>
          <p class="screen-sub">${tabSubtitle(activeTab, counts)}</p>
        </div>
        <div class="quest-header-btns">
          ${activeTab !== 'longterm' ? `<button class="btn btn-ghost btn-sm" id="presets-btn">Presets</button>` : ''}
          <button class="btn btn-primary" id="add-main-btn">+ Add</button>
        </div>
      </div>

      <div class="tab-row">
        <button class="tab-btn ${activeTab==='task'     ? 'active':''}" data-tab="task">
          Tasks <span class="tab-count">${counts.task}</span>
        </button>
        <button class="tab-btn ${activeTab==='project'  ? 'active':''}" data-tab="project">
          Projects <span class="tab-count">${counts.project}</span>
        </button>
        <button class="tab-btn ${activeTab==='longterm' ? 'active':''}" data-tab="longterm">
          Quests <span class="tab-count">${counts.longterm}</span>
        </button>
      </div>

      ${sortBar}

      ${activeTab === 'task' ? `
        <div class="quest-list" id="quest-list">
          ${sortedTasks.length === 0
            ? `<div class="empty-state">No tasks yet.<br>Add one or pick a preset!</div>`
            : sortedTasks.map(t => renderTaskCard(t, projectMap[t.parent_quest_id] || null)).join('')}
        </div>
      ` : activeTab === 'project' ? `
        <div class="quest-list" id="quest-list">
          ${sortedProjects.length === 0
            ? `<div class="empty-state">No projects yet.<br>Add one to group your tasks!</div>`
            : sortedProjects.map(p => renderProjectCard(p, tasksByProject[p.id] || [], objectiveMap[p.objective_id] || null)).join('')}
        </div>
      ` : `
        <div class="obj-list" id="obj-list">
          ${sortedObjectives.length === 0
            ? `<div class="empty-state">No quests yet.<br>Set a long-term goal to get started!</div>`
            : sortedObjectives.map(o => renderObjCard(o, projectsByObj[o.id] || [])).join('')}
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
              <button type="button" class="cat-chip" data-cat="${c}">${c}</button>
            `).join('')}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Difficulty</label>
            <select class="input" id="quest-difficulty">
              <option value="fun">Fun (0 XP)</option>
              <option value="quick">Quick (5 XP)</option>
              <option value="easy">Easy (25 XP)</option>
              <option value="medium" selected>Medium (50 XP)</option>
              <option value="hard">Hard (100 XP)</option>
              <option value="legendary">Legendary (250 XP)</option>
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

        <!-- Linking: tasks can be linked to a project -->
        ${activeTab === 'task' ? `
          <div class="form-group">
            <label class="form-label">Part of Project (optional)</label>
            <select class="input" id="quest-parent-project">
              <option value="">— Standalone —</option>
              ${projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        <!-- Linking: projects can be linked to a long-term quest -->
        ${activeTab === 'project' ? `
          <div class="form-group">
            <label class="form-label">Part of Quest (optional)</label>
            <select class="input" id="quest-objective">
              <option value="">— Standalone —</option>
              ${objectives.map(o => `<option value="${o.id}">${o.title}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-quest-modal">Cancel</button>
          <button class="btn btn-primary" id="save-quest-btn">Save</button>
        </div>
      </div>
    </div>

    <!-- Add task to project modal -->
    <div class="modal-overlay hidden" id="project-task-modal">
      <div class="modal modal-wide">
        <h3 class="modal-title">Add Task to Project</h3>
        <p class="modal-body ptm-project-label" id="ptm-project-label"></p>
        <input class="input" id="ptm-title" placeholder="Task title…" maxlength="80" />
        <div class="form-group">
          <label class="form-label">Categories</label>
          <div class="cat-chips" id="ptm-categories">
            ${ALL_CATEGORIES.map(c => `
              <button type="button" class="cat-chip ptm-chip" data-cat="${c}">${c}</button>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Difficulty</label>
          <select class="input" id="ptm-difficulty">
            <option value="fun">Fun (0 XP)</option>
            <option value="quick">Quick (5 XP)</option>
            <option value="easy">Easy (25 XP)</option>
            <option value="medium" selected>Medium (50 XP)</option>
            <option value="hard">Hard (100 XP)</option>
            <option value="legendary">Legendary (250 XP)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Deadline (optional)</label>
          <div class="deadline-row">
            <input class="input" id="ptm-deadline" placeholder="Pick a date…" />
            <div class="deadline-quick-btns">
              <button type="button" class="btn btn-xs btn-ghost" id="ptm-dl-today">Today</button>
              <button type="button" class="btn btn-xs btn-ghost" id="ptm-dl-week">Week</button>
              <button type="button" class="btn btn-xs btn-ghost" id="ptm-dl-clear">✕</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-ptm">Cancel</button>
          <button class="btn btn-primary" id="save-ptm">Add Task</button>
        </div>
      </div>
    </div>

    <!-- Add project to quest modal -->
    <div class="modal-overlay hidden" id="quest-project-modal">
      <div class="modal modal-wide">
        <h3 class="modal-title">Add Project to Quest</h3>
        <p class="modal-body paq-quest-label" id="paq-quest-label"></p>
        <input class="input" id="paq-title" placeholder="Project title…" maxlength="80" />
        <textarea class="input textarea" id="paq-desc" placeholder="Description (optional)…" rows="2"></textarea>
        <div class="form-group">
          <label class="form-label">Categories</label>
          <div class="cat-chips" id="paq-categories">
            ${ALL_CATEGORIES.map(c => `
              <button type="button" class="cat-chip paq-chip" data-cat="${c}">${c}</button>
            `).join('')}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Difficulty</label>
            <select class="input" id="paq-difficulty">
              <option value="fun">Fun (0 XP)</option>
              <option value="quick">Quick (5 XP)</option>
              <option value="easy">Easy (25 XP)</option>
              <option value="medium" selected>Medium (50 XP)</option>
              <option value="hard">Hard (100 XP)</option>
              <option value="legendary">Legendary (250 XP)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Deadline (optional)</label>
            <div class="deadline-row">
              <input class="input" id="paq-deadline" placeholder="Pick a date…" />
              <div class="deadline-quick-btns">
                <button type="button" class="btn btn-xs btn-ghost" id="paq-dl-today">Today</button>
                <button type="button" class="btn btn-xs btn-ghost" id="paq-dl-week">Week</button>
                <button type="button" class="btn btn-xs btn-ghost" id="paq-dl-clear">✕</button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-paq">Cancel</button>
          <button class="btn btn-primary" id="save-paq">Add Project</button>
        </div>
      </div>
    </div>

    <!-- Long-term quest add/edit modal -->
    <div class="modal-overlay hidden" id="obj-modal">
      <div class="modal modal-wide">
        <h3 class="modal-title" id="obj-modal-title">New Quest</h3>
        <input class="input" id="obj-title" placeholder="Quest title…" maxlength="100" />
        <textarea class="input textarea" id="obj-desc" placeholder="Description (optional)…" rows="2"></textarea>
        <div class="form-group">
          <label class="form-label">Categories</label>
          <div class="cat-chips" id="obj-categories">
            ${ALL_CATEGORIES.map(c => `
              <button type="button" class="cat-chip obj-chip" data-cat="${c}">${c}</button>
            `).join('')}
          </div>
        </div>
        <div class="form-group obj-completed-row">
          <label class="checkbox-label">
            <input type="checkbox" id="obj-completed" />
            <span>Mark as complete</span>
          </label>
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
        <h3 class="modal-title">Preset Missions</h3>
        <p class="modal-body">Tap a preset to add it instantly.</p>
        <div class="preset-list">
          ${PRESETS.map((p, i) => renderPresetCard(p, i, quests)).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-presets-modal">Close</button>
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
        <p class="modal-body">This will permanently delete this quest.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-delete-obj">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-obj">Delete</button>
        </div>
      </div>
    </div>
  `;

  let editingQuestId         = null;
  let deletingQuestId        = null;
  let editingObjId           = null;
  let deletingObjId          = null;
  let selectedCategories     = ['health'];
  let selectedPtmCategories  = ['health'];
  let selectedPaqCategories  = ['health'];
  let selectedObjCategories  = ['health'];
  let addingTaskToProjectId  = null;
  let addingProjectToQuestId = null;
  let dragSrcId              = null;

  // The current display list used by drag-drop handlers
  let displayList = activeTab === 'task' ? sortedTasks
    : activeTab === 'project'            ? sortedProjects
    : sortedObjectives;

  // ─── TABS ────────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => render(quests, objectives, container, userId, onXPUpdate, btn.dataset.tab, 'custom'));
  });

  // ─── SORT BAR ────────────────────────────────────────────────────────────
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sort = btn.dataset.sort;
      render(quests, objectives, container, userId, onXPUpdate, activeTab, sort);
    });
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

    selectedCategories = quest && quest.category
      ? quest.category.split(',').map(c => c.trim()).filter(Boolean)
      : ['health'];
    syncCategoryChips();

    const parentProjectSel = document.getElementById('quest-parent-project');
    if (parentProjectSel) parentProjectSel.value = quest ? (quest.parent_quest_id || '') : '';

    const objectiveSel = document.getElementById('quest-objective');
    if (objectiveSel) objectiveSel.value = quest ? (quest.objective_id || '') : '';

    document.getElementById('quest-modal').classList.remove('hidden');
    document.getElementById('quest-title').focus();
  }

  function syncCategoryChips() {
    document.querySelectorAll('.cat-chip:not(.ptm-chip):not(.paq-chip)').forEach(chip => {
      chip.classList.toggle('active', selectedCategories.includes(chip.dataset.cat));
    });
  }

  function syncPtmCategoryChips() {
    document.querySelectorAll('.ptm-chip').forEach(chip => {
      chip.classList.toggle('active', selectedPtmCategories.includes(chip.dataset.cat));
    });
  }

  function syncPaqCategoryChips() {
    document.querySelectorAll('.paq-chip').forEach(chip => {
      chip.classList.toggle('active', selectedPaqCategories.includes(chip.dataset.cat));
    });
  }

  function syncObjCategoryChips() {
    document.querySelectorAll('.obj-chip').forEach(chip => {
      chip.classList.toggle('active', selectedObjCategories.includes(chip.dataset.cat));
    });
  }

  document.querySelectorAll('.cat-chip:not(.ptm-chip):not(.paq-chip):not(.obj-chip)').forEach(chip => {
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

  document.querySelectorAll('.ptm-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.cat;
      if (selectedPtmCategories.includes(cat)) {
        if (selectedPtmCategories.length > 1) selectedPtmCategories = selectedPtmCategories.filter(c => c !== cat);
      } else {
        selectedPtmCategories.push(cat);
      }
      syncPtmCategoryChips();
    });
  });

  document.querySelectorAll('.paq-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.cat;
      if (selectedPaqCategories.includes(cat)) {
        if (selectedPaqCategories.length > 1) selectedPaqCategories = selectedPaqCategories.filter(c => c !== cat);
      } else {
        selectedPaqCategories.push(cat);
      }
      syncPaqCategoryChips();
    });
  });

  document.querySelectorAll('.obj-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.cat;
      if (selectedObjCategories.includes(cat)) {
        if (selectedObjCategories.length > 1) selectedObjCategories = selectedObjCategories.filter(c => c !== cat);
      } else {
        selectedObjCategories.push(cat);
      }
      syncObjCategoryChips();
    });
  });

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
  document.getElementById('dl-clear').addEventListener('click', () => { deadlineInput.value = ''; });

  document.getElementById('close-quest-modal').addEventListener('click', () => {
    document.getElementById('quest-modal').classList.add('hidden');
  });

  document.getElementById('save-quest-btn').addEventListener('click', async () => {
    const title          = document.getElementById('quest-title').value.trim();
    const description    = document.getElementById('quest-desc').value.trim() || null;
    const difficulty     = document.getElementById('quest-difficulty').value;
    const deadline       = document.getElementById('quest-deadline').value || null;
    const category       = selectedCategories.join(',');
    const frequency      = TAB_FREQ[activeTab] || 'daily';
    const parentQuestSel = document.getElementById('quest-parent-project');
    const objSel         = document.getElementById('quest-objective');
    const parent_quest_id = parentQuestSel ? (parentQuestSel.value || null) : null;
    const objective_id    = objSel         ? (objSel.value         || null) : null;

    if (!title) { showToast('Please enter a title', 'error'); return; }

    try {
      if (editingQuestId) {
        const updated = await updateQuest(editingQuestId,
          { title, description, category, difficulty, deadline, parent_quest_id, objective_id });
        quests.splice(quests.findIndex(q => q.id === editingQuestId), 1, updated);
      } else {
        const newQ = await createQuest(userId,
          { title, description, category, difficulty, frequency, deadline, parent_quest_id, objective_id, is_recurring: false });
        quests.push(newQ);
      }
      document.getElementById('quest-modal').classList.add('hidden');
      render(quests, objectives, container, userId, onXPUpdate, activeTab, activeSort);
    } catch { showToast('Failed to save activity', 'error'); }
  });

  // ─── PROJECT TASK MODAL ──────────────────────────────────────────────────
  function openProjectTaskModal(project) {
    addingTaskToProjectId = project.id;
    selectedPtmCategories = project.category
      ? project.category.split(',').map(c => c.trim()).filter(Boolean)
      : ['health'];
    document.getElementById('ptm-project-label').textContent = `${project.title}`;
    document.getElementById('ptm-title').value = '';
    document.getElementById('ptm-difficulty').value = 'medium';
    document.getElementById('ptm-deadline').value = '';
    syncPtmCategoryChips();
    document.getElementById('project-task-modal').classList.remove('hidden');
    document.getElementById('ptm-title').focus();
  }

  const ptmDeadlineInput = document.getElementById('ptm-deadline');
  attachCalendar(ptmDeadlineInput);
  document.getElementById('ptm-dl-today').addEventListener('click', () => {
    ptmDeadlineInput.value = todayStr();
    ptmDeadlineInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.getElementById('ptm-dl-week').addEventListener('click', () => {
    ptmDeadlineInput.value = endOfWeek();
    ptmDeadlineInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.getElementById('ptm-dl-clear').addEventListener('click', () => { ptmDeadlineInput.value = ''; });

  document.getElementById('close-ptm').addEventListener('click', () => {
    document.getElementById('project-task-modal').classList.add('hidden');
    addingTaskToProjectId = null;
  });

  document.getElementById('save-ptm').addEventListener('click', async () => {
    const title      = document.getElementById('ptm-title').value.trim();
    const difficulty = document.getElementById('ptm-difficulty').value;
    const deadline   = document.getElementById('ptm-deadline').value || null;
    const category   = selectedPtmCategories.join(',');

    if (!title) { showToast('Please enter a title', 'error'); return; }
    if (!addingTaskToProjectId) return;

    try {
      const newTask = await createQuest(userId, {
        title, category, difficulty, deadline,
        frequency: 'daily',
        parent_quest_id: addingTaskToProjectId,
        is_recurring: false,
      });
      quests.push(newTask);
      document.getElementById('project-task-modal').classList.add('hidden');
      addingTaskToProjectId = null;
      showToast(`Task "${title}" added!`, 'success');
      render(quests, objectives, container, userId, onXPUpdate, activeTab, activeSort);
    } catch { showToast('Failed to add task', 'error'); }
  });

  // ─── ADD PROJECT TO QUEST MODAL ──────────────────────────────────────────
  function openQuestProjectModal(obj) {
    addingProjectToQuestId = obj.id;
    selectedPaqCategories = obj.category
      ? obj.category.split(',').map(c => c.trim()).filter(Boolean)
      : ['health'];
    document.getElementById('paq-quest-label').textContent = obj.title;
    document.getElementById('paq-title').value = '';
    document.getElementById('paq-desc').value = '';
    document.getElementById('paq-difficulty').value = 'medium';
    document.getElementById('paq-deadline').value = '';
    syncPaqCategoryChips();
    document.getElementById('quest-project-modal').classList.remove('hidden');
    document.getElementById('paq-title').focus();
  }

  const paqDeadlineInput = document.getElementById('paq-deadline');
  attachCalendar(paqDeadlineInput);
  document.getElementById('paq-dl-today').addEventListener('click', () => {
    paqDeadlineInput.value = todayStr();
    paqDeadlineInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.getElementById('paq-dl-week').addEventListener('click', () => {
    paqDeadlineInput.value = endOfWeek();
    paqDeadlineInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.getElementById('paq-dl-clear').addEventListener('click', () => { paqDeadlineInput.value = ''; });

  document.getElementById('close-paq').addEventListener('click', () => {
    document.getElementById('quest-project-modal').classList.add('hidden');
    addingProjectToQuestId = null;
  });

  document.getElementById('save-paq').addEventListener('click', async () => {
    const title       = document.getElementById('paq-title').value.trim();
    const description = document.getElementById('paq-desc').value.trim() || null;
    const difficulty  = document.getElementById('paq-difficulty').value;
    const deadline    = document.getElementById('paq-deadline').value || null;
    const category    = selectedPaqCategories.join(',');

    if (!title) { showToast('Please enter a title', 'error'); return; }
    if (!addingProjectToQuestId) return;

    try {
      const newProject = await createQuest(userId, {
        title, description, category, difficulty, deadline,
        frequency: 'weekly',
        objective_id: addingProjectToQuestId,
        is_recurring: false,
      });
      quests.push(newProject);
      document.getElementById('quest-project-modal').classList.add('hidden');
      addingProjectToQuestId = null;
      showToast(`Project "${title}" added!`, 'success');
      render(quests, objectives, container, userId, onXPUpdate, activeTab, activeSort);
    } catch { showToast('Failed to add project', 'error'); }
  });

  // ─── OBJ MODAL ───────────────────────────────────────────────────────────
  function openObjModal(obj) {
    editingObjId = obj ? obj.id : null;
    document.getElementById('obj-modal-title').textContent = obj ? 'Edit Quest' : 'New Quest';
    document.getElementById('obj-title').value = obj ? obj.title : '';
    document.getElementById('obj-desc').value  = obj ? (obj.description || '') : '';
    document.getElementById('obj-completed').checked = obj ? !!obj.completed : false;
    selectedObjCategories = obj && obj.category
      ? obj.category.split(',').map(c => c.trim()).filter(Boolean)
      : ['health'];
    syncObjCategoryChips();
    document.getElementById('obj-modal').classList.remove('hidden');
    document.getElementById('obj-title').focus();
  }

  document.getElementById('close-obj-modal').addEventListener('click', () => {
    document.getElementById('obj-modal').classList.add('hidden');
  });

  document.getElementById('save-obj-btn').addEventListener('click', async () => {
    const title       = document.getElementById('obj-title').value.trim();
    const description = document.getElementById('obj-desc').value.trim() || null;
    const category    = selectedObjCategories.join(',');
    const completed   = document.getElementById('obj-completed').checked;
    if (!title) { showToast('Please enter a title', 'error'); return; }
    const payload = { title, description, category, completed, progress: completed ? 100 : 0, milestones: [] };
    try {
      if (editingObjId) {
        const updated = await updateObjective(editingObjId, payload);
        objectives.splice(objectives.findIndex(o => o.id === editingObjId), 1, updated);
      } else {
        objectives.unshift(await createObjective(userId, payload));
      }
      document.getElementById('obj-modal').classList.add('hidden');
      render(quests, objectives, container, userId, onXPUpdate, 'longterm', activeSort);
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
      btn.disabled = true; btn.textContent = 'Adding…';
      try {
        const newQ = await createQuest(userId,
          { ...preset, frequency: TAB_FREQ[activeTab] || 'daily', is_recurring: false });
        quests.push(newQ);
        btn.textContent = '✓ Added';
        btn.classList.add('btn-added');
        showToast(`"${preset.title}" added!`, 'success');
      } catch {
        showToast('Failed to add preset', 'error');
        btn.disabled = false; btn.textContent = '+ Add';
      }
    });
  });

  // ─── DRAG AND DROP ───────────────────────────────────────────────────────
  const questList = document.getElementById('quest-list');
  if (questList && activeSort === 'custom') {
    questList.addEventListener('dragstart', e => {
      const card = e.target.closest('.quest-card');
      if (!card) return;
      dragSrcId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragSrcId);
    });

    questList.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const card = e.target.closest('.quest-card');
      if (!card || card.dataset.id === dragSrcId) return;
      document.querySelectorAll('.quest-card').forEach(c => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
    });

    questList.addEventListener('dragleave', e => {
      const card = e.target.closest('.quest-card');
      if (card) card.classList.remove('drag-over');
    });

    questList.addEventListener('dragend', () => {
      document.querySelectorAll('.quest-card').forEach(c => c.classList.remove('dragging', 'drag-over'));
      dragSrcId = null;
    });

    questList.addEventListener('drop', e => {
      e.preventDefault();
      const targetCard = e.target.closest('.quest-card');
      if (!targetCard || !dragSrcId || targetCard.dataset.id === dragSrcId) return;

      const srcIdx = displayList.findIndex(q => q.id === dragSrcId);
      const tgtIdx = displayList.findIndex(q => q.id === targetCard.dataset.id);
      if (srcIdx === -1 || tgtIdx === -1) return;

      const [moved] = displayList.splice(srcIdx, 1);
      displayList.splice(tgtIdx, 0, moved);

      saveCustomOrder(userId, activeTab, displayList.map(q => q.id));
      dragSrcId = null;
      render(quests, objectives, container, userId, onXPUpdate, activeTab, 'custom');
    });
  }

  // ─── OBJ LIST DRAG AND DROP ──────────────────────────────────────────────
  const objList = document.getElementById('obj-list');
  if (objList && activeSort === 'custom') {
    objList.addEventListener('dragstart', e => {
      const card = e.target.closest('.obj-card');
      if (!card) return;
      dragSrcId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragSrcId);
    });

    objList.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const card = e.target.closest('.obj-card');
      if (!card || card.dataset.id === dragSrcId) return;
      document.querySelectorAll('.obj-card').forEach(c => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
    });

    objList.addEventListener('dragleave', e => {
      const card = e.target.closest('.obj-card');
      if (card) card.classList.remove('drag-over');
    });

    objList.addEventListener('dragend', () => {
      document.querySelectorAll('.obj-card').forEach(c => c.classList.remove('dragging', 'drag-over'));
      dragSrcId = null;
    });

    objList.addEventListener('drop', e => {
      e.preventDefault();
      const targetCard = e.target.closest('.obj-card');
      if (!targetCard || !dragSrcId || targetCard.dataset.id === dragSrcId) return;

      const srcIdx = displayList.findIndex(o => o.id === dragSrcId);
      const tgtIdx = displayList.findIndex(o => o.id === targetCard.dataset.id);
      if (srcIdx === -1 || tgtIdx === -1) return;

      const [moved] = displayList.splice(srcIdx, 1);
      displayList.splice(tgtIdx, 0, moved);

      saveCustomOrder(userId, 'longterm', displayList.map(o => o.id));
      dragSrcId = null;
      render(quests, objectives, container, userId, onXPUpdate, 'longterm', 'custom');
    });
  }

  // ─── QUEST LIST ACTIONS ──────────────────────────────────────────────────
  if (questList) {
    questList.addEventListener('click', async (e) => {
      // Add task to project button
      if (e.target.closest('.add-task-btn')) {
        const card = e.target.closest('.quest-card');
        if (!card) return;
        const project = quests.find(q => q.id === card.dataset.id);
        if (project) openProjectTaskModal(project);
        return;
      }

      const card = e.target.closest('.quest-card');
      if (!card) return;
      const quest = quests.find(q => q.id === card.dataset.id);
      if (!quest) return;

      if (e.target.closest('.complete-btn')) {
        const btn = e.target.closest('.complete-btn');
        btn.disabled = true;
        try {
          const result = await completeQuest(userId, quest);
          quest.last_completed = todayStr();
          showStatBoost(result.statKey, result.statBoost);
          if (result.leveledUp) showLevelUpBanner(result.newLevel, result.className);
          if (onXPUpdate) onXPUpdate(result.profile);
          if (quest.xp_reward > 0) showToast(`+${quest.xp_reward} XP earned!`, 'success');
          render(quests, objectives, container, userId, onXPUpdate, activeTab, activeSort);
        } catch {
          showToast('Failed to complete activity', 'error');
          btn.disabled = false;
        }
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
      render(quests, objectives, container, userId, onXPUpdate, activeTab, activeSort);
    } catch { showToast('Failed to delete activity', 'error'); }
  });

  // ─── OBJ LIST ACTIONS ────────────────────────────────────────────────────
  if (objList) {
    objList.addEventListener('click', async (e) => {
      // Add project to quest button
      if (e.target.closest('.add-project-btn')) {
        const card = e.target.closest('.obj-card');
        if (!card) return;
        const obj = objectives.find(o => o.id === card.dataset.id);
        if (obj) openQuestProjectModal(obj);
        return;
      }

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
    });
  }

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
      render(quests, objectives, container, userId, onXPUpdate, 'longterm', activeSort);
    } catch { showToast('Failed to delete quest', 'error'); }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    if (k) { if (!acc[k]) acc[k] = []; acc[k].push(item); }
    return acc;
  }, {});
}

function tabSubtitle(tab, counts) {
  if (tab === 'task')     return `${counts.task} task${counts.task !== 1 ? 's' : ''}`;
  if (tab === 'project')  return `${counts.project} project${counts.project !== 1 ? 's' : ''}`;
  if (tab === 'longterm') return `${counts.longterm} long-term quest${counts.longterm !== 1 ? 's' : ''}`;
  return '';
}

// ─── CARD RENDERERS ──────────────────────────────────────────────────────────

function renderTaskCard(quest, parentProject) {
  const done    = isDone(quest);
  const overdue = isOverdue(quest);
  const diffBadge = `<span class="badge badge-${quest.difficulty}">${quest.difficulty}</span>`;
  const deadlineEl = quest.deadline
    ? `<span class="quest-deadline ${overdue ? 'overdue' : ''}">${formatDate(quest.deadline)}</span>`
    : '';
  const draggable = _activeSort === 'custom';

  return `
    <div class="quest-card card ${done ? 'quest-done' : ''} ${overdue ? 'quest-overdue' : ''}" data-id="${quest.id}" ${draggable ? 'draggable="true"' : ''}>
      ${draggable ? `<span class="drag-handle" title="Drag to reorder">⠿</span>` : ''}
      <div class="quest-main">
        <div class="quest-left">
          <button class="complete-btn ${done ? 'done' : ''}" title="${done ? 'Complete again' : 'Complete'}">
            ${done ? '✓' : '○'}
          </button>
          <div class="quest-details">
            <div class="quest-title-row">
              <span class="quest-title">${quest.title}</span>
            </div>
            ${parentProject ? `<div class="link-parent-tag">${parentProject.title}</div>` : ''}
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
          <button class="icon-btn edit-quest-btn" title="Edit">Edit</button>
          <button class="icon-btn delete-quest-btn" title="Delete">Del</button>
        </div>
      </div>
    </div>
  `;
}

function renderProjectCard(project, linkedTasks, parentObjective) {
  const done    = isDone(project);
  const overdue = isOverdue(project);
  const diffBadge = `<span class="badge badge-${project.difficulty}">${project.difficulty}</span>`;
  const deadlineEl = project.deadline
    ? `<span class="quest-deadline ${overdue ? 'overdue' : ''}">${formatDate(project.deadline)}</span>`
    : '';
  const draggable = _activeSort === 'custom';

  return `
    <div class="quest-card card ${done ? 'quest-done' : ''} ${overdue ? 'quest-overdue' : ''}" data-id="${project.id}" ${draggable ? 'draggable="true"' : ''}>
      ${draggable ? `<span class="drag-handle" title="Drag to reorder">⠿</span>` : ''}
      <div class="quest-main">
        <div class="quest-left">
          <button class="complete-btn ${done ? 'done' : ''}" title="${done ? 'Complete again' : 'Complete'}">
            ${done ? '✓' : '○'}
          </button>
          <div class="quest-details">
            <div class="quest-title-row">
              <span class="quest-title">${project.title}</span>
              ${linkedTasks.length > 0 ? `<span class="link-count-badge">${linkedTasks.length} task${linkedTasks.length !== 1 ? 's' : ''}</span>` : ''}
            </div>
            ${parentObjective ? `<div class="link-parent-tag">${parentObjective.title}</div>` : ''}
            ${project.description ? `<div class="quest-description">${project.description}</div>` : ''}
            <div class="quest-meta">
              ${renderCats(project.category)}
              ${diffBadge}
              ${project.xp_reward > 0 ? `<span class="quest-xp gold">+${project.xp_reward} XP</span>` : ''}
              ${deadlineEl}
            </div>
            ${linkedTasks.length > 0 ? `
              <div class="linked-tasks-list">
                ${linkedTasks.map(t => `
                  <div class="linked-task-item ${isDone(t) ? 'done' : ''}">
                    <span class="linked-task-dot">${isDone(t) ? '✓' : '○'}</span>
                    <span class="linked-task-title">${t.title}</span>
                    ${t.xp_reward > 0 ? `<span class="linked-task-xp gold">+${t.xp_reward}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            <button class="btn btn-ghost btn-sm add-task-btn">+ Add Task</button>
          </div>
        </div>
        <div class="quest-actions">
          <button class="icon-btn edit-quest-btn" title="Edit">Edit</button>
          <button class="icon-btn delete-quest-btn" title="Delete">Del</button>
        </div>
      </div>
    </div>
  `;
}

function renderPresetCard(preset, idx, existingQuests) {
  const alreadyAdded = existingQuests.some(q => q.title === preset.title);
  const catIcon = '';
  return `
    <div class="preset-card">
      <div class="preset-info">
        <div class="preset-title">${preset.title}</div>
        <div class="preset-meta">
          <span class="badge badge-${preset.difficulty}">${preset.difficulty}</span>
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

function renderObjCard(obj, linkedProjects) {
  const draggable = _activeSort === 'custom';

  return `
    <div class="obj-card card ${obj.completed ? 'obj-complete' : ''}" data-id="${obj.id}" ${draggable ? 'draggable="true"' : ''}>
      <div class="obj-header">
        <div class="obj-title-row">
          ${draggable ? `<span class="drag-handle" title="Drag to reorder">⠿</span>` : ''}
          <span class="obj-title">${obj.title}</span>
          ${obj.completed ? '<span class="badge badge-legendary">✓ Complete</span>' : ''}
          ${linkedProjects.length > 0 ? `<span class="link-count-badge">${linkedProjects.length} project${linkedProjects.length !== 1 ? 's' : ''}</span>` : ''}
        </div>
        <div class="obj-actions">
          <button class="icon-btn edit-obj-btn" title="Edit">Edit</button>
          <button class="icon-btn delete-obj-btn" title="Delete">Del</button>
        </div>
      </div>
      ${obj.description ? `<p class="obj-desc">${obj.description}</p>` : ''}
      <div class="obj-meta">
        ${renderCats(obj.category)}
      </div>
      ${linkedProjects.length > 0 ? `
        <div class="linked-tasks-list">
          ${linkedProjects.map(p => `
            <div class="linked-task-item ${isDone(p) ? 'done' : ''}">
              <span class="linked-task-dot">${isDone(p) ? '✓' : '○'}</span>
              <span class="linked-task-title">${p.title}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${!obj.completed ? `
        <div class="obj-card-footer">
          <button class="btn btn-ghost btn-sm add-project-btn">+ Add Project</button>
        </div>
      ` : ''}
    </div>
  `;
}
