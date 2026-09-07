import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { payApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PublicShell } from '../components/Shells';
import { useLang } from '../context/LangContext';

function Plans({ wrap }) {
  const { user, setUser } = useAuth();
  const { t, locale } = useLang();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { payApi.plans().then((d) => setPlans(d.plans || [])); }, []);

  async function buy(plan) {
    if (!user) {
      navigate('/register');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const created = await payApi.create(plan.id);
      if (created.paymentUrl) {
        window.location.href = created.paymentUrl;
        return;
      }
      if (created.demo) {
        const confirmed = await payApi.confirmDemo(created.payment.id);
        setUser(confirmed.user);
        navigate('/app');
        return;
      }
      setError(t('pay.noUrl'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const inner = (
    <>
      <h1>{t('pay.title')}</h1>
      <p className="muted">
        {user?.subscriptionActive
          ? t('pay.active', { date: new Date(user.subscriptionEndDate).toLocaleDateString(locale) })
          : t('pay.one')}
      </p>
      {error && <p className="err">{error}</p>}
      <div className="grid-3">
        <div className="card">
          <h3>{t('pay.free')}</h3>
          <b style={{ fontSize: 28 }}>0 {t('common.som')}</b>
          <p className="muted">{t('pay.freeText')}</p>
          <button className="btn ghost" type="button" disabled>{t('pay.limit')}</button>
        </div>
        {plans.map((plan, i) => (
          <div key={plan.id} className="card" style={i === 1 ? { borderColor: 'var(--brand)' } : undefined}>
            {i === 1 && <span className="badge brand">Premium</span>}
            <h3>{plan.title}</h3>
            <b style={{ fontSize: 32 }}>{plan.price} {t('common.som')}</b>
            {plan.oldPrice && <p className="muted"><s>{plan.oldPrice} {t('common.som')}</s></p>}
            <p className="muted">{t('pay.full')}</p>
            <button className="btn" type="button" disabled={busy} onClick={() => buy(plan)}>{t('pay.start')}</button>
          </div>
        ))}
      </div>
    </>
  );

  if (wrap === 'public') return <PublicShell><div className="page">{inner}</div></PublicShell>;
  return inner;
}

export default function Subscriptions() {
  return <Plans />;
}

export function PricingPublic() {
  return <Plans wrap="public" />;
}
