import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, payApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import PlanPicker from '../components/PlanPicker';
import { startCheckout } from '../lib/checkout';

export default function Profile() {
  const { user, setUser } = useAuth();
  const { t, locale } = useLang();
  const initial = (user?.name || 'У')[0];
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(user?.subscriptionPlanId || null);

  useEffect(() => {
    payApi.plans().then((d) => setPlans(d.plans || [])).catch((err) => setError(err.message));
    authApi.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const end = user?.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
  const active = !!user?.subscriptionActive;
  const title = user?.subscriptionTitle || t('profile.noPlan');

  async function renew(plan) {
    setSelectedId(plan.id);
    setError('');
    setBusy(true);
    try {
      const result = await startCheckout(plan, { setUser });
      if (result === 'demo') setError('');
    } catch (err) {
      setError(err.message === 'no-url' ? t('pay.noUrl') : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card row" style={{ gap: 16 }}>
        <span className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{initial}</span>
        <div>
          <h1>{user?.name}</h1>
          <p className="muted">{user?.login}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="muted">{t('profile.sub')}</div>
            <h2 style={{ margin: '6px 0 8px' }}>{title}</h2>
            {active && end && <p className="ok" style={{ margin: 0 }}>{t('profile.until', { date: end.toLocaleDateString(locale) })}</p>}
            {!active && end && <p className="err" style={{ margin: 0 }}>{t('profile.expired', { date: end.toLocaleDateString(locale) })}</p>}
            {!active && !end && <p className="muted" style={{ margin: 0 }}>{t('profile.needPay')}</p>}
          </div>
          <span className={`badge ${active ? 'ok' : 'bad'}`}>
            {active ? t('profile.active') : t('profile.inactive')}
          </span>
        </div>
        <h3 style={{ marginTop: 20 }}>{active ? t('profile.renew') : t('profile.buy')}</h3>
        <p className="muted">{t('pay.renewHint')}</p>
        {error && <p className="err">{error}</p>}
        <PlanPicker plans={plans} selectedId={selectedId} onSelect={renew} />
        {busy && <p className="muted" style={{ marginTop: 12 }}>{t('common.loading')}</p>}
      </div>

      <div className="grid-4" style={{ marginTop: 16 }}>
        <div className="card stat"><b>{stats?.bestOfficial || 0}</b><span className="muted">{t('profile.best')}</span></div>
        <div className="card stat"><b>{stats?.questions || 0}</b><span className="muted">{t('profile.questions')}</span></div>
        <div className="card stat"><b>{stats?.streak || 0}</b><span className="muted">{t('home.streak')}</span></div>
        <div className="card stat"><b>{stats?.achievementsOpen || 0}</b><span className="muted">{t('profile.ach')}</span></div>
      </div>
      <div style={{ marginTop: 16 }}><Link className="btn" to="/app/settings">{t('profile.settings')}</Link></div>
    </div>
  );
}
