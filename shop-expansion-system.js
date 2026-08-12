export const SHOP_EXPANSION_STATE_VERSION = 1;

/**
 * Permanent shop upgrades. Percentage sale bonuses are additive and use the
 * original sale payout. They do not compound. With every sale upgrade active,
 * a sale can gain at most 15% of its base payout plus 3 coins.
 */
export const SHOP_EXPANSIONS = Object.freeze([
  Object.freeze({
    id: "display-shelves",
    objectName: "expansion-display-shelves",
    title: "Display Shelves",
    category: "Space",
    effectLabel: "+4 display slots · up to 20 stock capacity",
    copy: "Add a tall wall display with room for four more plants. It stacks with the Delivery Rack.",
    unlockWeek: 3,
    cost: Object.freeze({ coins: 120, bloom: 25 }),
    effects: Object.freeze({ displaySlots: 4, inventoryCapacity: 4 }),
  }),
  Object.freeze({
    id: "rare-nursery",
    objectName: "expansion-rare-nursery",
    title: "Rare Nursery Membership",
    category: "Supplier",
    effectLabel: "One rare specimen · +1 supplier choice",
    copy: "Join a specialist nursery. Its extra mixed delivery includes one rare specimen and stock for today’s notes.",
    unlockWeek: 4,
    cost: Object.freeze({ coins: 145, bloom: 32 }),
    effects: Object.freeze({ rareSpeciesUnlocked: true, supplierChoiceBonus: 1 }),
  }),
  Object.freeze({
    id: "checkout-bell",
    objectName: "expansion-checkout-bell",
    title: "Checkout Bell",
    category: "Sales",
    effectLabel: "+5% on every sale",
    copy: "Add a cheerful brass bell. Every sale pays 5% more.",
    unlockWeek: 5,
    cost: Object.freeze({ coins: 160, bloom: 35 }),
    effects: Object.freeze({ saleRate: 0.05 }),
  }),
  Object.freeze({
    id: "ceramic-sign",
    objectName: "expansion-ceramic-sign",
    title: "Ceramic Shop Sign",
    category: "Sales",
    effectLabel: "+10% on Boutique sales",
    unlockWeek: 6,
    cost: Object.freeze({ coins: 175, bloom: 40 }),
    copy: "Add a hand-painted sign. Boutique sales pay 10% more.",
    effects: Object.freeze({ boutiqueSaleRate: 0.10 }),
  }),
  Object.freeze({
    id: "scent-garden",
    objectName: "expansion-scent-garden",
    title: "Scent Garden",
    category: "Atmosphere",
    effectLabel: "+2 coins on perfect or lovely sales",
    copy: "Add a fragrant garden. Perfect and lovely sales pay 2 extra coins.",
    unlockWeek: 7,
    cost: Object.freeze({ coins: 195, bloom: 48 }),
    effects: Object.freeze({ lovelyFlatBonus: 2 }),
  }),
  Object.freeze({
    id: "wrapping-station",
    objectName: "expansion-wrapping-station",
    title: "Wrapping Station",
    category: "Service",
    effectLabel: "+1 coin on every sale",
    unlockWeek: 8,
    cost: Object.freeze({ coins: 220, bloom: 55 }),
    copy: "Wrap each plant with care. Every sale pays 1 extra coin.",
    effects: Object.freeze({ saleFlatBonus: 1 }),
  }),
]);

const EXPANSIONS_BY_ID = new Map(SHOP_EXPANSIONS.map((expansion) => [expansion.id, expansion]));

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function normalizedWeek(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : 1;
}

function purchasedEntries(value) {
  if (value instanceof Map) return [...value.entries()];
  if (Array.isArray(value)) {
    return value.map((entry) => Array.isArray(entry) ? entry : [entry, true]);
  }
  if (value && typeof value === "object") return Object.entries(value);
  return [];
}

function purchasedIdSet(value) {
  const ids = new Set();
  const source = Array.isArray(value) ? { purchasedIds: value } : value || {};

  purchasedEntries(source.purchased ?? source.purchasedMap).forEach(([id, purchased]) => {
    if (purchased && EXPANSIONS_BY_ID.has(id)) ids.add(id);
  });

  if (Array.isArray(source.purchasedIds)) {
    source.purchasedIds.forEach((id) => {
      if (EXPANSIONS_BY_ID.has(id)) ids.add(id);
    });
  }

  return ids;
}

/**
 * Convert missing, legacy, or partial upgrade data to a plain save object.
 * The map is convenient for lookups. The ordered list is convenient for UI.
 */
export function migrateExpansionState(value) {
  const ids = purchasedIdSet(value);
  const purchasedIds = SHOP_EXPANSIONS
    .map(({ id }) => id)
    .filter((id) => ids.has(id));
  const purchased = Object.fromEntries(purchasedIds.map((id) => [id, true]));

  return {
    version: SHOP_EXPANSION_STATE_VERSION,
    purchased,
    purchasedIds,
  };
}

export function expansionForId(id) {
  return EXPANSIONS_BY_ID.get(id) || null;
}

export function expansionUnlockedForWeek(id, week) {
  const expansion = expansionForId(id);
  return Boolean(expansion && normalizedWeek(week) >= expansion.unlockWeek);
}

