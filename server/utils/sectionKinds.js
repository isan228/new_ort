const SECTION_KINDS = ['group', 'standard', 'geometry', 'compare', 'reading'];

// Geometry questions are standard questions that must carry a drawing.
const IMAGE_REQUIRED_KINDS = ['geometry'];

function requiresImage(test) {
  return IMAGE_REQUIRED_KINDS.includes(test?.kind);
}

function normalizeKind(value) {
  return SECTION_KINDS.includes(value) ? value : null;
}

function inferKind(test) {
  if (test.ortPart === 'reading') return 'reading';
  return 'standard';
}

module.exports = { SECTION_KINDS, normalizeKind, inferKind, requiresImage };
