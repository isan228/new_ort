const { ActivityLog, Question, Answer, ReadingPassage, Test, Subject } = require('../models');

// Editors only work with questions and reading texts; everything else under /api/admin is admin-only.
const EDITOR_ALLOWED = [
  ['GET', /^\/subjects$/],
  ['GET', /^\/tests$/],
  ['*', /^\/questions(\/\d+)?$/],
  ['*', /^\/reading-passages(\/\d+)?$/],
  ['POST', /^\/(parse-txt|upload-image|import-questions|upload-txt-explained)$/],
];

const LOGGED = [
  ['POST', /^\/questions$/, 'create', 'question'],
  ['PUT', /^\/questions\/(\d+)$/, 'update', 'question'],
  ['DELETE', /^\/questions\/(\d+)$/, 'delete', 'question'],
  ['POST', /^\/(import-questions|upload-txt-explained)$/, 'import', 'question'],
  ['POST', /^\/reading-passages$/, 'create', 'passage'],
  ['PUT', /^\/reading-passages\/(\d+)$/, 'update', 'passage'],
  ['DELETE', /^\/reading-passages\/(\d+)$/, 'delete', 'passage'],
  ['POST', /^\/tests$/, 'create', 'section'],
  ['PUT', /^\/tests\/(\d+)$/, 'update', 'section'],
  ['DELETE', /^\/tests\/(\d+)$/, 'delete', 'section'],
];

const VERB = { create: 'Добавил', update: 'Изменил', delete: 'Удалил', import: 'Загрузил' };
const NOUN = { question: 'вопрос', passage: 'текст', section: 'раздел' };

function short(text, max = 140) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

async function questionSnapshot(id) {
  const q = await Question.findByPk(id, { include: [Answer], order: [[Answer, 'sortOrder', 'ASC']] });
  if (!q) return null;
  return {
    id: q.id,
    testId: q.testId,
    passageId: q.passageId,
    kind: q.kind || null,
    externalId: q.externalId || null,
    text: q.text || '',
    compareA: q.compareA || null,
    compareB: q.compareB || null,
    imageUrl: q.imageUrl || null,
    explanation: q.explanation || '',
    answers: (q.Answers || []).map((a) => ({ text: a.text, imageUrl: a.imageUrl || null, isCorrect: !!a.isCorrect })),
  };
}

async function passageSnapshot(id) {
  const p = await ReadingPassage.findByPk(id);
  return p ? { id: p.id, testId: p.testId, title: p.title, subtitle: p.subtitle || '' } : null;
}

async function sectionSnapshot(id) {
  const t = await Test.findByPk(id);
  return t ? { id: t.id, name: t.name, kind: t.kind, parentId: t.parentId, subjectId: t.subjectId } : null;
}

const SNAPSHOT = { question: questionSnapshot, passage: passageSnapshot, section: sectionSnapshot };

async function placeOf(testId) {
  if (!testId) return null;
  const names = [];
  let test = await Test.findByPk(testId);
  const subjectId = test?.subjectId;
  for (let guard = 0; test && guard < 6; guard += 1) {
    names.unshift(test.name);
    test = test.parentId ? await Test.findByPk(test.parentId) : null;
  }
  const subject = subjectId ? await Subject.findByPk(subjectId) : null;
  if (subject) names.unshift(subject.name);
  return names.join(' · ') || null;
}

function questionLabel(q) {
  if (!q) return '';
  if (q.kind === 'compare') return short(`${q.compareA} ⟷ ${q.compareB}`);
  return short(q.text);
}

function testIdOf(entity, snapshot) {
  if (!snapshot) return null;
  return entity === 'section' ? snapshot.id : snapshot.testId;
}

async function buildEntry(req, rule, id, before, beforePlace, body) {
  const [, , action, entity] = rule;
  let entityId = id;
  let after = null;
  let details = {};
  let label = '';
  let testId = null;

  if (action === 'import') {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    testId = Number(req.body?.testId) || null;
    if (!testId && req.body?.passageId) testId = (await passageSnapshot(Number(req.body.passageId)))?.testId || null;
    details = {
      count: items.length || Number(body?.created) || null,
      message: body?.message || null,
      items: items.slice(0, 200).map((item) => ({
        externalId: item.externalId || null,
        text: item.kind === 'compare' ? `${item.compareA} ⟷ ${item.compareB}` : short(item.text, 300),
      })),
    };
    label = `${details.count || 0} шт.`;
  } else {
    if (action === 'create') entityId = body?.question?.id || body?.passage?.id || body?.test?.id || body?.id || null;
    if (action !== 'delete' && entityId) after = await SNAPSHOT[entity](entityId);
    const current = after || before;
    testId = testIdOf(entity, current);
    details = { before, after };
    if (entity === 'question') label = questionLabel(current);
    else if (entity === 'passage') label = short(current?.title);
    else label = short(current?.name);
  }

  return {
    userId: req.user.id,
    userName: req.user.name || req.user.login,
    userRole: req.user.role,
    action,
    entity,
    entityId: entityId || null,
    testId: testId || null,
    place: action === 'delete' ? beforePlace : await placeOf(testId),
    summary: `${VERB[action]} ${action === 'import' ? 'вопросы' : NOUN[entity]}${label ? `: ${label}` : ''}`,
    details,
  };
}

async function staffScope(req, res, next) {
  const { method } = req;
  const path = req.path;

  if (req.user.role === 'editor') {
    const allowed = EDITOR_ALLOWED.some(([m, re]) => (m === '*' || m === method) && re.test(path));
    if (!allowed) return res.status(403).json({ error: 'Редактору это действие недоступно', code: 'ADMIN_REQUIRED' });
  }

  const rule = LOGGED.find(([m, re]) => m === method && re.test(path));
  if (!rule) return next();

  const id = Number(path.match(rule[1])[1]) || null;
  let before = null;
  let beforePlace = null;
  try {
    if (id && rule[2] !== 'create') before = await SNAPSHOT[rule[3]](id);
    if (rule[2] === 'delete') beforePlace = await placeOf(testIdOf(rule[3], before));
  } catch (err) {
    console.error('activity snapshot:', err.message);
  }

  const json = res.json.bind(res);
  res.json = (body) => {
    res.locals.activityBody = body;
    return json(body);
  };
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    buildEntry(req, rule, id, before, beforePlace, res.locals.activityBody)
      .then((entry) => ActivityLog.create(entry))
      .catch((err) => console.error('activity log:', err.message));
  });
  return next();
}

module.exports = { staffScope };
