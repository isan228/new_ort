import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';

// Section names arrive as a path ("Математика · Арифметика · Степень"): the last part is the topic,
// everything before it is the section the topic is listed under.
function groupTopics(tests) {
  const groups = [];
  for (const test of tests) {
    const parts = String(test.name || '').split(' · ');
    const topic = parts.pop();
    const name = parts.join(' · ');
    let group = groups.find((row) => row.name === name);
    if (!group) {
      group = { name, items: [] };
      groups.push(group);
    }
    group.items.push({ test, topic });
  }
  return groups;
}

function TopicGroup({ group, open, t, onPick }) {
  const rows = (
    <div className="tests-topics">
      {group.items.map(({ test, topic }) => (
        <button key={test.id} type="button" className="tests-topic" onClick={() => onPick(test)}>
          <span className="tests-topic-name">{topic || t('tests.start')}</span>
          <span className="tests-topic-count">{t('tests.qShort', { n: test.questionCount || 0 })}</span>
          <span className="tests-topic-go" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
  if (!group.name) return rows;
  return (
    <details className="tests-group" open={open}>
      <summary>
        <span>{group.name}</span>
        <small>{group.items.length}</small>
      </summary>
      {rows}
    </details>
  );
}

export default function Tests() {
  const { t } = useLang();
  const [data, setData] = useState({ main: [], state_lang: [], subject: [], mainExam: null });
  const [cat, setCat] = useState('all');
  const [error, setError] = useState('');
  const [reading, setReading] = useState([]);
  const { setBank } = useBank();
  const navigate = useNavigate();

  const cats = [
    { id: 'all', title: t('tests.all') },
    { id: 'main', title: t('tests.main') },
    { id: 'state_lang', title: t('tests.ky') },
    { id: 'subject', title: t('tests.subject') },
  ];

  useEffect(() => {
    ortApi.dashboard()
      .then(setData)
      .catch((err) => {
        if (isOrtGate(err)) navigate('/app/premium');
        else setError(err.message);
      });
    ortApi.readingList()
      .then((res) => setReading(res.tests || []))
      .catch(() => setReading([]));
  }, [navigate]);

  const list = cat === 'all'
    ? [...(data.main || []), ...(data.state_lang || []), ...(data.subject || [])]
    : (data[cat] || []);
  const showExam = cat === 'all' || cat === 'main';

  function open(subject, test) {
    setBank({
      subjectId: subject.id,
      testId: test?.id || null,
      name: subject.name,
      testName: test?.name,
      trackGroup: subject.trackGroup,
    });
    navigate(test ? `/app/create?bank=${test.id}` : `/app/create?subject=${subject.id}`);
  }

  return (
    <div>
      <h1>{t('tests.title')}</h1>
      <p className="muted">{t('tests.lead')}</p>
      <div className="tabs">
        {cats.map((c) => (
          <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.title}</button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      <div className="card ort-exam-card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="badge">{t('nav.create')}</span>
            <h2 style={{ margin: '8px 0 6px' }}>{t('builder.title')}</h2>
            <p className="muted" style={{ margin: 0 }}>{t('builder.leadNew')}</p>
          </div>
          <button className="btn" type="button" onClick={() => navigate('/app/create')}>{t('builder.start')}</button>
        </div>
      </div>
      <div className="card ort-exam-card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="badge brand">{t('simulation.badge')}</span>
            <h2 style={{ margin: '8px 0 6px' }}>{t('simulation.title')}</h2>
            <p className="muted" style={{ margin: 0 }}>{t('simulation.cardLead')}</p>
          </div>
          <button className="btn" type="button" onClick={() => navigate('/app/sim')}>
            {t('simulation.openCatalog')}
          </button>
        </div>
      </div>
      {showExam && reading.map((book) => {
        const total = book.passages.reduce((sum, p) => sum + p.questionCount, 0);
        const done = book.passages.reduce((sum, p) => sum + p.answered, 0);
        return (
          <div key={book.id} className="card ort-exam-card reading-card">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="badge brand">{t('reading.cardBadge')}</span>
                <h2 style={{ margin: '8px 0 6px' }}>{book.name || t('reading.cardTitle')}</h2>
                <p className="muted" style={{ margin: 0 }}>{t('reading.cardLead')}</p>
              </div>
              <button className="btn" type="button" onClick={() => navigate(`/app/reading/${book.id}`)}>
                {t('reading.cardOpen')}
              </button>
            </div>
            <div className="reading-card-list">
              {book.passages.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className="reading-card-item"
                  onClick={() => navigate(`/app/reading/${book.id}?p=${p.id}`)}
                >
                  <span className="reading-card-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="reading-card-title">
                    <b>{p.title}</b>
                    <small>
                      {t('reading.progress', { done: p.answered, total: p.questionCount })}
                    </small>
                  </span>
                  <span className="reading-card-bar"><i style={{ width: `${p.questionCount ? (p.answered / p.questionCount) * 100 : 0}%` }} /></span>
                </button>
              ))}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {t('reading.passages', { n: book.passages.length })}
              {' · '}
              {t('reading.progress', { done, total })}
            </p>
          </div>
        );
      })}
      <div className="tests-subjects">
        {list.map((subject) => {
          const tests = subject.Tests || subject.tests || [];
          const groups = groupTopics(tests);
          const questions = tests.reduce((sum, test) => sum + (test.questionCount || 0), 0);
          return (
            <div key={subject.id} className="card tests-subject">
              <div className="tests-subject-head">
                <div style={{ minWidth: 0 }}>
                  <h3>{subject.name}</h3>
                  {subject.description && <p className="muted">{subject.description}</p>}
                  <p className="muted tests-subject-meta">
                    {tests.length ? t('tests.summary', { t: tests.length, q: questions }) : t('tests.emptyBank')}
                  </p>
                </div>
                {tests.length > 0 && (
                  <button className="btn sm" type="button" onClick={() => open(subject, null)}>{t('tests.buildAll')}</button>
                )}
              </div>
              {groups.map((group, gi) => (
                <TopicGroup key={group.name || gi} group={group} open={groups.length === 1 || gi === 0} t={t} onPick={(test) => open(subject, test)} />
              ))}
            </div>
          );
        })}
      </div>
      {!list.length && <div className="empty">{t('tests.none')}</div>}
    </div>
  );
}
