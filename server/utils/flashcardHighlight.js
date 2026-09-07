function highlightFront(text) {
  return String(text || '')
    .replace(/______+/g, '<span class="blank">______</span>')
    .replace(/\(([^)]+\/[^)]+)\)/g, '<span class="choice">($1)</span>');
}

module.exports = { highlightFront };
