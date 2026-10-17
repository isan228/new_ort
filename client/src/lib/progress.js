const KEY = 'ortProgress';

const defaults = {
  lastDay: null,
  todayQuestions: 0,
  dailyGoal: 40,
  goalScore: 220,
  favorites: [],
  flagged: [],
  skipped: [],
};

export function loadProgress() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

export function saveProgress(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function bumpToday(n = 1) {
  const p = loadProgress();
  const today = new Date().toISOString().slice(0, 10);
  if (p.lastDay !== today) {
    p.todayQuestions = 0;
    p.lastDay = today;
  }
  p.todayQuestions = (p.todayQuestions || 0) + n;
  saveProgress(p);
  return p;
}

export const ACHIEVEMENT_DEFS = [
  { id: 'first', icon: '🏆' },
  { id: 'week', icon: '🔥' },
  { id: 'hundred', icon: '🎯' },
  { id: 'five', icon: '⚡' },
  { id: 'cards', icon: '🧠' },
  { id: 'ninety', icon: '💯' },
  { id: 'month', icon: '🚀' },
  { id: 'exam', icon: '📋' },
];
