// Runs before any app module is loaded, because src/config/env.js validates on require.
// The real database URI is set per test file by test/helpers.js (in-memory MongoDB).
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/dealdesk-test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-only-used-by-the-test-suite';
process.env.BILLPORT_SECRET = 'test-billport-secret';
process.env.BILLPORT_URL = 'http://billport.invalid';
process.env.PUSH_BASE_DELAY_MS = '1000';
process.env.RECONCILE_STALE_MINUTES = '1';
