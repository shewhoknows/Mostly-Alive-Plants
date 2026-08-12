export const PLANT_HEALTH_STATE_VERSION = 1;
export const NURSERY_STRESS_AFTER_DAYS = 2;
export const HEALTH_ISSUE_START_DAY = 6;
export const HEALTH_ISSUE_INTERVAL_DAYS = 4;
export const HEALTH_ISSUE_COOLDOWN_DAYS = 4;
export const MAX_NEW_ISSUES_PER_MORNING = 1;
export const MAX_GROWTH_POINTS = 6;

export const PLANT_ISSUE_TYPES = Object.freeze({
  MITES: "mites",
  FUNGUS: "fungus",
});

export const TREATMENT_IDS = Object.freeze({
  MITES: "neem-spray",
  FUNGUS: "fungicide",
});

export const ISSUE_TREATMENTS = Object.freeze({
  [PLANT_ISSUE_TYPES.MITES]: TREATMENT_IDS.MITES,
  [PLANT_ISSUE_TYPES.FUNGUS]: TREATMENT_IDS.FUNGUS,
});

const VALID_ISSUES = new Set(Object.values(PLANT_ISSUE_TYPES));
const VALID_TREATMENTS = new Set(Object.values(TREATMENT_IDS));

function safeInteger(value, fallback = 0, minimum = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.floor(number)) : fallback;
}

function safeDay(value, fallback = 1) {
  return safeInteger(value, fallback, 1);
}

