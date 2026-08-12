export const SHOP_SUPPLY_STATE_VERSION = 1;
export const CUSTOMER_ADD_ON_CHANCE_PERCENT = 40;

/**
 * Small shop supplies. `stock` is the total number owned. Clip-grow-light
 * assignments reduce the available number without reducing owned stock.
 * Consumable packs and add-on margins stay deliberately small and bounded.
 */
export const SUPPLY_CATALOG = Object.freeze([
  Object.freeze({
    id: "clip-grow-light",
    title: "Clip Grow Light",
    category: "Equipment",
    copy: "Assign one reusable light to one plant. Release it when the plant no longer needs it.",
    reusable: true,
    consumable: false,
    customerAddOn: false,
    buyPrice: 42,
    buyQuantity: 1,
    restockPrice: 36,
    restockQuantity: 1,
    maxStock: 4,
  }),
  Object.freeze({
    id: "fertilizer",
    title: "Gentle Fertilizer",
    category: "Plant care",
    copy: "A mild feed for established plants and an optional customer add-on.",
    reusable: false,
    consumable: true,
    customerAddOn: true,
    buyPrice: 18,
    buyQuantity: 3,
    restockPrice: 12,
    restockQuantity: 3,
    maxStock: 12,
    unitCost: 4,
    salePrice: 7,
    requestCopy: "Could I add a small bag of gentle fertilizer?",
  }),
  Object.freeze({
    id: "fungicide",
    title: "Leaf-Safe Fungicide",
    category: "Plant care",
    copy: "A careful fungal treatment and an optional customer add-on.",
    reusable: false,
    consumable: true,
    customerAddOn: true,
    buyPrice: 24,
    buyQuantity: 3,
    restockPrice: 18,
    restockQuantity: 3,
    maxStock: 9,
    unitCost: 6,
    salePrice: 9,
    requestCopy: "Could I take a leaf-safe fungicide sachet as well?",
  }),
  Object.freeze({
    id: "neem-spray",
    title: "Mite Medicine",
    category: "Plant care",
    copy: "A neem-based shop treatment for plants with mite trouble.",
    reusable: false,
    consumable: true,
    customerAddOn: false,
    buyPrice: 20,
    buyQuantity: 3,
    restockPrice: 15,
    restockQuantity: 3,
    maxStock: 9,
    unitCost: 5,
  }),
  Object.freeze({
    id: "potting-soil",
    title: "Potting Soil",
    category: "Retail add-on",
    copy: "A small bag that customers can add to a plant purchase.",
    reusable: false,
    consumable: true,
    customerAddOn: true,
    buyPrice: 16,
    buyQuantity: 4,
    restockPrice: 12,
    restockQuantity: 4,
    maxStock: 16,
    unitCost: 3,
    salePrice: 5,
    requestCopy: "Could I add a small bag of potting soil?",
  }),
]);

const CATALOG_BY_ID = new Map(SUPPLY_CATALOG.map((item) => [item.id, item]));
const CUSTOMER_ADD_ON_ITEMS = SUPPLY_CATALOG.filter((item) => item.customerAddOn);

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : fallback;
}

function recordEntries(value) {
  if (value instanceof Map) return [...value.entries()];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (Array.isArray(entry)) return [entry];
      if (entry && typeof entry === "object" && typeof entry.id === "string") {
        return [[entry.id, entry.count ?? entry.quantity ?? entry.stock ?? entry.value ?? true]];
      }
      return typeof entry === "string" ? [[entry, true]] : [];
    });
  }
  return value && typeof value === "object" ? Object.entries(value) : [];
}

function stockCount(value) {
  if (value && typeof value === "object") {
    return nonNegativeInteger(value.count ?? value.quantity ?? value.stock);
  }
  return nonNegativeInteger(value);
}

