import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { payApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { AuthLayout, PublicShell } from '../components/Shells';
import SiteFooter from '../components/SiteFooter';
import PlanPicker from '../components/PlanPicker';
import { startCheckout } from '../lib/checkout';

export default function Register() {
  const { register, setUser } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState(null);
  const [planId, setPlanId] = useState(() => Number(params.get('plan')) || null);
  const ref = params.get('ref') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ortRef') : '') || '';
  const [step, setStep] = useState(() => (params.get('plan') ? 'form' : 'plan'));
  const [form, setForm] = useState({ name: '', login: '', password: '', grade: 11, language: lang });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get('ref')) sessionStorage.setItem('ortRef', params.get('ref'));
    payApi.plans()
      .then((data) => setPlans(data.plans || []))
      .catch((err) => { setPlans([]); setError(err.message); });
  }, [params]);

  const selected = (plans || []).find((plan) => plan.id === planId) || null;

  function pickPlan(plan) {
    setPlanId(plan.id);
    setError('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!selected) {
      setError(t('auth.needPlan'));
      setStep('plan');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await register({ ...form, language: lang, planId: selected.id, ref: ref || undefined });
      const result = await startCheckout(selected, { setUser });
      if (result === 'demo') navigate('/app');
    } catch (err) {
      setError(err.message === 'no-url' ? t('pay.noUrl') : err.message);
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
              <PlanPicker plans={plans} selectedId={planId} onSelect={pickPlan} />
              {error && <p className="err">{error}</p>}
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
                    <b>{selected.title} · {selected.price} {t('common.som')}</b>
                  </div>
                  <button className="btn ghost sm" type="button" onClick={() => setStep('plan')}>
                    {t('auth.changePlan')}
                  </button>
                </div>
              )}
              <label className="field"><span>{t('common.name')}</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
              <label className="field"><span>{t('common.login')}</span><input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} autoComplete="username" required /></label>
              <label className="field"><span>{t('common.password')}</span><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" autoComplete="new-password" required /></label>
              <label className="field">
                <span>{t('auth.grade')}</span>
                <select value={form.grade} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}>
                  <option value={10}>10</option>
                  <option value={11}>11</option>
                </select>
              </label>
              {error && <p className="err">{error}</p>}
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
