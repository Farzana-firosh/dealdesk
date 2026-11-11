const crypto = require('crypto');

const sign = (raw, secret) => crypto.createHmac('sha256', secret).update(raw).digest('hex');

// Constant-time comparison so the signature cannot be guessed byte by byte.
function verify(raw, signature, secret) {
  if (!signature) return false;
  const expected = Buffer.from(sign(raw, secret));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

module.exports = { sign, verify };
