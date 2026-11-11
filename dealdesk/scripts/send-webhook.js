// Sends a hand-crafted, signed BillPort webhook to DealDesk (acceptance scenarios 06–08).
//
//   node scripts/send-webhook.js <externalId> <STATUS> <sequence> [--times N] [--event-id ID] [--tamper]
//
//   scenario 06: node scripts/send-webhook.js bp_xxx SENT 1 --times 3
//   scenario 07: node scripts/send-webhook.js bp_xxx PAID 3 && node scripts/send-webhook.js bp_xxx VIEWED 2
//   scenario 08: node scripts/send-webhook.js bp_xxx PAID 3 --tamper
require('dotenv').config({ quiet: true });
const crypto = require('crypto');

const [externalId, status, sequence, ...flags] = process.argv.slice(2);
if (!externalId || !status || !sequence) {
  console.log('usage: node scripts/send-webhook.js <externalId> <STATUS> <sequence> [--times N] [--event-id ID] [--tamper]');
  process.exit(1);
}
const flag = (name) => {
  const i = flags.indexOf(name);
  return i === -1 ? undefined : flags[i + 1] ?? true;
};

const url = `http://localhost:${process.env.PORT || 4000}/webhooks/billport`;
const body = {
  eventId: flag('--event-id') || crypto.randomUUID(),
  externalId,
  status,
  sequence: Number(sequence),
  occurredAt: new Date().toISOString(),
};
const raw = JSON.stringify(body);
const signature = crypto.createHmac('sha256', process.env.BILLPORT_SECRET).update(raw).digest('hex');
// --tamper: sign the original body, then alter the sequence in the body actually sent
const sent = flag('--tamper') ? raw.replace(`"sequence":${sequence}`, `"sequence":${Number(sequence) + 10}`) : raw;

(async () => {
  for (let i = 1; i <= Number(flag('--times') || 1); i++) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': signature }, body: sent });
    console.log(`#${i} ${status} seq ${sequence} eventId ${body.eventId} -> HTTP ${res.status}`);
  }
})();
