import { Fragment } from 'react';

export function linkifyMedicalTerms(text, keywords, onOpen) {
  if (!text) return null;
  const list = [...(keywords || [])].filter((k) => k.word).sort((a, b) => b.word.length - a.word.length);
  if (!list.length) return text;

  const escaped = list.map((k) => k.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = String(text).split(re);

  return parts.map((part, idx) => {
    const hit = list.find((k) => k.word.toLowerCase() === part.toLowerCase());
    if (!hit) return <Fragment key={idx}>{part}</Fragment>;
    return (
      <button key={idx} type="button" className="term-link" onClick={() => onOpen(hit)}>
        {part}
      </button>
    );
  });
}

export function buildFrontHtml(text) {
  return String(text || '')
    .replace(/______+/g, '<span class="blank">______</span>')
    .replace(/\(([^)]+\/[^)]+)\)/g, '<span class="choice">($1)</span>');
}
