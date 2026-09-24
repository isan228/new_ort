import { useEffect, useState } from 'react';
import { authApi } from '../api/client';
import { useLang } from '../context/LangContext';

export default function Referral() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    authApi.referral().then(setData).catch((err) => setError(err.message));
  }, []);

  const code = data?.code || '—';
  const link = `${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
  const invited = data?.invited || 0;
  const goal = data?.goal || 5;
  const pct = Math.min(100, (invited / goal) * 100);

  return (
    <div>
      <h1>{t('ref.title')}</h1>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <p className="muted">{t('ref.code')}</p>
        <h2>{code}</h2>
        <button
          className="btn"
          type="button"
          disabled={!data?.code}
          onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }}
        >
          {copied ? t('ref.copied') : t('ref.copy')}
        </button>
      </div>
      <div className="grid-4" style={{ marginTop: 16 }}>
        <div className="card stat"><b>{invited}</b><span className="muted">{t('ref.invited')}</span></div>
        <div className="card stat"><b>{data?.registered || 0}</b><span className="muted">{t('ref.registered')}</span></div>
        <div className="card stat"><b>{data?.premiumFromRef || 0}</b><span className="muted">{t('ref.premium')}</span></div>
        <div className="card stat">
          <b>{data?.bonusDays || 7} {t('common.days')}</b>
          <span className="muted">{data?.bonusGranted ? t('ref.bonusDone') : t('ref.bonus')}</span>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t('ref.goal')}</h3>
        <div className="progress"><i style={{ width: `${pct}%` }} /></div>
        <p className="muted">{invited} / {goal}</p>
        {data?.bonusGranted && <p className="ok">{t('ref.bonusOk')}</p>}
      </div>
    </div>
  );
}
