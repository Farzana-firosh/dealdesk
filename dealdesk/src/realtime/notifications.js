// Translates domain events into socket deliveries. Services never talk to Socket.IO directly.
const { bus, EVENTS } = require('../common/events');
const { toUser, toDeal, notify, disconnectUser } = require('./emitter');
const User = require('../modules/users/user.model');
const Role = require('../modules/roles/role.model');
const Deal = require('../modules/deals/deal.model');
const notificationService = require('../modules/notifications/notification.service');
const logger = require('../common/logger');

// Stored first, then pushed live, so a user who is offline sees it next time they connect.
async function send(userIds, type, data) {
  const stored = await notificationService.createMany(userIds.map(String), type, data);
  stored.forEach((n, i) => notify(userIds[i], n));
}

// Users who should act on the request's current step: holders of that role whose
// discount.approve scope covers the deal's branch. Resolved in the query, not by filtering.
async function approversFor(request) {
  const role = await Role.findById(request.currentRoleId).lean();
  const scope = role?.permissions.find((p) => p.key === 'discount.approve')?.scope;
  if (!scope || scope === 'own') return [];

  return User.find({
    roleId: role._id,
    active: true,
    _id: { $ne: request.requestedBy },
    ...(scope === 'branch' && { branchId: request.branchId }),
  })
    .select('_id')
    .lean();
}

async function onDiscountRequested({ request, dealTitle }) {
  const approvers = await approversFor(request);
  if (!approvers.length) return;
  // a later step is published by the approval, which does not have the deal at hand
  const title = dealTitle ?? (await Deal.findById(request.dealId, 'title').lean())?.title;
  const current = request.steps[request.currentStep - 1];
  await send(approvers.map((u) => u._id), 'discount.requested', {
    requestId: request._id,
    dealId: request.dealId,
    dealTitle: title,
    discountPercent: request.discountPercent,
    step: current.step,
    totalSteps: request.steps.length,
    role: current.roleName,
  });
}

function onDiscountDecided({ request, step, action, remarks }) {
  return send([request.requestedBy], 'discount.decided', {
    requestId: request._id,
    dealId: request.dealId,
    step,
    action,
    remarks,
    requestStatus: request.status, // pending (next step) | approved | rejected
  });
}

function onInvoiceStatusChanged(data) {
  return send([data.ownerId], 'invoice.status_changed', data);
}

function onChatMessage({ dealId, message, participantIds }) {
  toDeal(dealId, 'chat:message', message);
  // lets each participant's thread list update its preview + unread badge, even if not in the room
  participantIds.forEach((id) => toUser(id, 'thread:updated', { dealId, lastMessage: message }));
}

const safe = (fn) => (payload) => Promise.resolve(fn(payload)).catch((err) => logger.error({ err }, 'notification delivery failed'));

function registerNotificationHandlers() {
  bus.on(EVENTS.DISCOUNT_REQUESTED, safe(onDiscountRequested));
  bus.on(EVENTS.DISCOUNT_DECIDED, safe(onDiscountDecided));
  bus.on(EVENTS.INVOICE_STATUS_CHANGED, safe(onInvoiceStatusChanged));
  bus.on(EVENTS.CHAT_MESSAGE, safe(onChatMessage));
  // REST already rejects a deactivated user's token; this also ends their live connections
  bus.on(EVENTS.USER_DEACTIVATED, safe(({ userId }) => disconnectUser(userId)));
}

module.exports = { registerNotificationHandlers };
