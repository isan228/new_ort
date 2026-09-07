const KEY = 'ortProgress';

const defaults = {
  streak: 12,
  lastDay: null,
  todayQuestions: 30,
  dailyGoal: 40,
  goalScore: 220,
  favorites: [],
  flagged: [],
  skipped: [],
  referralCode: 'ORT-AB123',
  invited: 3,
  registered: 2,
  premiumFromRef: 1,
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
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    p.streak = p.lastDay === yesterday ? (p.streak || 0) + 1 : 1;
    p.todayQuestions = 0;
    p.lastDay = today;
  }
  p.todayQuestions = (p.todayQuestions || 0) + n;
  saveProgress(p);
  return p;
}

export function toggleFavorite(questionId) {
  const p = loadProgress();
  const id = Number(questionId);
  p.favorites = p.favorites.includes(id)
    ? p.favorites.filter((x) => x !== id)
    : [...p.favorites, id];
  saveProgress(p);
  return p;
}

export function activityDays() {
  const days = [];
  for (let i = 27; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const level = i === 0 ? 3 : (i % 5 === 0 ? 0 : (i % 3) + 1);
    days.push({ key, level, label: `${d.getDate()}.${d.getMonth() + 1}` });
  }
  return days;
}

export const RANKING = [
  { place: 1, name: 'Айжан К.', score: 241, streak: 34, progress: 96 },
  { place: 2, name: 'Эрмек С.', score: 236, streak: 21, progress: 94 },
  { place: 3, name: 'Нуржан Т.', score: 232, streak: 18, progress: 91 },
  { place: 4, name: 'Алина Б.', score: 228, streak: 12, progress: 88 },
  { place: 5, name: 'Бекжан М.', score: 224, streak: 9, progress: 86 },
  { place: 6, name: 'Данияр О.', score: 221, streak: 15, progress: 84 },
  { place: 7, name: 'Салтанат И.', score: 218, streak: 7, progress: 82 },
  { place: 8, name: 'Тимур Ж.', score: 216, streak: 11, progress: 80 },
];

export const ACHIEVEMENTS = [
  { id: 'first', icon: '🏆', title: 'Первый тест', text: 'Заверши первую попытку', unlocked: true },
  { id: 'week', icon: '🔥', title: '7 дней подряд', text: 'Серия без пропусков', unlocked: true },
  { id: 'hundred', icon: '🎯', title: '100 верных', text: '100 правильных ответов', unlocked: true },
  { id: 'five', icon: '⚡', title: '500 вопросов', text: 'Реши 500 заданий', unlocked: false },
  { id: 'cards', icon: '🧠', title: '100 карточек', text: 'Выучи 100 карточек', unlocked: false },
  { id: 'ninety', icon: '💯', title: '90%+ в тесте', text: 'Точность 90 и выше', unlocked: true },
  { id: 'month', icon: '🚀', title: '30 дней', text: 'Месяц подготовки', unlocked: false },
  { id: 'exam', icon: '📋', title: 'Полный ОРТ', text: 'Пройди полный пробник', unlocked: false },
];
