// Supabase client and all database access functions

import { xpForLevel, classForLevel, applyXP, CATEGORY_STAT_MAP, XP_BY_DIFFICULTY, STAT_BOOST_BY_DIFFICULTY } from './utils/xp.js';

// ─── CLIENT ──────────────────────────────────────────────────────────────────

const SUPABASE_URL  = window.ENV_SUPABASE_URL  || '';
const SUPABASE_ANON = window.ENV_SUPABASE_ANON || '';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── AUTH ────────────────────────────────────────────────────────────────────

export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── FIRST-LOGIN SEED ────────────────────────────────────────────────────────

const DEFAULT_REWARDS = [
  { title: 'Takeaway',     description: 'Order your favourite food',   tier: 'small',     xp_cost: 100  },
  { title: 'Joint',        description: 'Sit back and relax',          tier: 'small',     xp_cost: 75   },
  { title: 'Day out',      description: 'A fun day trip somewhere',    tier: 'medium',    xp_cost: 400  },
  { title: 'Meal out',     description: 'Dinner at a nice restaurant', tier: 'medium',    xp_cost: 300  },
  { title: 'Weekend trip', description: 'A short getaway',             tier: 'large',     xp_cost: 1500 },
  { title: 'Holiday',      description: 'A proper holiday abroad',     tier: 'legendary', xp_cost: 5000 },
];

export async function seedNewUser(userId) {
  // Profile
  const { error: pe } = await supabase.from('profiles').insert({
    user_id: userId, username: 'Adventurer', character_class: 'Novice',
    avatar: '⚔️', level: 1, xp: 0, xp_to_next_level: 100,
  });
  if (pe && pe.code !== '23505') throw pe;

  // Stats (all five skills at 25)
  const { error: se } = await supabase.from('stats').insert({
    user_id: userId,
    health: 25, intellect: 25, work: 25, wealth: 25, relationships: 25,
  });
  if (se && se.code !== '23505') throw se;

  // Rewards
  const { error: re } = await supabase.from('rewards')
    .insert(DEFAULT_REWARDS.map(r => ({ ...r, user_id: userId })));
  if (re && re.code !== '23505') throw re;
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('user_id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles').update(updates).eq('user_id', userId).select().single();
  if (error) throw error;
  return data;
}

// ─── STATS ───────────────────────────────────────────────────────────────────

