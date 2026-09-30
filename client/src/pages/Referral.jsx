import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Referral() {
  const { t, locale } = useLang();
  const { user, setUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    authApi.referral()
      .then((next) => {
        setData(next);
        if (user && next.coins !== user.coins) setUser({ ...user, coins: next.coins });
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const code = data?.code || '—';
  const link = `${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
  const invited = data?.invited || 0;
  const goal = data?.goal || 5;
  const pct = Math.min(100, (invited / goal) * 100);
  const perFriend = data?.coinsPerFriend || 50;
  const history = data?.coinHistory || [];

  function reasonText(row) {
    const key = `coins.reason.${row.reason}`;
    const text = t(key, { name: row.friend || t('coins.friend') });
    return text === key ? row.reason : text;
  }

  return (
    <div>
      <h1>{t('ref.title')}</h1>
      {error && <p className="err">{error}</p>}

      <div className="card coins-hero">
        <div className="coins-hero-balance">
          <i className="coin-dot xl" />
          <div>
            <span className="muted">{t('coins.balance')}</span>
            <b>{data?.coins ?? user?.coins ?? 0}</b>
          </div>
        </div>
        <div className="coins-hero-text">
          <h3>{t('coins.howTitle', { n: perFriend })}</h3>
          <p className="muted">{t('coins.howText', { n: perFriend })}</p>
          <Link className="btn sm" to="/app/premium">{t('coins.spend')}</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p className="muted">{t('ref.code')}</p>
        <h2>{code}</h2>
        <p className="muted ref-link">{link}</p>
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

      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t('coins.history')}</h3>
        {!history.length && <p className="muted">{t('coins.historyEmpty')}</p>}
        <div className="coins-history">
          {history.map((row) => (
            <div key={row.id} className="coins-history-row">
              <span>
                {reasonText(row)}
                <small className="muted">{new Date(row.createdAt).toLocaleDateString(locale)}</small>
              </span>
              <b className={row.amount > 0 ? 'ok' : 'err'}>{row.amount > 0 ? `+${row.amount}` : row.amount}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
