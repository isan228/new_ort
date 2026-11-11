import { useState } from 'react';
import { COMPARE_LETTERS } from '../../lib/compare';

// ORT answer sheets use Cyrillic letters.
export const SIM_LETTERS = 'АБВГДЕЖЗИК';

// Open on wide screens; on phones it is one tappable line so the question itself stays in view.
export function CompareInstruction({ t }) {
  const [wide] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 721px)').matches);
  return (
    <details className="sim-compare-help" open={wide}>
      <summary>{t('simulation.compareTitle')} <span className="sim-compare-keys">{COMPARE_LETTERS.join(' · ')}</span></summary>
      <ol>
        {COMPARE_LETTERS.map((letter, i) => <li key={letter}><b>({letter})</b> {t(`simulation.compareRule${i}`)}</li>)}
      </ol>
    </details>
  );
}

export function formatClock(sec) {
  const safe = Math.max(0, Math.floor(Number(sec) || 0));
  const hh = Math.floor(safe / 3600);
  const mm = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Difficulty({ t, value }) {
  return <span className={`sim-diff sim-diff-${value}`}>{t(`simulation.diff.${value}`)}</span>;
}

export function formatDate(value, locale) {
  return value ? new Date(value).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}
