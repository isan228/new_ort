const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const finik = require('../utils/finikClient');
const { isPaidStatus, isFailedStatus } = require('../utils/finikValidator');
const { tg, tgUpload } = require('../utils/telegram');
const { SbCheckout, SbUser } = require('./models');
const { loadConfig } = require('./config');
const { applyPurchase, REF_BONUS_DAYS } = require('./access');
const { getBotUsername, notifyAdmins } = require('./ctx');
const { MIN, humanDateTime } = require('./time');
const { btn, kb, send } = require('./ui');

const REUSE_MS = 30 * MIN;

class PayError extends Error {}

// Prices are free text like "300 сом"; Finik needs the number.
function tariffAmount(tariff) {
  const m = String(tariff?.price || '').replace(/\s/g, '').match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function onlinePayments(cfg) {
  return cfg.paymentsEnabled !== false && finik.isFinikConfigured();
}

async function startCheckout(user, days) {
  const cfg = await loadConfig();
  const tariff = cfg.tariffs.find((t) => t.days === days);
  const amount = tariffAmount(tariff);
  if (!tariff || !amount) throw new PayError('Цена тарифа ещё не задана. Напишите в поддержку.');

  // Tapping the same tariff again within half an hour reuses the open invoice instead of making a new one.
  const open = await SbCheckout.findOne({
    where: {
      userId: user.id, days, amount, status: 'pending', paymentUrl: { [Op.ne]: null }, createdAt: { [Op.gt]: new Date(Date.now() - REUSE_MS) },
    },
    order: [['id', 'DESC']],
  });
  if (open) return open;

  const checkout = await SbCheckout.create({ userId: user.id, days, amount, providerRef: crypto.randomUUID() });
  try {
    const result = await finik.createPayment({
      amount,
      paymentId: checkout.providerRef,
      redirectUrl: `https://t.me/${await getBotUsername()}`,
      webhookUrl: finik.webhookUrl(),
      accountId: finik.trimEnv('FINIK_ACCOUNT_ID'),
      nameEn: 'ORT KG',
      description: `Student Bot · ${days} дней`,
      lang: 'ru',
      extraData: { paymentType: 'studentbot', sbCheckoutId: String(checkout.id) },
    });
    await checkout.update({ paymentUrl: result.paymentUrl });
    return checkout;
  } catch (err) {
    console.error('studentbot finik:', err.message);
    await checkout.update({ status: 'failed' });
    throw new PayError('Не удалось создать оплату. Попробуйте позже или напишите в поддержку.');
  }
}

// Sent after the invoice message, so the button reply is instant while the browser works.
async function sendQr(checkout, chatId) {
  const caption = `QR для оплаты ${checkout.amount} сом · ${checkout.days} дней. Сохраните картинку и отсканируйте её в приложении банка («Сканировать QR» → из галереи).`;
  try {
    if (checkout.qrFileId) {
      await tg('sendPhoto', { chat_id: chatId, photo: checkout.qrFileId, caption });
      return true;
    }
    // eslint-disable-next-line global-require
    const png = await require('./qrShot').snapshotQr(checkout.paymentUrl);
    if (!png) return false;
    const msg = await tgUpload('sendPhoto', { chat_id: chatId, caption }, 'photo', png, 'finik-qr.png');
    const fileId = msg?.photo?.[msg.photo.length - 1]?.file_id;
    if (fileId) await checkout.update({ qrFileId: fileId });
    return true;
  } catch (err) {
    console.warn('studentbot qr:', err.message);
    return false;
  }
}

async function notifyPurchase(res) {
  const { user, net, debt } = res;
  await send(user.tgId, `✅ Доступ продлён на ${net} дн.${debt ? ` (${debt} дн. вычтено за использованный аванс)` : ''} — до ${humanDateTime(user.accessEnd)}.`);
  for (const g of res.referrals) {
    for (const [u, state] of [[g.referrer, g.referrerBonus], [g.invitee, g.inviteeBonus]]) {
      await send(u.tgId, state === 'granted'
        ? `🎁 Реферальный бонус: +${REF_BONUS_DAYS} дня доступа.`
        : 'Реферальный бонус не начислен: исчерпан лимит 30 дней за 30 суток.');
    }
  }
}

function webhookRefs(payload) {
  const fields = payload.fields || {};
  return [payload.transactionId, payload.paymentId, payload.PaymentId, fields.paymentId, payload.id].filter(Boolean).map(String);
}

async function findCheckout(payload) {
  const fields = payload.fields || {};
  const refs = webhookRefs(payload);
  if (refs.length) {
    const found = await SbCheckout.findOne({ where: { providerRef: refs } });
    if (found) return found;
  }
  if (fields.paymentType === 'studentbot' && Number(fields.sbCheckoutId)) return SbCheckout.findByPk(Number(fields.sbCheckoutId));
  return null;
}

// Returns false when the Finik notification is not a Student Bot payment, so the site handles it.
async function handleFinikWebhook(payload) {
  const found = await findCheckout(payload);
  if (!found) return false;

  if (isPaidStatus(payload.status)) {
    const paidAmount = Number(payload.amount);
    const outcome = await sequelize.transaction(async (transaction) => {
      const checkout = await SbCheckout.findByPk(found.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!['pending', 'failed'].includes(checkout.status)) return null;
      if (paidAmount && paidAmount < checkout.amount) {
        await checkout.update({ status: 'review', transactionId: payload.transactionId || null }, { transaction });
        return { review: true, checkout };
      }
      const res = await applyPurchase(checkout.userId, checkout.days, {
        provider: 'finik', externalId: checkout.providerRef, note: `Finik ${payload.transactionId || ''}`.trim(), transaction,
      });
      await checkout.update({
        status: 'paid', paidAt: new Date(), transactionId: payload.transactionId || null, paymentId: res.payment.id,
      }, { transaction });
      return { res, checkout };
    });
    if (outcome?.review) {
      await notifyAdmins(`⚠️ Оплата Finik №${outcome.checkout.id}: пришло ${paidAmount} сом вместо ${outcome.checkout.amount}. Доступ не выдан — проверьте и отметьте оплату вручную.`, kb([btn('Пользователь', `ad:u:${outcome.checkout.userId}`)]));
    } else if (outcome?.res) {
      await notifyPurchase(outcome.res);
    }
    return true;
  }

  if (isFailedStatus(payload.status)) {
    const [changed] = await SbCheckout.update({ status: 'failed' }, { where: { id: found.id, status: 'pending' } });
    if (changed) {
      const user = await SbUser.findByPk(found.userId);
      await send(user.tgId, `Оплата ${found.amount} сом не прошла. Можно попробовать ещё раз.`, kb([btn('Тарифы', 'acc:tariffs')]));
    }
  }
  return true;
}

async function checkoutStatus(userId, id) {
  const checkout = await SbCheckout.findByPk(id);
  if (!checkout || checkout.userId !== userId) return null;
  return checkout;
}

module.exports = {
  PayError,
  tariffAmount,
  onlinePayments,
  startCheckout,
  sendQr,
  notifyPurchase,
  handleFinikWebhook,
  checkoutStatus,
};
