import { payApi } from '../api/client';

export async function startCheckout(plan, { setUser } = {}) {
  const created = await payApi.create(plan.id);
  if (created.paymentUrl) {
    window.location.href = created.paymentUrl;
    return 'redirect';
  }
  if (created.demo) {
    const confirmed = await payApi.confirmDemo(created.payment.id);
    if (setUser) setUser(confirmed.user);
    return 'demo';
  }
  throw new Error('no-url');
}
