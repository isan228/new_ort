import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import { useLang } from '../../context/LangContext';
import { Modal, confirmDelete } from './adminUi';

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(value, endOfDay) {
  if (!value) return null;
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`).toISOString();
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function promoStatus(promo) {
  const now = Date.now();
  if (!promo.isActive) return 'off';
  if (promo.endsAt && new Date(promo.endsAt).getTime() < now) return 'expired';
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) return 'exhausted';
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now) return 'scheduled';
  return 'active';
}

function emptyForm() {
  const today = toDateInput(new Date());
  const month = new Date();
  month.setMonth(month.getMonth() + 1);
  return {
    code: randomCode(),
    discountType: 'percent',
    discountValue: 10,
    startsAt: today,
    endsAt: toDateInput(month),
    maxUses: 100,
    planIds: [],
    isActive: true,
    note: '',
  };
}

function toForm(promo) {
  return {
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    startsAt: toDateInput(promo.startsAt),
    endsAt: toDateInput(promo.endsAt),
    maxUses: promo.maxUses ?? '',
    planIds: promo.planIds || [],
    isActive: promo.isActive,
    note: promo.note || '',
  };
}

function PromoForm({ initial, plans, onSave, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  function togglePlan(id) {
    set('planIds', form.planIds.includes(id) ? form.planIds.filter((x) => x !== id) : [...form.planIds, id]);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSave({
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        startsAt: fromDateInput(form.startsAt, false),
        endsAt: fromDateInput(form.endsAt, true),
        maxUses: form.maxUses === '' ? null : Number(form.maxUses),
        planIds: form.planIds,
        isActive: form.isActive,
        note: form.note,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span>{t('admin.promo.code')}</span>
        <div className="promo-row">
          <input
            value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s+/g, ''))}
            maxLength={40}
            spellCheck={false}
            required
          />
          <button className="btn ghost sm" type="button" onClick={() => set('code', randomCode())}>
            {t('admin.promo.generate')}
          </button>
        </div>
      </label>
      <div className="promo-form-grid">
        <label className="field">
          <span>{t('admin.promo.type')}</span>
          <select value={form.discountType} onChange={(e) => set('discountType', e.target.value)}>
            <option value="percent">{t('admin.promo.percent')}</option>
            <option value="fixed">{t('admin.promo.fixed')}</option>
          </select>
        </label>
        <label className="field">
          <span>{form.discountType === 'percent' ? t('admin.promo.valuePercent') : t('admin.promo.valueFixed')}</span>
          <input
            type="number"
            min="1"
            max={form.discountType === 'percent' ? 100 : undefined}
            value={form.discountValue}
            onChange={(e) => set('discountValue', e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>{t('admin.promo.from')}</span>
          <input type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
        </label>
        <label className="field">
          <span>{t('admin.promo.until')}</span>
          <input type="date" value={form.endsAt} min={form.startsAt || undefined} onChange={(e) => set('endsAt', e.target.value)} />
        </label>
        <label className="field">
          <span>{t('admin.promo.maxUses')}</span>
          <input
            type="number"
            min="1"
            value={form.maxUses}
            placeholder={t('admin.promo.unlimited')}
            onChange={(e) => set('maxUses', e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('admin.promo.note')}</span>
          <input value={form.note} maxLength={300} placeholder={t('admin.promo.notePh')} onChange={(e) => set('note', e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span>{t('admin.promo.plans')}</span>
        <div className="promo-plan-list">
          {plans.map((plan) => (
            <label key={plan.id} className={`promo-plan-opt ${form.planIds.includes(plan.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={form.planIds.includes(plan.id)} onChange={() => togglePlan(plan.id)} />
              <span>{plan.title} · {plan.price} {t('common.som')}</span>
            </label>
          ))}
        </div>
        <small className="muted">{t('admin.promo.plansHint')}</small>
      </div>
      <label className="exam-accept" style={{ margin: '4px 0 12px' }}>
        <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
        <span>{t('admin.promo.active')}</span>
      </label>
      {error && <p className="err">{error}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" type="button" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn" type="submit" disabled={busy}>{busy ? t('common.loading') : t('common.save')}</button>
      </div>
    </form>
  );
}

