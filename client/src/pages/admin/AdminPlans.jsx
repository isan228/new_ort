import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';

function emptyPlan() {
  return {
    _key: `new-${Date.now()}`,
    title: '',
    months: 1,
    price: 0,
    oldPrice: '',
    isActive: true,
    sortOrder: 0,
  };
}

function toInput(plan) {
  return {
    ...plan,
    _key: plan.id || plan._key,
    oldPrice: plan.oldPrice ?? '',
  };
}

export default function AdminPlans() {
  const { t } = useLang();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.plans()
      .then((data) => setPlans((data.plans || []).map(toInput)))
      .catch((err) => setError(err.message));
  }, []);

  function patch(key, field, value) {
    setPlans((list) => list.map((plan) => (
      plan._key === key ? { ...plan, [field]: value } : plan
    )));
  }

  async function save() {
    setError('');
    setMsg('');
    setBusy(true);
    try {
      const payload = plans.map((plan, i) => ({
        id: plan.id || undefined,
        title: String(plan.title || '').trim(),
        months: Number(plan.months),
        price: Number(plan.price),
        oldPrice: plan.oldPrice === '' || plan.oldPrice == null ? null : Number(plan.oldPrice),
        isActive: plan.isActive !== false,
        sortOrder: Number(plan.sortOrder) || i + 1,
      }));
      if (payload.some((plan) => !plan.title)) {
        throw new Error(t('admin.planNeedName'));
      }
      if (payload.some((plan) => !Number.isFinite(plan.price) || plan.price < 1)) {
        throw new Error(t('admin.planNeedPrice'));
      }
      const data = await adminApi.savePlans(payload);
      setPlans((data.plans || []).map(toInput));
      setMsg(t('admin.saved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.plans')}</h1>
          <p className="muted">{t('admin.plansHint')}</p>
        </div>
        <div className="row">
          <button className="btn ghost sm" type="button" onClick={() => setPlans((list) => [...list, emptyPlan()])}>
            {t('admin.addPlan')}
          </button>
          <button className="btn sm" type="button" disabled={busy} onClick={save}>
            {busy ? t('common.loading') : t('admin.savePlans')}
          </button>
        </div>
      </div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="err">{error}</p>}
      <div className="cards">
        {plans.map((plan) => (
          <div key={plan._key} className="card">
            <label className="field">
              <span>{t('admin.name')}</span>
              <input value={plan.title} onChange={(e) => patch(plan._key, 'title', e.target.value)} />
            </label>
            <label className="field">
              <span>{t('admin.planMonths')}</span>
              <input
                type="number"
                min="1"
                value={plan.months}
                onChange={(e) => patch(plan._key, 'months', e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('admin.price')}</span>
              <input
                type="number"
                min="1"
                value={plan.price}
                onChange={(e) => patch(plan._key, 'price', e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('admin.oldPrice')}</span>
              <input
                type="number"
                min="0"
                value={plan.oldPrice}
                placeholder="—"
                onChange={(e) => patch(plan._key, 'oldPrice', e.target.value)}
              />
            </label>
            <label className="exam-accept" style={{ margin: '8px 0 0' }}>
              <input
                type="checkbox"
                checked={plan.isActive !== false}
                onChange={(e) => patch(plan._key, 'isActive', e.target.checked)}
              />
              <span>{t('admin.planVisible')}</span>
            </label>
          </div>
        ))}
      </div>
      {!plans.length && <div className="empty">{t('admin.noPlans')}</div>}
    </div>
  );
}
