// XP calculations and level-up logic

export const XP_BY_DIFFICULTY = {
  easy: 25,
  medium: 50,
  hard: 100,
  legendary: 250,
};

export const STAT_BOOST_BY_DIFFICULTY = {
  easy: 1,
  medium: 2,
  hard: 3,
  legendary: 5,
};

export const CATEGORY_STAT_MAP = {
  health: 'strength',
  mind: 'intellect',
  career: 'ambition',
  finance: 'wealth',
};

const CLASS_THRESHOLDS = [
  { minLevel: 16, title: 'Grandmaster' },
  { minLevel: 13, title: 'Master' },
  { minLevel: 10, title: 'Expert' },
  { minLevel: 7,  title: 'Adept' },
  { minLevel: 5,  title: 'Journeyman' },
  { minLevel: 3,  title: 'Apprentice' },
  { minLevel: 1,  title: 'Novice' },
];

/** XP required to go from level n to n+1 */
export function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

/** Character class title for a given level */
export function classForLevel(level) {
  for (const { minLevel, title } of CLASS_THRESHOLDS) {
    if (level >= minLevel) return title;
  }
  return 'Novice';
}

/**
 * Given current XP total and level, compute the resulting level, leftover XP,
 * and XP required for the next level after awarding xpGain.
 * Returns { newLevel, newXp, newXpToNext, leveledUp }.
 */
export function applyXP(currentLevel, currentXp, currentXpToNext, xpGain) {
  let level = currentLevel;
  let xp = currentXp + xpGain;
  let xpToNext = currentXpToNext;
  let leveledUp = false;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = xpForLevel(level);
    leveledUp = true;
  }

  return {
    newLevel: level,
    newXp: xp,
    newXpToNext: xpToNext,
    leveledUp,
  };
}

/** XP progress percentage (0-100) for the current level */
export function xpPercent(xp, xpToNext) {
  return Math.min(100, Math.round((xp / xpToNext) * 100));
}

/** Stat "level" label — every 10 points is a tier */
export function statLabel(value) {
  if (value >= 90) return 'Legendary';
  if (value >= 70) return 'Expert';
  if (value >= 50) return 'Skilled';
  if (value >= 30) return 'Trained';
  return 'Novice';
}
