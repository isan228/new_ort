export function promoApplies(promo, plan) {
  if (!promo || !plan) return false;
  return !promo.planIds || promo.planIds.includes(plan.id);
}

export function promoPrice(promo, plan) {
  if (!promoApplies(promo, plan)) return null;
  const off = promo.discountType === 'fixed'
    ? promo.discountValue
    : Math.round((plan.price * promo.discountValue) / 100);
  return Math.max(0, plan.price - Math.min(plan.price, off));
}

export function promoLabel(promo, som) {
  return promo.discountType === 'fixed' ? `−${promo.discountValue} ${som}` : `−${promo.discountValue}%`;
}