export async function getStats(userId) {
  const { data, error } = await supabase
    .from('stats').select('*').eq('user_id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateStats(userId, updates) {
  const { data, error } = await supabase
    .from('stats').update(updates).eq('user_id', userId).select().single();
  if (error) throw error;
  return data;
}

// ─── QUESTS ──────────────────────────────────────────────────────────────────

export async function getQuests(userId) {
  const { data, error } = await supabase
    .from('quests').select('*').eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createQuest(userId, quest) {
  const xp_reward = XP_BY_DIFFICULTY[quest.difficulty] || 25;
  const { data, error } = await supabase
    .from('quests').insert({ ...quest, user_id: userId, xp_reward }).select().single();
  if (error) throw error;
  return data;
}

export async function updateQuest(questId, updates) {
  if (updates.difficulty) updates.xp_reward = XP_BY_DIFFICULTY[updates.difficulty];
  const { data, error } = await supabase
    .from('quests').update(updates).eq('id', questId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteQuest(questId) {
  const { error } = await supabase.from('quests').delete().eq('id', questId);
  if (error) throw error;
}

/**
 * Complete a quest: award XP + stat boost, log activity.
 * Returns { profile, stats, leveledUp, newLevel, className, statKey, statBoost }.
 */
export async function completeQuest(userId, quest) {
  const today = new Date().toISOString().split('T')[0];

  // Streak: daily = yesterday, weekly = last week same weekday range
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastWeek  = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  let newStreak;
  if (quest.frequency === 'weekly') {
    newStreak = quest.last_completed >= lastWeek ? quest.streak + 1 : 1;
  } else {
    newStreak = quest.last_completed === yesterday ? quest.streak + 1 : 1;
  }

  await supabase.from('quests').update({ last_completed: today, streak: newStreak }).eq('id', quest.id);

  const [profile, stats] = await Promise.all([getProfile(userId), getStats(userId)]);

  const xpGain  = quest.xp_reward;
  const statKey = CATEGORY_STAT_MAP[quest.category];
  const statBoost = STAT_BOOST_BY_DIFFICULTY[quest.difficulty] || 1;

  const { newLevel, newXp, newXpToNext, leveledUp } = applyXP(
    profile.level, profile.xp, profile.xp_to_next_level, xpGain
  );
  const newClass = classForLevel(newLevel);

  const updatedProfile = await updateProfile(userId, {
    level: newLevel, xp: newXp, xp_to_next_level: newXpToNext, character_class: newClass,
  });

  const newStatValue = Math.min(100, (stats[statKey] || 0) + statBoost);
  const updatedStats = await updateStats(userId, { [statKey]: newStatValue });

  await logActivity(userId, 'quest_complete',
    `Completed quest: ${quest.title} (+${xpGain} XP, +${statBoost} ${statKey})`, xpGain);

  if (leveledUp) {
    await logActivity(userId, 'level_up', `Reached Level ${newLevel} — ${newClass}!`, 0);
  }

  return { profile: updatedProfile, stats: updatedStats, leveledUp, newLevel, className: newClass, statKey, statBoost };
}

// ─── OBJECTIVES ──────────────────────────────────────────────────────────────

export async function getObjectives(userId) {
  const { data, error } = await supabase
    .from('objectives').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createObjective(userId, obj) {
  const { data, error } = await supabase
    .from('objectives').insert({ ...obj, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function updateObjective(objId, updates) {
  const { data, error } = await supabase
    .from('objectives').update(updates).eq('id', objId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteObjective(objId) {
  const { error } = await supabase.from('objectives').delete().eq('id', objId);
  if (error) throw error;
}

// ─── REWARDS ─────────────────────────────────────────────────────────────────

export async function getRewards(userId) {
  const { data, error } = await supabase
    .from('rewards').select('*').eq('user_id', userId)
    .order('xp_cost', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createReward(userId, reward) {
  const { data, error } = await supabase
    .from('rewards').insert({ ...reward, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteReward(rewardId) {
  const { error } = await supabase.from('rewards').delete().eq('id', rewardId);
  if (error) throw error;
}

/**
 * Redeem a reward: deduct XP across levels if needed, log activity.
 * Returns updated profile.
 */
export async function redeemReward(userId, reward) {
  const profile = await getProfile(userId);

  // Calculate total banked XP
  let bankXp = profile.xp;
  for (let l = 1; l < profile.level; l++) bankXp += xpForLevel(l);
  if (bankXp < reward.xp_cost) throw new Error('Not enough XP');

  let remaining = reward.xp_cost;
  let { level, xp } = profile;

  if (xp >= remaining) {
    xp -= remaining;
  } else {
    remaining -= xp;
    xp = 0;
    while (remaining > 0 && level > 1) {
      level -= 1;
      const cap = xpForLevel(level);
      if (cap >= remaining) { xp = cap - remaining; remaining = 0; }
      else { remaining -= cap; }
    }
    if (remaining > 0) throw new Error('Not enough XP');
  }

  const newClass  = classForLevel(level);
  const xpToNext  = xpForLevel(level);
  const updatedProfile = await updateProfile(userId, {
    level, xp, xp_to_next_level: xpToNext, character_class: newClass,
  });

  await supabase.from('redemptions').insert({ user_id: userId, reward_id: reward.id });
  await logActivity(userId, 'reward_redeemed',
    `Redeemed reward: ${reward.title} (−${reward.xp_cost} XP)`, -reward.xp_cost);

  return updatedProfile;
}

// ─── REFLECTIONS ─────────────────────────────────────────────────────────────

export async function getReflection(userId, date) {
  const { data, error } = await supabase
    .from('reflections').select('*').eq('user_id', userId).eq('date', date).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertReflection(userId, { date, things_learnt, proud_of, troubled_by, mood }) {
  const { data, error } = await supabase
    .from('reflections')
    .upsert({ user_id: userId, date, things_learnt, proud_of, troubled_by, mood },
             { onConflict: 'user_id,date' })
    .select().single();
  if (error) throw error;

  await logActivity(userId, 'reflection', `Completed daily reflection for ${date}`, 0);
  return data;
}

export async function getReflectionHistory(userId, limit = 30) {
  const { data, error } = await supabase
    .from('reflections').select('*').eq('user_id', userId)
    .order('date', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

// ─── ACTIVITY LOG ────────────────────────────────────────────────────────────

export async function getActivityLog(userId, limit = 50) {
  const { data, error } = await supabase
    .from('activity_log').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

export async function logActivity(userId, entry_type, description, xp_delta = 0) {
  const { error } = await supabase.from('activity_log')
    .insert({ user_id: userId, entry_type, description, xp_delta });
  if (error) console.error('Activity log error:', error);
}