export default function AdminPromos() {
  const { t, locale } = useLang();
  const [promos, setPromos] = useState(null);
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    adminApi.promos().then((d) => setPromos(d.promos || [])).catch((err) => { setError(err.message); setPromos([]); });
    adminApi.plans().then((d) => setPlans(d.plans || [])).catch(() => setPlans([]));
  }, []);

  const planTitle = (id) => plans.find((p) => p.id === id)?.title || `#${id}`;
  const fmt = (value) => (value ? new Date(value).toLocaleDateString(locale) : '—');

  async function save(body) {
    const data = editing === 'new'
      ? await adminApi.createPromo(body)
      : await adminApi.updatePromo(editing.id, body);
    setPromos((list) => (editing === 'new'
      ? [data.promo, ...list]
      : list.map((p) => (p.id === data.promo.id ? data.promo : p))));
    setEditing(null);
  }

  async function remove(promo) {
    if (!confirmDelete(t)) return;
    try {
      await adminApi.deletePromo(promo.id);
      setPromos((list) => list.filter((p) => p.id !== promo.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function copyLink(promo) {
    const url = `${window.location.origin}/register?promo=${encodeURIComponent(promo.code)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(promo.id);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      window.prompt(t('admin.promo.link'), url);
    }
  }

  return (
    <div>
      <div className="admin-section-head" style={{ marginTop: 0 }}>
        <div>
          <h1>{t('admin.promo.title')}</h1>
          <p className="muted">{t('admin.promo.hint')}</p>
        </div>
        <button className="btn sm" type="button" onClick={() => setEditing('new')}>{t('admin.promo.add')}</button>
      </div>
      {error && <p className="err">{error}</p>}
      {promos == null && <p className="muted">{t('common.loading')}</p>}
      {promos && !promos.length && <div className="empty">{t('admin.promo.empty')}</div>}
      <div className="promo-list">
        {(promos || []).map((promo) => {
          const status = promoStatus(promo);
          const limit = promo.maxUses;
          const pct = limit ? Math.min(100, Math.round((promo.usedCount / limit) * 100)) : 0;
          return (
            <div key={promo.id} className={`card promo-card ${status}`}>
              <div className="promo-card-head">
                <span className="promo-chip lg">{promo.code}</span>
                <b className="promo-off">
                  {promo.discountType === 'percent' ? `−${promo.discountValue}%` : `−${promo.discountValue} ${t('common.som')}`}
                </b>
                <span className={`promo-status ${status}`}>{t(`admin.promo.status.${status}`)}</span>
              </div>
              {promo.note && <p className="muted promo-note">{promo.note}</p>}
              <div className="promo-meta">
                <span>{t('admin.promo.period')}: <b>{fmt(promo.startsAt)} — {fmt(promo.endsAt)}</b></span>
                <span>
                  {t('admin.promo.plans')}:{' '}
                  <b>{promo.planIds?.length ? promo.planIds.map(planTitle).join(', ') : t('admin.promo.allPlans')}</b>
                </span>
              </div>
              <div className="promo-usage">
                <div className="promo-usage-top">
                  <span>
                    {t('admin.promo.used')}: <b>{promo.usedCount}{limit ? ` / ${limit}` : ''}</b>
                    {!limit && <span className="muted"> ({t('admin.promo.unlimited')})</span>}
                  </span>
                  {promo.reserved > 0 && <span className="muted">{t('admin.promo.reserved', { n: promo.reserved })}</span>}
                </div>
                {limit ? <div className="promo-bar"><i style={{ width: `${pct}%` }} /></div> : null}
                <div className="muted promo-money">
                  {t('admin.promo.revenue', { sum: promo.revenue, off: promo.discounted })}
                </div>
              </div>
              <div className="row promo-actions">
                <button className="btn ghost sm" type="button" onClick={() => copyLink(promo)}>
                  {copied === promo.id ? t('admin.promo.copied') : t('admin.promo.copyLink')}
                </button>
                <button className="btn ghost sm" type="button" onClick={() => setEditing(promo)}>{t('common.edit')}</button>
                <button className="btn ghost sm" type="button" onClick={() => remove(promo)}>{t('common.delete')}</button>
              </div>
            </div>
          );
        })}
      </div>
      {editing && (
        <Modal
          title={editing === 'new' ? t('admin.promo.add') : t('admin.promo.edit')}
          onClose={() => setEditing(null)}
        >
          <PromoForm
            initial={editing === 'new' ? emptyForm() : toForm(editing)}
            plans={plans}
            onSave={save}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
