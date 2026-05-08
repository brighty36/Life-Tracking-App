// Daily Reflection screen

import { getReflection, upsertReflection, getReflectionHistory } from '../supabase.js';
import { showToast } from '../utils/animations.js';

const MOODS = [
  { value: 1, label: 'Rough' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];

export async function renderReflection(userId, container) {
  container.innerHTML = `<div class="loading-spinner"></div>`;

  const todayStr = new Date().toISOString().split('T')[0];
  const [existing, history] = await Promise.all([
    getReflection(userId, todayStr),
    getReflectionHistory(userId, 20),
  ]);

  render(userId, container, todayStr, existing, history);
}

function render(userId, container, todayStr, existing, history) {
  const savedMood = existing?.mood || 0;

  container.innerHTML = `
    <div class="reflection-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Daily Reflection</h2>
          <p class="screen-sub">${formatDisplayDate(todayStr)}</p>
        </div>
        ${existing ? '<span class="badge badge-legendary">✓ Saved today</span>' : ''}
      </div>

      <!-- Reflection form -->
      <div class="reflection-form card">

        <!-- Mood -->
        <div class="reflection-field">
          <label class="reflection-label">Overall Mood</label>
          <div class="mood-picker" id="mood-picker">
            ${MOODS.map(m => `
              <button class="mood-btn ${savedMood === m.value ? 'selected' : ''}" data-mood="${m.value}" title="${m.label}">
                <span class="mood-label">${m.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Things learnt -->
        <div class="reflection-field">
          <label class="reflection-label">Things I learnt today</label>
          <textarea
            class="input textarea reflection-textarea"
            id="things-learnt"
            placeholder="What did you discover, learn or realise today?"
            rows="3"
          >${existing?.things_learnt || ''}</textarea>
        </div>

        <!-- Proud of -->
        <div class="reflection-field">
          <label class="reflection-label">Things I am proud of</label>
          <textarea
            class="input textarea reflection-textarea"
            id="proud-of"
            placeholder="What did you accomplish or do well today?"
            rows="3"
          >${existing?.proud_of || ''}</textarea>
        </div>

        <!-- Troubled by -->
        <div class="reflection-field">
          <label class="reflection-label">Things that troubled me</label>
          <textarea
            class="input textarea reflection-textarea"
            id="troubled-by"
            placeholder="What was difficult, worrying or weighing on you today?"
            rows="3"
          >${existing?.troubled_by || ''}</textarea>
        </div>

        <!-- Grateful for -->
        <div class="reflection-field">
          <label class="reflection-label">Things I am grateful for</label>
          <textarea
            class="input textarea reflection-textarea"
            id="grateful-for"
            placeholder="What are you thankful for today?"
            rows="3"
          >${existing?.grateful_for || ''}</textarea>
        </div>

        <div class="reflection-actions">
          <button class="btn btn-primary" id="save-reflection-btn">
            ${existing ? '✓ Update Reflection' : 'Save Reflection'}
          </button>
        </div>
      </div>

      <!-- Past reflections -->
      ${history.filter(r => r.date !== todayStr).length > 0 ? `
        <div class="reflection-history">
          <h3 class="history-title">Past Reflections</h3>
          <div class="history-list">
            ${history
              .filter(r => r.date !== todayStr)
              .map(r => renderHistoryCard(r))
              .join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  let selectedMood = savedMood;

  // Mood picker
  document.getElementById('mood-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) return;
    selectedMood = parseInt(btn.dataset.mood);
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // Save reflection
  document.getElementById('save-reflection-btn').addEventListener('click', async () => {
    const things_learnt = document.getElementById('things-learnt').value.trim() || null;
    const proud_of      = document.getElementById('proud-of').value.trim() || null;
    const troubled_by   = document.getElementById('troubled-by').value.trim() || null;
    const grateful_for  = document.getElementById('grateful-for').value.trim() || null;
    const mood          = selectedMood || null;

    const saveBtn = document.getElementById('save-reflection-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      const saved = await upsertReflection(userId, {
        date: todayStr, things_learnt, proud_of, troubled_by, grateful_for, mood,
      });
      showToast('Reflection saved!', 'success');

      // Update history list with saved entry
      const histIdx = history.findIndex(r => r.date === todayStr);
      if (histIdx > -1) history[histIdx] = saved;
      else history.unshift(saved);

      render(userId, container, todayStr, saved, history);
    } catch (err) {
      showToast('Failed to save reflection', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = existing ? '✓ Update Reflection' : 'Save Reflection';
    }
  });
}

function renderHistoryCard(reflection) {
  const mood = MOODS.find(m => m.value === reflection.mood);

  return `
    <details class="history-card card">
      <summary class="history-summary">
        <span class="history-date">${formatDisplayDate(reflection.date)}</span>
        ${mood ? `<span class="history-mood">${mood.label}</span>` : ''}
      </summary>
      <div class="history-body">
        ${reflection.things_learnt ? `
          <div class="history-section">
            <div class="history-section-label">Learnt</div>
            <p>${escapeHtml(reflection.things_learnt)}</p>
          </div>` : ''}
        ${reflection.proud_of ? `
          <div class="history-section">
            <div class="history-section-label">Proud of</div>
            <p>${escapeHtml(reflection.proud_of)}</p>
          </div>` : ''}
        ${reflection.troubled_by ? `
          <div class="history-section">
            <div class="history-section-label">Troubled by</div>
            <p>${escapeHtml(reflection.troubled_by)}</p>
          </div>` : ''}
        ${reflection.grateful_for ? `
          <div class="history-section">
            <div class="history-section-label">Grateful for</div>
            <p>${escapeHtml(reflection.grateful_for)}</p>
          </div>` : ''}
      </div>
    </details>
  `;
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const todayStr = new Date().toISOString().split('T')[0];
  if (dateStr === todayStr) return 'Today';
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}
