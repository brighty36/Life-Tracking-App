// XP calculations

export const XP_BY_DIFFICULTY = {
  fun:       0,
  quick:     5,
  easy:      25,
  medium:    50,
  hard:      100,
  legendary: 250,
};

export const STAT_BOOST_BY_DIFFICULTY = {
  fun:       0,
  quick:     0,
  easy:      1,
  medium:    2,
  hard:      3,
  legendary: 5,
};

export const CATEGORY_STAT_MAP = {
  health:        'health',
  mind:          'intellect',
  work:          'work',
  finance:       'wealth',
  relationships: 'relationships',
};

/** Stat tier label */
export function statLabel(value) {
  if (value >= 90) return 'Legendary';
  if (value >= 70) return 'Expert';
  if (value >= 50) return 'Skilled';
  if (value >= 30) return 'Trained';
  return 'Novice';
}

/** Returns daily XP only if earned today, otherwise 0 */
export function getEffectiveDailyXP(profile) {
  const today = new Date().toISOString().split('T')[0];
  return profile.daily_xp_date === today ? (profile.daily_xp || 0) : 0;
}
