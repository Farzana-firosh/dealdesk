# DealDesk

DealDesk is a backend for deals, discount approvals, realtime deal chat and invoicing through **BillPort**. BillPort is a separate, deliberately unreliable billing service included in this repo.

| App | Port | What it is |
|---|---|---|
| `dealdesk/` | 4000 | Main API (Express 5, MongoDB/Mongoose, JWT, Socket.IO, background jobs) + a plain demo page |
| `billport/` | 5000 | Fake billing service: random 503s, slow responses, duplicate / out-of-order / badly-signed webhooks |

Stack: Node.js 20+, Express 5, MongoDB 7 with Mongoose, JWT and bcrypt (`bcryptjs`), Socket.IO, Joi. The code is plain JavaScript (CommonJS) so the solution stays small and readable within the time box.

---

## 1. How to run both apps

### Option A – Docker (everything)
```bash
docker compose up --build
docker compose exec dealdesk npm run seed
```
Host ports can be overridden with `DEALDESK_PORT`, `BILLPORT_PORT` and `MONGO_PORT`.

### Option B – local Node, Mongo in Docker
```bash
docker compose up -d mongo

cd billport && npm install && cp .env.example .env && npm run dev     # terminal 1
cd dealdesk && npm install && cp .env.example .env && npm run seed && npm run dev   # terminal 2
```

- **Demo UI:** http://localhost:4000. Open several tabs and log in as a different user in each.
- **Postman:** import `postman/DealDesk.postman_collection.json`, run `npm run seed`, then run folders 0–8 in order. Every request asserts its expected result. The full run is 84 requests and 111 assertions, all passing locally and against Docker.

**Seed users** (password `Password123!`, all `@dealdesk.test`):

| User | Role | Branch |
|---|---|---|
| `exec.a` | sales_exec (manager: manager.a) | Dubai (DXB) |
| `manager.a` | sales_manager | Dubai (DXB) |
| `exec.b` | sales_exec (manager: manager.b) | Abu Dhabi (AUH) |
| `manager.b` | sales_manager | Abu Dhabi (AUH) |
| `finance` | finance | Dubai |
| `admin` | admin | Dubai |

The seed also creates 3 customers, 3 products, 3 deals (each with a chat thread) and the approval config.

### Project layout
```
dealdesk/src
├── app.js, server.js, routes.js
├── config/            env (fails fast on missing secrets), db
├── common/            AppError, error handler, Joi validate, HMAC, interval runner, domain event bus
├── modules/           one folder per feature: <feature>.model / .routes / .controller / .service
│   ├── auth/          login, JWT, authenticate + authorize(permission) guard, scopeFilter
│   ├── roles/         role model, permission keys, admin role management
│   ├── deals/         deals (scoped queries)
│   ├── approvals/     config, requests, append-only history
│   ├── invoices/      sale, invoice, BillPort client, push worker, webhooks, reconciliation, integration_logs
│   ├── chat/          threads, messages, unread counts
│   └── users/ branches/ customers/ products/
├── realtime/          Socket.IO server, room emitter, event → notification mapping
└── database/          model registry, seed
```
Controllers stay thin and the business rules live in the services.

---

## 2. Permissions and data scope

**A role is data, and permissions are what the code checks.** A role is a document in the database:
```js
{ name: 'sales_manager', permissions: [ { key: 'deal.view', scope: 'branch' }, { key: 'discount.approve', scope: 'branch' }, ... ] }
```
- Permission keys (`deal.view`, `deal.edit`, `discount.approve`, `invoice.view`, `invoice.issue`, `invoice.cancel`, `chat.send`, `role.manage`, `approval_config.manage`) are defined in code (`modules/roles/permissions.js`), because the code is what checks them.
- Role names never appear in business logic. Adding a role is a `POST /api/roles` call, with no code change.
- The JWT holds only the user id. User and role are reloaded on every request, so a permission change takes effect immediately.

**One guard.** Every protected route uses `authorize('<permission>')` (`modules/auth/auth.middleware.js`). It returns 403 if the user's role lacks the permission. Otherwise it sets `req.scope` to `own`, `branch` or `all`.

**Scope is applied inside the query.** `scopeFilter(user, scope)` turns the scope into a Mongo filter (`{ ownerId }`, `{ branchId }` or `{}`), and the services merge it into the query:
```js
Deal.findOne({ _id: dealId, ...scopeFilter(user, scope) })   // out of scope → no match → 404
```
- Deals store `branchId`, copied from the owner when the deal is created, so branch scope is one indexed equality filter.
- Malformed ids also return 404, so a caller can't tell "doesn't exist" apart from "not yours".
- The same pattern protects invoices, approval requests and notification recipients.

