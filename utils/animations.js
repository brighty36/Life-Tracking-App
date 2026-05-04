// Animation helpers: confetti, level-up flash, XP bar fill

// ─── CONFETTI ────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#fbbf24', '#a78bfa', '#60a5fa', '#34d399', '#f87171', '#f472b6'];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

export function launchConfetti(count = 120) {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${randomBetween(10, 90)}vw;
      background: ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
      width: ${randomBetween(6, 12)}px;
      height: ${randomBetween(6, 12)}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${randomBetween(1.5, 3)}s;
      animation-delay: ${randomBetween(0, 0.8)}s;
    `;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ─── LEVEL-UP FLASH ──────────────────────────────────────────────────────────

export function showLevelUpBanner(newLevel, className) {
  const existing = document.querySelector('.level-up-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'level-up-banner';
  banner.innerHTML = `
    <div class="level-up-inner">
      <span class="level-up-icon">⭐</span>
      <div>
        <div class="level-up-title">LEVEL UP!</div>
        <div class="level-up-sub">Level ${newLevel} — ${className}</div>
      </div>
      <span class="level-up-icon">⭐</span>
    </div>
  `;
  document.body.appendChild(banner);
  launchConfetti(80);

  setTimeout(() => {
    banner.classList.add('fade-out');
    setTimeout(() => banner.remove(), 600);
  }, 3000);
}

// ─── XP BAR ANIMATION ────────────────────────────────────────────────────────

export function animateXPBar(barEl, fromPct, toPct, durationMs = 800) {
  const start = performance.now();
  const diff = toPct - fromPct;

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    barEl.style.width = `${fromPct + diff * eased}%`;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─── STAT BOOST POP ──────────────────────────────────────────────────────────

export function showStatBoost(statName, amount) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'stat-toast';
  toast.textContent = `+${amount} ${statName.charAt(0).toUpperCase() + statName.slice(1)}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 2000);
}

// ─── GENERIC TOAST ───────────────────────────────────────────────────────────

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}
