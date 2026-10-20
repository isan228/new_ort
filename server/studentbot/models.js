const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SbUser = sequelize.define('SbUser', {
  tgId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  username: { type: DataTypes.STRING(64), allowNull: true },
  registered: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  nickname: { type: DataTypes.STRING(32), allowNull: true },
  faculty: { type: DataTypes.STRING(120), allowNull: true },
  course: { type: DataTypes.INTEGER, allowNull: true },
  // m | f
  sex: { type: DataTypes.STRING(1), allowNull: true },
  whatsapp: { type: DataTypes.STRING(20), allowNull: true },
  consentAt: { type: DataTypes.DATE, allowNull: true },
  blockedUntil: { type: DataTypes.DATE, allowNull: true },
  blockReason: { type: DataTypes.STRING(300), allowNull: true },
  needsReview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  refCode: { type: DataTypes.STRING(16), allowNull: true, unique: true },
  referredById: { type: DataTypes.INTEGER, allowNull: true },
  // Paid + bonus days end here; the advance day and the launch promo are counted on top.
  accessEnd: { type: DataTypes.DATE, allowNull: true },
  advanceAvailable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  advanceUntil: { type: DataTypes.DATE, allowNull: true },
  advanceDebt: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  paidCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  notifyMatches: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  matchNotifyDay: { type: DataTypes.STRING(10), allowNull: true },
  matchNotifyCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  chatUnreachable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { indexes: [{ fields: ['nickname'] }] });

// Dialog state: current screen, half-filled forms, open order chat.
const SbState = sequelize.define('SbState', {
  tgId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  screen: { type: DataTypes.STRING(40), allowNull: true },
  data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
});

const SbOrder = sequelize.define('SbOrder', {
  creatorId: { type: DataTypes.INTEGER, allowNull: false },
  executorId: { type: DataTypes.INTEGER, allowNull: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  pairType: { type: DataTypes.STRING(8), allowNull: false },
  startsAt: { type: DataTypes.DATE, allowNull: false },
  endsAt: { type: DataTypes.DATE, allowNull: false },
  placeKey: { type: DataTypes.STRING(120), allowNull: false },
  placeText: { type: DataTypes.STRING(200), allowNull: false },
  subject: { type: DataTypes.STRING(120), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: false },
  compensation: { type: DataTypes.STRING(200), allowNull: false },
  comment: { type: DataTypes.STRING(500), allowNull: true },
  requiredSex: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'any' },
  facultyMode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'any' },
  faculty: { type: DataTypes.STRING(120), allowNull: true },
  // OPEN | ACCEPTED | COMPLETED | CANCELLED
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'OPEN' },
  revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  slotId: { type: DataTypes.INTEGER, allowNull: true },
  acceptedAt: { type: DataTypes.DATE, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  cancelledAt: { type: DataTypes.DATE, allowNull: true },
  cancelledById: { type: DataTypes.INTEGER, allowNull: true },
  // EXPIRED | CREATOR | UNILATERAL | LATE | GRACE | MUTUAL | ADMIN
  cancelReason: { type: DataTypes.STRING(20), allowNull: true },
  cancelNote: { type: DataTypes.STRING(300), allowNull: true },
  mutualCancelBy: { type: DataTypes.INTEGER, allowNull: true },
  pendingChange: { type: DataTypes.JSONB, allowNull: true },
  reminded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  completionAsked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  completionReminded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  chatPurged: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { indexes: [{ fields: ['status', 'date'] }, { fields: ['creatorId'] }, { fields: ['executorId'] }] });

const SbSlot = sequelize.define('SbSlot', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  pairType: { type: DataTypes.STRING(8), allowNull: false },
  startsAt: { type: DataTypes.DATE, allowNull: false },
  endsAt: { type: DataTypes.DATE, allowNull: false },
  // [{ key, text }]
  places: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  customerSex: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'any' },
  facultyMode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'any' },
  // OPEN | BOOKED | EXPIRED | DELETED
  state: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'OPEN' },
}, { indexes: [{ fields: ['state', 'date'] }, { fields: ['userId'] }] });

const SbInvitation = sequelize.define('SbInvitation', {
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  slotId: { type: DataTypes.INTEGER, allowNull: false },
  initiatorId: { type: DataTypes.INTEGER, allowNull: false },
  targetId: { type: DataTypes.INTEGER, allowNull: false },
  // customer | executor
  initiatorRole: { type: DataTypes.STRING(10), allowNull: false },
  // PENDING | ACCEPTED | DECLINED | EXPIRED | INVALIDATED | CANCELLED
  state: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'PENDING' },
  urgent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  respondedAt: { type: DataTypes.DATE, allowNull: true },
  orderRevision: { type: DataTypes.INTEGER, allowNull: false },
}, { indexes: [{ fields: ['state', 'expiresAt'] }, { fields: ['orderId'] }, { fields: ['slotId'] }, { fields: ['targetId'] }] });