Scenario 01: exec A asking for a Branch B deal by id gets **404**, while finance (scope `all`) gets the record.

---

## 3. The approval chain: configuration and runtime resolution

**Configuration.** One `ApprovalConfig` document holds bands. Each band is `(minPercent, maxPercent] → ordered list of role ids`. The seed loads the assignment's table:

| Discount | Chain |
|---|---|
| ≤ 10% | auto-approved |
| 10–25% | sales_manager |
| 25–40% | sales_manager → finance |
| > 40% | sales_manager → finance → admin |

- Admins edit it with `PUT /api/approval-config` (permission `approval_config.manage`), sending role **names**.
- The service stores role **ids**, so renaming a role doesn't break the chain.
- The bands are validated: they must cover 0–100 with no gaps or overlaps, and every role must exist. A `version` field increments on each edit.

**Runtime resolution.**
- `resolveChain(pct)` reads the config from MongoDB **on every discount request**. It doesn't cache and doesn't use an if-else ladder, so edits apply at once without a restart (scenario 03).
- The chain it resolves is **snapshotted** into the new `ApprovalRequest`, as `steps[]` plus the config version. Requests already in flight therefore keep the rules they started under.

**Enforcement** (`modules/approvals/approval.service.js`):
- **Sequential.** If the user's role holds a later step, the request gets 409 (scenario 02). The step advances with `findOneAndUpdate({ _id, status: 'pending', currentStep: n })`, so two simultaneous approvals can't both succeed.
- **Only your own step.** The user needs `discount.approve`, the role of the *current* step, and the request's branch inside their scope. Otherwise they get 403 or 404.
- **No self-approval.** The requester gets 403 even if their role is in the chain.
- **Rejection.** A rejection requires remarks. The deal goes back to `open` and the chain closes. A partial unique index allows only one pending chain per deal, and re-requesting starts a new one.
- **Append-only audit.** `approval_history` records step, approverRole, approverId, action, remarks and timestamp. The model blocks every update, delete and re-save path.
- **Pending for me.** `GET /api/approvals/pending` filters in the query on `currentRoleId = my role`, my scope, and `requestedBy ≠ me`.

---

## 4. Exactly-once invoice creation on BillPort

1. **Converting never calls BillPort.** `POST /api/deals/:id/convert` creates the Sale and the Invoice locally and returns 201. The invoice starts with `pushStatus: 'queued'`. Unique indexes on `sale.dealId` and `invoice.saleId` make converting twice a 409.
2. **The idempotency key is generated once.** It's a UUID created when the invoice is created and stored on the invoice, with a unique index. Every push attempt for that invoice sends the **same** key; it is never regenerated.
3. **BillPort enforces it.** BillPort has a unique index on `idempotencyKey` and does find-or-create, handling a duplicate-key error for concurrent requests. The same key always returns the same `externalId`.
4. **The push worker keeps its state in MongoDB, not memory.** It claims one due invoice atomically: `findOneAndUpdate` on `pushStatus`, `nextPushAt` and an expiring `pushLockedUntil`.
   - Each request is HMAC-signed (`X-Signature`) and has a **4 s timeout** (`AbortSignal.timeout`).
   - On failure it retries with **exponential backoff and jitter**: 2 s, 4 s, 8 s … capped at 60 s.
   - After 8 attempts it stops at a **terminal `pushStatus: failed`**, which is visible in the API and UI, and can be retried with `POST /api/invoices/:id/retry-push`.
   - A 4xx response other than 408 or 429 is treated as non-retryable.

**Proof.** The test forces BillPort's slow path: BillPort *creates* the invoice, then waits 6 s before answering.
- DealDesk times out at 4 s and logs `timeout after 4000ms → retry_scheduled_in_2s`. The retry gets **the same externalId**.
- `GET http://localhost:5000/admin/invoices` shows exactly **one** BillPort invoice for that key.

To reproduce it yourself:
```bash
curl -X POST localhost:5000/admin/chaos -H 'Content-Type: application/json' -d '{"failRate":0,"slowRate":1}'
# convert a won deal, wait ~5 s, then:
curl -X POST localhost:5000/admin/chaos -H 'Content-Type: application/json' -d '{"slowRate":0}'
# GET /api/invoices/:id/logs → push attempt 1: timeout, attempt 2: success (same externalId)
# GET localhost:5000/admin/invoices → one invoice with that idempotencyKey
```

