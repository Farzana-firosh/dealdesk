const env = require('../../config/env');

// Minimal CORS for the REST API. The JWT travels in the Authorization header (no cookies),
// so credentials are not needed. Origins that are not listed get no CORS headers and the
// browser blocks the response.
function cors(req, res, next) {
  const origin = req.get('Origin');
  if (origin && env.corsOrigins.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      'Access-Control-Max-Age': '600',
    });
  }
  res.vary('Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204); // preflight
  next();
}

module.exports = { cors };
