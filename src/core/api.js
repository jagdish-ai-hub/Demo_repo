const BASE_PATH = '/api';

export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE_PATH}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

export const getBootstrap = () => api('/bootstrap');

export const postPayment = (payload) => api('/fees/pay', { method: 'POST', body: payload });

export const postWaiveFine = (payload) => api('/fees/waive-fine', { method: 'POST', body: payload });

export const postBulkRemind = (payload) => api('/fees/bulk-remind', { method: 'POST', body: payload });

export const postReset = () => api('/reset', { method: 'POST', body: {} });