function purchaseResult({
  ok,
  code,
  message,
  expansion,
  state,
  coins,
  bloom,
  reservedCoins,
}) {
  return {
    ok,
    code,
    message,
    expansion,
    cost: expansion?.cost || null,
    state,
    coins,
    bloom,
    reservedCoins,
    availableCoins: Math.max(0, coins - reservedCoins),
  };
}

/**
 * Check a permanent upgrade purchase without changing the supplied state.
 * reservedCoins cannot be spent. This keeps daily bills safe.
 */
export function validateExpansionPurchase({
  id,
  week = 1,
  state,
  coins = 0,
  bloom = 0,
  reservedCoins = 0,
} = {}) {
  const expansion = expansionForId(id);
  const migratedState = migrateExpansionState(state);
  const safeCoins = nonNegativeInteger(coins);
  const safeBloom = nonNegativeInteger(bloom);
  const safeReservedCoins = Math.min(safeCoins, nonNegativeInteger(reservedCoins));
  const result = (values) => purchaseResult({
    expansion,
    state: migratedState,
    coins: safeCoins,
    bloom: safeBloom,
    reservedCoins: safeReservedCoins,
    ...values,
  });

  if (!expansion) {
    return result({
      ok: false,
      code: "unknown-expansion",
      message: "This shop upgrade does not exist.",
    });
  }

  if (!expansionUnlockedForWeek(id, week)) {
    return result({
      ok: false,
      code: "locked",
      message: `${expansion.title} unlocks in Week ${expansion.unlockWeek}.`,
    });
  }

  if (migratedState.purchased[id]) {
    return result({
      ok: false,
      code: "already-purchased",
      message: `${expansion.title} is already in the shop.`,
    });
  }

  const availableCoins = safeCoins - safeReservedCoins;
  if (safeBloom < expansion.cost.bloom || availableCoins < expansion.cost.coins) {
    const missing = [];
    if (availableCoins < expansion.cost.coins) missing.push(`${expansion.cost.coins - availableCoins} coins`);
    if (safeBloom < expansion.cost.bloom) missing.push(`${expansion.cost.bloom - safeBloom} Bloom`);
    return result({
      ok: false,
      code: safeCoins >= expansion.cost.coins && availableCoins < expansion.cost.coins
        ? "reserved-coins"
        : "insufficient-resources",
      message: `You need ${missing.join(" and ")} more for ${expansion.title}${safeReservedCoins ? " after shop bills" : ""}.`,
    });
  }

  return result({
    ok: true,
    code: "ready",
    message: `${expansion.title} is ready to add.`,
  });
}

/** Purchase one permanent upgrade and return a new serializable state. */
export function purchaseExpansion(options = {}) {
  const validation = validateExpansionPurchase(options);
  if (!validation.ok) return validation;

  const purchasedIds = SHOP_EXPANSIONS
    .map(({ id }) => id)
    .filter((id) => validation.state.purchased[id] || id === validation.expansion.id);
  const state = {
    version: SHOP_EXPANSION_STATE_VERSION,
    purchased: Object.fromEntries(purchasedIds.map((id) => [id, true])),
    purchasedIds,
  };

  return purchaseResult({
    ok: true,
    code: "purchased",
    message: `${validation.expansion.title} is now part of the shop.`,
    expansion: validation.expansion,
    state,
    coins: validation.coins - validation.cost.coins,
    bloom: validation.bloom - validation.cost.bloom,
    reservedCoins: validation.reservedCoins,
  });
}

function hasLovelyExtra(extras) {
  if (typeof extras === "string") return extras.toLowerCase() === "lovely";
  if (Array.isArray(extras)) return extras.some(hasLovelyExtra);
  if (extras instanceof Set) return [...extras].some(hasLovelyExtra);
  if (!extras || typeof extras !== "object") return false;
  return extras.lovely === true
    || extras.isLovely === true
    || extras.quality === "lovely"
    || extras.rating === "lovely"
    || hasLovelyExtra(extras.tags);
}

/**
 * Get the extra whole coins for one sale. Percentage effects are added, then
 * rounded once from basePayout. Flat effects apply once. The maximum combined
 * effect is 15% of basePayout plus 3 coins. Perfect and lovely never double-pay.
 */
export function saleExpansionBonus({
  state,
  priceBand,
  perfect = false,
  extras,
  basePayout = 0,
} = {}) {
  const purchased = migrateExpansionState(state).purchased;
  const safeBasePayout = nonNegativeInteger(basePayout);
  let rate = 0;
  let flatBonus = 0;

  if (purchased["checkout-bell"]) {
    rate += expansionForId("checkout-bell").effects.saleRate;
  }
  if (purchased["ceramic-sign"] && String(priceBand).toLowerCase() === "boutique") {
    rate += expansionForId("ceramic-sign").effects.boutiqueSaleRate;
  }
  if (purchased["wrapping-station"]) {
    flatBonus += expansionForId("wrapping-station").effects.saleFlatBonus;
  }
  if (purchased["scent-garden"] && (perfect === true || hasLovelyExtra(extras))) {
    flatBonus += expansionForId("scent-garden").effects.lovelyFlatBonus;
  }

  return Math.round(safeBasePayout * rate) + flatBonus;
}
