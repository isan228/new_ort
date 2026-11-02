// Matches TXT file names ("Fonetika.txt", "Tyutchev, Fet i Nekrasov.txt", "Фонетика.txt") to topic names.
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ң: 'ng', ө: 'o', ү: 'u', і: 'i', ә: 'a', ғ: 'g', қ: 'k', һ: 'h',
};

export function topicKey(name) {
  return [...String(name || '').toLowerCase()]
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

// Spelling variants of other transliteration schemes: "Gorkij", "Psihologizm", "Cvetaeva", "Priemy".
function looseKey(key) {
  return key
    .replace(/shch|sch/g, 'sh')
    .replace(/kh/g, 'h')
    .replace(/ts/g, 'c')
    .replace(/zh/g, 'j')
    .replace(/yo|jo/g, 'e')
    .replace(/(iy|yy|ij|yj|ii|ji)(?![aeiouy])/g, 'y')
    .replace(/ya|ja|ia/g, 'a')
    .replace(/yu|ju|iu/g, 'u')
    .replace(/[jy]/g, 'i');
}

export function fileTopicName(fileName) {
  return String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/^\s*\d+\s*[.)_-]?\s*/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
}

// targets: [{ key, name, label }]; `name` is the topic name ("Группа · тема" uses the part after " · ").
// Returns, per file, the matching targets (exact transliteration first, then loose spelling).
export function matchFiles(fileNames, targets) {
  const exact = new Map();
  const loose = new Map();
  const add = (map, k, target) => {
    if (!k) return;
    const list = map.get(k) || [];
    if (!list.includes(target)) list.push(target);
    map.set(k, list);
  };
  for (const target of targets) {
    const names = [target.name];
    const short = String(target.name).split(' · ').pop();
    if (short !== target.name) names.push(short);
    if (target.label && target.label !== target.name) names.push(target.label);
    for (const name of names) {
      add(exact, topicKey(name), target);
      add(loose, looseKey(topicKey(name)), target);
    }
  }
  return fileNames.map((fileName) => {
    const k = topicKey(fileTopicName(fileName));
    return exact.get(k) || loose.get(looseKey(k)) || [];
  });
}