---

## 5. Duplicate and out-of-order webhooks

**`POST /webhooks/billport`:**
1. The route is mounted **before** `express.json()` and uses `express.raw()`. The HMAC-SHA256 of the **raw bytes** is compared with `crypto.timingSafeEqual`. A wrong or missing signature gets **401**: the event is logged and nothing else happens (scenario 08).
2. The event is inserted into `webhook_events`, which has a **unique `eventId`**. A duplicate fails that insert with E11000, gets 200, and is logged as `duplicate_ignored` (scenario 06: one change, two ignored duplicates).
3. The endpoint **answers 200 and then processes the event** with `setImmediate`. The only inline database work is that single indexed insert, which is what makes deduplication and durability possible. A sweep job reprocesses events left unprocessed, for example after a crash, or because the webhook arrived before our push response had stored the `externalId`.

**Stale events are ignored by `sequence`.** An invoice moves only through a guarded update:
```js
Invoice.findOneAndUpdate(
  { externalId, lastSequence: { $lt: event.sequence }, status: { $in: statusesBelow(target) } },
  { $set: { status: target, lastSequence: event.sequence } })
```
PAID (seq 3) followed by a late VIEWED (seq 2) leaves the invoice **paid**, and the late event is logged as `stale_ignored` (scenario 07).

**Why `sequence` and not `occurredAt`:**
- The source assigns `sequence` per invoice, as a strictly increasing integer. It can't tie, and it doesn't depend on clock skew between BillPort's machines or on timestamp precision.
- `occurredAt` is kept for display only.
- As a second guard, status can only move **forward** (pending < sent < viewed < paid/failed). That also protects transitions that have no sequence, such as reconciliation, and cancelled invoices never change again.

**Applied exactly once.** Only the update that actually moves the invoice into `paid` reduces the customer's outstanding balance and emits `invoice.status_changed` to the deal owner. That update's filter can match once.

**Self-healing.**
- The reconciliation job runs every 20 s. It finds pushed invoices in a non-final status that haven't changed for **N minutes** (`RECONCILE_STALE_MINUTES`, default 1), calls `GET /billing/invoices/:externalId`, and applies the result through the same forward-only rule (scenario 09).
- `integration_logs` records every push attempt, every inbound webhook (applied, duplicate, stale, rejected), and every reconciliation. Each record has its payload, response, outcome and duration, and they're available via `GET /api/invoices/:id/logs`.

### BillPort misbehaviour (built as specified)
- `POST /billing/invoices`: 15% respond 503, and 10% respond after 6 s.
- Lifecycle: QUEUED → SENT → VIEWED → PAID (80%) or FAILED, at random 5–30 s steps.
- Webhooks:
  - 20% are sent twice with the same `eventId`.
  - 25% of VIEWED events are held back until after the final event, so they arrive out of order.
  - 10% have the first attempt signed with the wrong secret.
  - No answer within 3 s triggers a retry with backoff.
- `POST /admin/chaos` changes these rates at runtime, for example `{"webhooksEnabled": false}` for scenario 09. `GET /admin/invoices` and `GET /admin/deliveries` are for inspection.

---

## 6. Realtime chat and notifications

- **Threads:** one thread per deal. Participants are the owner and the owner's manager (added when the deal is created), plus anyone who comments. Commenting requires `chat.send` and being able to see the deal.
- **History** is stored in MongoDB.
- **`GET /api/threads`** returns only the user's own threads, each with a last-message preview and the user's **stored** unread count. That count is incremented with `$inc` for every other participant, so it's correct for users who were offline.
- **Socket.IO** checks the JWT inside `io.use()`, so a socket without a valid token is **rejected at the handshake**.
  - Each socket joins `user:<id>` automatically.
  - It joins `deal:<id>` only after a server-side participant check.
  - All delivery goes **into rooms**; nothing is broadcast to everyone.
- **One event layer:**
  - Services publish domain events (`discount.requested`, `discount.decided`, `invoice.status_changed`, `chat.message`) to `common/events.js` and never touch Socket.IO directly.
  - `realtime/notifications.js` maps each event to recipients:
    - approvers of the current step, filtered in the query by role and branch scope
    - the requester
    - the deal owner
  - Chat uses the `chat:message` and `thread:updated` events.
  - System notifications use a single `notification` event with the envelope `{ type, data, at }`.
