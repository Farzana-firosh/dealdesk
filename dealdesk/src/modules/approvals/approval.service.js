const Deal = require('../deals/deal.model');
const ApprovalRequest = require('./approval-request.model');
const ApprovalHistory = require('./approval-history.model');
const { resolveChain } = require('./approval-config.service');
const dealService = require('../deals/deal.service');
const AppError = require('../../common/errors/AppError');
const { scopeFilter } = require('../auth/scope');
const { publish, EVENTS } = require('../../common/events');

const record = (request, step, user, action, remarks) =>
  ApprovalHistory.create({
    requestId: request._id,
    dealId: request.dealId,
    step,
    approverRole: user.role.name,
    approverId: user._id,
    action,
    remarks,
  });

async function markDealWon(dealId, discountPercent) {
  const deal = await Deal.findById(dealId);
  deal.set({ status: 'won', discountPercent, wonAt: new Date() });
  return deal.save(); // save (not update) so totals are recalculated
}

async function requestDiscount(user, scope, dealId, { discountPercent, remarks }) {
  const deal = await dealService.getDeal(user, scope, dealId, { populate: false });
  const chain = await resolveChain(discountPercent);

  // open -> pending_approval atomically, so two parallel requests cannot both start a chain
  const locked = await Deal.findOneAndUpdate({ _id: deal._id, status: 'open' }, { status: 'pending_approval' });
  if (!locked) throw AppError.conflict(`Deal is ${deal.status}; a discount can only be requested on an open deal`);

  const steps = chain.roles.map((role, i) => ({ step: i + 1, roleId: role._id, roleName: role.name }));
  const autoApproved = steps.length === 0;

  let request;
  try {
    request = await ApprovalRequest.create({
      dealId: deal._id,
      branchId: deal.branchId,
      requestedBy: user._id,
      discountPercent,
      remarks,
      steps,
      configVersion: chain.version,
      status: autoApproved ? 'approved' : 'pending',
      currentStep: autoApproved ? null : 1,
      currentRoleId: autoApproved ? null : steps[0].roleId,
      decidedAt: autoApproved ? new Date() : undefined,
    });
  } catch (err) {
    // no transactions on a standalone Mongo: undo the status change by hand
    await Deal.updateOne({ _id: deal._id, status: 'pending_approval' }, { status: 'open' });
    throw err;
  }

  await record(request, 0, user, 'requested', remarks);

  if (autoApproved) {
    await record(request, 0, user, 'auto_approved', 'Within auto-approval threshold');
    await markDealWon(deal._id, discountPercent);
  } else {
    publish(EVENTS.DISCOUNT_REQUESTED, { request: request.toObject(), dealTitle: deal.title });
  }

  return request;
}

// Works out why a user may not act on the current step: 404 / 403 / 409.
function assertCanAct(user, request) {
  if (request.status !== 'pending') throw AppError.conflict(`Request already ${request.status}`);
  if (String(request.requestedBy) === user.id) throw AppError.forbidden('You cannot approve your own request');

  const current = request.steps[request.currentStep - 1];
  if (String(current.roleId) === String(user.role._id)) return current;

  const laterStep = request.steps.find((s) => s.step > current.step && String(s.roleId) === String(user.role._id));
  if (laterStep) {
    throw AppError.conflict(`Step ${current.step} (${current.roleName}) is still pending; your step is ${laterStep.step}`);
  }
  throw AppError.forbidden('This request is not waiting on your role');
}

async function decide(user, scope, requestId, action, remarks) {
  // scope applies to the request's branch, so a manager cannot reach another branch's requests
  const request = await ApprovalRequest.findOne({ _id: requestId, ...scopeFilter(user, scope, { ownerField: 'requestedBy' }) });
  if (!request) throw AppError.notFound('Approval request not found');

  const current = assertCanAct(user, request);
  const isLast = current.step === request.steps.length;
  const finished = action === 'rejected' || isLast;
  const next = request.steps[current.step]; // undefined when last

  const update = {
    [`steps.${current.step - 1}.status`]: action,
    ...(finished
      ? { status: action, currentStep: null, currentRoleId: null, decidedAt: new Date() }
      : { currentStep: next.step, currentRoleId: next.roleId }),
  };

  // conditional on currentStep: if two approvers race, only one update matches
  const updated = await ApprovalRequest.findOneAndUpdate(
    { _id: request._id, status: 'pending', currentStep: current.step },
    { $set: update },
    { new: true },
  );
  if (!updated) throw AppError.conflict('This step was already decided');

  await record(updated, current.step, user, action, remarks);

  if (action === 'rejected') {
    await Deal.updateOne({ _id: updated.dealId, status: 'pending_approval' }, { status: 'open' });
  } else if (isLast) {
    await markDealWon(updated.dealId, updated.discountPercent);
  }

  publish(EVENTS.DISCOUNT_DECIDED, { request: updated.toObject(), step: current.step, action, decidedBy: user.id, remarks });
  if (!finished) publish(EVENTS.DISCOUNT_REQUESTED, { request: updated.toObject() });

  return updated;
}

// Only requests whose *current* step is addressed to this user's role, within their scope,
// excluding their own requests.
function pendingFor(user, scope) {
  return ApprovalRequest.find({
    status: 'pending',
    currentRoleId: user.role._id,
    requestedBy: { $ne: user._id },
    ...scopeFilter(user, scope, { ownerField: 'requestedBy' }),
  })
    .sort({ createdAt: 1 })
    .populate('dealId', 'title subtotal status')
    .populate('requestedBy', 'name email')
    .lean();
}

async function historyForDeal(user, scope, dealId) {
  await dealService.getDeal(user, scope, dealId, { populate: false }); // scope check
  const [requests, history] = await Promise.all([
    ApprovalRequest.find({ dealId }).sort({ createdAt: -1 }).lean(),
    ApprovalHistory.find({ dealId }).sort({ timestamp: 1 }).populate('approverId', 'name email').lean(),
  ]);
  return { requests, history };
}

module.exports = { requestDiscount, decide, pendingFor, historyForDeal };
