import { useMemo } from 'react';
import { paragraphParts, splitParagraphs } from '../lib/reading';

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function PassageText({
  passage,
  number,
  pageNo,
  ranges = [],
  markRef,
  onMouseUp,
  t,
}) {
  const paragraphs = useMemo(() => splitParagraphs(passage.body), [passage.body]);
  const byIndex = new Map(ranges.map((range) => [range.index, range]));
  const firstMarked = ranges.length ? ranges[0].index : -1;
  const kicker = t('reading.textShort', { n: pad2(number) });

  return (
    <div className="rb-text" onMouseUp={onMouseUp}>
      <div className="rb-runhead">
        <span>{t('reading.section')}</span>
        <span>{pageNo}</span>
      </div>
      <header className="rb-head">
        <span className="rb-kicker">{kicker}</span>
        <h1 className="rb-title">{passage.title || '—'}</h1>
        {passage.subtitle && <p className="rb-sub">{passage.subtitle}</p>}
        {passage.tags?.length > 0 && (
          <div className="rb-tags">
            {passage.tags.map((tag) => <span key={tag.name || tag}>{tag.name || tag}</span>)}
          </div>
        )}
        <div className="rb-orn" aria-hidden="true"><span /><i>❦</i><span /></div>
      </header>
      <div className="rb-body">
        {paragraphs.map((text, i) => (
          <div key={i} className={`rb-para${byIndex.has(i) ? ' has-mark' : ''}${i === 0 ? ' is-first' : ''}`}>
            <span className="rb-pnum" aria-hidden="true">{i + 1}</span>
            <p>
              {paragraphParts(text, byIndex.get(i)).map((part, k) => (part.mark ? (
                <mark key={k} ref={i === firstMarked ? markRef : undefined} className="rb-mark">{part.text}</mark>
              ) : (
                <span key={k}>{part.text}</span>
              )))}
            </p>
          </div>
        ))}
      </div>
      <div className="rb-end" aria-hidden="true">⁂</div>
      <div className="rb-folio">{pageNo}</div>
    </div>
  );
}
