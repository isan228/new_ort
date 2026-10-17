import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { practiceApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import '../styles/practice.css';

const FILTERS = ['unused', 'incorrect', 'correct', 'flagged'];

function TriCheck({ checked, partial, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !checked && partial; }, [checked, partial]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} />;
}

function leavesUnder(sections, id) {
  const children = sections.filter((s) => s.parentId === id);
  return children.flatMap((s) => (s.leaf ? [s.id] : leavesUnder(sections, s.id)));
}

function Stars({ value, onChange, t }) {
  return (
    <div className="pb-difficulty" role="radiogroup" aria-label={t('practice.difficulty')}>
      <button type="button" role="radio" aria-checked={value === 'mixed'} className={`chip${value === 'mixed' ? ' on' : ''}`} onClick={() => onChange('mixed')}>
        {t('practice.mixed')}
      </button>
      <span className="pb-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            title={t('practice.levelN', { n })}
            className={`pb-star${value !== 'mixed' && n <= value ? ' on' : ''}${value === n ? ' is-picked' : ''}`}
            onClick={() => onChange(n)}
          >
            {value !== 'mixed' && n <= value ? '★' : '☆'}
          </button>
        ))}
      </span>
      <span className="muted pb-hint">{value === 'mixed' ? t('practice.mixedHint') : t('practice.onlyLevel', { n: value })}</span>
    </div>
  );
}

function SectionTree({ sections, parentId, selected, toggle, depth }) {
  return sections.filter((s) => s.parentId === parentId).map((s) => {
    if (s.leaf) {
      return (
        <label key={s.id} className={`pb-topic${selected.has(s.id) ? ' on' : ''}`} style={{ paddingLeft: 12 + depth * 18 }}>
          <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle([s.id])} />
          <span className="pb-topic-name">{s.name}</span>
          <b className="pb-topic-count">{s.matching}</b>
        </label>
      );
    }
    const ids = leavesUnder(sections, s.id);
    const on = ids.filter((id) => selected.has(id)).length;
    return (
      <div key={s.id}>
        <label className="pb-topic pb-group" style={{ paddingLeft: 12 + depth * 18 }}>
          <TriCheck checked={on === ids.length && on > 0} partial={on > 0} label={s.name} onChange={() => toggle(ids, on !== ids.length)} />
          <span className="pb-topic-name">{s.name}</span>
        </label>
        <SectionTree sections={sections} parentId={s.id} selected={selected} toggle={toggle} depth={depth + 1} />
      </div>
    );
  });
}

