import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';

const MODE_KEYS = ['unused', 'solved', 'correct', 'incorrect'];

function toggleId(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export default function TestBuilder() {
  const { bank, setBank } = useBank();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetId = Number(params.get('bank')) || bank?.testId || null;

  const [groups, setGroups] = useState([]);
  const [tags, setTags] = useState([]);
  const [status, setStatus] = useState({ all: 0, unused: 0, solved: 0, correct: 0, incorrect: 0 });
  const [available, setAvailable] = useState(0);
  const [testIds, setTestIds] = useState(presetId ? [presetId] : []);
  const [tagIds, setTagIds] = useState([]);
  const [modes, setModes] = useState(['unused']);
  const [questionCount, setQuestionCount] = useState(20);
  const [minutes, setMinutes] = useState(20);
  const [timed, setTimed] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    ortApi.builder({ testIds, tagIds, modes })
      .then((data) => {
        if (stop) return;
        setGroups(data.groups || []);
        setTags(data.tags || []);
        setStatus(data.status || { all: 0, unused: 0, solved: 0, correct: 0, incorrect: 0 });
        setAvailable(data.available || 0);
      })
      .catch((err) => {
        if (stop) return;
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
    return () => { stop = true; };
  }, [modes, navigate, tagIds, testIds]);

  const sections = useMemo(() => groups.flatMap((group) => group.sections), [groups]);
  const maxCount = Math.max(1, Math.min(150, available || 1));

  useEffect(() => {
    setQuestionCount((n) => Math.min(Math.max(1, n), maxCount));
  }, [maxCount]);

  function toggleMode(key) {
    setModes((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }

  function setAllSections(on) {
    setTestIds(on ? sections.map((row) => row.id) : []);
  }

  function setAllTags(on) {
    setTagIds(on ? tags.map((row) => row.id) : []);
  }

  async function start() {
    setError('');
    setBusy(true);
    try {
      const data = await ortApi.customTest({
        testIds,
        tagIds,
        modes,
        questionCount,
        minutes: timed ? minutes : 0,
        name,
        randomizeAnswers: true,
      });
      const first = sections.find((row) => testIds.includes(row.id)) || sections[0];
      if (first) {
        setBank({
          subjectId: first.subjectId,
          testId: first.id,
          name: first.subjectName,
          testName: data.test?.name || first.name,
          trackGroup: first.trackGroup,
        });
      }
      sessionStorage.setItem('ortSession', JSON.stringify({
        ...data,
        examMode: timed,
        instantFeedbackMode: !timed,
        startedAt: Date.now(),
        questionMode: modes.join(',') || 'all',
        minutes: timed ? minutes : 0,
        examType: 'custom',
      }));
      navigate('/app/test');
    } catch (err) {
      if (isOrtGate(err)) navigate('/app/premium');
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="builder-page">
      <div className="builder-head">
        <h1>{t('builder.title')}</h1>
        <div className="builder-switch">
          <button type="button" className={!timed ? 'on' : ''} onClick={() => setTimed(false)}>{t('builder.practice')}</button>
          <button type="button" className={timed ? 'on' : ''} onClick={() => setTimed(true)}>{t('builder.timed')}</button>
        </div>
        <Link className="btn ghost sm" to="/app/tests">{t('tests.title')}</Link>
      </div>

      <div className="card builder-card">
        <div className="builder-top">
          <label className="field">
            <span>{t('builder.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('builder.namePh')} />
          </label>
          <label className="field">
            <span>{t('builder.count')}</span>
            <input
              type="number"
              min={1}
              max={maxCount}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value) || 1)}
            />
          </label>
          <label className="field">
            <span>{t('builder.time')}</span>
            <input
              type="number"
              min={0}
              max={240}
              value={minutes}
              disabled={!timed}
              onChange={(e) => setMinutes(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <div className="builder-avail muted">{t('builder.available', { n: available })}</div>
        </div>
        <div className="builder-status">
          {MODE_KEYS.map((key) => (
            <label key={key} className={`builder-check ${modes.includes(key) ? 'on' : ''}`}>
              <span>
                <input type="checkbox" checked={modes.includes(key)} onChange={() => toggleMode(key)} />
                {t(`builder.${key}`)}
              </span>
              <b>{status[key] || 0}</b>
            </label>
          ))}
        </div>
      </div>

      <div className="builder-cols">
        <div className="card builder-card">
          <div className="builder-block-head">
            <h3>{t('builder.sections')}</h3>
            <div className="row">
              <button type="button" className="btn ghost sm" onClick={() => setAllSections(true)}>{t('builder.allOn')}</button>
              <button type="button" className="btn ghost sm" onClick={() => setAllSections(false)}>{t('builder.allOff')}</button>
            </div>
          </div>
          <div className="builder-scroll">
            {!groups.length && <p className="empty">{t('builder.noSections')}</p>}
            {groups.map((group) => (
              <div key={group.id} className="builder-group">
                <div className="builder-group-title">{group.name}</div>
                {group.sections.map((row) => (
                  <label key={row.id} className={`builder-check ${testIds.includes(row.id) ? 'on' : ''}`}>
                    <span>
                      <input
                        type="checkbox"
                        checked={testIds.includes(row.id)}
                        onChange={() => setTestIds((prev) => toggleId(prev, row.id))}
                      />
                      {row.name}
                    </span>
                    <b>{row.available}</b>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="card builder-card">
          <div className="builder-block-head">
            <h3>{t('builder.tags')}</h3>
            <div className="row">
              <button type="button" className="btn ghost sm" onClick={() => setAllTags(true)}>{t('builder.allOn')}</button>
              <button type="button" className="btn ghost sm" onClick={() => setAllTags(false)}>{t('builder.allOff')}</button>
            </div>
          </div>
          <div className="builder-scroll builder-tags">
            {!tags.length && <p className="empty">{t('builder.noTags')}</p>}
            {tags.map((tag) => (
              <label key={tag.id} className={`builder-check ${tagIds.includes(tag.id) ? 'on' : ''}`}>
                <span>
                  <input
                    type="checkbox"
                    checked={tagIds.includes(tag.id)}
                    onChange={() => setTagIds((prev) => toggleId(prev, tag.id))}
                  />
                  {tag.name}
                </span>
                <b>{tag.available}</b>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="err">{error}</p>}
      <div className="builder-start">
        <button className="btn" type="button" disabled={busy || available < 1} onClick={start}>
          {t('builder.start')}
        </button>
        <span className="muted">{t('builder.summary', { q: questionCount, m: timed ? t('sim.minutes', { n: minutes }) : t('builder.noTime') })}</span>
      </div>
    </div>
  );
}