function purchasedIds(value) {
  const ids = new Set();
  const source = value || {};
  recordEntries(source.purchased ?? source.unlocked ?? source.owned).forEach(([id, purchased]) => {
    if (purchased && CATALOG_BY_ID.has(id)) ids.add(id);
  });
  const lists = [source.purchasedIds, source.unlockedIds, source.ownedIds];
  lists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((id) => {
      if (CATALOG_BY_ID.has(id)) ids.add(id);
    });
  });
  return ids;
}

function assignmentPlantIds(value) {
  return recordEntries(value)
    .filter(([plantId, assignment]) => typeof plantId === "string"
      && plantId.trim()
      && (assignment === true || (typeof assignment === "string" && assignment.trim())))
    .map(([plantId]) => plantId.trim())
    .filter((plantId, index, values) => values.indexOf(plantId) === index)
    .sort((left, right) => left.localeCompare(right));
}

function lightUnitId(index) {
  return `clip-grow-light-${index + 1}`;
}

export function createDefaultSupplyState() {
  return {
    version: SHOP_SUPPLY_STATE_VERSION,
    stock: Object.fromEntries(SUPPLY_CATALOG.map(({ id }) => [id, 0])),
    purchased: {},
    lightAssignments: {},
  };
}

/** Convert missing, legacy, or partial supply data to a plain JSON save. */
export function migrateSupplyState(value) {
  const source = value || {};
  const stockSource = source.stock ?? source.inventory ?? source.supplies;
  const suppliedStock = new Map(recordEntries(stockSource));
  const stock = Object.fromEntries(SUPPLY_CATALOG.map((item) => [
    item.id,
    Math.min(item.maxStock, stockCount(suppliedStock.get(item.id))),
  ]));
  const purchasedSet = purchasedIds(source);
  SUPPLY_CATALOG.forEach(({ id }) => {
    if (stock[id] > 0) purchasedSet.add(id);
  });

  // An old assignment is proof that its reusable light existed. Preserve it
  // by restoring enough total light stock, up to the catalog limit.
  const light = CATALOG_BY_ID.get("clip-grow-light");
  const requestedAssignments = assignmentPlantIds(
    source.lightAssignments ?? source.growLightAssignments ?? source.assignments,
  ).slice(0, light.maxStock);
  if (requestedAssignments.length) {
    stock[light.id] = Math.max(stock[light.id], requestedAssignments.length);
    purchasedSet.add(light.id);
  }
  const keptAssignments = requestedAssignments.slice(0, stock[light.id]);
  const lightAssignments = Object.fromEntries(
    keptAssignments.map((plantId, index) => [plantId, lightUnitId(index)]),
  );

  const purchased = Object.fromEntries(
    SUPPLY_CATALOG.filter(({ id }) => purchasedSet.has(id)).map(({ id }) => [id, true]),
  );
  return {
    version: SHOP_SUPPLY_STATE_VERSION,
    stock,
    purchased,
    lightAssignments,
  };
}

export function supplyItemForId(id) {
  return CATALOG_BY_ID.get(id) || null;
}

function purchasePlan(id, supplyState) {
  const item = supplyItemForId(id);
  if (!item) return null;
  const firstPurchase = !supplyState.purchased[id];
  return {
    item,
    firstPurchase,
    price: firstPurchase ? item.buyPrice : item.restockPrice,
    quantity: firstPurchase ? item.buyQuantity : item.restockQuantity,
  };
}

function purchaseResult({
  ok,
  code,
  message,
  supplyState,
  item,
  firstPurchase = false,
  price = 0,
  quantity = 0,
  coins = 0,
  reservedCoins = 0,
  stockBefore = 0,
  stockAfter = stockBefore,
}) {
  return {
    ok,
    code,
    message,
    supplyState,
    item,
    firstPurchase,
    price,
    quantity,
    coins,
    reservedCoins,
    availableCoins: Math.max(0, coins - reservedCoins),
    stockBefore,
    stockAfter,
  };
}

