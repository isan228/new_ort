import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi, payApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AuthLayout, PublicShell } from '../components/Shells';
import SiteFooter from '../components/SiteFooter';
import { useLang } from '../context/LangContext';
import { clearPendingPayment, readPendingPayment } from '../lib/checkout';

function extractPaymentId(searchParams) {
  const direct = searchParams.get('paymentId') || searchParams.get('PaymentId');
  if (direct) return direct;
  const href = typeof window !== 'undefined' ? window.location.href : '';
  const match = href.match(/(?:\?|&)paymentId=([\da-f-]{8}-[\da-f-]{4}-[\da-f-]{4}-[\da-f-]{4}-[\da-f-]{12})/i);
  return match ? match[1] : '';
}

export default function PaymentSuccess() {
  const { t } = useLang();
  const { user, setUser, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState('wait');
  const [signup, setSignup] = useState(false);

  useEffect(() => {
    const pending = readPendingPayment();
    const paymentId = extractPaymentId(params) || pending?.paymentId || '';
    if (!paymentId) {
      setState('missing');
      return undefined;
    }
    const claim = pending && pending.paymentId === paymentId ? pending.claim : '';
    setSignup(!!claim);

    let attempts = 0;
    let timer;
    let stopped = false;

    async function tick() {
      try {
        const data = await payApi.status(paymentId, claim);
        if (stopped) return;
        if (data.paid) {
          if (data.token) {
            signIn(data.token, data.user);
            clearPendingPayment();
            setState('created');
            timer = setTimeout(() => navigate('/app', { replace: true }), 1500);
            return;
          }
          if (localStorage.getItem('ort_token')) {
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
          clearPendingPayment();
          setState('fail');
          return;
        }
      } catch {
        /* webhook may arrive a moment later */
      }
      attempts += 1;
      if (attempts > 30) {
        setState('wait-long');
        return;
      }
      timer = setTimeout(tick, 2000);
    }

    tick();
    return () => { stopped = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <PublicShell>
      <AuthLayout title={t('pay.resultTitle')}>
        <div className="cl-auth-card">
          {state === 'created' && <p className="ok">{t('pay.resultCreated')}</p>}
          {state === 'ok' && <p className="ok">{t('pay.resultOk')}</p>}
          {state === 'fail' && <p className="err">{signup ? t('pay.resultFailSignup') : t('pay.resultFail')}</p>}
          {state === 'missing' && <p className="err">{t('pay.resultMissing')}</p>}
          {(state === 'wait' || state === 'wait-long') && <p className="muted">{t('pay.resultWait')}</p>}
          {state === 'wait-long' && <p className="muted">{t('pay.resultLater')}</p>}
          <div className="cl-auth-actions">
            {state === 'fail' && signup ? (
              <Link className="btn" to="/register">{t('pay.tryAgain')}</Link>
            ) : (
              <Link className="btn" to={user ? '/app' : '/login'}>{user ? t('nav.cabinet') : t('common.enter')}</Link>
            )}
            <Link className="btn ghost" to="/pricing">{t('nav.pricing')}</Link>
          </div>
        </div>
      </AuthLayout>
      <SiteFooter cta={false} />
    </PublicShell>
  );
}
