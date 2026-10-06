export const COMPARE_LETTERS = ['А', 'Б', 'В', 'Г'];

export function isCompare(q) {
  return q?.kind === 'compare';
}

export function compareAnswerText(t, answer, index) {
  const slot = answer?.sortOrder >= 1 && answer.sortOrder <= 4 ? answer.sortOrder - 1 : index;
  return t(`compare.answers.${slot}`);
}

export function compareCorrectLetter(q) {
  const i = (q?.answers || []).findIndex((a) => a.isCorrect);
  return i >= 0 ? COMPARE_LETTERS[i] : '';
}
