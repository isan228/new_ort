import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ortApi } from '../api/client';
import { isOrtGate } from '../context/AuthContext';
import { useBank } from '../context/BankContext';
import { useLang } from '../context/LangContext';

export default function History() {
  const { bank } = useBank();
  const { t, locale } = useLang();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!bank?.testId) return;
    ortApi.history(bank.testId)
      .then((d) => setRows(d.history || []))
      .catch((err) => { if (isOrtGate(err)) navigate('/app/premium'); });
  }, [bank, navigate]);

  return (
    <div>
      <h1>{t('history.title')}</h1>
      {!bank?.testId && <p className="muted">{t('history.pick')} <Link to="/app/tests">{t('history.tests')}</Link>.</p>}
      <div className="table-scroll">
        <table className="table">
          <thead><tr><th>{t('history.date')}</th><th>{t('history.score')}</th><th>{t('history.acc')}</th><th>{t('history.mode')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString(locale)}</td>
                <td>{r.score}/{r.total}</td>
                <td>{r.accuracy}%</td>
                <td>{r.questionMode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="empty">{t('history.empty')}</div>}
    </div>
  );
}
