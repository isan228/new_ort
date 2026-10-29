const {
  Test, ReadingPassage, Question, SimVariant, Subject,
} = require('../models');

// What an editor may touch. Admins get null everywhere (no limits).
//   subjects  — every subject they can open: their own plus the ones the admin granted;
//   own       — subjects they created: only there may they change the structure;
//   allQuestions — the admin let them see and change other people's questions.
async function editorScope(user) {
  if (user?.role !== 'editor') return null;
  const own = new Set((await Subject.findAll({ where: { createdById: user.id }, attributes: ['id'], raw: true })).map((s) => s.id));
  const granted = (user.editorSubjectIds || []).map(Number).filter(Boolean);
  return { subjects: new Set([...own, ...granted]), own, allQuestions: !!user.editorAllQuestions, userId: user.id };
}

function outsideScope(req, subjectId) {
  return !!req.editorScope && !req.editorScope.subjects.has(Number(subjectId));
}

// Other people's questions are invisible to an editor without the "all questions" right,
// except inside the subjects they created themselves.
function seesAllQuestions(req, subjectId) {
  const scope = req.editorScope;
  return !scope || scope.allQuestions || scope.own.has(Number(subjectId));
}

function questionVisible(req, question, subjectId) {
  return seesAllQuestions(req, subjectId) || question.createdById === req.editorScope.userId;
}

async function subjectOfTest(id) {
  if (!Number(id)) return null;
  const test = await Test.findByPk(Number(id), { attributes: ['subjectId'] });
  return test?.subjectId ?? null;
}

async function subjectOfPassage(id) {
  if (!Number(id)) return null;
  const passage = await ReadingPassage.findByPk(Number(id), { attributes: ['testId'] });
  return passage ? subjectOfTest(passage.testId) : null;
}

async function subjectOfVariant(id) {
  const v = await SimVariant.findByPk(Number(id), { attributes: ['subjectId'] });
  return v?.subjectId ?? null;
}

const STRUCTURE = 'structure';

// The subject an editor request reads or changes, and whether it changes the structure.
// undefined = the route checks access itself (lists filter by scope; multipart uploads check after parsing).
async function requestTarget(req) {
  const { method, path } = req;
  const body = req.body || {};
  const query = req.query || {};
  const id = (re) => Number((path.match(re) || [])[1]) || null;

  const questionId = id(/^\/questions\/(\d+)$/);
  if (questionId) {
    const q = await Question.findByPk(questionId, { attributes: ['id', 'testId', 'createdById'] });
    return { subjectId: q ? await subjectOfTest(q.testId) : null, question: q };
  }
  if (path === '/questions') {
    const src = method === 'GET' ? query : body;
    return { subjectId: src.passageId ? await subjectOfPassage(src.passageId) : await subjectOfTest(src.testId) };
  }
  if (id(/^\/reading-passages\/(\d+)$/)) return { subjectId: await subjectOfPassage(id(/^\/reading-passages\/(\d+)$/)) };
  if (path === '/reading-passages') return { subjectId: await subjectOfTest(method === 'GET' ? query.testId : body.testId) };
  if (path === '/import-questions') {
    if (body.passageId) return { subjectId: await subjectOfPassage(body.passageId) };
    if (body.testId) return { subjectId: await subjectOfTest(body.testId) };
    return { subjectId: Number(body.subjectId) || null };
  }
  if (id(/^\/subjects\/(\d+)$/)) return { subjectId: id(/^\/subjects\/(\d+)$/), kind: STRUCTURE };
  if (path === '/tests' && method === 'POST') {
    const subjectId = body.parentId ? await subjectOfTest(body.parentId) : Number(body.subjectId) || null;
    return { subjectId, kind: STRUCTURE };
  }
  if (id(/^\/tests\/(\d+)$/)) return { subjectId: await subjectOfTest(id(/^\/tests\/(\d+)$/)), kind: STRUCTURE };
  if (id(/^\/sim\/tests\/(\d+)$/)) return { subjectId: id(/^\/sim\/tests\/(\d+)$/) };
  if (id(/^\/sim\/variants\/(\d+)$/)) return { subjectId: await subjectOfVariant(id(/^\/sim\/variants\/(\d+)$/)) };
  if (id(/^\/sim\/slots\/(\d+)$/)) return { subjectId: await subjectOfTest(id(/^\/sim\/slots\/(\d+)$/)) };
  return undefined;
}

module.exports = {
  editorScope,
  outsideScope,
  seesAllQuestions,
  questionVisible,
  subjectOfTest,
  subjectOfPassage,
  requestTarget,
  STRUCTURE,
};
