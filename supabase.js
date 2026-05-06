// Supabase client and all database access functions

import { CATEGORY_STAT_MAP, XP_BY_DIFFICULTY, STAT_BOOST_BY_DIFFICULTY } from './utils/xp.js';

// ─── CLIENT ──────────────────────────────────────────────────────────────────

const SUPABASE_URL  = window.ENV_SUPABASE_URL  || '';
const SUPABASE_ANON = window.ENV_SUPABASE_ANON || '';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── PROFILE MANAGEMENT ──────────────────────────────────────────────────────

const DEFAULT_REWARDS = [
  { title: 'Takeaway',     description: 'Order your favourite food',   tier: 'small',     xp_cost: 100  },
  { title: 'Joint',        description: 'Sit back and relax',          tier: 'small',     xp_cost: 100  },
  { title: 'Cinema',       description: 'Watch a film',                tier: 'small',     xp_cost: 100  },
  { title: 'Day out',      description: 'A fun day trip somewhere',    tier: 'medium',    xp_cost: 400  },
  { title: 'Meal out',     description: 'Dinner at a nice restaurant', tier: 'medium',    xp_cost: 300  },
  { title: 'Weekend trip', description: 'A short getaway',             tier: 'large',     xp_cost: 1500 },
  { title: 'Holiday',      description: 'A proper holiday abroad',     tier: 'legendary', xp_cost: 5000 },
];

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createProfile(username, avatar) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase
    .from('profiles')
    .insert({ username, avatar, lifetime_xp: 0, daily_xp: 0, stats_reset_month: currentMonth })
    .select().single();
  if (error) throw error;

  await seedNewProfile(data.id);
  return data;
}

