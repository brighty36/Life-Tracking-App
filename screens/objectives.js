// Objectives screen

import { getObjectives, createObjective, updateObjective, deleteObjective } from '../supabase.js';
import { showToast } from '../utils/animations.js';

const CATEGORY_ICONS = { health: '', mind: '', career: '', finance: '' };

export async function renderObjectives(userId, container) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const objectives = await getObjectives(userId);
  render(objectives, container, userId);
}

function render(objectives, container, userId) {
  container.innerHTML = `
    <div class="objectives-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Objectives</h2>
          <p class="screen-sub">Long-term goals and milestones</p>
        </div>
        <button class="btn btn-primary" id="add-obj-btn">+ Add Objective</button>
      </div>

      <div class="obj-list" id="obj-list">
        ${objectives.length === 0
          ? `<div class="empty-state">No objectives yet.<br>Set a long-term goal to get started!</div>`
          : objectives.map(o => renderObjCard(o)).join('')}
      </div>
    </div>

    <!-- Add / Edit modal -->
    <div class="modal-overlay hidden" id="obj-modal">
      <div class="modal modal-wide">
        <h3 class="modal-title" id="obj-modal-title">New Objective</h3>
        <input class="input" id="obj-title" placeholder="Objective title…" maxlength="100" />
        <textarea class="input textarea" id="obj-desc" placeholder="Description (optional)…" rows="2"></textarea>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="input" id="obj-category">
              <option value="health">Health</option>
              <option value="mind">Mind</option>
              <option value="career">Career</option>
              <option value="finance">Finance</option>
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
          <button class="btn btn-primary" id="save-obj-btn">Save</button>
        </div>
      </div>
    </div>

    <!-- Progress update modal -->
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

    <!-- Delete confirm -->
    <div class="modal-overlay hidden" id="delete-obj-modal">
      <div class="modal">
        <h3 class="modal-title">Delete Objective?</h3>
        <p class="modal-body">This will permanently delete this objective.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-delete-obj">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-obj">Delete</button>
        </div>
      </div>
    </div>
  `;

  let editingObjId  = null;
  let progressObjId = null;
  let deletingObjId = null;

  // ─── ADD / EDIT ──────────────────────────────────────────────────────────
  document.getElementById('add-obj-btn').addEventListener('click', () => openObjModal(null));
  document.getElementById('close-obj-modal').addEventListener('click', () => {
    document.getElementById('obj-modal').classList.add('hidden');
  });

  function openObjModal(obj) {
    editingObjId = obj ? obj.id : null;
    document.getElementById('obj-modal-title').textContent = obj ? 'Edit Objective' : 'New Objective';
    document.getElementById('obj-title').value = obj ? obj.title : '';
    document.getElementById('obj-desc').value = obj ? (obj.description || '') : '';
    document.getElementById('obj-category').value = obj ? obj.category : 'health';
    document.getElementById('obj-progress').value = obj ? obj.progress : 0;
    const milestones = obj ? (obj.milestones || []).map(m => m.text || m).join('\n') : '';
    document.getElementById('obj-milestones').value = milestones;
    document.getElementById('obj-modal').classList.remove('hidden');
    document.getElementById('obj-title').focus();
  }

  document.getElementById('save-obj-btn').addEventListener('click', async () => {
    const title       = document.getElementById('obj-title').value.trim();
    const description = document.getElementById('obj-desc').value.trim();
    const category    = document.getElementById('obj-category').value;
    const progress    = parseInt(document.getElementById('obj-progress').value) || 0;
    const milestonesRaw = document.getElementById('obj-milestones').value.trim();
    const milestones  = milestonesRaw
      ? milestonesRaw.split('\n').filter(l => l.trim()).map(text => ({ text: text.trim(), done: false }))
      : [];

    if (!title) { showToast('Please enter a title', 'error'); return; }

    const payload = { title, description, category, progress: Math.min(100, Math.max(0, progress)), milestones, completed: progress >= 100 };

    try {
      if (editingObjId) {
        const updated = await updateObjective(editingObjId, payload);
        objectives.splice(objectives.findIndex(o => o.id === editingObjId), 1, updated);
      } else {
        const newObj = await createObjective(userId, payload);
        objectives.unshift(newObj);
      }
      document.getElementById('obj-modal').classList.add('hidden');
      render(objectives, container, userId);
    } catch (err) {
      showToast('Failed to save objective', 'error');
    }
  });

  // ─── LIST ACTIONS ────────────────────────────────────────────────────────
  document.getElementById('obj-list').addEventListener('click', async (e) => {
    const card = e.target.closest('.obj-card');
    if (!card) return;
    const objId = card.dataset.id;
    const obj   = objectives.find(o => o.id === objId);
    if (!obj) return;

    if (e.target.closest('.edit-obj-btn')) { openObjModal(obj); return; }

    if (e.target.closest('.delete-obj-btn')) {
      deletingObjId = objId;
      document.getElementById('delete-obj-modal').classList.remove('hidden');
      return;
    }

    if (e.target.closest('.update-progress-btn')) {
      progressObjId = objId;
      document.getElementById('progress-input').value = obj.progress;
      document.getElementById('progress-range').value  = obj.progress;
      document.getElementById('progress-modal').classList.remove('hidden');
      return;
    }

    if (e.target.closest('.milestone-check')) {
      const milestoneIdx = parseInt(e.target.closest('.milestone-check').dataset.idx);
      const milestones = [...(obj.milestones || [])];
      milestones[milestoneIdx] = { ...milestones[milestoneIdx], done: !milestones[milestoneIdx].done };
      try {
        const updated = await updateObjective(objId, { milestones });
        objectives.splice(objectives.findIndex(o => o.id === objId), 1, updated);
        render(objectives, container, userId);
      } catch (err) {
        showToast('Failed to update milestone', 'error');
      }
    }
  });

  // Sync range ↔ number
  document.getElementById('progress-range').addEventListener('input', (e) => {
    document.getElementById('progress-input').value = e.target.value;
  });
  document.getElementById('progress-input').addEventListener('input', (e) => {
    document.getElementById('progress-range').value = e.target.value;
  });

  document.getElementById('close-progress-modal').addEventListener('click', () => {
    document.getElementById('progress-modal').classList.add('hidden');
  });
  document.getElementById('save-progress-btn').addEventListener('click', async () => {
    if (!progressObjId) return;
    const progress = parseInt(document.getElementById('progress-input').value) || 0;
    const clamped  = Math.min(100, Math.max(0, progress));
    try {
      const updated = await updateObjective(progressObjId, { progress: clamped, completed: clamped >= 100 });
      objectives.splice(objectives.findIndex(o => o.id === progressObjId), 1, updated);
      document.getElementById('progress-modal').classList.add('hidden');
      progressObjId = null;
      render(objectives, container, userId);
      if (clamped >= 100) showToast('Objective complete!', 'success');
    } catch (err) {
      showToast('Failed to update progress', 'error');
    }
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
      render(objectives, container, userId);
    } catch (err) {
      showToast('Failed to delete objective', 'error');
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

function renderObjCard(obj) {
  const catIcon = '';
  const milestones = obj.milestones || [];

  return `
    <div class="obj-card card ${obj.completed ? 'obj-complete' : ''}" data-id="${obj.id}">
      <div class="obj-header">
        <div class="obj-title-row">
          <span class="obj-title">${obj.title}</span>
          ${obj.completed ? '<span class="badge badge-legendary">✓ Complete</span>' : ''}
        </div>
        <div class="obj-actions">
          <button class="icon-btn edit-obj-btn" title="Edit">Edit</button>
          <button class="icon-btn delete-obj-btn" title="Delete">Del</button>
        </div>
      </div>

      ${obj.description ? `<p class="obj-desc">${obj.description}</p>` : ''}

      <div class="obj-meta">
        <span class="obj-cat">${obj.category}</span>
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
