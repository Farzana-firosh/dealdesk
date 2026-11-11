const env = require('../../config/env');
const { sign } = require('../../common/utils/hmac');

// Thin HTTP client. Never throws: returns { ok, status, body, error, durationMs } so callers can log every attempt.
async function request(method, path, { body, headers = {} } = {}) {
  const raw = body ? JSON.stringify(body) : undefined;
  const started = Date.now();
  try {
    const res = await fetch(env.billport.url + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(raw && { 'X-Signature': sign(raw, env.billport.secret) }),
        ...headers,
      },
      body: raw,
      // a slow BillPort must not hold our worker open
      signal: AbortSignal.timeout(env.billport.timeoutMs),
    });
    const resBody = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body: resBody, durationMs: Date.now() - started };
  } catch (err) {
    const error = err.name === 'TimeoutError' ? `timeout after ${env.billport.timeoutMs}ms` : err.cause?.code || err.message;
    return { ok: false, status: null, error, durationMs: Date.now() - started };
  }
}

const createInvoice = (payload, idempotencyKey) =>
  request('POST', '/billing/invoices', { body: payload, headers: { 'Idempotency-Key': idempotencyKey } });

const getInvoice = (externalId) => request('GET', `/billing/invoices/${encodeURIComponent(externalId)}`);

module.exports = { createInvoice, getInvoice };
