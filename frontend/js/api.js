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

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
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
};
