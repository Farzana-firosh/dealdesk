const ApprovalConfig = require('./approval-config.model');
const Role = require('../roles/role.model');
const AppError = require('../../common/errors/AppError');

const CONFIG_KEY = 'discount';

// (min, max] — the band starting at 0 also includes 0 itself
const inBand = (band, pct) => pct <= band.maxPercent && (pct > band.minPercent || (band.minPercent === 0 && pct === 0));

function getConfig() {
  return ApprovalConfig.findOne({ key: CONFIG_KEY }).populate('bands.steps', 'name').lean();
}

// Resolved from the DB on every call: changing the config changes behaviour immediately.
async function resolveChain(discountPercent) {
  const config = await getConfig();
  if (!config) throw new AppError(500, 'Approval configuration missing');

  const band = config.bands.find((b) => inBand(b, discountPercent));
  if (!band) throw AppError.badRequest(`No approval band covers ${discountPercent}%`);

  return { version: config.version, roles: band.steps };
}

// Bands must cover 0–100 with no gaps or overlaps.
function assertContiguous(bands) {
  const sorted = [...bands].sort((a, b) => a.minPercent - b.minPercent);
  if (sorted[0].minPercent !== 0) throw AppError.badRequest('First band must start at 0');
  if (sorted.at(-1).maxPercent !== 100) throw AppError.badRequest('Last band must end at 100');

  sorted.forEach((band, i) => {
    if (band.maxPercent <= band.minPercent) throw AppError.badRequest('maxPercent must be greater than minPercent');
    if (i > 0 && band.minPercent !== sorted[i - 1].maxPercent) {
      throw AppError.badRequest(`Gap or overlap at ${band.minPercent}%`);
    }
  });
  return sorted;
}

// Admins send role names; we store role ids so a role rename does not break the chain.
async function toRoleIds(bands) {
  const names = [...new Set(bands.flatMap((b) => b.steps))];
  const roles = await Role.find({ name: { $in: names } }).lean();
  const idByName = new Map(roles.map((r) => [r.name, r._id]));

  const unknown = names.filter((n) => !idByName.has(n));
  if (unknown.length) throw AppError.badRequest(`Unknown roles: ${unknown.join(', ')}`);

  return bands.map((b) => ({ ...b, steps: b.steps.map((name) => idByName.get(name)) }));
}

async function replaceConfig(user, bands) {
  const resolved = await toRoleIds(assertContiguous(bands));
  await ApprovalConfig.findOneAndUpdate(
    { key: CONFIG_KEY },
    { bands: resolved, updatedBy: user._id, $inc: { version: 1 } },
    { upsert: true, runValidators: true },
  );
  return getConfig();
}

module.exports = { getConfig, resolveChain, replaceConfig, CONFIG_KEY };
