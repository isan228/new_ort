// ORT answer sheets use Cyrillic letters.
export const SIM_LETTERS = 'АБВГДЕЖЗИК';

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
