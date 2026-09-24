import { useLang } from '../context/LangContext';

export default function PlanPicker({ plans, selectedId, onSelect }) {
  const { t } = useLang();
  return (
    <div className="grid-3">
      {(plans || []).map((plan) => (
        <button
          key={plan.id}
          type="button"
          className={`card plan-card ${selectedId === plan.id ? 'on' : ''}`}
          onClick={() => onSelect(plan)}
        >
          {selectedId === plan.id && <span className="badge brand">{t('pay.chosen')}</span>}
          <strong style={{ display: 'block', fontSize: 20, margin: '8px 0 6px' }}>{plan.title}</strong>
          <b style={{ fontSize: 32 }}>{plan.price} {t('common.som')}</b>
          {plan.oldPrice ? <p className="muted"><s>{plan.oldPrice} {t('common.som')}</s></p> : null}
          <p className="muted">{t('pay.full')}</p>
        </button>
      ))}
    </div>
  );
}