/** Check a first purchase or later restock without changing the input. */
export function validateSupplyPurchase({
  id,
  supplyState,
  coins = 0,
  reservedCoins = 0,
} = {}) {
  const state = migrateSupplyState(supplyState);
  const safeCoins = nonNegativeInteger(coins);
  const safeReserved = Math.min(safeCoins, nonNegativeInteger(reservedCoins));
  const plan = purchasePlan(id, state);
  const item = plan?.item || null;
  const stockBefore = item ? state.stock[item.id] : 0;
  const result = (values) => purchaseResult({
    supplyState: state,
    item,
    coins: safeCoins,
    reservedCoins: safeReserved,
    stockBefore,
    ...plan,
    ...values,
  });

  if (!plan) {
    return result({
      ok: false,
      code: "unknown-supply",
      message: "This shop supply does not exist.",
    });
  }
  if (stockBefore + plan.quantity > item.maxStock) {
    return result({
      ok: false,
      code: "stock-limit",
      message: `${item.title} holds up to ${item.maxStock}. Use some stock before you restock.`,
    });
  }
  const spendableCoins = safeCoins - safeReserved;
  if (spendableCoins < plan.price) {
    const missing = plan.price - spendableCoins;
    return result({
      ok: false,
      code: safeCoins >= plan.price ? "reserved-coins" : "insufficient-coins",
      message: `You need ${missing} more ${missing === 1 ? "coin" : "coins"} for ${item.title}${safeReserved ? " after shop bills" : ""}.`,
    });
  }
  return result({
    ok: true,
    code: "ready",
    message: `${item.title} is ready to ${plan.firstPurchase ? "buy" : "restock"}.`,
    stockAfter: stockBefore + plan.quantity,
  });
}

/** Buy the first pack or restock one fixed pack. */
export function purchaseSupply(options = {}) {
  const validation = validateSupplyPurchase(options);
  if (!validation.ok) return validation;
  const { item, stockBefore, stockAfter } = validation;
  const supplyState = {
    ...validation.supplyState,
    stock: { ...validation.supplyState.stock, [item.id]: stockAfter },
    purchased: { ...validation.supplyState.purchased, [item.id]: true },
    lightAssignments: { ...validation.supplyState.lightAssignments },
  };
  return purchaseResult({
    ...validation,
    ok: true,
    code: validation.firstPurchase ? "purchased" : "restocked",
    message: `${item.title} added ${validation.quantity} ${validation.quantity === 1 ? "unit" : "units"}.`,
    supplyState,
    coins: validation.coins - validation.price,
    stockBefore,
    stockAfter,
  });
}

export const restockSupply = purchaseSupply;

function stockChangeResult({
  ok,
  code,
  message,
  item,
  supplyState,
  quantity = 0,
  stockBefore = 0,
  stockAfter = stockBefore,
}) {
  return { ok, code, message, item, supplyState, quantity, stockBefore, stockAfter };
}

/** Consume one or more non-reusable care items. */
export function consumeSupply({ id, supplyState, quantity = 1 } = {}) {
  const state = migrateSupplyState(supplyState);
  const item = supplyItemForId(id);
  const safeQuantity = positiveInteger(quantity);
  const stockBefore = item ? state.stock[item.id] : 0;
  const result = (values) => stockChangeResult({
    item,
    supplyState: state,
    quantity: safeQuantity,
    stockBefore,
    ...values,
  });
  if (!item) return result({ ok: false, code: "unknown-supply", message: "This shop supply does not exist." });
  if (item.reusable) {
    return result({
      ok: false,
      code: "reusable-supply",
      message: `${item.title} is reusable. Assign it instead of consuming it.`,
    });
  }
  if (stockBefore < safeQuantity) {
    return result({
      ok: false,
      code: "insufficient-stock",
      message: `${item.title} needs ${safeQuantity} in stock.`,
    });
  }
  const stockAfter = stockBefore - safeQuantity;
  const nextState = {
    ...state,
    stock: { ...state.stock, [item.id]: stockAfter },
    purchased: { ...state.purchased },
    lightAssignments: { ...state.lightAssignments },
  };
  return result({
    ok: true,
    code: "consumed",
    message: `${safeQuantity} ${item.title} ${safeQuantity === 1 ? "unit was" : "units were"} used.`,
    supplyState: nextState,
    stockAfter,
  });
}

