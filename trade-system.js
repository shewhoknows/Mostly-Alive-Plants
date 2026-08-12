import {
  CUSTOMERS,
  INVENTORY_CAPACITY,
  SPECIES,
  WEEKDAYS,
  WEEKLY_OBJECTIVES,
} from "./game-data.js";

export const TRADE_PROFILE_VERSION = 1;

const WEEK_ONE_VISITORS = [3, 3, 3, 3, 3];
const WEEK_TWO_VISITORS = [4, 4, 5, 4, 5];
const MATURE_VISITOR_PATTERNS = [
  [4, 5, 5, 5, 6],
  [5, 4, 5, 6, 6],
  [5, 5, 4, 5, 6],
  [4, 5, 6, 5, 6],
];
const WEEK_ONE_UTILITIES = [0, 1, 1, 1, 2];
const MATURE_UTILITIES = [1, 2, 1, 2, 3];

const SALE_METRICS = new Set([
  "plantsSold",
  "perfectBriefs",
  "quickSales",
  "returningCustomersDelighted",
]);

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function capacityInteger(value, fallback = INVENTORY_CAPACITY) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback;
}

function calendarForDay(day) {
  const safeDay = positiveInteger(day);
  const weekdayIndex = (safeDay - 1) % WEEKDAYS.length;
  return {
    day: safeDay,
    week: Math.floor((safeDay - 1) / WEEKDAYS.length) + 1,
    weekdayIndex,
    weekday: WEEKDAYS[weekdayIndex],
  };
}

function requestedVisitorCount(calendar) {
  if (calendar.week === 1) return WEEK_ONE_VISITORS[calendar.weekdayIndex];
  if (calendar.week === 2) return WEEK_TWO_VISITORS[calendar.weekdayIndex];
  const pattern = MATURE_VISITOR_PATTERNS[(calendar.week - 3) % MATURE_VISITOR_PATTERNS.length];
  return pattern[calendar.weekdayIndex];
}

function customerCountForWeek(week) {
  return CUSTOMERS.filter((customer) => positiveInteger(customer.unlockWeek) <= week).length;
}

function choiceBufferForWeek(week) {
  if (week === 1) return 3;
  if (week === 2) return 4;
  if (week === 3) return 5;
  return 6;
}

function operatingCost(calendar, visitorCount) {
  const baseCost = calendar.week === 1
    ? 0
    : Math.min(14, 3 + (calendar.week - 2));
  const utilities = calendar.week === 1
    ? WEEK_ONE_UTILITIES[calendar.weekdayIndex]
    : MATURE_UTILITIES[calendar.weekdayIndex];
  const serviceCost = Math.max(0, visitorCount - 3) * 2;
  return {
    baseCost,
    utilities,
    serviceCost,
    total: baseCost + utilities + serviceCost,
  };
}

function stockPressure({ inventoryCount, visitorCount, stockTarget, capacity }) {
  if (inventoryCount === 0) {
    return {
      level: "empty",
      copy: `The shop has no stock. Order ${stockTarget} plants to cover today's visitors and give them a choice.`,
    };
  }

  if (inventoryCount < visitorCount) {
    const shortfall = visitorCount - inventoryCount;
    return {
      level: "shortage",
      copy: `${shortfall} ${shortfall === 1 ? "visitor does" : "visitors do"} not have a possible plant yet. Order stock before you open.`,
    };
  }

  if (inventoryCount < stockTarget) {
    const choiceGap = stockTarget - inventoryCount;
    return {
      level: "thin",
      copy: `You can serve every visitor, but the choice is narrow. Add ${choiceGap} ${choiceGap === 1 ? "plant" : "plants"} for a better range.`,
    };
  }

  if (inventoryCount > stockTarget) {
    const surplus = inventoryCount - stockTarget;
    return {
      level: "overstock",
      copy: `${surplus} ${surplus === 1 ? "plant is" : "plants are"} above today's stock target. Sell carry-over stock before you order more.`,
    };
  }

  if (inventoryCount >= capacity) {
    return {
      level: "full",
      copy: "The shelves are full and ready. Use this stock before you order more.",
    };
  }

  return {
    level: "balanced",
    copy: "Stock is balanced. You can serve every visitor and still offer a useful choice.",
  };
}

function shipmentGuidance({ inventoryCount, visitorCount, stockTarget, capacity }) {
  const freeCapacity = Math.max(0, capacity - inventoryCount);
  const minimum = Math.min(freeCapacity, Math.max(0, visitorCount - inventoryCount));
  const recommended = Math.min(freeCapacity, Math.max(0, stockTarget - inventoryCount));
  const maximum = recommended > 0
    ? Math.min(freeCapacity, Math.max(recommended, minimum) + 2)
    : 0;

  let copy;
  if (recommended === 0) {
    copy = inventoryCount > stockTarget
      ? "Skip today's shipment. Sell the overstock first."
      : "No shipment is needed. Current stock meets today's target.";
  } else if (minimum > 0) {
    copy = `Order ${recommended} plants. This covers all visitors and restores a useful range.`;
  } else {
    copy = `Top up with ${recommended} ${recommended === 1 ? "plant" : "plants"} to improve customer choice.`;
  }

  return {
    minimum,
    recommended,
    maximum,
    freeCapacity,
    rangeLabel: recommended === maximum ? String(recommended) : `${recommended}-${maximum}`,
    copy,
  };
}