const SbCompletion = sequelize.define('SbCompletion', {
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
}, { indexes: [{ unique: true, fields: ['orderId', 'userId'] }] });

const SbReview = sequelize.define('SbReview', {
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  fromId: { type: DataTypes.INTEGER, allowNull: false },
  toId: { type: DataTypes.INTEGER, allowNull: false },
  // Role of the person being rated: customer | executor.
  role: { type: DataTypes.STRING(10), allowNull: false },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  comment: { type: DataTypes.STRING(500), allowNull: true },
  revealAfter: { type: DataTypes.DATE, allowNull: false },
  revealed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { indexes: [{ unique: true, fields: ['orderId', 'fromId'] }, { fields: ['toId', 'role'] }] });

const SbReport = sequelize.define('SbReport', {
  orderId: { type: DataTypes.INTEGER, allowNull: true },
  reporterId: { type: DataTypes.INTEGER, allowNull: false },
  subjectId: { type: DataTypes.INTEGER, allowNull: true },
  // order | user | idea | appeal
  category: { type: DataTypes.STRING(12), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  // OPEN | WAITING | CLOSED
  status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'OPEN' },
  resolution: { type: DataTypes.TEXT, allowNull: true },
  resolvedAt: { type: DataTypes.DATE, allowNull: true },
}, { indexes: [{ fields: ['status'] }] });

const SbMessage = sequelize.define('SbMessage', {
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  fromId: { type: DataTypes.INTEGER, allowNull: false },
  toId: { type: DataTypes.INTEGER, allowNull: false },
  // text | photo | document | contact | template
  type: { type: DataTypes.STRING(12), allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: true },
  fileId: { type: DataTypes.STRING(300), allowNull: true },
  delivered: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  purged: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { indexes: [{ fields: ['orderId'] }] });

// Every change of access: purchase, bonus, advance, deduction, admin correction.
const SbAccessLog = sequelize.define('SbAccessLog', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  kind: { type: DataTypes.STRING(20), allowNull: false },
  days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  endBefore: { type: DataTypes.DATE, allowNull: true },
  endAfter: { type: DataTypes.DATE, allowNull: true },
  note: { type: DataTypes.STRING(300), allowNull: true },
}, { indexes: [{ fields: ['userId', 'kind'] }] });

const SbPayment = sequelize.define('SbPayment', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  days: { type: DataTypes.INTEGER, allowNull: false },
  // manual | provider name later
  provider: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'manual' },
  externalId: { type: DataTypes.STRING(120), allowNull: true },
  // paid | refunded
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'paid' },
  note: { type: DataTypes.STRING(300), allowNull: true },
});

// An online payment started from the bot; it turns into an SbPayment once Finik confirms it.
const SbCheckout = sequelize.define('SbCheckout', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  days: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  providerRef: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  paymentUrl: { type: DataTypes.TEXT, allowNull: true },
  qrFileId: { type: DataTypes.STRING(300), allowNull: true },
  // pending | paid | failed | review
  status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'pending' },
  transactionId: { type: DataTypes.STRING(120), allowNull: true },
  paymentId: { type: DataTypes.INTEGER, allowNull: true },
  paidAt: { type: DataTypes.DATE, allowNull: true },
}, { indexes: [{ fields: ['userId', 'status'] }] });

const SbReferral = sequelize.define('SbReferral', {
  referrerId: { type: DataTypes.INTEGER, allowNull: false },
  inviteeId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  // registered | granted
  state: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'registered' },
  // granted | limit | null
  referrerBonus: { type: DataTypes.STRING(10), allowNull: true },
  inviteeBonus: { type: DataTypes.STRING(10), allowNull: true },
  grantedAt: { type: DataTypes.DATE, allowNull: true },
}, { indexes: [{ fields: ['referrerId'] }] });

// Immutable admin journal.
const SbModeration = sequelize.define('SbModeration', {
  adminTgId: { type: DataTypes.BIGINT, allowNull: false },
  subjectId: { type: DataTypes.INTEGER, allowNull: true },
  orderId: { type: DataTypes.INTEGER, allowNull: true },
  reportId: { type: DataTypes.INTEGER, allowNull: true },
  action: { type: DataTypes.STRING(40), allowNull: false },
  reason: { type: DataTypes.STRING(500), allowNull: true },
  before: { type: DataTypes.JSONB, allowNull: true },
  after: { type: DataTypes.JSONB, allowNull: true },
});

module.exports = {
  SbUser,
  SbState,
  SbOrder,
  SbSlot,
  SbInvitation,
  SbCompletion,
  SbReview,
  SbReport,
  SbMessage,
  SbAccessLog,
  SbPayment,
  SbCheckout,
  SbReferral,
  SbModeration,
};
