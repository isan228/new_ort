import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, payApi } from '../api/client';
import PromoField, { promoErrorText } from '../components/PromoField';
import CoinsToggle from '../components/CoinsToggle';
import { promoApplies } from '../lib/promo';
import { useAuth } from '../context/AuthContext';
import { AuthLayout, PublicShell } from '../components/Shells';
import SiteFooter from '../components/SiteFooter';
import PlanPicker from '../components/PlanPicker';
import { useLang } from '../context/LangContext';
import { startCheckout } from '../lib/checkout';

function Plans({ wrap }) {
  const { user, setUser } = useAuth();
  const { t, locale } = useLang();
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(user?.subscriptionPlanId || null);
  const [promo, setPromo] = useState(null);
  const [useCoins, setUseCoins] = useState(false);
  const coins = user && useCoins ? user.coins || 0 : 0;

  useEffect(() => {
    payApi.plans()
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans([]));
  }, []);

  async function go(plan) {
    setSelectedId(plan.id);
    const promoCode = promoApplies(promo, plan) ? promo.code : undefined;
    if (!user) {
      navigate(`/register?plan=${plan.id}${promoCode ? `&promo=${encodeURIComponent(promoCode)}` : ''}`);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const result = await startCheckout(plan, { setUser, promoCode, useCoins: coins > 0 });
      if (result === 'demo') navigate('/app/profile');
    } catch (err) {
      if (err instanceof ApiError && err.code?.startsWith('PROMO_')) {
        setPromo(null);
        setError(promoErrorText(t, err));
      } else {
        setError(err.message === 'no-url' ? t('pay.noUrl') : err.message);
      }
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
      <PromoField promo={promo} onChange={setPromo} />
      {user && <CoinsToggle balance={user.coins || 0} checked={useCoins} onChange={setUseCoins} />}
      <PlanPicker plans={plans} selectedId={selectedId} onSelect={go} promo={promo} coins={coins} />
      {user && (
        <p className="muted" style={{ marginTop: 16 }}>{busy ? t('common.loading') : t('pay.renewHint')}</p>
      )}
    </>
  );

  if (wrap === 'public') {
    return (
      <PublicShell>
        <AuthLayout wide title={t('pay.title')} hint={t('pay.one')}>
          {error && <p className="err">{error}</p>}
          <PromoField promo={promo} onChange={setPromo} />
          <PlanPicker plans={plans} selectedId={selectedId} onSelect={go} promo={promo} />
        </AuthLayout>
        <SiteFooter />
      </PublicShell>
    );
  }
  return inner;
}

export default function Subscriptions() {
  return <Plans />;
}

export function PricingPublic() {
  return <Plans wrap="public" />;
}
