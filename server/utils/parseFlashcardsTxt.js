const { normalizeTopicTitle } = require('./ortFlashcardTopics');

function parseFlashcardsTxt(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const blocks = text.split(/\n(?=={3}|\"ID\":)/);
  const cards = [];
  let topic = 'Общее';

  const lines = text.split('\n');
  let current = null;

  const flush = () => {
    if (current && current.front && current.back) {
      cards.push({
        externalId: current.id || String(cards.length + 1),
        frontText: current.front,
        backText: current.back,
        topic,
      });
    }
    current = null;
  };

  for (const line of lines) {
    const topicMatch = line.match(/^===\s*(.+?)\s*===\s*$/);
    if (topicMatch) {
      flush();
      topic = normalizeTopicTitle(topicMatch[1]);
      continue;
    }
    const idMatch = line.match(/^"ID"\s*:\s*"([^"]*)"/i);
    if (idMatch) {
      flush();
      current = { id: idMatch[1], front: '', back: '' };
      continue;
    }
    const frontMatch = line.match(/^"Front"\s*:\s*"([\s\S]*)"/i);
    if (frontMatch && current) {
      current.front = frontMatch[1].replace(/"$/, '');
      continue;
    }
    const backMatch = line.match(/^"Back"\s*:\s*"([\s\S]*)"/i);
    if (backMatch && current) {
      current.back = backMatch[1].replace(/"$/, '');
    }
  }
  flush();

  return cards;
}

module.exports = { parseFlashcardsTxt };
