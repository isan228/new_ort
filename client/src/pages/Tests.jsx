import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';

export default function Tests() {
  const { t } = useLang();
  const [data, setData] = useState({ main: [], state_lang: [], subject: [] });
  const [cat, setCat] = useState('all');
  const [error, setError] = useState('');
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
  }, [navigate]);

  const list = cat === 'all'
    ? [...(data.main || []), ...(data.state_lang || []), ...(data.subject || [])]
    : (data[cat] || []);

  function open(subject) {
    const test = (subject.Tests || subject.tests || [])[0];
    setBank({
      subjectId: subject.id,
      testId: test?.id || null,
      name: subject.name,
      testName: test?.name,
      trackGroup: subject.trackGroup,
    });
    navigate(test ? `/app/create?bank=${test.id}` : '/app/create');
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
      <div className="cards">
        {list.map((subject) => {
          const tests = subject.Tests || subject.tests || [];
          return (
            <div key={subject.id} className="card">
              <h3>{subject.name}</h3>
              <p className="muted">{subject.description}</p>
              <p className="muted">{tests.length ? t('tests.ready') : t('tests.emptyBank')}</p>
              <button className="btn" type="button" onClick={() => open(subject)} disabled={!tests.length}>{t('tests.start')}</button>
            </div>
          );
        })}
      </div>
      {!list.length && <div className="empty">{t('tests.none')}</div>}
    </div>
  );
}
