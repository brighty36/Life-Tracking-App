// Main app — routing, auth, nav

import { supabase, signIn, signUp, signOut, getSession, createProfile, getProfile } from './supabase.js';
import { renderCharacter  } from './screens/character.js';
import { renderQuests     } from './screens/quests.js';
import { renderRewards    } from './screens/rewards.js';
import { renderJournal    } from './screens/journal.js';
import { renderReflection } from './screens/reflection.js';
import { renderBudget     } from './screens/budget.js';
import { renderClaude     } from './screens/claude.js';
import { getEffectiveDailyXP } from './utils/xp.js';
import { showToast } from './utils/animations.js';
import { getApiKey, saveApiKey } from './utils/claude.js';

// ─── THEME ────────────────────────────────────────────────────────────────────

const THEME_KEY = 'life-rpg-theme';
const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// ─── STATE ────────────────────────────────────────────────────────────────────

let currentUserId  = null;
let currentScreen  = 'character';
let currentProfile = null;

// ─── ROUTES ──────────────────────────────────────────────────────────────────

const SCREENS = ['character', 'quests', 'rewards', 'journal', 'reflection', 'budget', 'claude'];

async function navigateTo(screen, context = null) {
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
      case 'rewards':     await renderRewards(currentUserId, content, handleXPUpdate); break;
      case 'journal':     await renderJournal(currentUserId, content, handleXPUpdate); break;
      case 'reflection':  await renderReflection(currentUserId, content); break;
      case 'budget':      await renderBudget(currentUserId, content); break;
      case 'claude':      await renderClaude(currentUserId, content, handleXPUpdate, context); break;
    }
  } catch (err) {
    console.error('Screen render error:', err);
    content.innerHTML = `<div class="error-state">Failed to load. <button class="btn btn-ghost" onclick="location.reload()">Retry</button></div>`;
  }
}

window.navigateTo = navigateTo;

function handleXPUpdate(profile) {
  currentProfile = profile;
  updateHeaderXP(profile);
}

function updateHeaderXP(profile) {
  const nameEl     = document.getElementById('header-name');
  const dailyEl    = document.getElementById('header-daily-xp');
  const lifetimeEl = document.getElementById('header-lifetime-xp');

  if (nameEl)     nameEl.textContent     = profile.username;
  if (dailyEl)    dailyEl.textContent    = getEffectiveDailyXP(profile).toLocaleString();
  if (lifetimeEl) lifetimeEl.textContent = (profile.lifetime_xp || 0).toLocaleString();
}

// ─── AUTH SCREEN ─────────────────────────────────────────────────────────────

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
  currentUserId  = null;
  currentProfile = null;
}

function showAppShell() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
}

async function loadUserProfile(authId) {
  try {
    currentProfile = await getProfile(authId);
    currentUserId  = authId;
    updateHeaderXP(currentProfile);
    showAppShell();
    navigateTo('character');
  } catch {
    showProfileSetupModal(authId);
  }
}

function showProfileSetupModal(authId) {
  const modal  = document.getElementById('profile-setup-modal');
  const nameEl = document.getElementById('profile-setup-name');
  nameEl.value = '';
  modal.classList.remove('hidden');
  nameEl.focus();

  document.getElementById('profile-setup-confirm').onclick = async () => {
    const name = nameEl.value.trim() || 'Adventurer';
    const btn  = document.getElementById('profile-setup-confirm');
    btn.disabled    = true;
    btn.textContent = 'Setting up…';
    try {
      currentProfile = await createProfile(authId, name, name.slice(0, 2).toUpperCase());
      currentUserId  = authId;
      modal.classList.add('hidden');
      updateHeaderXP(currentProfile);
      showAppShell();
      navigateTo('character');
    } catch (err) {
      console.error('Profile creation failed:', err);
      showToast('Failed to create profile', 'error');
      btn.disabled    = false;
      btn.textContent = 'Get started';
    }
  };
}

// ─── AVATAR INITIALS ─────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#1558f6','#6d28d9','#059669','#dc2626','#d97706','#0891b2','#7c3aed','#be185d'];

function avatarColor(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = ((h << 5) - h) + username.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function avatarHTML(username, size = 'lg') {
  const color    = avatarColor(username);
  const initials = username.slice(0, 2).toUpperCase();
  return `<div class="avatar-initials avatar-${size}" style="background:${color}">${initials}</div>`;
}

// ─── BOOT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // Nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });

  // Settings modal
  const settingsModal  = document.getElementById('settings-modal');
  const settingsKeyEl  = document.getElementById('settings-api-key');
  document.getElementById('settings-btn').addEventListener('click', () => {
    settingsKeyEl.value = getApiKey();
    settingsModal.classList.remove('hidden');
  });
  document.getElementById('settings-cancel').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });
  document.getElementById('settings-save').addEventListener('click', () => {
    saveApiKey(settingsKeyEl.value);
    settingsModal.classList.add('hidden');
    showToast('API key saved', 'success');
  });
  settingsModal.addEventListener('click', e => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
  });

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle');
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    themeBtn.textContent = next === 'dark' ? 'Light' : 'Dark';
  });
  themeBtn.textContent = savedTheme === 'dark' ? 'Light' : 'Dark';

  // Sign out
  document.getElementById('sign-out-btn').addEventListener('click', async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  });

  // ── Auth form ──────────────────────────────────────────────────────────────

  let authMode = 'signin';

  document.getElementById('auth-tab-signin').addEventListener('click', () => {
    authMode = 'signin';
    document.getElementById('auth-tab-signin').classList.add('active');
    document.getElementById('auth-tab-signup').classList.remove('active');
    document.getElementById('auth-submit').textContent = 'Sign in';
    document.getElementById('auth-error').classList.add('hidden');
  });

  document.getElementById('auth-tab-signup').addEventListener('click', () => {
    authMode = 'signup';
    document.getElementById('auth-tab-signup').classList.add('active');
    document.getElementById('auth-tab-signin').classList.remove('active');
    document.getElementById('auth-submit').textContent = 'Create account';
    document.getElementById('auth-error').classList.add('hidden');
  });

  async function submitAuth() {
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errorEl  = document.getElementById('auth-error');
    const btn      = document.getElementById('auth-submit');
    if (!email || !password) return;

    btn.disabled    = true;
    btn.textContent = authMode === 'signin' ? 'Signing in…' : 'Creating account…';
    errorEl.classList.add('hidden');
    errorEl.style.color = '';

    try {
      const user = authMode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password);

      if (authMode === 'signup' && !user.confirmed_at) {
        errorEl.textContent = 'Check your email to confirm your account, then sign in.';
        errorEl.classList.remove('hidden');
        errorEl.style.color = 'var(--accent)';
      }
      // onAuthStateChange handles the rest for confirmed/signed-in users
    } catch (err) {
      errorEl.textContent = err.message || 'Authentication failed';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled    = false;
      btn.textContent = authMode === 'signin' ? 'Sign in' : 'Create account';
    }
  }

  document.getElementById('auth-submit').addEventListener('click', submitAuth);
  document.getElementById('auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAuth();
  });

  // ── Auth state listener ────────────────────────────────────────────────────

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      await loadUserProfile(session.user.id);
    } else {
      showAuthScreen();
    }
  });

  // ── Boot: check for existing session ──────────────────────────────────────

  const session = await getSession();
  if (session?.user) {
    await loadUserProfile(session.user.id);
  } else {
    showAuthScreen();
  }
});
