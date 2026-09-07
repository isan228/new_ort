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
};

export const ortApi = {
  dashboard: () => api('/api/tests/ort/dashboard'),
  welcomeStats: (testId) => api(`/api/tests/ort/welcome-stats?testId=${testId}`),
  history: (testId) => api(`/api/tests/ort/history?testId=${testId}`),
  tags: () => api('/api/tests/ort/tags'),
  tagsGrouped: (testId) => api(`/api/tests/ort/tags/grouped?testId=${testId}`),
  customTest: (body) => api('/api/tests/ort/custom-test/questions', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  flashcards: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/tests/ort/flashcards${q ? `?${q}` : ''}`);
  },
  check: (testId, body) => api(`/api/tests/tests/${testId}/check`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
};

export const payApi = {
  plans: () => api('/api/payments/plans'),
  create: (planId) => api('/api/payments/create', { method: 'POST', body: JSON.stringify({ planId }) }),
  confirmDemo: (paymentId) => api('/api/payments/confirm-demo', {
    method: 'POST',
    body: JSON.stringify({ paymentId }),
  }),
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
  tags: () => api('/api/admin/question-tags'),
  createTag: (body) => api('/api/admin/question-tags', { method: 'POST', body: JSON.stringify(body) }),
  mergeTags: (sourceId, targetId) => api('/api/admin/question-tags/merge', {
    method: 'POST',
    body: JSON.stringify({ sourceId, targetId }),
  }),
  deleteTag: (id) => api(`/api/admin/question-tags/${id}`, { method: 'DELETE' }),
  termImages: () => api('/api/admin/term-images'),
  createTerm: (form) => api('/api/admin/term-images', { method: 'POST', body: form }),
  deleteTerm: (id) => api(`/api/admin/term-images/${id}`, { method: 'DELETE' }),
  subjects: () => api('/api/admin/subjects'),
  createSubject: (body) => api('/api/admin/subjects', { method: 'POST', body: JSON.stringify(body) }),
  updateSubject: (id, body) => api(`/api/admin/subjects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSubject: (id) => api(`/api/admin/subjects/${id}`, { method: 'DELETE' }),
  tests: (subjectId) => api(`/api/admin/tests${subjectId ? `?subjectId=${subjectId}` : ''}`),
  createTest: (body) => api('/api/admin/tests', { method: 'POST', body: JSON.stringify(body) }),
  deleteTest: (id) => api(`/api/admin/tests/${id}`, { method: 'DELETE' }),
  questions: (testId) => api(`/api/admin/questions?testId=${testId}`),
  createQuestion: (body) => api('/api/admin/questions', { method: 'POST', body: JSON.stringify(body) }),
  deleteQuestion: (id) => api(`/api/admin/questions/${id}`, { method: 'DELETE' }),
  flashcards: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api(`/api/admin/flashcards${q ? `?${q}` : ''}`);
  },
  createFlashcard: (body) => api('/api/admin/flashcards', { method: 'POST', body: JSON.stringify(body) }),
  deleteFlashcard: (id) => api(`/api/admin/flashcards/${id}`, { method: 'DELETE' }),
  users: () => api('/api/admin/users'),
  grant: (id, months) => api(`/api/admin/users/${id}/grant-subscription`, {
    method: 'POST',
    body: JSON.stringify({ months }),
  }),
  uploadTxt: (url, testId, file, extra = {}) => {
    const form = new FormData();
    form.append('pdf', file);
    if (testId) form.append('testId', testId);
    Object.entries(extra).forEach(([k, v]) => form.append(k, v));
    return api(url, { method: 'POST', body: form });
  },
};
