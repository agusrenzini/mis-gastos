// Única puerta de entrada al backend. Las pantallas nunca llaman a fetch() directamente.

export class ApiError extends Error {
  constructor(message, { status = 0, errors = {}, offline = false } = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.offline = offline;
  }
}

const OFFLINE_MESSAGE = 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.';

/** El servidor manda la cookie XSRF-TOKEN; hay que devolverla en un header en cada POST/PUT/DELETE. */
function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Si el servidor responde 401 (sesión vencida o cuenta desactivada) o pide cambiar la contraseña,
 * se avisa con un evento y app.js lleva a la pantalla que corresponda.
 * silent: para las llamadas de login/registro, que manejan el 401 en el propio formulario.
 */
async function request(method, path, body, { silent = false } = {}) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  if (method !== 'GET') {
    const token = csrfToken();
    if (token) headers['X-XSRF-TOKEN'] = token;
  }

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, { offline: true });
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Respuesta sin JSON (por ejemplo, un proxy caído)
  }

  if (!silent && response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:required'));
  }
  if (!silent && response.status === 403 && data?.message === 'Antes de seguir, cambiá tu contraseña.') {
    window.dispatchEvent(new CustomEvent('auth:must-change-password'));
  }

  if (!response.ok) {
    const message = data?.message
      ?? (response.status >= 500 ? 'El servidor tuvo un problema. Probá de nuevo en un momento.' : 'No se pudo completar la operación.');
    throw new ApiError(message, { status: response.status, errors: data?.errors ?? {} });
  }
  return data;
}

const query = (params) => {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

export const api = {
  listExpenses: (from, to) => request('GET', `/expenses${query({ from, to })}`),
  getExpense: (id) => request('GET', `/expenses/${id}`),
  createExpense: (expense) => request('POST', '/expenses', expense),
  updateExpense: (id, expense) => request('PUT', `/expenses/${id}`, expense),
  deleteExpense: (id) => request('DELETE', `/expenses/${id}`),
  getDashboard: (month) => request('GET', `/dashboard${query({ month })}`),
  getStatistics: (period, date) => request('GET', `/statistics${query({ period, date })}`),

  // Ingresos
  listIncomes: (month) => request('GET', `/incomes${query({ month })}`),
  getIncome: (id) => request('GET', `/incomes/${id}`),
  createIncome: (income) => request('POST', '/incomes', income),
  updateIncome: (id, income) => request('PUT', `/incomes/${id}`, income),
  deleteIncome: (id) => request('DELETE', `/incomes/${id}`),
  receiveIncome: (id) => request('POST', `/incomes/${id}/receive`),

  // Gastos fijos y sus meses
  listRecurring: () => request('GET', '/recurring'),
  getRecurring: (id) => request('GET', `/recurring/${id}`),
  createRecurring: (data) => request('POST', '/recurring', data),
  updateRecurring: (id, data) => request('PUT', `/recurring/${id}`, data),
  pauseRecurring: (id) => request('POST', `/recurring/${id}/pause`),
  resumeRecurring: (id) => request('POST', `/recurring/${id}/resume`),
  finishRecurring: (id) => request('POST', `/recurring/${id}/finish`),
  deleteRecurring: (id) => request('DELETE', `/recurring/${id}`),
  listObligations: (month) => request('GET', `/recurring/obligations${query({ month })}`),
  getObligation: (id) => request('GET', `/recurring/obligations/${id}`),
  adjustObligation: (id, amount) => request('PUT', `/recurring/obligations/${id}/amount`, { amount }),
  payObligation: (id, data) => request('POST', `/recurring/obligations/${id}/pay`, data),
  linkObligation: (id, expenseId) => request('POST', `/recurring/obligations/${id}/link`, { expenseId }),
  obligationCandidates: (id) => request('GET', `/recurring/obligations/${id}/candidates`),
  unpayObligation: (id) => request('POST', `/recurring/obligations/${id}/unpay`),
  skipObligation: (id) => request('POST', `/recurring/obligations/${id}/skip`),
  restoreObligation: (id) => request('POST', `/recurring/obligations/${id}/restore`),

  // Presupuesto y resumen del mes
  getBudget: (month) => request('GET', `/budget${query({ month })}`),
  saveBudget: (month, items) => request('PUT', `/budget${query({ month })}`, { items }),

  // Cuenta
  me: () => request('GET', '/auth/me', null, { silent: true }),
  login: (username, password) => request('POST', '/auth/login', { username, password }, { silent: true }),
  register: (data) => request('POST', '/auth/register', data, { silent: true }),
  logout: () => request('POST', '/auth/logout', null, { silent: true }),
  changePassword: (data) => request('POST', '/auth/change-password', data),

  // Administración (el servidor rechaza estas llamadas si no sos administradora)
  adminUsers: () => request('GET', '/admin/users'),
  adminSetActive: (id, active) => request('POST', `/admin/users/${id}/${active ? 'activate' : 'deactivate'}`),
  adminResetPassword: (id) => request('POST', `/admin/users/${id}/reset-password`),
  adminUnassigned: () => request('GET', '/admin/unassigned-expenses'),
  adminAssignUnassigned: () => request('POST', '/admin/unassigned-expenses/assign-to-me'),
};
