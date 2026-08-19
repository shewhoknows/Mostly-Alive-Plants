export const BATCH_UNPACK_START_DAY = 6;

const QUICK_ONLY_CONDITIONS = new Set([
  "drooping",
  "nursery-stressed",
  "root-bound",
  "light-stressed",
  "mite-infested",
  "fungal",
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function canBatchUnpack({ day = 1, crates = 0 } = {}) {
  return Math.max(1, Math.floor(Number(day) || 1)) >= BATCH_UNPACK_START_DAY
    && Math.max(0, Math.floor(Number(crates) || 0)) >= 2;
}

export function sortKeyboardTargets(targets = [], inventoryOrder = []) {
  const plantOrder = new Map(safeArray(inventoryOrder).map((id, index) => [id, index]));
  const stationOrder = new Map([
    ["care-bench", 0],
    ["rehabilitation-station", 1],
    ["watering-can", 2],
    ["grow-lamp", 3],
    ["supply-shelf", 4],
  ]);
  const rank = (target) => {
    const entity = target?.entity || target?.userData?.entity || {};
    if (entity.kind === "plant") return [0, plantOrder.get(entity.id) ?? 9999, String(entity.id)];
    if (entity.kind === "crate") return [1, 0, String(entity.id || "crate")];
    if (entity.kind === "customer") return [2, 0, String(entity.id || "customer")];
    if (entity.kind === "station") return [3, stationOrder.get(entity.id) ?? 9999, String(entity.id)];
    return [9, 9999, String(entity.id || entity.kind || "")];
  };
  return safeArray(targets)
    .filter((target) => {
      const entity = target?.entity || target?.userData?.entity;
      return entity && entity.kind !== "slot";
    })
    .sort((left, right) => {
      const a = rank(left);
      const b = rank(right);
      return a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]);
    });
}

export function plantSaleReadiness({
  plant,
  species,
  light = { level: "unplaced", label: "light undecided" },
  conditionLabel = "comfortable",
  customer = null,
  askingPrice = 0,
  priceBand = "fair",
  boutiqueReady = true,
  remainingCoverage = true,
} = {}) {
  if (!plant) {
    return {
      status: "blocked",
      label: "No plant selected",
      summary: "Choose a plant to check its sale readiness.",
      checks: [],
      blockers: ["Choose a plant."],
    };
  }

  const checks = [];
  const blockers = [];
  const warnings = [];
  const addCheck = (id, label, state, detail) => checks.push({ id, label, state, detail });

  if (plant.benchStatus) {
    const detail = "Busy with a timed Care Bench job.";
    addCheck("availability", "Available", "blocked", detail);
    blockers.push(detail);
  } else if (plant.lifeStage === "juvenile") {
    const mornings = Math.max(0, Math.floor(Number(plant.maturityDaysRemaining) || 0));
    const detail = `${mornings} ${mornings === 1 ? "morning" : "mornings"} until mature.`;
    addCheck("availability", "Available", "blocked", detail);
    blockers.push(detail);
  } else if (plant.held) {
    const detail = "Held for the weekly order.";
    addCheck("availability", "Available", "blocked", detail);
    blockers.push(detail);
  } else {
    addCheck("availability", "Available", "ready", "Free for a shop customer.");
  }

  if (!Number.isInteger(plant.slot)) {
    const detail = "Place it on a display first.";
    addCheck("display", "Display", "blocked", detail);
    blockers.push(detail);
  } else {
    addCheck("display", "Display", "ready", "Placed and visible to customers.");
  }

  const hydration = Math.max(0, Math.min(100, Math.round(Number(plant.hydration) || 0)));
  if (hydration < 42) {
    const detail = `${hydration}% soil moisture. Water it to lift the leaves.`;
    addCheck("soil", "Soil", "warning", detail);
    warnings.push(detail);
  } else if (hydration < 78) {
    addCheck("soil", "Soil", "pending", `${hydration}% soil moisture. Comfortable, but it can drink.`);
  } else {
    addCheck("soil", "Soil", "ready", `${hydration}% soil moisture. No water needed.`);
  }

  if (light.level === "unplaced") {
    addCheck("light", "Light", "pending", "Choose a display to set its light.");
  } else if (light.level === "poor") {
    const detail = `${light.label}. Move it or assign a Clip Grow Light.`;
    addCheck("light", "Light", "warning", detail);
    warnings.push(detail);
  } else {
    addCheck("light", "Light", light.level === "ideal" ? "ready" : "pending", light.label);
  }

  if (QUICK_ONLY_CONDITIONS.has(conditionLabel)) {
    const detail = `${conditionLabel}. Quick tag only until this is fixed.`;
    addCheck("health", "Condition", "warning", detail);
    warnings.push(detail);
  } else {
    addCheck("health", "Condition", "ready", conditionLabel);
  }

  const beneficialCare = safeArray(species?.beneficialCare);
  const completedCare = beneficialCare.filter((care) => Boolean(plant.care?.[care]));
  const careDetail = beneficialCare.length
    ? `${completedCare.length}/${beneficialCare.length} helpful care actions complete.`
    : "No special care needed today.";
  addCheck("care", "Helpful care", completedCare.length === beneficialCare.length ? "ready" : "pending", careDetail);

  if (customer) {
    const traitMatch = safeArray(plant.traits).includes(customer.need);
    const withinBudget = !Number.isFinite(Number(customer.budget)) || Number(askingPrice) <= Number(customer.budget);
    if (!traitMatch) {
      const detail = `Needs a ${customer.need} plant.`;
      addCheck("customer", "Current visitor", "blocked", detail);
      blockers.push(detail);
    } else if (!withinBudget) {
      const detail = `${askingPrice} coins is above the ${customer.budget}-coin budget.`;
      addCheck("customer", "Current visitor", "blocked", detail);
      blockers.push(detail);
    } else if (priceBand === "boutique" && !boutiqueReady) {
      const detail = "Boutique needs two strong care, trait, condition, or light matches.";
      addCheck("customer", "Current visitor", "blocked", detail);
      blockers.push(detail);
    } else if (!remainingCoverage) {
      const detail = "Keep this plant for a later visitor who has no other match.";
      addCheck("customer", "Current visitor", "blocked", detail);
      blockers.push(detail);
    } else {
      addCheck("customer", "Current visitor", "ready", `Matches ${customer.need} and the budget.`);
    }
  }

  if (blockers.length) {
    return {
      status: "blocked",
      label: "Not ready",
      summary: blockers[0],
      checks,
      blockers,
      warnings,
    };
  }
  if (warnings.length) {
    return {
      status: "quick",
      label: "Quick sale only",
      summary: warnings[0],
      checks,
      blockers,
      warnings,
    };
  }
  return {
    status: "ready",
    label: "Ready for sale",
    summary: completedCare.length === beneficialCare.length && light.level === "ideal"
      ? "Healthy, fully cared for, and in ideal light."
      : "This plant can be offered now. Extra care can improve the result.",
    checks,
    blockers,
    warnings,
  };
}
