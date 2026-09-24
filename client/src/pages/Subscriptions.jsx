import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { payApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PublicShell } from '../components/Shells';
import PlanPicker from '../components/PlanPicker';
import { useLang } from '../context/LangContext';
import { startCheckout } from '../lib/checkout';

function Plans({ wrap }) {
  const { user, setUser } = useAuth();
  const { t, locale } = useLang();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(user?.subscriptionPlanId || null);

  useEffect(() => { payApi.plans().then((d) => setPlans(d.plans || [])); }, []);

  async function go(plan) {
    setSelectedId(plan.id);
    if (!user) {
      navigate(`/register?plan=${plan.id}`);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const result = await startCheckout(plan, { setUser });
      if (result === 'demo') navigate('/app/profile');
    } catch (err) {
      setError(err.message === 'no-url' ? t('pay.noUrl') : err.message);
    } finally {
      setBusy(false);
    }
  }

  const inner = (
    <>
      <h1>{user ? t('pay.renewTitle') : t('pay.title')}</h1>
      <p className="muted">
        {user?.subscriptionActive
          ? t('pay.active', { date: new Date(user.subscriptionEndDate).toLocaleDateString(locale) })
          : t('pay.one')}
      </p>
      {error && <p className="err">{error}</p>}
      <PlanPicker plans={plans} selectedId={selectedId} onSelect={go} />
      {user && (
        <p className="muted" style={{ marginTop: 16 }}>{busy ? t('common.loading') : t('pay.renewHint')}</p>
      )}
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