- **Bonus:** a typing indicator, relayed only inside a room the socket has joined.

---

## 7. API overview
All `/api` routes except login require `Authorization: Bearer <token>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Roles (admin) | `GET /api/roles/permissions`, `GET/POST /api/roles`, `PATCH /api/roles/:id` |
| Reference | `GET /api/customers`, `GET /api/products` |
| Deals | `GET/POST /api/deals`, `GET/PATCH /api/deals/:id`, `POST /api/deals/:id/discount-request`, `GET /api/deals/:id/approvals`, `POST /api/deals/:id/convert` |
| Approvals | `GET /api/approvals/pending`, `POST /api/approvals/:id/approve`, `POST /api/approvals/:id/reject` |
| Approval config (admin) | `GET/PUT /api/approval-config` |
| Invoices | `GET /api/invoices`, `GET /api/invoices/:id`, `GET /api/invoices/:id/logs`, `POST /api/invoices/:id/retry-push`, `POST /api/invoices/:id/cancel` |
| Chat | `GET /api/threads`, `GET/POST /api/threads/:dealId/messages`, `POST /api/threads/:dealId/read` |
| Webhook | `POST /webhooks/billport` (HMAC-signed, no JWT) |
| BillPort | `POST /billing/invoices`, `GET /billing/invoices/:externalId`, `GET/POST /admin/chaos`, `GET /admin/invoices`, `GET /admin/deliveries` |
| Socket events | client → `thread:join`, `thread:leave`, `chat:send`, `chat:typing` · server → `chat:message`, `chat:typing`, `thread:updated`, `notification` |

## 8. Acceptance scenarios: how to see each one
| # | How |
|---|---|
| 01–03, 06–08 | Postman folders 4–6 (asserted) |
| 04 | Demo UI: exec.a and manager.a open the deal chat in two tabs; exec.b never sees the thread |
| 05 | Stop BillPort (Ctrl+C), convert a won deal → the DealDesk log shows `retry_scheduled_in_2s / 4s / 8s …` → start BillPort → the push succeeds on its own |
| 06–08 by hand | `cd dealdesk && node scripts/send-webhook.js <externalId> SENT 1 --times 3` · `... PAID 3` then `... VIEWED 2` · `... PAID 3 --tamper` |
| 09 | `POST localhost:5000/admin/chaos {"webhooksEnabled": false}`, convert a deal → after about N min the log shows `[reconcile] … repaired pending -> paid` |

---

## 9. Trade-offs, what is not finished, and what I'd do with another day

**Trade-offs made deliberately:**
- **No multi-document transactions,** because MongoDB runs standalone. Correctness relies on conditional single-document updates (the guard sits in the filter). Where two writes must both happen, the code either makes them idempotent and re-runnable (convert) or compensates (discount request).
- **Polling workers instead of a queue broker.** The jobs poll MongoDB on an interval, and all their state is in documents with atomic claims and expiring locks. That survives restarts and works with several instances, without adding Redis or a queue.
- **Two small exceptions to "nothing inline":** the webhook endpoint does one inline insert, for deduplication and durability, before answering 200. Notifications are dispatched in-process with an EventEmitter. They're best-effort, and the durable state (invoice status, approvals, unread counts) is always in MongoDB.

**Not finished:**
- **Notifications aren't persisted.** A user who's offline misses the live notification, although `GET /approvals/pending`, invoice status and unread counts still show the current state.
- **Cancelling is local only.** BillPort's contract has no cancel endpoint, so a cancelled invoice ignores later BillPort events.
- **No automated test suite in the repo.** Workflows were verified with throwaway scripts and the asserted Postman collection, run with Newman, rather than Jest or Supertest.
- **Plain JavaScript, not TypeScript.**

**With another day:**
1. A Jest + Supertest + mongodb-memory-server suite covering scope, approval races and webhook ordering, and run in CI.
2. A persisted `notifications` collection, with a read API and replay on reconnect.
3. A MongoDB replica set and transactions for convert and for discount requests. A transactional outbox for domain events.
4. An integration-log retention policy (TTL index) and a small admin view of failed pushes, with bulk retry.
5. Rate limiting on login and webhooks, plus Helmet and structured logging (pino) with a request id.
6. Pagination on the list endpoints and a TypeScript migration.
