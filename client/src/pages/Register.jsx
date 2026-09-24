import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { payApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { PublicShell } from '../components/Shells';
import PlanPicker from '../components/PlanPicker';
import { startCheckout } from '../lib/checkout';

export default function Register() {
  const { register, setUser } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState([]);
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
      .catch((err) => setError(err.message));
  }, [params]);

  const selected = plans.find((plan) => plan.id === planId) || null;

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
      <div className="page" style={{ maxWidth: step === 'plan' ? 960 : 440 }}>
        <div className={step === 'plan' ? '' : 'card'}>
          <h1>{t('auth.registerTitle')}</h1>
          <p className="muted">{step === 'plan' ? t('auth.pickPlanHint') : t('auth.registerHint')}</p>
          {step === 'plan' && (
            <>
              <PlanPicker plans={plans} selectedId={planId} onSelect={pickPlan} />
              {error && <p className="err">{error}</p>}
              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn lg" type="button" disabled={!selected} onClick={() => setStep('form')}>
                  {t('auth.toForm')}
                </button>
                <Link to="/login">{t('auth.haveAccount')}</Link>
              </div>
            </>
          )}
          {step === 'form' && (
            <form onSubmit={onSubmit}>
              {selected && (
                <div className="card" style={{ marginBottom: 16, padding: 14 }}>
                  <div className="muted">{t('auth.yourPlan')}</div>
                  <b>{selected.title}</b>
                  {' · '}
                  {selected.price} {t('common.som')}
                  <div>
                    <button className="btn ghost sm" type="button" onClick={() => setStep('plan')}>
                      {t('auth.changePlan')}
                    </button>
                  </div>
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
              <button className="btn lg" type="submit" disabled={busy} style={{ width: '100%' }}>
                {busy ? t('common.loading') : t('auth.payAndStart')}
              </button>
              <p style={{ marginTop: 14 }}><Link to="/login">{t('auth.haveAccount')}</Link></p>
            </form>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
