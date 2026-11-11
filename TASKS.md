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
- [x] `POST /billing/invoices`: 15% 503, 10% 6 s delay, else 201 QUEUED
- [x] Same Idempotency-Key → same externalId (unique index + E11000 race handling)
- [x] Verifies DealDesk's X-Signature (401)
- [x] `GET /billing/invoices/:externalId`
- [x] Lifecycle SENT → VIEWED → PAID/FAILED at random 5–30 s steps (DB-driven)
- [x] Webhooks: 20% duplicates, 25% VIEWED held back (out of order), 10% bad signature, 3 s timeout → retry with backoff
- [x] `/admin/chaos` to tune misbehaviour / disable webhooks (scenario 09); `/admin/invoices`, `/admin/deliveries`
### DealDesk
- [x] `POST /api/deals/:id/convert` (invoice.issue) – won deal → Sale + Invoice locally; idempotent (unique saleId/dealId)
- [x] Push worker: MongoDB-backed (pushStatus + nextPushAt + lock with expiry), atomic claim
- [x] Exponential backoff (2s→60s cap, ±20% jitter), 8 attempts → terminal `failed`; `POST /api/invoices/:id/retry-push`
- [x] Stable Idempotency-Key per invoice (generated once at creation, unique index)
- [x] HMAC-signed outbound request, 4 s timeout (AbortSignal)
- [x] Webhook: `express.raw`, HMAC verified (timingSafeEqual) before parsing → 401
- [x] Dedup by eventId (unique index on `webhook_events`), stale events ignored by sequence + forward-only rank
- [x] Ack 200 then process async (setImmediate) + sweep job for crash recovery / unknown-invoice retries
- [x] Status mapping QUEUED/SENT/VIEWED/PAID/FAILED → pending/sent/viewed/paid/failed
- [x] On paid: outstanding balance reduced exactly once (inside the guarded transition) + `invoice.status_changed` event
- [x] Reconciliation job, N = `RECONCILE_STALE_MINUTES` (default 1)
- [x] `integration_logs` for every push attempt, inbound webhook (incl. rejected/duplicate/stale) and reconcile call
- [x] `GET /api/invoices`, `/:id`, `/:id/logs`, `POST /:id/cancel`
- [x] `scripts/send-webhook.js` for replay / out-of-order / tamper demos
- Tests (22/22 + live chaos run)
  - [x] Idempotency: forced 6 s response → timeout → retry → exactly one BillPort invoice, same externalId
  - [x] Scenario 05: BillPort failing → retries with growing gaps (3s,4s,8s…) → recovers on its own
  - [x] Scenario 06: same webhook ×3 → one change, two `duplicate_ignored` logs
  - [x] Scenario 07: PAID then VIEWED → stays paid; balance reduced once
  - [x] Scenario 08: tampered body → 401, nothing changes
  - [x] Scenario 09: webhooks dropped → reconciliation repairs status

## Phase 6 – Chat & notifications (Part 3 · 15%) (target 35 min)
- [x] Thread (one per deal, unique dealId) with participants + stored unread counts; Message model
- [x] Participants: owner, owner's manager (created with the deal), anyone who comments (if they can see the deal)
- [x] `GET /api/threads` (mine only, last message preview, unread), `GET/POST /api/threads/:dealId/messages`, `POST /:dealId/read`
- [x] Socket.IO JWT auth at handshake (`io.use`)
- [x] Rooms: `user:<id>` (auto) and `deal:<id>` (join only after participant check)
- [x] One event layer: services publish to `common/events.js`; `realtime/notifications.js` maps events to rooms
- [x] Notifications: discount.requested → current-step approvers (scoped), discount.decided → requester, invoice.status_changed → deal owner
- [x] Bonus: typing indicator (relayed only inside a joined room)
- [x] Plain HTML demo page (`dealdesk/public/index.html`) covering the full workflow
- Tests (26/26)
  - [x] Scenario 04: two participants live, non-participant can't join room, receives nothing, doesn't see thread
  - [x] Unauthenticated / bad-token socket rejected at handshake
  - [x] Offline participant's unread count correct on next login; mark read; history persisted
  - [x] Notifications reach only the right users (other-branch manager and later-step finance excluded)

## Phase 6b – Demo UI (`frontend/`, React + Vite)
- [x] Separate app; backend is API-only (old static page removed)
- [x] Reusable components in `components/common` (Button, Input, Select, TextArea, Card, Badge/StatusBadge, Table, Modal, Avatar, Icon, EmptyState, Field)
- [x] Layout: permission-filtered sidebar with unread / pending counts, top bar with live status + notification bell, mobile drawer
- [x] Pages: Login, Deals (+ new deal, discount request, approval history), Deal chat (threads, conversation, deal details), Approvals, Invoices (+ integration log), Approval rules (admin)
- [x] Responsive (desktop 3-column chat → tablet 2-column → mobile single view)
- Tests
  - [x] Headless Edge walkthrough: login error, scoped deals, live chat between two users, discount → manager notification + pending, admin rules, finance invoices – no page errors
  - [x] Mobile 390px: no horizontal overflow, drawer menu
  - [x] Proxy: REST + websocket through Vite
  - [x] Fixed: reload right after login no longer logs out (only a 401 ends the session)

## Phase 7 – Submission (target 30 min)
- [x] Postman collection covering every endpoint (`postman/`, 84 requests, 111 assertions – passes via newman locally and against Docker)
- [x] README answering the six required questions + run instructions, API overview, scenario guide, trade-offs
- [x] `docker compose up --build` verified: health, seed, full Postman run, container-to-container webhooks
- [x] Mongoose 9 deprecation (`new: true` → `returnDocument: 'after'`) cleaned up
- [x] Full regression: phase test scripts 2–6 all pass
- [ ] Screen recording: scenarios 5, 6, 7, 9 (by candidate)
- [x] Final review of this checklist

---

## Known limitations / pending
- Notifications are live-only (not persisted); pending approvals / invoice status / unread counts remain correct via the API.
- Invoice cancel is local only (BillPort contract has no cancel endpoint).
- No in-repo automated test suite (Jest/Supertest); verified with scripts + asserted Postman collection.
- Plain JavaScript (TypeScript was optional).
- Standalone MongoDB → no transactions; conditional updates + idempotent/compensating writes instead.
