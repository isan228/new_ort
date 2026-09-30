import { payApi } from '../api/client';

const PENDING_KEY = 'ortPendingPayment';

export function rememberPendingPayment(paymentId, claim) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ paymentId, claim, at: Date.now() }));
  } catch {
    /* storage may be unavailable */
  }
}

export function readPendingPayment() {
  try {
    const data = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    if (!data?.paymentId) return null;
    if (Date.now() - (data.at || 0) > 24 * 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export async function startCheckout(plan, { setUser, promoCode } = {}) {
  const created = await payApi.create(plan.id, promoCode);
  if (created.free) {
    if (setUser) setUser(created.user);
    return 'demo';
  }
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
