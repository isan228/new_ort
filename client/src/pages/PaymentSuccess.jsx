import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi, payApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AuthLayout, PublicShell } from '../components/Shells';
import SiteFooter from '../components/SiteFooter';
import { useLang } from '../context/LangContext';

function extractPaymentId(searchParams) {
  const direct = searchParams.get('paymentId') || searchParams.get('PaymentId');
  if (direct) return direct;
  const href = typeof window !== 'undefined' ? window.location.href : '';
  const match = href.match(/(?:\?|&)paymentId=([\da-f-]{8}-[\da-f-]{4}-[\da-f-]{4}-[\da-f-]{4}-[\da-f-]{12})/i);
  return match ? match[1] : '';
}

export default function PaymentSuccess() {
  const { t } = useLang();
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const [state, setState] = useState('wait');

  useEffect(() => {
    const paymentId = extractPaymentId(params);
    if (!paymentId) {
      setState('missing');
      return undefined;
    }

    let attempts = 0;
    let timer;

    async function tick() {
      try {
        const data = await payApi.status(paymentId);
        if (data.paid) {
          if (user || (typeof localStorage !== 'undefined' && localStorage.getItem('ort_token'))) {
            try {
              const me = await authApi.me();
              setUser(me.user);
            } catch {
              /* session may be missing after redirect */
            }
          }
          setState('ok');
          return;
        }
        if (data.status === 'failed') {
          setState('fail');
          return;
        }
      } catch {
        /* webhook may arrive a moment later */
      }
      attempts += 1;
      if (attempts > 20) {
        setState('wait-long');
        return;
      }
      timer = setTimeout(tick, 2000);
    }

    tick();
    return () => clearTimeout(timer);
  }, [params, setUser]);

  return (
    <PublicShell>
      <AuthLayout title={t('pay.resultTitle')}>
        <div className="cl-auth-card">
          {state === 'ok' && <p className="ok">{t('pay.resultOk')}</p>}
          {state === 'fail' && <p className="err">{t('pay.resultFail')}</p>}
          {state === 'missing' && <p className="err">{t('pay.resultMissing')}</p>}
          {(state === 'wait' || state === 'wait-long') && <p className="muted">{t('pay.resultWait')}</p>}
          {state === 'wait-long' && <p className="muted">{t('pay.resultLater')}</p>}
          <div className="cl-auth-actions">
            <Link className="btn" to={user ? '/app' : '/login'}>{user ? t('nav.cabinet') : t('common.enter')}</Link>
            <Link className="btn ghost" to="/pricing">{t('nav.pricing')}</Link>
          </div>
        </div>
      </AuthLayout>
      <SiteFooter cta={false} />
    </PublicShell>
  );
}
