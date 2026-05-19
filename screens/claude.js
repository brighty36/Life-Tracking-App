// Claude AI chat screen

import { getProfile, getQuests, getActivityLog, getStats, createQuest, logActivity } from '../supabase.js';
import { showToast } from '../utils/animations.js';
import { getApiKey, buildSystemPrompt, streamMessage, parseQuestBlocks } from '../utils/claude.js';

// ─── LIGHTWEIGHT MARKDOWN ─────────────────────────────────────────────────────

function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export async function renderClaude(userId, container, onXPUpdate, initialContext = null) {
  container.innerHTML = `<div class="loading-spinner"></div>`;

  const apiKey = getApiKey();

  // Fetch data for system prompt (fail gracefully)
  let profile, quests, activityLog, stats, systemPrompt;
  try {
    [profile, quests, activityLog, stats] = await Promise.all([
      getProfile(userId),
      getQuests(userId),
      getActivityLog(userId, 20),
      getStats(userId),
    ]);
    systemPrompt = buildSystemPrompt(profile, quests, activityLog, stats);
  } catch {
    systemPrompt = 'You are a helpful life coach assistant. Be warm and encouraging.';
    profile = { username: 'Adventurer' };
    quests  = [];
  }

  // ─── Messages state ───────────────────────────────────────────────────────
  const messages = [];
  let   questQueue = [];   // pending quest-create blocks
  let   streaming  = false;

  // ─── Render shell ─────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="claude-screen">
      <div class="screen-header">
        <div>
          <h2 class="screen-title">Claude</h2>
          <p class="screen-sub">Your AI life coach</p>
        </div>
      </div>

      ${!apiKey ? `
        <div class="claude-api-key-banner">
          <span>Add your Anthropic API key to start chatting.</span>
          <button id="claude-open-settings">Add Key</button>
        </div>
      ` : ''}

      <div class="claude-chat-window" id="claude-chat-window"></div>

      <div id="claude-quest-offer-slot"></div>

      <div class="claude-input-bar">
        <textarea id="claude-input" rows="1" placeholder="Ask Claude anything…" ${!apiKey ? 'disabled' : ''}></textarea>
        <button class="claude-send-btn" id="claude-send-btn" ${!apiKey ? 'disabled' : ''}>Send</button>
      </div>
    </div>
  `;

  const chatWindow     = container.querySelector('#claude-chat-window');
  const input          = container.querySelector('#claude-input');
  const sendBtn        = container.querySelector('#claude-send-btn');
  const offerSlot      = container.querySelector('#claude-quest-offer-slot');
  const openSettingsBtn = container.querySelector('#claude-open-settings');

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      const modal = document.getElementById('settings-modal');
      if (modal) modal.classList.remove('hidden');
    });
  }

  // Auto-grow textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  });

  // ─── Append message bubble ────────────────────────────────────────────────
  function appendBubble(role, html, streaming = false) {
    const wrap = document.createElement('div');
    wrap.className = `claude-message-${role}`;
    const bubble = document.createElement('div');
    bubble.className = `claude-bubble${streaming ? ' streaming' : ''}`;
    bubble.innerHTML = html;
    wrap.appendChild(bubble);
    chatWindow.appendChild(wrap);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return bubble;
  }

  // ─── Quest offer banner ───────────────────────────────────────────────────
  function showNextOffer() {
    if (questQueue.length === 0) { offerSlot.innerHTML = ''; return; }
    const quest = questQueue[0];
    const diffLabels = { fun:'Fun (0 XP)', quick:'Quick (5 XP)', easy:'Easy (25 XP)', medium:'Medium (50 XP)', hard:'Hard (100 XP)', legendary:'Legendary (250 XP)' };
    offerSlot.innerHTML = `
      <div class="claude-quest-offer">
        <div class="claude-quest-offer-text">
          <div class="claude-quest-offer-title">New quest: ${escHtml(quest.title)}</div>
          <div class="claude-quest-offer-meta">${quest.category} · ${diffLabels[quest.difficulty] || quest.difficulty} · ${quest.frequency}</div>
          ${quest.description ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem">${escHtml(quest.description)}</div>` : ''}
        </div>
        <div class="claude-quest-offer-actions">
          <button class="btn btn-primary btn-sm" id="claude-confirm-quest">Add Quest</button>
          <button class="btn btn-ghost btn-sm" id="claude-dismiss-quest">Dismiss</button>
        </div>
      </div>
    `;

    offerSlot.querySelector('#claude-confirm-quest').addEventListener('click', async () => {
      try {
        await createQuest(userId, { ...quest, is_recurring: false });
        await logActivity(userId, 'claude_quest', `Claude created quest: ${quest.title}`, 0);
        showToast(`Quest "${quest.title}" added!`, 'success');
      } catch {
        showToast('Failed to add quest', 'error');
      }
      questQueue.shift();
      showNextOffer();
    });

    offerSlot.querySelector('#claude-dismiss-quest').addEventListener('click', () => {
      questQueue.shift();
      showNextOffer();
    });
  }

  // ─── Send message ─────────────────────────────────────────────────────────
  async function sendMessage(text) {
    text = text.trim();
    if (!text || streaming) return;

    const key = getApiKey();
    if (!key) { showToast('Add your API key in Settings', 'error'); return; }

    streaming = true;
    sendBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto';

    appendBubble('user', renderMarkdown(text));
    messages.push({ role: 'user', content: text });

    const assistantBubble = appendBubble('assistant', '', true);

    await streamMessage(
      key,
      messages,
      systemPrompt,
      (partial) => {
        assistantBubble.innerHTML = renderMarkdown(partial);
        chatWindow.scrollTop = chatWindow.scrollHeight;
      },
      (full) => {
        assistantBubble.classList.remove('streaming');
        assistantBubble.innerHTML = renderMarkdown(full);
        messages.push({ role: 'assistant', content: full });

        const blocks = parseQuestBlocks(full);
        if (blocks.length > 0) {
          questQueue.push(...blocks);
          showNextOffer();
        }

        streaming = false;
        sendBtn.disabled = false;
        input.focus();
      },
      (err) => {
        assistantBubble.classList.remove('streaming');
        assistantBubble.innerHTML = `<span style="color:var(--error)">Error: ${escHtml(err.message)}</span>`;
        messages.pop(); // remove the user message since it failed
        streaming = false;
        sendBtn.disabled = false;
      }
    );
  }

  sendBtn.addEventListener('click', () => sendMessage(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

  // ─── Auto-send initial context ────────────────────────────────────────────
  if (initialContext && apiKey) {
    input.value = initialContext;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    setTimeout(() => sendMessage(initialContext), 100);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
