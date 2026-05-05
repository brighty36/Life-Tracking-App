// Main app — routing, auth state, nav

import { supabase, onAuthStateChange, sendMagicLink, signOut, seedNewUser, getProfile } from './supabase.js';
import { renderCharacter  } from './screens/character.js';
import { renderQuests     } from './screens/quests.js';
import { renderObjectives } from './screens/objectives.js';
import { renderRewards    } from './screens/rewards.js';
import { renderJournal    } from './screens/journal.js';
import { renderReflection } from './screens/reflection.js';
import { renderBudget     } from './screens/budget.js';
import { xpPercent, classForLevel } from './utils/xp.js';
import { showToast, animateXPBar } from './utils/animations.js';

// ─── THEME ────────────────────────────────────────────────────────────────────

const THEME_KEY = 'life-rpg-theme';
const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// ─── STATE ────────────────────────────────────────────────────────────────────

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

// ─── AUTH ────────────────────────────────────────────────────────────────────

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-shell').classList.add('hidden');
}

function showAppShell() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
}

async function initUser(userId) {
  currentUserId = userId;

  try { await seedNewUser(userId); }
  catch (err) { console.warn('Seed skipped:', err.message); }

  try {
    currentProfile = await getProfile(userId);
    updateHeaderXP(currentProfile);
  } catch (err) { console.error('Failed to load profile:', err); }

  showAppShell();
  navigateTo('character');
}

// ─── BOOT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
  });

  const themeBtn = document.getElementById('theme-toggle');
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
  });
  themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  document.getElementById('sign-out-btn').addEventListener('click', async () => {
    await signOut();
  });

  const emailForm  = document.getElementById('email-form');
  const emailInput = document.getElementById('email-input');
  const authMsg    = document.getElementById('auth-message');

  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;

    const submitBtn = emailForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    authMsg.textContent = '';

    try {
      await sendMagicLink(email);
      authMsg.textContent = '✅ Check your email for a magic link!';
      authMsg.className = 'auth-message success';
      emailInput.value = '';
    } catch (err) {
      authMsg.textContent = '❌ ' + (err.message || 'Failed to send link');
      authMsg.className = 'auth-message error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Magic Link';
    }
  });

  onAuthStateChange(async (session) => {
    if (session?.user) { await initUser(session.user.id); }
    else { currentUserId = null; showAuthScreen(); }
  });
});
