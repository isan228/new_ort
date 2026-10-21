import { useLang } from '../../context/LangContext';

export const DIFFICULTY_LEVELS = [1, 2, 3, 4];

export function DifficultyPicker({ value, onChange }) {
  const { t } = useLang();
  return (
    <div className="field">
      <span>{t('admin.q.difficulty')}</span>
      <div className="dp" role="radiogroup">
        <button type="button" className={`chip${value ? '' : ' on'}`} onClick={() => onChange(null)}>
          {t('admin.q.difficultyNone')}
        </button>
        {DIFFICULTY_LEVELS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`dp-star${value && n <= value ? ' on' : ''}`}
            onClick={() => onChange(n)}
            title={String(n)}
          >
            {value && n <= value ? '★' : '☆'}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DifficultyBadge({ value }) {
  if (!value) return null;
  return <span className="dp-badge" title={String(value)}>{'★'.repeat(value)}</span>;
}
