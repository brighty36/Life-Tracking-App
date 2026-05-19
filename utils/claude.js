// Claude API utilities

const STORAGE_KEY = 'life-rpg-claude-key';
const API_URL     = 'https://api.anthropic.com/v1/messages';
const MODEL       = 'claude-sonnet-4-6';

export function getApiKey()          { return localStorage.getItem(STORAGE_KEY) || ''; }
export function saveApiKey(key)      { localStorage.setItem(STORAGE_KEY, key.trim()); }

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

export function buildSystemPrompt(profile, quests, activityLog, stats) {
  const today = new Date().toISOString().split('T')[0];

  const questSummary = quests.length === 0
    ? 'No quests yet.'
    : quests.map(q =>
        `- [${q.frequency === 'weekly' ? 'project' : 'task'}] "${q.title}" | category: ${q.category || 'none'} | difficulty: ${q.difficulty} | xp: ${q.xp_reward}`
      ).join('\n');

  const logSummary = activityLog.length === 0
    ? 'No recent activity.'
    : activityLog.map(e =>
        `- ${new Date(e.created_at).toISOString().split('T')[0]} | ${e.entry_type} | ${e.description}${e.xp_delta ? ` | ${e.xp_delta > 0 ? '+' : ''}${e.xp_delta} XP` : ''}`
      ).join('\n');

  const statsSummary = stats
    ? `Health: ${stats.health}, Intellect: ${stats.intellect}, Work: ${stats.work}, Wealth: ${stats.wealth}, Relationships: ${stats.relationships}`
    : 'Stats unavailable.';

  return `You are a helpful life coach assistant embedded in a personal life-tracking RPG app. Today is ${today}.

## User Profile
Name: ${profile.username}
Lifetime XP: ${profile.lifetime_xp || 0}
Stats: ${statsSummary}

## Current Quests (tasks & projects)
${questSummary}

## Recent Activity (last 20 entries)
${logSummary}

## Your Capabilities
1. Answer questions about the user's activity data, patterns, and progress.
2. Create new quests when asked — use the exact format below.
3. Offer advice and encouragement based on their data.

## Quest Creation Format
When you want to suggest creating a quest, include one or more blocks like this:

<quest-create>
{"title":"…","description":"…","category":"health","difficulty":"medium","frequency":"daily"}
</quest-create>

Allowed category values: health, mind, work, finance, relationships
Allowed difficulty values: fun, quick, easy, medium, hard, legendary
Allowed frequency values: daily, weekly

Only create quests when the user asks you to or when it would clearly help. Keep titles concise (under 60 chars). Be warm, practical, and encouraging. Use markdown for clarity (bold, code) but keep responses focused.`;
}

// ─── STREAMING ────────────────────────────────────────────────────────────────

export async function streamMessage(apiKey, messages, systemPrompt, onChunk, onDone, onError) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':                       'application/json',
        'x-api-key':                          apiKey,
        'anthropic-version':                  '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 1024,
        system:     systemPrompt,
        stream:     true,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   full    = '';
    let   buf     = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            full += evt.delta.text;
            onChunk(full);
          }
        } catch { /* skip malformed SSE */ }
      }
    }

    onDone(full);
  } catch (err) {
    onError(err);
  }
}

// ─── QUEST BLOCK PARSER ───────────────────────────────────────────────────────

const ALLOWED_CATEGORIES  = new Set(['health','mind','work','finance','relationships']);
const ALLOWED_DIFFICULTIES = new Set(['fun','quick','easy','medium','hard','legendary']);
const ALLOWED_FREQUENCIES  = new Set(['daily','weekly']);

export function parseQuestBlocks(text) {
  const blocks = [];
  const re = /<quest-create>([\s\S]*?)<\/quest-create>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1].trim());
      if (!obj.title || typeof obj.title !== 'string') continue;
      blocks.push({
        title:       String(obj.title).slice(0, 80),
        description: obj.description ? String(obj.description) : null,
        category:    ALLOWED_CATEGORIES.has(obj.category)   ? obj.category   : 'health',
        difficulty:  ALLOWED_DIFFICULTIES.has(obj.difficulty) ? obj.difficulty : 'medium',
        frequency:   ALLOWED_FREQUENCIES.has(obj.frequency)  ? obj.frequency  : 'daily',
      });
    } catch { /* skip invalid JSON */ }
  }
  return blocks;
}
