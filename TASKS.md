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
- [ ] Models: Branch, Role (permissions with scope), User (branchId, managerId), Customer, Product
- [ ] bcrypt password hashing, `POST /auth/login` → JWT, `GET /auth/me`
- [ ] `authenticate` middleware
- [ ] One reusable guard: `authorize('deal.view')` → sets `req.scope`
- [ ] `scopeFilter()` turns scope (own / branch / all) into a Mongo filter
- [ ] Admin: manage roles & permissions (`/roles`)
- [ ] Seed: 2 branches, 6 users (exec+manager per branch, finance, admin), 3 customers, 3 products, roles, approval config
- Tests
  - [ ] Three users with `deal.view` get three different lists
  - [ ] Scenario 01: exec A → Branch B deal by id = 404; finance reads both

## Phase 3 – Deals (target 20 min)
- [ ] Deal model (owner, branch, customer, line items, discount, status)
- [ ] `POST /deals`, `GET /deals`, `GET /deals/:id`, `PATCH /deals/:id`
- [ ] Scope applied inside every query (list, detail, edit)
- [ ] Status rules: only `open` deals are editable

## Phase 4 – Approval workflow (Part 2 · 20%) (target 50 min)
- [ ] ApprovalConfig (bands → ordered role ids), admin `GET/PUT /approval-config`
- [ ] Chain resolved from DB on every request (no restart, no if-else ladder)
- [ ] `POST /deals/:id/discount-request` (≤ auto threshold → auto-approved → won)
- [ ] `POST /approvals/:id/approve` / `reject` with remarks
- [ ] Sequential: acting on a later step → 409; atomic step advance
- [ ] Only your own step + `discount.approve`; no self-approval
- [ ] Rejection → deal `open`, chain cleared; re-request = fresh chain
- [ ] Append-only ApprovalHistory (update/delete blocked at model level)
- [ ] `GET /approvals/pending` – only items waiting on the logged-in user
- Tests
  - [ ] Scenario 02: 30% → 2 steps, finance first = 409, then won
  - [ ] Scenario 03: admin edits band → new 30% request has 3 steps

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