export function assignedClipGrowLightCount(supplyState) {
  return Object.keys(migrateSupplyState(supplyState).lightAssignments).length;
}

export function availableClipGrowLightCount(supplyState) {
  const state = migrateSupplyState(supplyState);
  return Math.max(0, state.stock["clip-grow-light"] - Object.keys(state.lightAssignments).length);
}

export function plantHasClipGrowLight(supplyState, plantId) {
  if (typeof plantId !== "string" || !plantId.trim()) return false;
  return Boolean(migrateSupplyState(supplyState).lightAssignments[plantId.trim()]);
}

function lightResult({
  ok,
  code,
  message,
  supplyState,
  plantId,
  lightId = null,
  changed = false,
}) {
  return {
    ok,
    code,
    message,
    supplyState,
    plantId,
    lightId,
    changed,
    assignedCount: Object.keys(supplyState.lightAssignments).length,
    availableCount: availableClipGrowLightCount(supplyState),
    totalOwned: supplyState.stock["clip-grow-light"],
  };
}

/** Assign one available reusable unit to a plant. */
export function assignClipGrowLight({ supplyState, plantId } = {}) {
  const state = migrateSupplyState(supplyState);
  const safePlantId = typeof plantId === "string" ? plantId.trim() : "";
  if (!safePlantId) {
    return lightResult({
      ok: false,
      code: "plant-required",
      message: "Choose a plant for the clip grow light.",
      supplyState: state,
      plantId: null,
    });
  }
  const currentLight = state.lightAssignments[safePlantId];
  if (currentLight) {
    return lightResult({
      ok: true,
      code: "already-assigned",
      message: "This plant already has a clip grow light.",
      supplyState: state,
      plantId: safePlantId,
      lightId: currentLight,
    });
  }
  if (availableClipGrowLightCount(state) <= 0) {
    return lightResult({
      ok: false,
      code: "no-light-available",
      message: "Every clip grow light is in use.",
      supplyState: state,
      plantId: safePlantId,
    });
  }
  const used = new Set(Object.values(state.lightAssignments));
  let lightId = null;
  for (let index = 0; index < state.stock["clip-grow-light"]; index += 1) {
    const candidate = lightUnitId(index);
    if (!used.has(candidate)) {
      lightId = candidate;
      break;
    }
  }
  const nextState = {
    ...state,
    stock: { ...state.stock },
    purchased: { ...state.purchased },
    lightAssignments: { ...state.lightAssignments, [safePlantId]: lightId },
  };
  return lightResult({
    ok: true,
    code: "assigned",
    message: "Clip grow light assigned.",
    supplyState: nextState,
    plantId: safePlantId,
    lightId,
    changed: true,
  });
}

/** Release one reusable unit so another plant can use it. */
export function releaseClipGrowLight({ supplyState, plantId } = {}) {
  const state = migrateSupplyState(supplyState);
  const safePlantId = typeof plantId === "string" ? plantId.trim() : "";
  const lightId = safePlantId ? state.lightAssignments[safePlantId] : null;
  if (!safePlantId) {
    return lightResult({
      ok: false,
      code: "plant-required",
      message: "Choose a plant with an assigned clip grow light.",
      supplyState: state,
      plantId: null,
    });
  }
  if (!lightId) {
    return lightResult({
      ok: true,
      code: "not-assigned",
      message: "This plant has no clip grow light to release.",
      supplyState: state,
      plantId: safePlantId,
    });
  }
  const lightAssignments = { ...state.lightAssignments };
  delete lightAssignments[safePlantId];
  const nextState = {
    ...state,
    stock: { ...state.stock },
    purchased: { ...state.purchased },
    lightAssignments,
  };
  return lightResult({
    ok: true,
    code: "released",
    message: "Clip grow light returned to available equipment.",
    supplyState: nextState,
    plantId: safePlantId,
    lightId,
    changed: true,
  });
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function recordIdentity(value, fallback) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return fallback;
  return String(value.id ?? value.name ?? value.speciesId ?? value.species ?? fallback);
}

