const TOKEN_KEY = 'ort_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Ошибка запроса', res.status, data.code);
  }
  return data;
}

export const authApi = {
  login: (body) => api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  adminLogin: (body) => api('/api/auth/admin-login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => api('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me: () => api('/api/auth/me'),
  updateMe: (body) => api('/api/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
  referral: () => api('/api/auth/referral'),
  stats: () => api('/api/auth/stats'),
  ranking: (period = 'week') => api(`/api/auth/ranking?period=${period}`),
};

export const ortApi = {
  dashboard: () => api('/api/tests/ort/dashboard'),
  welcomeStats: (testId) => api(`/api/tests/ort/welcome-stats?testId=${testId}`),
  history: (testId) => api(`/api/tests/ort/history?testId=${testId}`),
  flashcards: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/tests/ort/flashcards${q ? `?${q}` : ''}`);
  },
  check: (testId, body) => api(`/api/tests/tests/${testId}/check`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  checkExam: (body) => api('/api/tests/ort/check', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  readingList: () => api('/api/tests/ort/reading'),
  reading: (testId) => api(`/api/tests/ort/reading/${testId}`),
  readingAnswer: (questionId, answerId) => api('/api/tests/ort/reading/answer', {
    method: 'POST',
    body: JSON.stringify({ questionId, answerId }),
  }),
};

export const payApi = {
  plans: () => api('/api/payments/plans'),
  create: (planId, promoCode, useCoins) => api('/api/payments/create', {
    method: 'POST',
    body: JSON.stringify({ planId, promoCode: promoCode || undefined, useCoins: !!useCoins }),
  }),
  checkPromo: (code, planId) => api('/api/payments/promo', {
    method: 'POST',
    body: JSON.stringify({ code, planId: planId || undefined }),
  }),
  confirmDemo: (paymentId) => api('/api/payments/confirm-demo', {
    method: 'POST',
    body: JSON.stringify({ paymentId }),
  }),
  status: (paymentId, claim) => api(
    `/api/payments/status?paymentId=${encodeURIComponent(paymentId)}${claim ? `&claim=${encodeURIComponent(claim)}` : ''}`,
  ),
};

export const chatApi = {
  messages: () => api('/api/chat/messages'),
  send: (text) => api('/api/chat/messages', { method: 'POST', body: JSON.stringify({ text }) }),
  unread: () => api('/api/chat/unread'),
};

const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body || {}) });
const put = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body || {}) });
const del = (path) => api(path, { method: 'DELETE' });

export const simApi = {
  catalog: () => api('/api/sim/catalog'),
  subject: (id) => api(`/api/sim/subjects/${id}`),
  variant: (id) => api(`/api/sim/variants/${id}`),
  start: (variantId) => post(`/api/sim/variants/${variantId}/start`),
  attempt: (id) => api(`/api/sim/attempts/${id}`),
  startBlock: (id) => post(`/api/sim/attempts/${id}/start-block`),
  answer: (id, questionId, answerId) => post(`/api/sim/attempts/${id}/answer`, { questionId, answerId }),
  closeBlock: (id, index, timeout = false) => post(`/api/sim/attempts/${id}/close-block`, { index, timeout }),
  finish: (id) => post(`/api/sim/attempts/${id}/finish`),
  result: (id) => api(`/api/sim/attempts/${id}/result`),
  history: () => api('/api/sim/history'),
};

export const practiceApi = {
  builder: ({ testIds = [], difficulty = 'mixed', filters = [] } = {}) => {
    const q = new URLSearchParams();
    if (testIds.length) q.set('testIds', testIds.join(','));
    if (difficulty !== 'mixed') q.set('difficulty', String(difficulty));
    if (filters.length) q.set('filters', filters.join(','));
    const qs = q.toString();
    return api(`/api/practice/builder${qs ? `?${qs}` : ''}`);
  },
  create: (body) => post('/api/practice/sessions', body),
  sessions: (status = 'active') => api(`/api/practice/sessions?status=${status}`),
  session: (id) => api(`/api/practice/sessions/${id}`),
  answer: (id, questionId, answerId) => post(`/api/practice/sessions/${id}/answer`, { questionId, answerId }),
  finish: (id, timeout = false) => post(`/api/practice/sessions/${id}/finish`, { timeout }),
  result: (id) => api(`/api/practice/sessions/${id}/result`),
  flags: () => api('/api/practice/flags'),
  setFlag: (questionId, flagged) => put(`/api/practice/flags/${questionId}`, { flagged }),
};

export const ugcApi = {
  list: () => api('/api/admin/ugc'),
  create: (body) => post('/api/admin/ugc', body),
  update: (id, body) => put(`/api/admin/ugc/${id}`, body),
  invitees: (id) => api(`/api/admin/ugc/${id}/invitees`),
};

export const telegramAdminApi = {
  status: () => api('/api/admin/telegram/status'),
  webhook: () => post('/api/admin/telegram/webhook'),
  requests: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return api(`/api/admin/telegram/requests${q ? `?${q}` : ''}`);
  },
  cancel: (id) => post(`/api/admin/telegram/requests/${id}/cancel`),
};

const SIM = '/api/admin/sim';
export const simAdminApi = {
  tests: () => api(`${SIM}/tests`),
  test: (id) => api(`${SIM}/tests/${id}`),
  createTest: (body) => post(`${SIM}/tests`, body),
  updateTest: (id, body) => put(`${SIM}/tests/${id}`, body),
  deleteTest: (id) => del(`${SIM}/tests/${id}`),
  createTopic: (testId, name) => post(`${SIM}/tests/${testId}/topics`, { name }),
  updateTopic: (id, name) => put(`${SIM}/topics/${id}`, { name }),
  deleteTopic: (id) => del(`${SIM}/topics/${id}`),
  createVariant: (testId, body) => post(`${SIM}/tests/${testId}/variants`, body),
  variant: (id) => api(`${SIM}/variants/${id}`),
  updateVariant: (id, body) => put(`${SIM}/variants/${id}`, body),
  deleteVariant: (id) => del(`${SIM}/variants/${id}`),
  publish: (id) => post(`${SIM}/variants/${id}/publish`),
  unpublish: (id) => post(`${SIM}/variants/${id}/unpublish`),
  createBlock: (variantId, body) => post(`${SIM}/variants/${variantId}/blocks`, body),
  updateBlock: (id, body) => put(`${SIM}/blocks/${id}`, body),
  deleteBlock: (id) => del(`${SIM}/blocks/${id}`),
  createPart: (blockId, body) => post(`${SIM}/blocks/${blockId}/parts`, body),
  updatePart: (id, body) => put(`${SIM}/parts/${id}`, body),
  deletePart: (id) => del(`${SIM}/parts/${id}`),
  addTopic: (partId, topicId) => post(`${SIM}/parts/${partId}/topics`, { topicId }),
  slot: (id) => api(`${SIM}/slots/${id}`),
  deleteSlot: (id) => del(`${SIM}/slots/${id}`),
  move: (type, id, dir) => post(`${SIM}/${type}/${id}/move`, { dir }),
};

export const glossaryApi = {
  keywords: () => api('/api/term-images/keywords'),
};

export const adminApi = {
  stats: () => api('/api/admin/ort-stats'),
  plans: () => api('/api/admin/ort-subscription-plans'),
  savePlans: (plans) => api('/api/admin/ort-subscription-plans', {
    method: 'PUT',
    body: JSON.stringify({ plans }),
  }),
  promos: () => api('/api/admin/promo-codes'),
  createPromo: (body) => api('/api/admin/promo-codes', { method: 'POST', body: JSON.stringify(body) }),
  updatePromo: (id, body) => api(`/api/admin/promo-codes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePromo: (id) => api(`/api/admin/promo-codes/${id}`, { method: 'DELETE' }),
  termImages: () => api('/api/admin/term-images'),
  createTerm: (form) => api('/api/admin/term-images', { method: 'POST', body: form }),
  deleteTerm: (id) => api(`/api/admin/term-images/${id}`, { method: 'DELETE' }),
  subjects: (trackGroup) => api(`/api/admin/subjects${trackGroup ? `?trackGroup=${trackGroup}` : ''}`),
  createSubject: (body) => api('/api/admin/subjects', { method: 'POST', body: JSON.stringify(body) }),
  updateSubject: (id, body) => api(`/api/admin/subjects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSubject: (id) => api(`/api/admin/subjects/${id}`, { method: 'DELETE' }),
  tests: (subjectId) => api(`/api/admin/tests${subjectId ? `?subjectId=${subjectId}` : ''}`),
  createTest: (body) => api('/api/admin/tests', { method: 'POST', body: JSON.stringify(body) }),
  updateTest: (id, body) => api(`/api/admin/tests/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTest: (id) => api(`/api/admin/tests/${id}`, { method: 'DELETE' }),
  questions: (testId) => api(`/api/admin/questions?testId=${testId}`),
  createQuestion: (body) => api('/api/admin/questions', { method: 'POST', body: JSON.stringify(body) }),
  updateQuestion: (id, body) => api(`/api/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteQuestion: (id) => api(`/api/admin/questions/${id}`, { method: 'DELETE' }),
  passages: (testId) => api(`/api/admin/reading-passages?testId=${testId}`),
  passage: (id) => api(`/api/admin/reading-passages/${id}`),
  createPassage: (body) => api('/api/admin/reading-passages', { method: 'POST', body: JSON.stringify(body) }),
  updatePassage: (id, body) => api(`/api/admin/reading-passages/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePassage: (id) => api(`/api/admin/reading-passages/${id}`, { method: 'DELETE' }),
  flashcards: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/admin/flashcards${q ? `?${q}` : ''}`);
  },
  createFlashcard: (body) => api('/api/admin/flashcards', { method: 'POST', body: JSON.stringify(body) }),
  updateFlashcard: (id, body) => api(`/api/admin/flashcards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteFlashcard: (id) => api(`/api/admin/flashcards/${id}`, { method: 'DELETE' }),
  users: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/admin/users${q ? `?${q}` : ''}`);
  },
  grant: (id, months) => api(`/api/admin/users/${id}/grant-subscription`, {
    method: 'POST',
    body: JSON.stringify({ months }),
  }),
  addCoins: (id, amount) => api(`/api/admin/users/${id}/coins`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }),
  editors: () => api('/api/admin/editors'),
  createEditor: (body) => api('/api/admin/editors', { method: 'POST', body: JSON.stringify(body) }),
  updateEditor: (id, body) => api(`/api/admin/editors/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEditor: (id) => api(`/api/admin/editors/${id}`, { method: 'DELETE' }),
  activity: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return api(`/api/admin/activity${q ? `?${q}` : ''}`);
  },
  chatThreads: () => api('/api/admin/chat/threads'),
  chatThread: (userId) => api(`/api/admin/chat/threads/${userId}`),
  chatReply: (userId, text) => api(`/api/admin/chat/threads/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),
  uploadTxt: (url, testId, file, extra = {}) => {
    const form = new FormData();
    form.append('pdf', file);
    if (testId) form.append('testId', testId);
    Object.entries(extra).forEach(([k, v]) => form.append(k, v));
    return api(url, { method: 'POST', body: form });
  },
  parseTxt: (file, mode, testId) => {
    const form = new FormData();
    form.append('file', file);
    form.append('mode', mode);
    if (testId) form.append('testId', testId);
    return api('/api/admin/parse-txt', { method: 'POST', body: form });
  },
  uploadImage: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api('/api/admin/upload-image', { method: 'POST', body: form });
  },
  importQuestions: (target, items) => api('/api/admin/import-questions', {
    method: 'POST',
    body: JSON.stringify({ ...target, items }),
  }),
};
