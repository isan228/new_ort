export function pickTextFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

export async function readTextFile(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  const text = utf8.includes('\uFFFD') ? new TextDecoder('windows-1251').decode(buffer) : utf8;
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
}

// A short first line without final punctuation is treated as the title.
export function splitTitle(raw) {
  const [first = '', ...rest] = raw.split('\n');
  const head = first.trim();
  const body = rest.join('\n').trim();
  if (head && body && head.length <= 120 && !/[.!?…:;,]$/.test(head)) {
    return { title: head, body };
  }
  return { title: '', body: raw };
}