/**
 * Get the deterministic demand, costs, and stock guidance for one shop day.
 * All values come from the day and current stock. No new save data is needed.
 */
export function dailyTradeProfile(options = {}) {
  const source = typeof options === "number" || typeof options === "string"
    ? { day: options }
    : options || {};
  const calendar = calendarForDay(source.day);
  const capacity = capacityInteger(source.capacity);
  const inventoryCount = nonNegativeInteger(source.inventoryCount);
  const availableCustomerCount = customerCountForWeek(calendar.week);
  const requestedVisitors = requestedVisitorCount(calendar);
  const visitorBonus = nonNegativeInteger(source.visitorBonus);
  const visitorCount = Math.min(requestedVisitors + visitorBonus, availableCustomerCount);
  const choiceBuffer = choiceBufferForWeek(calendar.week);
  const stockTarget = Math.min(capacity, visitorCount + choiceBuffer);
  const costs = operatingCost(calendar, visitorCount);
  const pressure = stockPressure({ inventoryCount, visitorCount, stockTarget, capacity });
  const shipment = shipmentGuidance({ inventoryCount, visitorCount, stockTarget, capacity });

  return {
    version: TRADE_PROFILE_VERSION,
    ...calendar,
    visitorCount,
    visitorBonus,
    requestedVisitorCount: requestedVisitors,
    availableCustomerCount,
    operatingCost: costs.total,
    operatingCostBreakdown: costs,
    stockTarget,
    choiceBuffer,
    stockPressure: pressure.level,
    pressureCopy: pressure.copy,
    shipment,
    shipmentSizeGuidance: shipment,
  };
}

export const createDailyTradeProfile = dailyTradeProfile;

export function visitorCountForDay(day) {
  return dailyTradeProfile({ day }).visitorCount;
}

export function operatingCostForDay(day) {
  return dailyTradeProfile({ day }).operatingCost;
}

export function weeklyTradeProfile(week, options = {}) {
  const safeWeek = positiveInteger(week);
  const firstDay = (safeWeek - 1) * WEEKDAYS.length + 1;
  const days = WEEKDAYS.map((unused, weekdayIndex) => dailyTradeProfile({
    ...options,
    day: firstDay + weekdayIndex,
  }));
  const visitorCounts = days.map((profile) => profile.visitorCount);

  return {
    week: safeWeek,
    days,
    visitorCount: visitorCounts.reduce((total, count) => total + count, 0),
    minimumDailyVisitors: Math.min(...visitorCounts),
    maximumDailyVisitors: Math.max(...visitorCounts),
    operatingCost: days.reduce((total, profile) => total + profile.operatingCost, 0),
    availableCustomerCount: customerCountForWeek(safeWeek),
  };
}

function scaledObjectiveForWeek(week) {
  const source = WEEKLY_OBJECTIVES[(week - 1) % WEEKLY_OBJECTIVES.length];
  if (!source) return null;
  const base = Number(source.target?.base) || 0;
  const perWeek = Number(source.target?.perWeek) || 0;
  const maximum = Number(source.target?.maximum);
  const scaledTarget = Math.max(1, Math.round(base + perWeek * (week - 1)));
  return {
    id: source.id,
    metric: source.metric,
    target: Number.isFinite(maximum) ? Math.min(maximum, scaledTarget) : scaledTarget,
  };
}

function availableSpeciesCount(week) {
  return SPECIES.filter((species) => positiveInteger(species.unlockWeek) <= week).length;
}

/**
 * Report the highest practical value for the active objective. This is a pure
 * balance check. It does not change the objective or the save file.
 */
export function weeklyObjectiveFeasibility(week) {
  const safeWeek = positiveInteger(week);
  const objective = scaledObjectiveForWeek(safeWeek);
  if (!objective) {
    return { week: safeWeek, objective: null, maximum: 0, feasible: true };
  }

  const trade = weeklyTradeProfile(safeWeek);
  const unlockedSpecies = SPECIES.filter((species) => positiveInteger(species.unlockWeek) <= safeWeek);
  const bestMargin = unlockedSpecies.reduce((best, species) => {
    const boutiquePrice = Math.round(Number(species.price || 0) * 1.2);
    return Math.max(best, boutiquePrice - Number(species.wholesaleCost || 0));
  }, 0);
  let maximum;

  if (SALE_METRICS.has(objective.metric)) maximum = trade.visitorCount;
  else if (objective.metric === "boutiqueSales") maximum = WEEKDAYS.length;
  else if (objective.metric === "uniqueSpeciesSold") {
    maximum = Math.min(trade.visitorCount, availableSpeciesCount(safeWeek));
  } else if (objective.metric === "healthyDisplayDays") maximum = WEEKDAYS.length;
  else if (objective.metric === "grossProfit") maximum = trade.visitorCount * bestMargin;
  else if (objective.metric === "beneficialCare" || objective.metric === "thirstRescues") {
    maximum = INVENTORY_CAPACITY * WEEKDAYS.length;
  } else maximum = trade.visitorCount;

  return {
    week: safeWeek,
    objective,
    maximum,
    feasible: maximum >= objective.target,
  };
}
