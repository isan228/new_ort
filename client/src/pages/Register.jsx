import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, payApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { AuthLayout, PublicShell } from '../components/Shells';
import SiteFooter from '../components/SiteFooter';
import PlanPicker from '../components/PlanPicker';
import PromoField from '../components/PromoField';
import { rememberPendingPayment, startCheckout } from '../lib/checkout';
import { promoPrice } from '../lib/promo';

const FIELD_BY_CODE = {
  NAME_REQUIRED: 'name',
  LOGIN_REQUIRED: 'login',
  LOGIN_INVALID: 'login',
  LOGIN_TAKEN: 'login',
  PASSWORD_REQUIRED: 'password',
  PASSWORD_SHORT: 'password',
};

export default function Register() {
  const { user, register, setUser } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState(null);
  const [planId, setPlanId] = useState(() => Number(params.get('plan')) || null);
  const ref = params.get('ref') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ortRef') : '') || '';
  const [step, setStep] = useState(() => (params.get('plan') ? 'form' : 'plan'));
  const [form, setForm] = useState({ name: '', login: '', password: '', grade: 11, language: lang });
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [promo, setPromo] = useState(null);
  const [promoSeed, setPromoSeed] = useState(() => params.get('promo') || '');

  useEffect(() => {
    if (params.get('ref')) sessionStorage.setItem('ortRef', params.get('ref'));
    payApi.plans()
      .then((data) => setPlans(data.plans || []))
      .catch(() => setPlans([]));
  }, [params]);

  const selected = (plans || []).find((plan) => plan.id === planId) || null;
  const promoted = promoPrice(promo, selected);
  const promoCode = promoted != null ? promo.code : undefined;

  function pickPlan(plan) {
    setPlanId(plan.id);
    setError('');
    setErrorCode('');
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErr[key]) setFieldErr((fe) => ({ ...fe, [key]: '' }));
  }

  function errText(code) {
    const key = `auth.err.${code}`;
    const text = t(key);
    return text === key ? t('auth.err.UNKNOWN') : text;
  }

  function validate() {
    const next = {};
    const loginValue = form.login.trim();
    if (!form.name.trim()) next.name = errText('NAME_REQUIRED');
    if (!loginValue) next.login = errText('LOGIN_REQUIRED');
    if (!form.password) next.password = errText('PASSWORD_REQUIRED');
    return next;
  }

  function showError(err) {
    const code = err instanceof ApiError
      ? (err.code || (err.status === 409 ? 'LOGIN_TAKEN' : ''))
      : (err instanceof TypeError ? 'NETWORK' : '');
    if (err?.message === 'no-url') {
      setError(errText('PAYMENT_FAILED'));
      setErrorCode('PAYMENT_FAILED');
      return;
    }
    if (code.startsWith('PROMO_')) {
      setPromo(null);
      setError(t(`promo.err.${code}`));
      setErrorCode(code);
      return;
    }
    const field = FIELD_BY_CODE[code];
    if (field) {
      setFieldErr({ [field]: errText(code) });
      setErrorCode(code);
      return;
    }
    if (code === 'PLAN_REQUIRED' || code === 'PLAN_NOT_FOUND') setStep('plan');
    setError(code ? errText(code) : (err?.message || errText('UNKNOWN')));
    setErrorCode(code);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setErrorCode('');
    if (!selected) {
      setError(errText('PLAN_REQUIRED'));
      setStep('plan');
      return;
    }
    if (!user) {
      const invalid = validate();
      setFieldErr(invalid);
      if (Object.keys(invalid).length) return;
    }
    setBusy(true);
    try {
      if (user) {
        const result = await startCheckout(selected, { setUser, promoCode });
        if (result === 'demo') navigate('/app');
        return;
      }
      const data = await register({ ...form, language: lang, planId: selected.id, ref: ref || undefined, promoCode });
      if (data.token) {
        navigate('/app');
        return;
      }
      if (!data.paymentUrl) throw new Error('no-url');
      rememberPendingPayment(data.paymentId, data.claim);
      window.location.href = data.paymentUrl;
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <AuthLayout
        wide={step === 'plan'}
        title={t('auth.registerTitle')}
        hint={step === 'plan' ? t('auth.pickPlanHint') : t('auth.registerHint')}
      >
          {step === 'plan' && (
            <>
              <PlanPicker plans={plans} selectedId={planId} onSelect={pickPlan} promo={promo} />
              <PromoField promo={promo} onChange={setPromo} initialCode={promoSeed} onInitialDone={() => setPromoSeed('')} />
              {error && <div className="form-alert" role="alert">{error}</div>}
              <div className="cl-auth-actions">
                <button className="btn lg" type="button" disabled={!selected} onClick={() => setStep('form')}>
                  {t('auth.toForm')}
                </button>
                <Link to="/login">{t('auth.haveAccount')}</Link>
              </div>
            </>
          )}
          {step === 'form' && (
            <form className="cl-auth-card" onSubmit={onSubmit}>
              {selected && (
                <div className="cl-auth-plan">
                  <div>
                    <span>{t('auth.yourPlan')}</span>
                    <b>
                      {selected.title} · {promoted ?? selected.price} {t('common.som')}
                      {promoted != null && <s className="promo-was">{selected.price} {t('common.som')}</s>}
                    </b>
                  </div>
                  <button className="btn ghost sm" type="button" onClick={() => setStep('plan')}>
                    {t('auth.changePlan')}
                  </button>
                </div>
              )}
              <PromoField promo={promo} onChange={setPromo} initialCode={promoSeed} onInitialDone={() => setPromoSeed('')} />
              {promo && selected && promoted == null && <small className="field-error">{t('promo.err.PROMO_PLAN')}</small>}
              <label className={`field ${fieldErr.name ? 'has-error' : ''}`}>
                <span>{t('common.name')}</span>
                <input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  autoComplete="name"
                  aria-invalid={!!fieldErr.name}
                />
                {fieldErr.name && <small className="field-error">{fieldErr.name}</small>}
              </label>
              <label className={`field ${fieldErr.login ? 'has-error' : ''}`}>
                <span>{t('common.login')}</span>
                <input
                  value={form.login}
                  onChange={(e) => setField('login', e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={!!fieldErr.login}
                />
                {fieldErr.login && (
                  <small className="field-error">
                    {fieldErr.login}
                    {errorCode === 'LOGIN_TAKEN' && <> <Link to="/login">{t('auth.signIn')}</Link></>}
                  </small>
                )}
              </label>
              <label className={`field ${fieldErr.password ? 'has-error' : ''}`}>
                <span>{t('common.password')}</span>
                <input
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!fieldErr.password}
                />
                {fieldErr.password && <small className="field-error">{fieldErr.password}</small>}
              </label>
              <label className="field">
                <span>{t('auth.grade')}</span>
                <select value={form.grade} onChange={(e) => setField('grade', Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={11}>11</option>
                </select>
              </label>
              {error && <div className="form-alert" role="alert">{error}</div>}
              <button className="btn lg cl-auth-submit" type="submit" disabled={busy}>
                {busy ? t('common.loading') : t('auth.payAndStart')}
              </button>
              <p className="cl-auth-alt"><Link to="/login">{t('auth.haveAccount')}</Link></p>
            </form>
          )}
      </AuthLayout>
      <SiteFooter cta={false} />
    </PublicShell>
  );
}
