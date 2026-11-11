# DealDesk – Task Tracker

Legend: `[ ]` not started · `[~]` in progress · `[x]` done **and tested**

Time budget: ~4 hrs. Priority order follows the scoring weights: Part 4 (30%) > Part 1 (20%) = Part 2 (20%) > Part 3 (15%).

---

## Phase 1 – Foundation (target 20 min)
- [x] Monorepo layout: `dealdesk/`, `billport/`, `postman/`
- [x] Express 5 app, config from env, central error handler, `AppError`
- [x] Mongoose connection
- [~] `docker-compose.yml` (mongo verified; full stack verified in Phase 7)
- [x] `GET /health` on both apps (tested: 200 on both, unknown route → 404 JSON)
- [x] `.gitignore`, `.env.example`

## Phase 2 – Auth & permissions (Part 1 · 20%) (target 45 min)
- [x] Models: Branch, Role (permissions with scope), User (branchId, managerId), Customer, Product
- [x] bcrypt (bcryptjs) password hashing, `POST /api/auth/login` → JWT, `GET /api/auth/me`
- [x] `authenticate` middleware (role reloaded from DB per request)
- [x] One reusable guard: `authorize('deal.view')` → sets `req.scope`
- [x] `scopeFilter()` turns scope (own / branch / all) into a Mongo filter
- [x] Admin: manage roles & permissions (`/api/roles`, `/api/roles/permissions`)
- [x] Seed: 2 branches, 6 users (exec+manager per branch, finance, admin), 3 customers, 3 products, roles
- [ ] Seed approval config (Phase 4)
- Tests
  - [x] Login ok / wrong password 401 / invalid body 400 / no or bad token 401
  - [x] Exec → `/roles` 403, admin → 200; admin creates a new role as pure data; unknown permission key → 400
  - [x] Three users with `deal.view` get three different lists (exec 1 / manager 2 / finance 3)
  - [x] Scenario 01 (tested in Phase 3)

## Phase 3 – Deals (target 20 min)
- [x] Deal model (owner, branch, customer, item price snapshots, discount, totals, status)
- [x] `POST /api/deals`, `GET /api/deals`, `GET /api/deals/:id`, `PATCH /api/deals/:id`
- [x] `GET /api/customers`, `GET /api/products` (reference data)
- [x] Scope applied inside every query (list, detail, edit)
- [x] Status rules: only `open` deals are editable (409 otherwise)
- [x] Seed 3 deals (exec A, manager A, exec B)
- Tests (17/17)
  - [x] S01: exec A → Branch B deal 404; finance reads both
  - [x] Same-branch colleague's deal 404 for exec; manager B → Branch A deal 404; malformed id 404
  - [x] Create/edit by owner; other exec 404; finance 403 on edit/create; bad body / unknown product 400

## Phase 4 – Approval workflow (Part 2 · 20%) (target 50 min)
- [x] ApprovalConfig (bands → ordered role ids), admin `GET/PUT /api/approval-config` (validates 0–100 coverage, unknown roles)
- [x] Chain resolved from DB on every request (no restart, no if-else ladder); snapshotted into the request
- [x] `POST /api/deals/:id/discount-request` (≤ 10% → auto-approved → won)
- [x] `POST /api/approvals/:id/approve` / `reject` (reject requires remarks)
- [x] Sequential: acting on a later step → 409; atomic step advance on `currentStep`
- [x] Only your own step + `discount.approve` + scope; no self-approval
- [x] Rejection → deal `open`, chain closed; re-request = fresh chain (partial unique index: one pending chain per deal)
- [x] Append-only `approval_history` (update/delete/save-existing blocked at model level)
- [x] `GET /api/approvals/pending` – only items whose current step is the user's role, in scope, not their own
- [x] `GET /api/deals/:id/approvals` – requests + history
- [x] Domain event bus (`common/events.js`) publishes discount.requested / discount.decided (consumed in Phase 6)
- Tests (32/32 + append-only check)
  - [x] Scenario 02: 30% → 2 steps, finance first = 409, manager then finance → won
  - [x] Scenario 03: admin edits band → new 30% request has 3 steps, no restart
  - [x] Auto-approve, rejection reset, fresh chain, self-approval 403, cross-branch manager 404, double request 409

## Phase 5 – Invoicing & BillPort (Part 4 · 30%) (target 80 min)
### BillPort (separate app)
- [ ] `POST /billing/invoices`: 15% 503, 10% 6 s delay, else 201 QUEUED
- [ ] Same Idempotency-Key → same externalId (unique index)
- [ ] Verifies DealDesk's X-Signature
- [ ] `GET /billing/invoices/:externalId`
- [ ] Webhooks SENT → VIEWED → PAID/FAILED every 5–30 s
- [ ] 20% duplicates, out-of-order, 10% bad signature, retry if no answer in 3 s
- [ ] Toggle to stop sending webhooks (scenario 09)
### DealDesk
- [ ] `POST /deals/:id/convert` (won deal → Sale + Invoice locally, never fails on BillPort)
- [ ] Push worker: DB-backed queue (status + nextAttemptAt + lock), not in-memory
- [ ] Exponential backoff with cap + max attempts → terminal `push_failed`; manual retry endpoint
- [ ] Stable Idempotency-Key per invoice (stored, unique)
- [ ] HMAC-signed outbound request, 4 s timeout
- [ ] Webhook: raw body, verify HMAC before parsing → 401
- [ ] Dedup by eventId (unique index), stale events ignored by sequence
- [ ] Ack 200 then process async
- [ ] Status mapping QUEUED/SENT/VIEWED/PAID/FAILED → pending/sent/viewed/paid/failed
- [ ] On paid: reduce customer outstanding balance exactly once + live notification
- [ ] Reconciliation job, N minutes configurable
- [ ] integration_logs for every outbound attempt and inbound event
- [ ] `GET /invoices`, `GET /invoices/:id`, `GET /invoices/:id/logs`, cancel
- Tests
  - [ ] Scenario 05: BillPort down → retries with growing gaps → recovers
  - [ ] Scenario 06: same webhook ×3 → one change, two ignored duplicates logged
  - [ ] Scenario 07: PAID then VIEWED → stays paid
  - [ ] Scenario 08: tampered body → 401, nothing changes
  - [ ] Scenario 09: webhooks blocked → reconciliation fixes status

## Phase 6 – Chat & notifications (Part 3 · 15%) (target 35 min)
- [ ] Thread (one per deal) with participants + unread counts; Message model
- [ ] Participants: owner, owner's manager, anyone who comments
- [ ] `GET /threads` (mine only, last message preview, unread), `GET/POST /threads/:dealId/messages`, mark read
- [ ] Socket.IO JWT auth at handshake
- [ ] Rooms: `user:<id>` and `deal:<id>` (join only if participant)
- [ ] One realtime module for chat + notifications (discount requested / decided, invoice status)
- [ ] Plain HTML demo page
- Tests
  - [ ] Scenario 04: two participants live, non-participant gets nothing

## Phase 7 – Submission (target 30 min)
- [ ] Postman collection covering every endpoint
- [ ] README answering the six required questions
- [ ] `docker compose up` verified
- [ ] Screen recording: scenarios 5, 6, 7, 9 (done by you)
- [ ] Final review of this checklist

---

## Known limitations / pending
- (filled in as we go)
