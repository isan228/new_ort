import { useLang } from '../context/LangContext';
import { checkoutPrice, promoPrice } from '../lib/promo';

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M5 12.5 9.5 17 19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PlanPicker({ plans, selectedId, onSelect, promo = null, coins = 0 }) {
  const { t, copy } = useLang();
  const perks = (copy.land.features || []).slice(0, 4).map((f) => f.title);

  if (plans == null) {
    return (
      <div className="plan-grid">
        {[0, 1, 2].map((i) => <div key={i} className="plan-card plan-skeleton" aria-hidden="true" />)}
      </div>
    );
  }

  if (plans.length === 0) {
    return <div className="plan-empty">{t('pay.noPlans')}</div>;
  }

  return (
    <div className="plan-grid">
      {plans.map((plan) => {
        const on = selectedId === plan.id;
        const promoted = promoPrice(promo, plan);
        const { afterPromo, coinsUsed, total: price } = checkoutPrice(plan, promo, coins);
        const was = promoted != null || coinsUsed ? plan.price : plan.oldPrice;
        const discount = was && was > afterPromo ? Math.round((1 - afterPromo / was) * 100) : 0;
        return (
          <button
            key={plan.id}
            type="button"
            className={`plan-card ${on ? 'on' : ''}`}
            onClick={() => onSelect(plan)}
          >
            <div className="plan-card-top">
              <strong>{plan.title}</strong>
              {discount > 0 && (
                <span className={`plan-discount ${promoted != null ? 'promo' : ''}`}>
                  {promoted != null ? `${promo.code} ` : ''}−{discount}%
                </span>
              )}
            </div>
            <div className="plan-price">
              <b>{price}</b>
              <span>{t('common.som')}</span>
              {was && was > price ? <s>{was} {t('common.som')}</s> : null}
            </div>
            {coinsUsed > 0 && (
              <div className="plan-coins"><i className="coin-dot" />{t('coins.minus', { n: coinsUsed })}</div>
            )}
            <p className="plan-desc">{t('pay.full')}</p>
            <ul className="plan-perks">
              {perks.map((perk) => (
                <li key={perk}><Check />{perk}</li>
              ))}
            </ul>
            <span className="plan-cta">{on ? t('pay.chosen') : t('pay.start')}</span>
          </button>
        );
      })}
    </div>
  );
}
