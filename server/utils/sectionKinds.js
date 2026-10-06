const SECTION_KINDS = ['group', 'standard', 'compare', 'reading'];

function normalizeKind(value) {
  return SECTION_KINDS.includes(value) ? value : null;
}

function inferKind(test) {
  if (test.ortPart === 'reading') return 'reading';
  return 'standard';
}

module.exports = { SECTION_KINDS, normalizeKind, inferKind };
