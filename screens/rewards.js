// Reward shop screen

import { getRewards, createReward, deleteReward, redeemReward, getProfile } from '../supabase.js';
import { showToast, launchConfetti } from '../utils/animations.js';

const TIER_LABELS = { small: 'S', medium: 'M', large: 'L', legendary: 'Legend' };
const TIER_ORDER = { small: 0, medium: 1, large: 2, legendary: 3 };

export async function renderRewards(userId, container, onXPUpdate) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  const [rewards, profile] = await Promise.all([getRewards(userId), getProfile(userId)]);
  render(rewards, profile, container, userId, onXPUpdate);
}

function bankXP(profile) {
  return profile.lifetime_xp || 0;
}

function render(rewards, profile, container, userId, onXPUpdate) {
  const bank = bankXP(profile);

  container.innerHTML = `
    <div class="rewards-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Reward Shop</h2>
          <p class="screen-sub xp-balance"><span id="xp-balance" class="gold">${bank.toLocaleString()}</span> XP available</p>
        </div>
        <button class="btn btn-primary" id="add-reward-btn">+ Add Reward</button>
      </div>

      <div class="rewards-grid" id="rewards-grid">
        ${rewards.length === 0
          ? `<div class="empty-state">No rewards yet.<br>Add something to work towards!</div>`
          : rewards.map(r => renderRewardCard(r, bank)).join('')}
      </div>
    </div>

    <!-- Add reward modal -->
    <div class="modal-overlay hidden" id="reward-modal">
      <div class="modal">
        <h3 class="modal-title">New Reward</h3>
        <input class="input" id="reward-title" placeholder="Reward name…" maxlength="60" />
        <textarea class="input textarea" id="reward-desc" placeholder="Description (optional)…" rows="2"></textarea>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tier</label>
            <select class="input" id="reward-tier">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">XP Cost</label>
            <input class="input" id="reward-xp" type="number" min="1" max="99999" value="100" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="close-reward-modal">Cancel</button>
          <button class="btn btn-primary" id="save-reward-btn">Add Reward</button>
        </div>
      </div>
    </div>

    <!-- Redeem confirm modal -->
    <div class="modal-overlay hidden" id="redeem-modal">
      <div class="modal">
        <h3 class="modal-title">Redeem Reward?</h3>
        <div class="redeem-preview" id="redeem-preview"></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-redeem">Cancel</button>
          <button class="btn btn-gold" id="confirm-redeem">Redeem</button>
        </div>
      </div>
    </div>

    <!-- Delete reward confirm -->
    <div class="modal-overlay hidden" id="delete-reward-modal">
      <div class="modal">
        <h3 class="modal-title">Delete Reward?</h3>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="cancel-delete-reward">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-reward">Delete</button>
        </div>
      </div>
    </div>
  `;

  let redeemingReward  = null;
  let deletingRewardId = null;

  // ─── ADD REWARD ──────────────────────────────────────────────────────────
  document.getElementById('add-reward-btn').addEventListener('click', () => {
    document.getElementById('reward-title').value = '';
    document.getElementById('reward-desc').value = '';
    document.getElementById('reward-tier').value = 'small';
    document.getElementById('reward-xp').value = '100';
    document.getElementById('reward-modal').classList.remove('hidden');
    document.getElementById('reward-title').focus();
  });
  document.getElementById('close-reward-modal').addEventListener('click', () => {
    document.getElementById('reward-modal').classList.add('hidden');
  });
  document.getElementById('save-reward-btn').addEventListener('click', async () => {
    const title = document.getElementById('reward-title').value.trim();
    const description = document.getElementById('reward-desc').value.trim();
    const tier = document.getElementById('reward-tier').value;
    const xp_cost = parseInt(document.getElementById('reward-xp').value) || 100;
    if (!title) { showToast('Please enter a reward name', 'error'); return; }
    try {
      const newReward = await createReward(userId, { title, description, tier, xp_cost });
      rewards.push(newReward);
      rewards.sort((a, b) => a.xp_cost - b.xp_cost);
      document.getElementById('reward-modal').classList.add('hidden');
      render(rewards, profile, container, userId, onXPUpdate);
    } catch (err) {
      showToast('Failed to add reward', 'error');
    }
  });

  // ─── GRID ACTIONS ────────────────────────────────────────────────────────
  document.getElementById('rewards-grid').addEventListener('click', async (e) => {
    const card = e.target.closest('.reward-card');
    if (!card) return;
    const rewardId = card.dataset.id;
    const reward   = rewards.find(r => r.id === rewardId);
    if (!reward) return;

    if (e.target.closest('.redeem-btn')) {
      if (bank < reward.xp_cost) return;
      redeemingReward = reward;
      document.getElementById('redeem-preview').innerHTML = `
        <span class="reward-tier-icon tier-${reward.tier}">${TIER_LABELS[reward.tier]}</span>
        <strong>${reward.title}</strong>
        <span class="gold">−${reward.xp_cost.toLocaleString()} XP</span>
      `;
      document.getElementById('redeem-modal').classList.remove('hidden');
      return;
    }

    if (e.target.closest('.delete-reward-btn')) {
      deletingRewardId = rewardId;
      document.getElementById('delete-reward-modal').classList.remove('hidden');
      return;
    }
  });

  // Redeem confirm
  document.getElementById('cancel-redeem').addEventListener('click', () => {
    document.getElementById('redeem-modal').classList.add('hidden');
    redeemingReward = null;
  });
  document.getElementById('confirm-redeem').addEventListener('click', async () => {
    if (!redeemingReward) return;
    const btn = document.getElementById('confirm-redeem');
    btn.disabled = true;
    try {
      const updatedProfile = await redeemReward(userId, redeemingReward);
      profile.lifetime_xp = updatedProfile.lifetime_xp;
      if (onXPUpdate) onXPUpdate(updatedProfile);
      document.getElementById('redeem-modal').classList.add('hidden');
      launchConfetti(150);
      showToast(`Enjoy your ${redeemingReward.title}!`, 'success');
      redeemingReward = null;
      render(rewards, updatedProfile, container, userId, onXPUpdate);
    } catch (err) {
      showToast(err.message || 'Failed to redeem reward', 'error');
      btn.disabled = false;
    }
  });

  // Delete confirm
  document.getElementById('cancel-delete-reward').addEventListener('click', () => {
    document.getElementById('delete-reward-modal').classList.add('hidden');
    deletingRewardId = null;
  });
  document.getElementById('confirm-delete-reward').addEventListener('click', async () => {
    if (!deletingRewardId) return;
    try {
      await deleteReward(deletingRewardId);
      rewards.splice(rewards.findIndex(r => r.id === deletingRewardId), 1);
      document.getElementById('delete-reward-modal').classList.add('hidden');
      deletingRewardId = null;
      render(rewards, profile, container, userId, onXPUpdate);
    } catch (err) {
      showToast('Failed to delete reward', 'error');
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

function renderRewardCard(reward, bank) {
  const canAfford = bank >= reward.xp_cost;
  return `
    <div class="reward-card card tier-${reward.tier} ${canAfford ? '' : 'unaffordable'}" data-id="${reward.id}">
      <div class="reward-card-header">
        <span class="reward-tier-icon tier-${reward.tier}">${TIER_LABELS[reward.tier]}</span>
        <button class="icon-btn delete-reward-btn" title="Delete">X</button>
      </div>
      <div class="reward-title">${reward.title}</div>
      ${reward.description ? `<div class="reward-desc">${reward.description}</div>` : ''}
      <div class="reward-footer">
        <span class="reward-cost gold">${reward.xp_cost.toLocaleString()} XP</span>
        <button class="btn ${canAfford ? 'btn-gold' : 'btn-disabled'} redeem-btn" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? 'Redeem' : 'Locked'}
        </button>
      </div>
    </div>
  `;
}
