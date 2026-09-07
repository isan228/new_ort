const { encodeLinkedText, QUESTION_MARK } = require('./ortLinkedQuestions');
const { normalizeTagName } = require('./ortTagNormalize');

function parseFieldBlocks(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const records = [];
  let current = {};
  let openKey = null;

  const commit = () => {
    if (current.Q || current.ID) records.push(current);
    current = {};
    openKey = null;
  };

  for (const line of text.split('\n')) {
    const start = line.match(/^"([^"]+)"\s*:\s*"(.*)$/);
    if (start && !openKey) {
      const key = start[1];
      let value = start[2];
      if (key === 'ID' || key === 'GroupID') {
        if (current.ID || current.Q) commit();
      }
      if (value.endsWith('"') && !value.endsWith('\\"')) {
        current[key] = value.slice(0, -1);
        openKey = null;
      } else {
        current[key] = value;
        openKey = key;
      }
      continue;
    }
    if (openKey) {
      if (line.endsWith('"') && !line.endsWith('\\"')) {
        current[openKey] += `\n${line.slice(0, -1)}`;
        openKey = null;
      } else {
        current[openKey] += `\n${line}`;
      }
      continue;
    }
    if (Object.keys(current).length && line.trim() === '') commit();
  }
  commit();
  return records;
}

function extractAnswers(record) {
  const answers = [];
  for (let i = 1; i <= 8; i += 1) {
    const key = `A${i}`;
    if (record[key]) answers.push({ text: record[key], sortOrder: i });
  }
  const correctRaw = String(record.Correct || record.C || '1').trim();
  const correctIndex = Number(correctRaw) - 1;
  return answers.map((a, idx) => ({ ...a, isCorrect: idx === correctIndex }));
}

function extractTags(record) {
  const tags = [];
  if (record.Topic) tags.push({ name: normalizeTagName(record.Topic), kind: 'topic' });
  if (record.Skill) tags.push({ name: normalizeTagName(record.Skill), kind: 'skill' });
  const extra = record.Tags || record.T || record.Tag;
  if (extra) {
    extra.split(',').forEach((part) => {
      const name = normalizeTagName(part);
      if (name) tags.push({ name, kind: 'topic' });
    });
  }
  return tags;
}

function parseExplainedQuestions(raw, { linked = false } = {}) {
  return parseFieldBlocks(raw).map((record) => {
    let text = record.Q || '';
    if (linked && record.GroupID) {
      text = encodeLinkedText(record.GroupID, QUESTION_MARK, text);
    }
    return {
      externalId: record.ID || null,
      groupId: record.GroupID || null,
      text,
      explanation: record.E || record.Explanation || '',
      answers: extractAnswers(record),
      tags: extractTags(record),
    };
  }).filter((q) => q.text);
}

module.exports = { parseExplainedQuestions, parseFieldBlocks };