async function seedNewProfile(profileId) {
  const { error: se } = await supabase.from('stats').insert({
    user_id: profileId,
    health: 0, intellect: 0, work: 0, wealth: 0, relationships: 0,
  });
  if (se && se.code !== '23505') throw se;

  const { error: re } = await supabase.from('rewards')
    .insert(DEFAULT_REWARDS.map(r => ({ ...r, user_id: profileId })));
  if (re && re.code !== '23505') throw re;
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

export async function getProfile(profileId) {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', profileId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(profileId, updates) {
  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', profileId).select().single();
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

// ─── MONTHLY RESET ───────────────────────────────────────────────────────────

/**
 * If the current month differs from the profile's stats_reset_month, reset
 * all hero stats to 0 and log a monthly summary entry.
 * Returns true if a reset happened, false otherwise.
 */
export async function checkAndResetMonth(userId) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const profile = await getProfile(userId);

  if (profile.stats_reset_month === currentMonth) return false;

  const stats = await getStats(userId);
  const prevMonth = profile.stats_reset_month || 'previous month';

  const statSummary = [
    `Health: ${stats.health ?? 0}`,
    `Intellect: ${stats.intellect ?? 0}`,
    `Work: ${stats.work ?? 0}`,
    `Wealth: ${stats.wealth ?? 0}`,
    `Relationships: ${stats.relationships ?? 0}`,
  ].join(', ');

  await logActivity(userId, 'monthly_reset',
    `Month ended (${prevMonth}) — ${statSummary}`, 0);

  await updateStats(userId, { health: 0, intellect: 0, work: 0, wealth: 0, relationships: 0 });
  await updateProfile(userId, { stats_reset_month: currentMonth });

  return true;
}

// ─── MONTHLY CATEGORY XP ─────────────────────────────────────────────────────

export async function getMonthlyCategoryXP(userId, yearMonth) {
  const { data, error } = await supabase
    .from('monthly_category_xp')
    .select('stat_key, xp_total')
    .eq('user_id', userId)
    .eq('year_month', yearMonth);
  if (error) throw error;

  const result = {};
  (data || []).forEach(row => { result[row.stat_key] = row.xp_total; });
  return result;
}

async function upsertMonthlyCategoryXP(userId, yearMonth, statKey, xpGain) {
  const { data: existing } = await supabase
    .from('monthly_category_xp')
    .select('xp_total')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .eq('stat_key', statKey)
    .maybeSingle();

  const newTotal = (existing?.xp_total || 0) + xpGain;

  const { error } = await supabase
    .from('monthly_category_xp')
    .upsert(
      { user_id: userId, year_month: yearMonth, stat_key: statKey, xp_total: newTotal },
      { onConflict: 'user_id,year_month,stat_key' }
    );
  if (error) console.error('Monthly XP upsert error:', error);
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
 * Returns { profile, stats, statKey, statBoost }.
 */
export async function completeQuest(userId, quest) {
  const today        = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastWeek  = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  let newStreak;
  if (quest.frequency === 'weekly') {
    newStreak = quest.last_completed >= lastWeek ? quest.streak + 1 : 1;
  } else {
    newStreak = quest.last_completed === yesterday ? quest.streak + 1 : 1;
  }

  await supabase.from('quests').update({ last_completed: today, streak: newStreak }).eq('id', quest.id);

  // Check for month rollover before applying anything
  await checkAndResetMonth(userId);

  const [profile, stats] = await Promise.all([getProfile(userId), getStats(userId)]);

  const xpGain     = quest.xp_reward;
  const primaryCat = quest.category ? quest.category.split(',')[0].trim() : null;
  const statKey    = CATEGORY_STAT_MAP[primaryCat];
  const statBoost  = STAT_BOOST_BY_DIFFICULTY[quest.difficulty] ?? 1;

  // Daily XP resets if it's a new day
  const newDailyXp = profile.daily_xp_date === today
    ? (profile.daily_xp || 0) + xpGain
    : xpGain;

  const updatedProfile = await updateProfile(userId, {
    lifetime_xp:   (profile.lifetime_xp || 0) + xpGain,
    daily_xp:      newDailyXp,
    daily_xp_date: today,
  });

  let updatedStats = stats;
  if (statKey) {
    const newStatValue = Math.min(100, (stats[statKey] || 0) + statBoost);
    updatedStats = await updateStats(userId, { [statKey]: newStatValue });
    await upsertMonthlyCategoryXP(userId, currentMonth, statKey, xpGain);
  } else {
    console.warn('No stat mapping for quest category:', quest.category);
  }

  await logActivity(userId, 'quest_complete',
    `Completed quest: ${quest.title} (+${xpGain} XP${statKey ? `, +${statBoost} ${statKey}` : ''})`, xpGain);

  return { profile: updatedProfile, stats: updatedStats, statKey, statBoost };
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
 * Redeem a reward: deduct from lifetime XP, log activity.
 * Returns updated profile.
 */
export async function redeemReward(userId, reward) {
  const profile    = await getProfile(userId);
  const lifetimeXp = profile.lifetime_xp || 0;
  if (lifetimeXp < reward.xp_cost) throw new Error('Not enough XP');

  const updatedProfile = await updateProfile(userId, {
    lifetime_xp: lifetimeXp - reward.xp_cost,
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

export async function upsertReflection(userId, { date, things_learnt, proud_of, troubled_by, grateful_for, mood }) {
  const { data, error } = await supabase
    .from('reflections')
    .upsert({ user_id: userId, date, things_learnt, proud_of, troubled_by, grateful_for, mood },
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

// ─── TRANSACTIONS ────────────────────────────────────────────────────────────

export async function getTransactions(userId, year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to   = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTransaction(userId, tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...tx, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(txId, updates) {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', txId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(txId) {
  const { error } = await supabase.from('transactions').delete().eq('id', txId);
  if (error) throw error;
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

/**
 * Apply a signed XP change to a profile's lifetime (and daily if from today).
 * Returns the updated profile, or null when xpChange is 0.
 */
async function adjustProfileXP(userId, xpChange, entryDate) {
  if (xpChange === 0) return null;

  const profile = await getProfile(userId);
  const today   = new Date().toISOString().split('T')[0];

  const updates = {
    lifetime_xp: Math.max(0, (profile.lifetime_xp || 0) + xpChange),
  };

  if (entryDate === today) {
    updates.daily_xp = Math.max(0, (profile.daily_xp || 0) + xpChange);
  }

  return updateProfile(userId, updates);
}

export async function deleteActivityLog(entryId) {
  const { data: entry, error: fetchErr } = await supabase
    .from('activity_log').select('user_id, xp_delta, created_at').eq('id', entryId).single();
  if (fetchErr) throw fetchErr;

  const entryDate      = new Date(entry.created_at).toISOString().split('T')[0];
  const updatedProfile = entry.xp_delta !== 0
    ? await adjustProfileXP(entry.user_id, -entry.xp_delta, entryDate)
    : null;

  const { error } = await supabase.from('activity_log').delete().eq('id', entryId);
  if (error) throw error;

  return updatedProfile;
}
