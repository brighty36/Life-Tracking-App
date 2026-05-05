// Main app — routing, profile selection, nav

import { getAllProfiles, createProfile, getProfile } from './supabase.js';
import { renderCharacter  } from './screens/character.js';
import { renderQuests     } from './screens/quests.js';
import { renderObjectives } from './screens/objectives.js';
import { renderRewards    } from './screens/rewards.js';
import { renderJournal    } from './screens/journal.js';
import { renderReflection } from './screens/reflection.js';
import { renderBudget     } from './screens/budget.js';
import { xpPercent } from './utils/xp.js';
import { showToast, animateXPBar } from './utils/animations.js';

// ─── THEME ────────────────────────────────────────────────────────────────────

const THEME_KEY = 'life-rpg-theme';
const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// ─── STATE ────────────────────────────────────────────────────────────────────

const PROFILE_KEY = 'life-rpg-profile-id';

let currentUserId  = null;
let currentScreen  = 'character';
let currentProfile = null;

// ─── ROUTES ──────────────────────────────────────────────────────────────────

const SCREENS = ['character', 'quests', 'objectives', 'rewards', 'journal', 'reflection', 'budget'];

async function navigateTo(screen) {
  if (!SCREENS.includes(screen)) screen = 'character';
  currentScreen = screen;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === screen);
  });

  const content = document.getElementById('screen-content');
  content.innerHTML = `<div class="loading-spinner"></div>`;

  try {
    switch (screen) {
      case 'character':   await renderCharacter(currentUserId, content); break;
      case 'quests':      await renderQuests(currentUserId, content, handleXPUpdate); break;
      case 'objectives':  await renderObjectives(currentUserId, content); break;
      case 'rewards':     await renderRewards(currentUserId, content, handleXPUpdate); break;
      case 'journal':     await renderJournal(currentUserId, content); break;
      case 'reflection':  await renderReflection(currentUserId, content); break;
      case 'budget':      await renderBudget(currentUserId, content); break;
    }
  } catch (err) {
    console.error('Screen render error:', err);
    content.innerHTML = `<div class="error-state">Failed to load. <button class="btn btn-ghost" onclick="location.reload()">Retry</button></div>`;
  }
}

function handleXPUpdate(profile) {
  currentProfile = profile;
  updateHeaderXP(profile);
}

function updateHeaderXP(profile) {
  const nameEl  = document.getElementById('header-name');
  const levelEl = document.getElementById('header-level');
  const barEl   = document.getElementById('header-xp-bar');
  const pctEl   = document.getElementById('header-xp-pct');

  if (nameEl)  nameEl.textContent  = profile.username;
  if (levelEl) levelEl.textContent = `Lv.${profile.level}`;

  const pct = xpPercent(profile.xp, profile.xp_to_next_level);
  if (pctEl)  pctEl.textContent   = `${profile.xp}/${profile.xp_to_next_level}`;
  if (barEl)  animateXPBar(barEl, parseFloat(barEl.style.width) || 0, pct, 600);
}

// ─── PROFILE SELECTOR ────────────────────────────────────────────────────────

function showProfileScreen() {
  document.getElementById('profile-screen').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
  loadProfileCards();
}

function showAppShell() {
  document.getElementById('profile-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
}

async function loadProfileCards() {
  const container = document.getElementById('profile-cards');
  container.innerHTML = `<div class="loading-spinner"></div>`;
  try {
    const profiles = await getAllProfiles();
    if (profiles.length === 0) {
      container.innerHTML = `<p class="profile-empty">No profiles yet — create one below!</p>`;
    } else {
      container.innerHTML = profiles.map(p => `
        <button class="profile-card" data-id="${p.id}">
          <span class="profile-card-avatar">${p.avatar}</span>
          <span class="profile-card-name">${p.username}</span>
          <span class="profile-card-class">${p.character_class}</span>
          <span class="profile-card-level">Lv.${p.level}</span>
        </button>
      `).join('');
      container.querySelectorAll('.profile-card').forEach(card => {
        card.addEventListener('click', () => selectProfile(card.dataset.id));
      });
    }
  } catch (err) {
    console.error('Failed to load profiles:', err);
    container.innerHTML = `<p class="error-state">Failed to load profiles.</p>`;
  }
}

async function selectProfile(profileId) {
  try {
    currentProfile = await getProfile(profileId);
  } catch (err) {
    console.error('Profile not found:', err);
    localStorage.removeItem(PROFILE_KEY);
    showProfileScreen();
    return;
  }
  localStorage.setItem(PROFILE_KEY, profileId);
  currentUserId = profileId;
  updateHeaderXP(currentProfile);
  showAppShell();
  navigateTo('character');
}

// Exposed globally so character screen can trigger it
window.switchProfile = function () {
  currentUserId  = null;
  currentProfile = null;
  localStorage.removeItem(PROFILE_KEY);
  showProfileScreen();
};

// ─── AVATARS ─────────────────────────────────────────────────────────────────

const AVATARS = ['⚔️','🧙','🏹','🛡️','🗡️','🔮','🦸','🧝','🐉','🌟','🦊','🐺','🦁','👑','💎','🔥','⚡','🌙','☀️','🎭'];

// ─── BOOT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle');
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
  });
  themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  // Switch profile (header button)
  document.getElementById('switch-profile-btn').addEventListener('click', () => window.switchProfile());

  // ── New profile modal ──────────────────────────────────────────────────────

  let selectedAvatar = AVATARS[0];

  document.getElementById('new-profile-btn').addEventListener('click', () => {
    selectedAvatar = AVATARS[0];
    document.getElementById('new-profile-avatar-grid').innerHTML = AVATARS.map(a =>
      `<button class="avatar-option ${a === selectedAvatar ? 'selected' : ''}" data-avatar="${a}">${a}</button>`
    ).join('');
    document.getElementById('new-profile-name').value = '';
    document.getElementById('new-profile-modal').classList.remove('hidden');
    document.getElementById('new-profile-name').focus();
  });

  document.getElementById('cancel-new-profile').addEventListener('click', () => {
    document.getElementById('new-profile-modal').classList.add('hidden');
  });

  document.getElementById('new-profile-avatar-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.avatar-option');
    if (!btn) return;
    selectedAvatar = btn.dataset.avatar;
    document.querySelectorAll('#new-profile-avatar-grid .avatar-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  document.getElementById('confirm-new-profile').addEventListener('click', async () => {
    const name    = document.getElementById('new-profile-name').value.trim() || 'Adventurer';
    const saveBtn = document.getElementById('confirm-new-profile');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Creating…';
    try {
      const profile = await createProfile(name, selectedAvatar);
      document.getElementById('new-profile-modal').classList.add('hidden');
      await selectProfile(profile.id);
    } catch (err) {
      console.error('Failed to create profile:', err);
      showToast('Failed to create profile', 'error');
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Create';
    }
  });

  // ── Auto-resume last session ───────────────────────────────────────────────

  const savedId = localStorage.getItem(PROFILE_KEY);
  if (savedId) {
    selectProfile(savedId);
  } else {
    showProfileScreen();
  }
});