/**
 * Generate one stable optional request. Stock is not considered here. This
 * gives the player a reason to hold supplies, while a missed add-on never
 * changes the plant sale.
 */
export function generateCustomerAddOnRequest({
  day = 1,
  customer,
  customerId,
  plant,
  plantId,
  saleIndex = 0,
} = {}) {
  const safeDay = positiveInteger(day);
  const customerKey = recordIdentity(customerId ?? customer, "customer");
  const plantKey = recordIdentity(plantId ?? plant, "plant");
  const safeSaleIndex = nonNegativeInteger(saleIndex);
  const seed = `${safeDay}|${customerKey}|${plantKey}|${safeSaleIndex}`;
  if (hashText(`${seed}|chance`) % 100 >= CUSTOMER_ADD_ON_CHANCE_PERCENT) return null;
  const item = CUSTOMER_ADD_ON_ITEMS[hashText(`${seed}|item`) % CUSTOMER_ADD_ON_ITEMS.length];
  return {
    requestId: `add-on-${safeDay}-${hashText(seed).toString(36)}`,
    itemId: item.id,
    title: item.title,
    copy: item.requestCopy,
    optional: true,
    blocksPlantSale: false,
    salePrice: item.salePrice,
    costOfGoods: item.unitCost,
    profit: item.salePrice - item.unitCost,
  };
}

function addOnSaleResult({
  ok = true,
  code,
  message,
  supplyState,
  request,
  item,
  accepted,
  sold = false,
  coins,
  stockBefore = 0,
  stockAfter = stockBefore,
  revenue = 0,
  costOfGoods = 0,
  profit = 0,
}) {
  return {
    ok,
    code,
    message,
    plantSaleAllowed: true,
    addOnSold: sold,
    accepted,
    request,
    item,
    supplyState,
    coins,
    revenue,
    costOfGoods,
    profit,
    stockBefore,
    stockAfter,
  };
}

/** Resolve an optional add-on. Every result leaves the plant sale allowed. */
export function sellCustomerAddOn({
  request,
  supplyState,
  coins = 0,
  accepted = true,
} = {}) {
  const state = migrateSupplyState(supplyState);
  const safeCoins = nonNegativeInteger(coins);
  const itemId = request?.itemId ?? request?.id;
  const item = supplyItemForId(itemId);
  const stockBefore = item ? state.stock[item.id] : 0;
  const result = (values) => addOnSaleResult({
    supplyState: state,
    request: request || null,
    item,
    accepted: Boolean(accepted),
    coins: safeCoins,
    stockBefore,
    ...values,
  });

  if (!request) {
    return result({ code: "no-request", message: "No add-on was requested." });
  }
  if (!item || !item.customerAddOn) {
    return result({
      ok: false,
      code: "invalid-add-on",
      message: "This optional add-on is not available.",
    });
  }
  if (!accepted) {
    return result({ code: "declined", message: `${item.title} was not added.` });
  }
  if (stockBefore <= 0) {
    return result({
      code: "add-on-out-of-stock",
      message: `${item.title} is out of stock. The plant sale continues.`,
    });
  }

  const stockAfter = stockBefore - 1;
  const revenue = item.salePrice;
  const costOfGoods = item.unitCost;
  const profit = revenue - costOfGoods;
  const nextState = {
    ...state,
    stock: { ...state.stock, [item.id]: stockAfter },
    purchased: { ...state.purchased },
    lightAssignments: { ...state.lightAssignments },
  };
  return result({
    code: "add-on-sold",
    message: `${item.title} sold for ${revenue} coins. ${profit} coins of add-on profit.`,
    supplyState: nextState,
    sold: true,
    coins: safeCoins + revenue,
    stockAfter,
    revenue,
    costOfGoods,
    profit,
  });
}
