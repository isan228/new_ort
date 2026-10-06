import { Fragment } from 'react';

const MATH_HINT = /[\^_/√]|sqrt|<=|>=|!=|\bpi\b/;
const CLOSE = { '(': ')', '{': '}' };
const WORD = /[0-9A-Za-zА-Яа-яЁё]/;
const NUMBER = /^\d+(?:[.,]\d+)?/;
const SCRIPT = /^-?\d+(?:[.,]\d+)?|^[A-Za-z]/;
const SYMBOLS = [['<=', '≤'], ['>=', '≥'], ['!=', '≠']];

export function hasMath(text) {
  return MATH_HINT.test(String(text || ''));
}

function groupEnd(s, start) {
  const open = s[start];
  const close = CLOSE[open];
  let depth = 0;
  for (let i = start; i < s.length; i += 1) {
    if (s[i] === open) depth += 1;
    else if (s[i] === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Operand of a fraction, power or root: "(…)", "{…}", a number or a single latin letter.
function readOperand(s, i, { letters = true } = {}) {
  if (CLOSE[s[i]]) {
    const end = groupEnd(s, i);
    if (end < 0) return null;
    return { inner: s.slice(i + 1, end), end: end + 1 };
  }
  const rest = s.slice(i);
  const num = rest.match(NUMBER);
  if (num) return { inner: num[0], end: i + num[0].length };
  if (letters && /^[A-Za-z](?![A-Za-z])/.test(rest)) return { inner: rest[0], end: i + 1 };
  return null;
}

function readScript(s, i) {
  if (CLOSE[s[i]]) return readOperand(s, i);
  const m = s.slice(i).match(SCRIPT);
  return m ? { inner: m[0], end: i + m[0].length } : null;
}

function parse(s) {
  const out = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push(buf);
    buf = '';
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const prev = s[i - 1] || '';

    const symbol = SYMBOLS.find(([from]) => s.startsWith(from, i));
    if (symbol) {
      buf += symbol[1];
      i += symbol[0].length;
      continue;
    }

    if (s.startsWith('pi', i) && !WORD.test(prev) && !WORD.test(s[i + 2] || '')) {
      buf += 'π';
      i += 2;
      continue;
    }

    const isRoot = ch === '√' || (s.startsWith('sqrt', i) && !WORD.test(prev) && CLOSE[s[i + 4]]);
    if (isRoot) {
      const op = readOperand(s, i + (ch === '√' ? 1 : 4));
      if (op) {
        flush();
        out.push({ type: 'root', body: parse(op.inner) });
        i = op.end;
        continue;
      }
    }

    if ((ch === '^' || ch === '_') && prev && prev !== ' ') {
      const op = readScript(s, i + 1);
      if (op) {
        flush();
        out.push({ type: ch === '^' ? 'sup' : 'sub', body: parse(op.inner) });
        i = op.end;
        continue;
      }
    }

    const startsOperand = CLOSE[ch] || (!WORD.test(prev) && /[0-9A-Za-z]/.test(ch));
    if (startsOperand) {
      const left = readOperand(s, i);
      if (left && s[left.end] === '/') {
        const right = readOperand(s, left.end + 1);
        if (right) {
          flush();
          out.push({ type: 'frac', num: parse(left.inner), den: parse(right.inner) });
          i = right.end;
          continue;
        }
      }
      if (CLOSE[ch] && left) {
        buf += ch;
        flush();
        out.push(...parse(left.inner));
        buf += s[left.end - 1];
        i = left.end;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

function render(nodes) {
  return nodes.map((node, i) => {
    if (typeof node === 'string') return <Fragment key={i}>{node}</Fragment>;
    if (node.type === 'sup') return <sup key={i}>{render(node.body)}</sup>;
    if (node.type === 'sub') return <sub key={i}>{render(node.body)}</sub>;
    if (node.type === 'root') {
      return <span key={i} className="mt-root">√<span className="mt-root-body">{render(node.body)}</span></span>;
    }
    return (
      <span key={i} className="mt-frac">
        <span className="mt-num">{render(node.num)}</span>
        <span className="mt-den">{render(node.den)}</span>
      </span>
    );
  });
}

export default function MathText({ text }) {
  const value = String(text ?? '');
  if (!hasMath(value)) return value;
  return <>{render(parse(value))}</>;
}
