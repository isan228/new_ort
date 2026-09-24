const { Op } = require('sequelize');
const { TestResult, User, Question, Test, Subject } = require('../models');
const { partMeta, blockPoints, roundOrt, MAIN_MAX, SUBJECT_MAX } = require('./ortScoring');

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function periodSince(period) {
  const now = new Date();
  if (period === 'today') return startOfDay(now);
  if (period === 'week') {
    const d = startOfDay(now);
    d.setDate(d.getDate() - 6);
    return d;
  }
  if (period === 'month') {
    const d = startOfDay(now);
    d.setDate(d.getDate() - 29);
    return d;
  }
  return null;
}

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function computeStreak(daySet) {
  let streak = 0;
  const cursor = startOfDay();
  const today = dayKey(cursor);
  const yesterday = new Date(cursor);
  yesterday.setDate(yesterday.getDate() - 1);
  if (!daySet.has(today) && !daySet.has(dayKey(yesterday))) return 0;
  if (!daySet.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (daySet.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function activityDays(dayCounts) {
  const days = [];
  for (let i = 27; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = dayKey(d);
    const n = dayCounts[key] || 0;
    let level = 0;
    if (n >= 40) level = 3;
    else if (n >= 15) level = 2;
    else if (n > 0) level = 1;
    days.push({ key, level, count: n, label: `${d.getDate()}.${d.getMonth() + 1}` });
  }
  return days;
}

function achievementsFrom(stats) {
  return {
    first: stats.tests > 0,
    week: stats.streak >= 7,
    hundred: stats.correct >= 100,
    five: stats.questions >= 500,
    cards: false,
    ninety: stats.bestAccuracy >= 90,
    month: stats.streak >= 30 || stats.activeDays >= 30,
    exam: stats.mainExams > 0,
  };
}

function gauss(x, mean, std) {
  const s = Math.max(std, 1);
  return Math.exp(-0.5 * ((x - mean) / s) ** 2);
}

function buildCurve(scores, userScore) {
  const values = scores.filter((n) => Number.isFinite(n));
  const mean = values.length
    ? values.reduce((sum, n) => sum + n, 0) / values.length
    : 0;
  let std = 20;
  if (values.length > 1) {
    const variance = values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / values.length;
    std = Math.max(8, Math.sqrt(variance));
  }
  const min = Math.min(0, mean - 3 * std);
  const max = Math.max(245, mean + 3 * std);
  const points = [];
  for (let i = 0; i <= 60; i += 1) {
    const x = min + ((max - min) * i) / 60;
    points.push({ x: Math.round(x * 10) / 10, y: gauss(x, mean, std) });
  }
  const peak = Math.max(...points.map((p) => p.y), 0.0001);
  return {
    mean: Math.round(mean * 10) / 10,
    std: Math.round(std * 10) / 10,
    userScore: userScore == null ? null : Math.round(userScore * 10) / 10,
    points: points.map((p) => ({ x: p.x, y: Math.round((p.y / peak) * 1000) / 1000 })),
  };
}

function lastBlockScore(results, blockKey) {
  for (const result of results) {
    const items = (result.answers || []).filter((item) => partMeta(item.ortPart)?.block === blockKey);
    if (!items.length) continue;
    return { ...blockPoints(items.filter((item) => item.correct).length, blockKey), attempted: true };
  }
  return { ...blockPoints(0, blockKey), attempted: false };
}

function buildOrtScores(results, subjectList) {
  const lastMain = results.find((result) => (
    result.scoreBreakdown?.examType === 'main' || result.questionMode === 'main_exam'
  ));
  const fromBlocks = lastMain?.scoreBreakdown?.blocks || [];
  const pick = (key) => fromBlocks.find((row) => row.key === key);

  const verbal = pick('verbal') || lastBlockScore(results, 'verbal');
  const grammar = pick('grammar') || lastBlockScore(results, 'grammar');
  const math = pick('math') || lastBlockScore(results, 'math');
  const parts = [verbal, grammar, math].filter((row) => row.attempted !== false || row.points);
  const total = lastMain?.officialScore != null
    ? lastMain.officialScore
    : roundOrt(parts.reduce((sum, row) => sum + (row.points || 0), 0));

  const subjects = (subjectList || []).map((subject) => {
    const last = results.find((result) => (
      result.Test?.Subject?.id === subject.id || result.Test?.subjectId === subject.id
    ));
    if (!last) {
      return {
        id: subject.id,
        name: subject.name,
        officialScore: null,
        maxScore: SUBJECT_MAX,
        attempted: false,
      };
    }
    const correct = (last.answers || []).filter((item) => item.correct).length;
    const official = last.officialScore != null
      ? last.officialScore
      : blockPoints(correct, 'subject').points;
    return {
      id: subject.id,
      name: subject.name,
      officialScore: official,
      maxScore: SUBJECT_MAX,
      correct,
      total: last.total,
      attempted: true,
    };
  });

  return {
    main: {
      total: parts.length || lastMain ? total : null,
      maxScore: MAIN_MAX,
      fromExam: !!lastMain,
      verbal,
      grammar,
      math,
    },
    subjects,
  };
}

function summarizeResults(results, extras = {}) {
  const tests = results.length;
  let questions = 0;
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let durationSec = 0;
  let mainExams = 0;
  let todayQuestions = 0;
  const today = dayKey(new Date());
  const official = [];
  const accuracies = [];
  const dayCounts = {};
  const byBlock = {};
  const recentScores = [];
  const seen = new Set();
  const history = [];

  for (const result of results) {
    const total = Number(result.total) || 0;
    const score = Number(result.score) || 0;
    questions += total;
    correct += score;
    durationSec += Number(result.durationSec) || 0;
    const examType = result.scoreBreakdown?.examType || (result.questionMode === 'main_exam' ? 'main' : 'practice');
    if (examType === 'main' || result.questionMode === 'main_exam') mainExams += 1;
    const key = dayKey(result.createdAt);
    dayCounts[key] = (dayCounts[key] || 0) + total;
    if (key === today) todayQuestions += total;
    if (result.officialScore != null) official.push(Number(result.officialScore));
    const accuracy = total ? Math.round((score / total) * 100) : 0;
    if (total) accuracies.push(accuracy);
    recentScores.push({
      at: result.createdAt,
      officialScore: result.officialScore,
      accuracy,
    });
    history.push({
      id: result.id,
      createdAt: result.createdAt,
      score,
      officialScore: result.officialScore,
      maxScore: result.scoreBreakdown?.maxScore || null,
      total,
      accuracy,
      durationSec: result.durationSec,
      questionMode: result.questionMode,
      examType,
      testName: result.Test?.name || null,
    });

    for (const item of result.answers || []) {
      if (item.questionId) seen.add(item.questionId);
      if (!item.answerId) skipped += 1;
      else if (!item.correct) incorrect += 1;
      const block = partMeta(item.ortPart)?.block;
      if (!block) continue;
      if (!byBlock[block]) byBlock[block] = { key: block, correct: 0, total: 0 };
      byBlock[block].total += 1;
      if (item.correct) byBlock[block].correct += 1;
    }
  }

  const topics = Object.values(byBlock).map((row) => ({
    ...row,
    accuracy: row.total ? Math.round((row.correct / row.total) * 100) : 0,
  })).sort((a, b) => a.accuracy - b.accuracy);

  const daySet = new Set(Object.keys(dayCounts));
  const accuracy = questions ? Math.round((correct / questions) * 100) : 0;
  const avgOfficial = official.length
    ? Math.round((official.reduce((sum, n) => sum + n, 0) / official.length) * 10) / 10
    : 0;
  const bestOfficial = official.length ? Math.max(...official) : 0;
  const bestAccuracy = accuracies.length ? Math.max(...accuracies) : 0;
  const streak = computeStreak(daySet);

  const bankTotal = extras.bankTotal || 0;
  const used = seen.size;
  const unused = Math.max(0, bankTotal - used);
  const usedPct = bankTotal ? Math.round((used / bankTotal) * 1000) / 10 : 0;
  const userScore = official.length ? avgOfficial : accuracy;
  const others = extras.peerScores || [];
  const below = others.filter((n) => n <= userScore).length;
  const percentile = others.length
    ? Math.round((below / others.length) * 100)
    : (tests ? 50 : 0);
  const place = extras.place || null;

  const stats = {
    tests,
    questions,
    correct,
    incorrect,
    skipped,
    accuracy,
    avgOfficial,
    bestOfficial,
    bestAccuracy,
    hours: Math.round((durationSec / 3600) * 10) / 10,
    todayQuestions,
    dailyGoal: 40,
    streak,
    activeDays: daySet.size,
    mainExams,
    practiceTests: Math.max(0, tests - mainExams),
    bankTotal,
    used,
    unused,
    usedPct,
    percentile,
    place,
    peers: others.length,
    curve: buildCurve(others.length ? others : official, tests ? userScore : null),
    topics,
    weak: topics.slice(0, 3),
    activity: activityDays(dayCounts),
    recentScores: recentScores.slice(0, 10).reverse(),
    history,
    ort: extras.ort || null,
  };
  stats.achievements = achievementsFrom(stats);
  stats.achievementsOpen = Object.values(stats.achievements).filter(Boolean).length;
  return stats;
}

async function peerAverages() {
  const rows = await TestResult.findAll({
    attributes: ['userId', 'officialScore', 'score', 'total'],
    include: [{ model: User, attributes: ['id'], where: { role: 'student' }, required: true }],
  });
  const byUser = new Map();
  for (const row of rows) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    const value = row.officialScore != null
      ? Number(row.officialScore)
      : (row.total ? (row.score / row.total) * 100 : 0);
    byUser.get(row.userId).push(value);
  }
  return [...byUser.entries()].map(([id, list]) => ({
    userId: id,
    avg: list.reduce((sum, n) => sum + n, 0) / list.length,
  })).sort((a, b) => b.avg - a.avg);
}

async function userStats(userId) {
  const [results, bankTotal, peers, subjectList] = await Promise.all([
    TestResult.findAll({
      where: { userId },
      include: [{
        model: Test,
        attributes: ['id', 'name', 'subjectId', 'ortPart'],
        include: [{ model: Subject, attributes: ['id', 'name', 'trackGroup'] }],
      }],
      order: [['createdAt', 'DESC']],
    }),
    Question.count({ where: { isActive: true } }),
    peerAverages(),
    Subject.findAll({
      where: { trackGroup: 'subject', isActive: true },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    }),
  ]);
  const mine = peers.find((row) => row.userId === userId);
  const place = mine ? peers.findIndex((row) => row.userId === userId) + 1 : null;
  return summarizeResults(results, {
    bankTotal,
    peerScores: peers.map((row) => row.avg),
    place,
    ort: buildOrtScores(results, subjectList),
  });
}

async function rankingFor(period, userId) {
  const since = periodSince(period);
  const where = {};
  if (since) where.createdAt = { [Op.gte]: since };
  const results = await TestResult.findAll({
    where,
    include: [{
      model: User,
      attributes: ['id', 'name'],
      where: { role: 'student' },
      required: true,
    }],
  });

  const byUser = new Map();
  for (const result of results) {
    const uid = result.userId;
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        userId: uid,
        name: result.User?.name || 'Ученик',
        best: result.officialScore != null ? Number(result.officialScore) : 0,
        tests: 0,
        questions: 0,
        correct: 0,
        days: new Set(),
      });
    }
    const row = byUser.get(uid);
    row.tests += 1;
    row.questions += Number(result.total) || 0;
    row.correct += Number(result.score) || 0;
    row.days.add(dayKey(result.createdAt));
    const official = result.officialScore != null ? Number(result.officialScore) : 0;
    if (official > row.best) row.best = official;
  }

  const rows = [...byUser.values()]
    .map((row) => ({
      userId: row.userId,
      name: row.name,
      score: Math.round(row.best * 10) / 10,
      tests: row.tests,
      progress: row.questions ? Math.round((row.correct / row.questions) * 100) : 0,
      streak: computeStreak(row.days),
    }))
    .sort((a, b) => b.score - a.score || b.progress - a.progress);

  rows.forEach((row, i) => { row.place = i + 1; });
  const me = rows.find((row) => row.userId === userId) || null;
  return { period, rows: rows.slice(0, 50), me };
}

module.exports = { userStats, rankingFor, summarizeResults };