export default function TestBuilder() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = Number(params.get('bank')) || null;
  const presetFilter = FILTERS.includes(params.get('filter')) ? [params.get('filter')] : [];

  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [difficulty, setDifficulty] = useState('mixed');
  const [filters, setFilters] = useState(presetFilter);
  const [count, setCount] = useState(20);
  const [timer, setTimer] = useState(false);
  const [minutes, setMinutes] = useState(40);
  const [instant, setInstant] = useState(false);
  const [active, setActive] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const presetApplied = useRef(false);
  const testIds = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);

  useEffect(() => {
    let stop = false;
    practiceApi.builder({ testIds, difficulty, filters })
      .then((next) => { if (!stop) setData(next); })
      .catch((err) => {
        if (stop) return;
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
    return () => { stop = true; };
  }, [testIds.join(','), difficulty, filters.join(','), navigate]);

  useEffect(() => {
    practiceApi.sessions('active').then((res) => setActive(res.sessions || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!data || presetApplied.current || !preset) return;
    presetApplied.current = true;
    for (const subject of data.subjects) {
      const hit = subject.sections.find((s) => s.id === preset);
      if (!hit) continue;
      setSelected(new Set(hit.leaf ? [hit.id] : leavesUnder(subject.sections, hit.id)));
      setExpanded(new Set([subject.id]));
    }
  }, [data, preset]);

  function toggle(ids, on) {
    setSelected((prev) => {
      const next = new Set(prev);
      const turnOn = on ?? !ids.every((id) => prev.has(id));
      for (const id of ids) (turnOn ? next.add(id) : next.delete(id));
      return next;
    });
  }

  function toggleSubject(subject) {
    const ids = subject.sections.filter((s) => s.leaf).map((s) => s.id);
    const all = ids.every((id) => selected.has(id));
    toggle(ids, !all);
    if (!all) setExpanded((prev) => new Set(prev).add(subject.id));
  }

  function toggleFilter(key) {
    if (key === 'all') { setFilters([]); return; }
    setFilters((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function create() {
    setError('');
    setBusy(true);
    try {
      const { id } = await practiceApi.create({ testIds, difficulty, filters, count, timer, minutes, instant });
      navigate(`/app/practice/${id}`);
    } catch (err) {
      if (isOrtGate(err)) navigate('/app/premium');
      else setError(err.message);
      setBusy(false);
    }
  }

  const counts = data?.counts || { all: 0 };
  const available = data?.available || 0;
  const canCreate = testIds.length > 0 && count >= 1 && (!timer || minutes >= 1);

  return (
    <div className="builder-page pb">
      <div className="builder-head">
        <h1>{t('practice.title')}</h1>
        <Link className="btn ghost sm" to="/app/tests">{t('tests.title')}</Link>
      </div>

      {active.length > 0 && (
        <div className="card pb-active">
          <b>{t('practice.unfinished')}</b>
          {active.slice(0, 5).map((s) => (
            <div key={s.id} className="pb-active-row">
              <span>{s.subjects.join(', ')} · {t('practice.answeredOf', { a: s.answered, b: s.count })}</span>
              <Link className="btn sm" to={`/app/practice/${s.id}`}>{t('practice.continue')}</Link>
            </div>
          ))}
        </div>
      )}

      <div className="card builder-card">
        <h3>{t('practice.step1')}</h3>
        {!data && <p className="muted">{t('common.loading')}</p>}
        {data && !data.subjects.length && <p className="empty">{t('builder.noSections')}</p>}
        <div className="pb-subjects">
          {data?.subjects.map((subject) => {
            const ids = subject.sections.filter((s) => s.leaf).map((s) => s.id);
            const on = ids.filter((id) => selected.has(id)).length;
            const open = expanded.has(subject.id);
            return (
              <div key={subject.id} className={`pb-subject${on ? ' on' : ''}`}>
                <div className="pb-subject-head">
                  <label>
                    <TriCheck checked={on === ids.length} partial={on > 0} label={subject.name} onChange={() => toggleSubject(subject)} />
                    <b>{subject.name}</b>
                  </label>
                  <span className="muted">{on ? t('practice.topicsPicked', { a: on, b: ids.length }) : t('practice.topicsN', { n: ids.length })}</span>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(subject.id)) next.delete(subject.id); else next.add(subject.id);
                      return next;
                    })}
                  >
                    {open ? t('practice.hideTopics') : t('practice.showTopics')}
                  </button>
                </div>
                {open && (
                  <div className="pb-tree">
                    <SectionTree sections={subject.sections} parentId={null} selected={selected} toggle={toggle} depth={0} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card builder-card pb-settings">
        <h3>{t('practice.step2')}</h3>
        <div className="pb-row">
          <label className="field pb-count">
            <span>{t('practice.count')}</span>
            <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
          </label>
          <div className="field">
            <span>{t('practice.difficulty')}</span>
            <Stars value={difficulty} onChange={setDifficulty} t={t} />
          </div>
        </div>

        <div className="field">
          <span>{t('practice.filters')}</span>
          <div className="pb-filters">
            {['all', ...FILTERS].map((key) => {
              const on = key === 'all' ? !filters.length : filters.includes(key);
              return (
                <button key={key} type="button" className={`chip pb-filter pb-filter-${key}${on ? ' on' : ''}`} onClick={() => toggleFilter(key)}>
                  {key === 'flagged' && <span className="pb-flag-dot" aria-hidden="true">⚑</span>}
                  {t(`practice.filter.${key}`)}
                  <b>{counts[key] ?? 0}</b>
                </button>
              );
            })}
          </div>
          <small className="field-hint">{testIds.length ? t('practice.filtersHint') : t('practice.pickTopicsFirst')}</small>
        </div>

        <div className="pb-row">
          <label className="ar-check">
            <input type="checkbox" checked={timer} onChange={(e) => setTimer(e.target.checked)} />
            <span>{t('practice.timer')}</span>
          </label>
          {timer && (
            <label className="field pb-minutes">
              <span>{t('practice.minutes')}</span>
              <input type="number" min={1} max={300} value={minutes} onChange={(e) => setMinutes(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
            </label>
          )}
        </div>
        <label className="ar-check">
          <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} />
          <span>{t('practice.instant')}</span>
        </label>
      </div>

      {error && <p className="err">{error}</p>}
      <div className="builder-start">
        <button className="btn lg" type="button" disabled={busy || !canCreate} onClick={create}>
          {busy ? t('common.loading') : t('practice.create')}
        </button>
        <span className="muted">
          {t('practice.summary', { q: count, n: available })}
          {available < count && testIds.length > 0 && <b className="pb-short"> · {t('practice.notEnough')}</b>}
        </span>
      </div>
    </div>
  );
}