function nullableDay(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : null;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function issueSeverity(ageDays) {
  if (ageDays >= 4) return "severe";
  if (ageDays >= 2) return "established";
  return "mild";
}

function normalizeIssue(value, plant = {}) {
  const type = typeof value === "string" ? value : value?.type;
  if (!VALID_ISSUES.has(type)) return null;
  const ageDays = safeInteger(plant.healthIssueAgeDays ?? (typeof value === "object" ? value.ageDays : 0));
  return {
    type,
    onsetDay: nullableDay(plant.healthIssueDay ?? (typeof value === "object" ? value.onsetDay : null)),
    ageDays,
    severity: issueSeverity(ageDays),
  };
}

/**
 * Adds the current health fields to one plant without changing unrelated data.
 * Missing fields use conservative defaults, so an old save does not gain age,
 * stress, an issue, or a daily action during migration.
 */
export function migratePlantHealth(plant = {}) {
  const issue = normalizeIssue(plant.healthIssue, plant);
  return {
    ...plant,
    plantHealthVersion: PLANT_HEALTH_STATE_VERSION,
    nurseryAgeDays: safeInteger(plant.nurseryAgeDays),
    needsRehabilitation: plant.needsRehabilitation === true,
    nurseryStressDay: nullableDay(plant.nurseryStressDay),
    healthIssue: issue?.type || null,
    healthIssueDay: issue?.onsetDay || null,
    healthIssueAgeDays: issue?.ageDays || 0,
    healthIssueSeverity: issue?.severity || null,
    lastHealthMorningDay: nullableDay(plant.lastHealthMorningDay),
    lastHealthIssueDay: nullableDay(plant.lastHealthIssueDay),
    lastIssueResolvedDay: nullableDay(plant.lastIssueResolvedDay),
    lastTreatmentDay: nullableDay(plant.lastTreatmentDay),
    lastTreatmentId: VALID_TREATMENTS.has(plant.lastTreatmentId) ? plant.lastTreatmentId : null,
    fertilizedDay: nullableDay(plant.fertilizedDay ?? plant.lastFertilizedDay),
    growthPoints: Math.min(MAX_GROWTH_POINTS, safeInteger(plant.growthPoints)),
    growthBoost: Math.min(1, safeInteger(plant.growthBoost ?? (plant.fertilizerBoostUntilDay ? 1 : 0))),
    clipGrowLightAssigned: plant.clipGrowLightAssigned === true,
    clipGrowLightAssignedDay: nullableDay(plant.clipGrowLightAssignedDay),
  };
}

export function migratePlantHealthInventory(inventory = []) {
  return Array.isArray(inventory) ? inventory.map((plant) => migratePlantHealth(plant)) : [];
}

function completedMorningDelta(plant, day) {
  if (plant.lastHealthMorningDay !== null && day <= plant.lastHealthMorningDay) return 0;
  if (Number.isFinite(Number(plant.arrivalDay)) && day <= safeDay(plant.arrivalDay)) return 0;
  if (plant.lastHealthMorningDay === null) return 1;
  return Math.max(1, day - plant.lastHealthMorningDay);
}

/** Advances age and an existing issue once for each newly completed morning. */
export function advancePlantHealthMorning(plant, { day = 1 } = {}) {
  const currentDay = safeDay(day);
  const next = migratePlantHealth(plant);
  if (next.lastHealthMorningDay !== null && currentDay <= next.lastHealthMorningDay) return next;

  const delta = completedMorningDelta(next, currentDay);
  const canGainNurseryAge = next.lifeStage !== "juvenile" && !next.benchStatus;
  const nurseryAgeDays = canGainNurseryAge ? next.nurseryAgeDays + delta : next.nurseryAgeDays;
  const healthIssueAgeDays = next.healthIssue && delta > 0
    ? next.healthIssueAgeDays + delta
    : next.healthIssueAgeDays;
  const becameStressed = !next.needsRehabilitation && nurseryAgeDays > NURSERY_STRESS_AFTER_DAYS;

  return {
    ...next,
    nurseryAgeDays,
    needsRehabilitation: next.needsRehabilitation || becameStressed,
    nurseryStressDay: becameStressed ? currentDay : next.nurseryStressDay,
    healthIssueAgeDays,
    healthIssueSeverity: next.healthIssue ? issueSeverity(healthIssueAgeDays) : null,
    growthBoost: delta > 0 ? 0 : next.growthBoost,
    lastHealthMorningDay: currentDay,
  };
}

export function isHealthIssueMorning(day) {
  const currentDay = safeDay(day);
  return currentDay >= HEALTH_ISSUE_START_DAY
    && (currentDay - HEALTH_ISSUE_START_DAY) % HEALTH_ISSUE_INTERVAL_DAYS === 0;
}

function issueEligible(plant, day) {
  if (!plant?.id || plant.healthIssue || plant.benchStatus || plant.lifeStage === "juvenile") return false;
  if (plant.nurseryAgeDays < 1) return false;
  if (nullableDay(plant.conditionProtectionUntilDay) >= day) return false;
  return plant.lastIssueResolvedDay === null
    || day - plant.lastIssueResolvedDay >= HEALTH_ISSUE_COOLDOWN_DAYS;
}

function deterministicIssue(day, plantId) {
  const issueIndex = Math.floor((day - HEALTH_ISSUE_START_DAY) / HEALTH_ISSUE_INTERVAL_DAYS);
  const types = Object.values(PLANT_ISSUE_TYPES);
  return types[(issueIndex + hashText(plantId)) % types.length];
}

/**
 * Advances a shop inventory and creates no more than one deterministic issue
 * on scheduled mornings. The returned event lists are suitable for UI copy.
 */
export function advancePlantHealthInventoryMorning(inventory = [], { day = 1 } = {}) {
  const currentDay = safeDay(day);
  const source = migratePlantHealthInventory(inventory);
  const advancedAny = source.some((plant) => plant.lastHealthMorningDay === null || currentDay > plant.lastHealthMorningDay);
  let nextInventory = source.map((plant) => advancePlantHealthMorning(plant, { day: currentDay }));
  const newlyStressed = nextInventory
    .filter((plant, index) => !source[index].needsRehabilitation && plant.needsRehabilitation)
    .map((plant) => plant.id);
  const newIssues = [];

  if (advancedAny && isHealthIssueMorning(currentDay)) {
    const eligible = nextInventory
      .filter((plant) => issueEligible(plant, currentDay))
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    if (eligible.length) {
      const signature = eligible.map((plant) => plant.id).join("|");
      const target = eligible[hashText(`plant-health-target|${currentDay}|${signature}`) % eligible.length];
      const type = deterministicIssue(currentDay, target.id);
      nextInventory = nextInventory.map((plant) => plant.id === target.id ? {
        ...plant,
        healthIssue: type,
        healthIssueDay: currentDay,
        healthIssueAgeDays: 0,
        healthIssueSeverity: "mild",
        lastHealthIssueDay: currentDay,
      } : plant);
      newIssues.push({ plantId: target.id, type, day: currentDay });
    }
  }

  const stressCopy = newlyStressed.length
    ? `${newlyStressed.length} ${newlyStressed.length === 1 ? "plant needs" : "plants need"} rehabilitation.`
    : "";
  const issueCopy = newIssues.length
    ? `${newIssues.length === 1 ? "One plant has" : `${newIssues.length} plants have`} ${newIssues.map((issue) => issue.type).join(" and ")}.`
    : "";
  return {
    inventory: nextInventory,
    newlyStressed,
    newIssues: newIssues.slice(0, MAX_NEW_ISSUES_PER_MORNING),
    message: [stressCopy, issueCopy].filter(Boolean).join(" ") || "No new plant health concerns this morning.",
    advanced: advancedAny,
  };
}

export function treatmentForIssue(issueType) {
  return ISSUE_TREATMENTS[issueType] || null;
}

export function validatePlantTreatment({ plant, treatmentId, day = 1 } = {}) {
  const next = migratePlantHealth(plant);
  const currentDay = safeDay(day);
  if (!next.id) return { ok: false, code: "plant-not-found", message: "Select a plant to treat.", plant: next };
  if (next.benchStatus) return { ok: false, code: "plant-unavailable", message: "This plant is busy at the care bench.", plant: next };
  if (!next.healthIssue) return { ok: false, code: "no-health-issue", message: "This plant has no issue to treat.", plant: next };
  if (!VALID_TREATMENTS.has(treatmentId)) {
    return { ok: false, code: "unknown-treatment", message: "Choose a valid plant treatment.", plant: next };
  }
  const requiredTreatment = treatmentForIssue(next.healthIssue);
  if (treatmentId !== requiredTreatment) {
    return {
      ok: false,
      code: "treatment-mismatch",
      message: `${treatmentId} does not treat ${next.healthIssue}. Use ${requiredTreatment}.`,
      plant: next,
      requiredTreatment,
    };
  }
  return {
    ok: true,
    code: "treatment-ready",
    message: `${requiredTreatment} can treat ${next.healthIssue}.`,
    plant: next,
    treatmentId,
    issueType: next.healthIssue,
    day: currentDay,
  };
}

/** Applies health state only. The caller remains responsible for supplies. */
export function applyPlantTreatment(options = {}) {
  const validation = validatePlantTreatment(options);
  if (!validation.ok) return validation;
  return {
    ...validation,
    code: "treatment-applied",
    message: `${validation.issueType} treated with ${validation.treatmentId}.`,
    plant: {
      ...validation.plant,
      healthIssue: null,
      healthIssueDay: null,
      healthIssueAgeDays: 0,
      healthIssueSeverity: null,
      lastIssueResolvedDay: validation.day,
      lastTreatmentDay: validation.day,
      lastTreatmentId: validation.treatmentId,
    },
  };
}

export function validatePlantFertilizer({ plant, day = 1 } = {}) {
  const next = migratePlantHealth(plant);
  const currentDay = safeDay(day);
  if (!next.id) return { ok: false, code: "plant-not-found", message: "Select a plant to fertilize.", plant: next };
  if (next.benchStatus) return { ok: false, code: "plant-unavailable", message: "This plant is busy at the care bench.", plant: next };
  if (next.healthIssue) return { ok: false, code: "treat-first", message: `Treat ${next.healthIssue} before fertilizer.`, plant: next };
  if (next.fertilizedDay !== null && next.fertilizedDay >= currentDay) {
    return { ok: false, code: "already-fertilized", message: "This plant was already fertilized today.", plant: next };
  }
  return {
    ok: true,
    code: "fertilizer-ready",
    message: next.lifeStage === "juvenile" ? "Fertilizer will shorten juvenile growth by one morning." : "Fertilizer will add mature growth and a condition boost.",
    plant: next,
    day: currentDay,
  };
}

/** Applies fertilizer state only. The caller remains responsible for supplies. */
export function applyPlantFertilizer(options = {}) {
  const validation = validatePlantFertilizer(options);
  if (!validation.ok) return validation;
  const juvenile = validation.plant.lifeStage === "juvenile";
  if (juvenile) {
    const maturityDaysRemaining = Math.max(0, safeInteger(validation.plant.maturityDaysRemaining) - 1);
    const matured = maturityDaysRemaining === 0;
    return {
      ...validation,
      code: "fertilizer-applied",
      effect: matured ? "juvenile-matured" : "juvenile-growth",
      message: matured ? "Fertilizer helped the juvenile reach maturity." : "Fertilizer shortened growth by one morning.",
      plant: {
        ...validation.plant,
        lifeStage: matured ? "mature" : "juvenile",
        maturityDaysRemaining,
        rootAgeDays: matured ? 0 : validation.plant.rootAgeDays,
        fertilizedDay: validation.day,
        growthBoost: 1,
      },
    };
  }

  const growthPoints = Math.min(MAX_GROWTH_POINTS, validation.plant.growthPoints + 1);
  return {
    ...validation,
    code: "fertilizer-applied",
    effect: "mature-vigor",
    message: "Fertilizer added one growth point and a condition boost for today.",
    plant: {
      ...validation.plant,
      growthPoints,
      fertilizedDay: validation.day,
      growthBoost: 1,
    },
  };
}

export function hasFertilizerGrowthBoost(plant, { day = 1 } = {}) {
  const next = migratePlantHealth(plant);
  return next.growthBoost > 0 && next.fertilizedDay === safeDay(day);
}

/** Resets the nursery-age clock after a completed rehabilitation job. */
export function markPlantRehabilitated(plant, { day = 1 } = {}) {
  const next = migratePlantHealth(plant);
  return {
    ...next,
    nurseryAgeDays: 0,
    needsRehabilitation: false,
    nurseryStressDay: null,
    lastRehabilitatedDay: safeDay(day),
  };
}

export function hasClipGrowLightSupport(plant) {
  return plant?.clipGrowLightAssigned === true;
}

export function validateClipGrowLightAssignment({ plant, assignedCount = 0, maxAssignments = 1 } = {}) {
  const next = migratePlantHealth(plant);
  const maximum = safeInteger(maxAssignments, 1, 1);
  const assigned = safeInteger(assignedCount);
  if (!next.id) return { ok: false, code: "plant-not-found", message: "Select a plant for the clip grow light.", plant: next };
  if (next.benchStatus) return { ok: false, code: "plant-unavailable", message: "This plant is busy at the care bench.", plant: next };
  if (next.clipGrowLightAssigned) return { ok: false, code: "already-assigned", message: "This plant already has clip grow-light support.", plant: next };
  if (assigned >= maximum) return { ok: false, code: "no-light-available", message: "Every clip grow light is already assigned.", plant: next };
  return { ok: true, code: "light-ready", message: "The clip grow light can support this plant.", plant: next };
}

/** Assigns light support only. The caller controls owned-light counts. */
export function assignClipGrowLight({ plant, assignedCount = 0, maxAssignments = 1, day = 1 } = {}) {
  const validation = validateClipGrowLightAssignment({ plant, assignedCount, maxAssignments });
  if (!validation.ok) return validation;
  return {
    ...validation,
    code: "light-assigned",
    message: "Clip grow light assigned.",
    plant: {
      ...validation.plant,
      clipGrowLightAssigned: true,
      clipGrowLightAssignedDay: safeDay(day),
    },
  };
}

export function removeClipGrowLight(plant) {
  const next = migratePlantHealth(plant);
  if (!next.clipGrowLightAssigned) {
    return { ok: false, code: "light-not-assigned", message: "This plant has no clip grow light.", plant: next };
  }
  return {
    ok: true,
    code: "light-removed",
    message: "Clip grow light removed.",
    plant: { ...next, clipGrowLightAssigned: false, clipGrowLightAssignedDay: null },
  };
}
