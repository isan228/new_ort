import { useLang } from '../../context/LangContext';

export const DIFFICULTY_LEVELS = [1, 2, 3, 4];
// Same default as the server: a question without an explicit level is level 3.
export const DEFAULT_DIFFICULTY = 3;

export function DifficultyPicker({ value, onChange }) {
  const { t } = useLang();
  const level = value || DEFAULT_DIFFICULTY;
  return (
    <div className="field">
      <span>{t('admin.q.difficulty')}</span>
      <div className="dp" role="radiogroup">
        {DIFFICULTY_LEVELS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={level === n}
            className={`dp-star${n <= level ? ' on' : ''}`}
            onClick={() => onChange(n)}
            title={String(n)}
          >
            {n <= level ? '★' : '☆'}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DifficultyBadge({ value }) {
  const level = value || DEFAULT_DIFFICULTY;
  return <span className="dp-badge" title={String(level)}>{'★'.repeat(level)}</span>;
}
