import { useLang } from '../context/LangContext';
import { isCompare } from '../lib/compare';

export function CompareColumns({ a, b }) {
  const { t } = useLang();
  return (
    <div className="cmp-table" role="table">
      <div className="cmp-cell cmp-head" role="columnheader">{t('compare.colA')}</div>
      <div className="cmp-cell cmp-head" role="columnheader">{t('compare.colB')}</div>
      <div className="cmp-cell cmp-value" role="cell">{a}</div>
      <div className="cmp-cell cmp-value" role="cell">{b}</div>
    </div>
  );
}

export default function QuestionStem({ q, className }) {
  if (!q) return null;
  const text = String(q.text || '').trim();
  if (!isCompare(q)) {
    return (
      <>
        <div className={className}>{q.text}</div>
        {q.imageUrl && <img className="q-media" src={q.imageUrl} alt="" />}
      </>
    );
  }
  return (
    <>
      {text && <div className={className}>{text}</div>}
      {q.imageUrl && <img className="q-media" src={q.imageUrl} alt="" />}
      <CompareColumns a={q.compareA} b={q.compareB} />
    </>
  );
}
