import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';
import { useLang } from '../context/LangContext';

function formatOrt(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return String(value).replace('.', ',');
}

export default function History() {
  const { t, locale } = useLang();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    authApi.stats()
      .then((d) => setRows(d.history || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>{t('history.title')}</h1>
      <p className="muted">{t('stats.pastLead')}</p>
      {error && <p className="err">{error}</p>}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('history.date')}</th>
              <th>{t('history.score')}</th>
              <th>{t('history.acc')}</th>
              <th>{t('stats.kind')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString(locale)}</td>
                <td>
                  {r.officialScore != null
                    ? `${formatOrt(r.officialScore)}${r.maxScore ? ` / ${r.maxScore}` : ''}`
                    : `${r.score}/${r.total}`}
                </td>
                <td>{r.accuracy}%</td>
                <td>{r.examType === 'main' ? t('sim.title') : (r.testName || t('results.session'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty">
          {t('history.empty')} <Link to="/app/tests">{t('tests.start')}</Link>
        </div>
      )}
    </div>
  );
}
