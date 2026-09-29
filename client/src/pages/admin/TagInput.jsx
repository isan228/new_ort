import { useEffect, useId, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

let cachedNames = null;

function useTagSuggestions() {
  const [names, setNames] = useState(cachedNames || []);
  useEffect(() => {
    if (cachedNames) return;
    adminApi.tags()
      .then((res) => {
        cachedNames = [...new Set((res.tags || []).map((tag) => tag.name))];
        setNames(cachedNames);
      })
      .catch(() => {});
  }, []);
  return names;
}

export function TagChips({ tags }) {
  if (!tags?.length) return null;
  return (
    <span className="tag-chips">
      {tags.map((tag) => <span key={tag.id || tag.name || tag} className="tag-chip">{tag.name || tag}</span>)}
    </span>
  );
}

export default function TagInput({ value, onChange, label }) {
  const { t } = useLang();
  const listId = useId();
  const suggestions = useTagSuggestions();
  const [draft, setDraft] = useState('');

  function add(raw) {
    const names = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const lower = value.map((v) => v.toLowerCase());
    const next = [...value];
    for (const name of names) {
      if (!lower.includes(name.toLowerCase())) {
        next.push(name);
        lower.push(name.toLowerCase());
      }
    }
    onChange(next);
    setDraft('');
  }

  function remove(name) {
    onChange(value.filter((v) => v !== name));
  }

  return (
    <div className="field tag-input">
      <span>{label || t('admin.tagsLabel')}</span>
      <div className="tag-input-box">
        {value.map((name) => (
          <span key={name} className="tag-chip">
            {name}
            <button type="button" onClick={() => remove(name)} aria-label={t('common.delete')}>×</button>
          </span>
        ))}
        <input
          list={listId}
          value={draft}
          placeholder={value.length ? '' : t('admin.tagsPh')}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',')) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => add(draft)}
        />
        <datalist id={listId}>
          {suggestions.filter((name) => !value.includes(name)).map((name) => <option key={name} value={name} />)}
        </datalist>
      </div>
      <small className="field-hint">{t('admin.tagsHint')}</small>
    </div>
  );
}
