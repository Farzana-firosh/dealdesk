// Translates domain events into socket deliveries. Services never talk to Socket.IO directly.
const { bus, EVENTS } = require('../common/events');
const { toUser, toDeal, notify } = require('./emitter');
const User = require('../modules/users/user.model');
const Role = require('../modules/roles/role.model');

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
  const current = request.steps[request.currentStep - 1];
  approvers.forEach((u) =>
    notify(u._id, 'discount.requested', {
      requestId: request._id,
      dealId: request.dealId,
      dealTitle,
      discountPercent: request.discountPercent,
      step: current.step,
      totalSteps: request.steps.length,
      role: current.roleName,
    }),
  );
}

function onDiscountDecided({ request, step, action, remarks }) {
  notify(request.requestedBy, 'discount.decided', {
    requestId: request._id,
    dealId: request.dealId,
    step,
    action,
    remarks,
    requestStatus: request.status, // pending (next step) | approved | rejected
  });
}

function onInvoiceStatusChanged(data) {
  notify(data.ownerId, 'invoice.status_changed', data);
}

function onChatMessage({ dealId, message, participantIds }) {
  toDeal(dealId, 'chat:message', message);
  // lets each participant's thread list update its preview + unread badge, even if not in the room
  participantIds.forEach((id) => toUser(id, 'thread:updated', { dealId, lastMessage: message }));
}

const safe = (fn) => (payload) => Promise.resolve(fn(payload)).catch((err) => console.error('[notifications]', err));

function registerNotificationHandlers() {
  bus.on(EVENTS.DISCOUNT_REQUESTED, safe(onDiscountRequested));
  bus.on(EVENTS.DISCOUNT_DECIDED, safe(onDiscountDecided));
  bus.on(EVENTS.INVOICE_STATUS_CHANGED, safe(onInvoiceStatusChanged));
  bus.on(EVENTS.CHAT_MESSAGE, safe(onChatMessage));
}

module.exports = { registerNotificationHandlers };
