const {
  Test, ReadingPassage, Question, SimVariant,
} = require('../models');

// null = no limits (admin); a Set = the only subjects this editor may see or change.
function editorSubjects(user) {
  if (user?.role !== 'editor') return null;
  return new Set((user.editorSubjectIds || []).map(Number).filter(Boolean));
}

function outsideScope(req, subjectId) {
  return !!req.editorSubjects && !req.editorSubjects.has(Number(subjectId));
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

async function subjectOfQuestion(id) {
  const q = await Question.findByPk(Number(id), { attributes: ['testId'] });
  return q ? subjectOfTest(q.testId) : null;
}

async function subjectOfVariant(id) {
  const v = await SimVariant.findByPk(Number(id), { attributes: ['subjectId'] });
  return v?.subjectId ?? null;
}

// The subject an editor request reads or changes. undefined = this route checks access itself
// (lists filter by scope; multipart uploads check after their body is parsed).
async function requestSubject(req) {
  const { method, path } = req;
  const body = req.body || {};
  const query = req.query || {};
  const id = (re) => Number((path.match(re) || [])[1]) || null;

  if (id(/^\/questions\/(\d+)$/)) return subjectOfQuestion(id(/^\/questions\/(\d+)$/));
  if (path === '/questions') {
    const src = method === 'GET' ? query : body;
    return src.passageId ? subjectOfPassage(src.passageId) : subjectOfTest(src.testId);
  }
  if (id(/^\/reading-passages\/(\d+)$/)) return subjectOfPassage(id(/^\/reading-passages\/(\d+)$/));
  if (path === '/reading-passages') return subjectOfTest(method === 'GET' ? query.testId : body.testId);
  if (path === '/import-questions') {
    if (body.passageId) return subjectOfPassage(body.passageId);
    if (body.testId) return subjectOfTest(body.testId);
    return Number(body.subjectId) || null;
  }
  if (id(/^\/sim\/tests\/(\d+)$/)) return id(/^\/sim\/tests\/(\d+)$/);
  if (id(/^\/sim\/variants\/(\d+)$/)) return subjectOfVariant(id(/^\/sim\/variants\/(\d+)$/));
  if (id(/^\/sim\/slots\/(\d+)$/)) return subjectOfTest(id(/^\/sim\/slots\/(\d+)$/));
  return undefined;
}

module.exports = {
  editorSubjects,
  outsideScope,
  subjectOfTest,
  subjectOfPassage,
  requestSubject,
};
