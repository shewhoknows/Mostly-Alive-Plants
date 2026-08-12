import { INVENTORY_CAPACITY, SLOT_DATA, SPECIES } from "./game-data.js";

export const CARE_BENCH_STATE_VERSION = 2;
export const CARE_BENCH_BASE_SLOTS = 1;

export const BENCH_JOB_TYPES = Object.freeze({
  REPOT: "repot",
  REHABILITATE: "rehabilitate",
  PROPAGATE: "propagate",
});

export const BENCH_JOB_COSTS = Object.freeze({
  [BENCH_JOB_TYPES.REPOT]: Object.freeze({ coins: 10, bloom: 0 }),
  [BENCH_JOB_TYPES.REHABILITATE]: Object.freeze({ coins: 8, bloom: 0 }),
  [BENCH_JOB_TYPES.PROPAGATE]: Object.freeze({ coins: 12, bloom: 5 }),
});

export const BENCH_JOB_DURATIONS = Object.freeze({
  [BENCH_JOB_TYPES.REPOT]: 1,
  [BENCH_JOB_TYPES.REHABILITATE]: 1,
  [BENCH_JOB_TYPES.PROPAGATE]: 2,
});

export const REPOT_VALUE_BONUS = 4;
export const REHABILITATE_HYDRATION = 88;
export const REHABILITATE_PROTECTION_DAYS = 2;
export const REHABILITATE_VALUE_RESTORE = 4;
export const PROPAGATION_PRICE_MULTIPLIER = 0.65;
export const PROPAGATION_MATURITY_DAYS = 3;
export const GROW_LAMP_REPOT_VALUE_BONUS = 2;
export const GROW_LAMP_REHABILITATE_PROTECTION_DAYS = 1;
export const GROW_LAMP_PROPAGATION_MATURITY_DAYS = 2;

const VALID_JOB_TYPES = new Set(Object.values(BENCH_JOB_TYPES));
const SPECIES_BY_ID = new Map(SPECIES.map((species) => [species.id, species]));
const SPECIES_BY_NAME = new Map(SPECIES.map((species) => [species.name, species]));

const JOB_LABELS = Object.freeze({
  [BENCH_JOB_TYPES.REPOT]: "Repotting",
  [BENCH_JOB_TYPES.REHABILITATE]: "Rehabilitation",
  [BENCH_JOB_TYPES.PROPAGATE]: "Propagation",
});

function safeInteger(value, fallback = 0, minimum = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.floor(number)) : fallback;
}

function safeDay(value) {
  return safeInteger(value, 1, 1);
}

function safeCapacity(value) {
  return safeInteger(value, INVENTORY_CAPACITY, 1);
}

function clonePlant(plant) {
  return {
    ...plant,
    traits: Array.isArray(plant?.traits) ? [...plant.traits] : [],
    care: { ...(plant?.care || {}) },
    cosmeticVariation: { ...(plant?.cosmeticVariation || {}) },
    benchStatus: plant?.benchStatus ? { ...plant.benchStatus } : null,
  };
}

function cloneInventory(inventory) {
  return Array.isArray(inventory) ? inventory.map(clonePlant) : [];
}

function speciesForPlant(plant) {
  return SPECIES_BY_ID.get(plant?.speciesId)
    || SPECIES_BY_NAME.get(plant?.species)
    || SPECIES_BY_NAME.get(plant?.speciesName)
    || null;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizedCost(type, value = BENCH_JOB_COSTS[type]) {
  return {
    coins: safeInteger(value?.coins, BENCH_JOB_COSTS[type]?.coins || 0),
    bloom: safeInteger(value?.bloom, BENCH_JOB_COSTS[type]?.bloom || 0),
  };
}

function normalizedJob(job, index) {
  const type = VALID_JOB_TYPES.has(job?.type) ? job.type : null;
  const plantId = typeof job?.plantId === "string" && job.plantId ? job.plantId : null;
  if (!type || !plantId) return null;

  const startDay = safeDay(job.startDay);
  const duration = BENCH_JOB_DURATIONS[type];
  const readyDay = Math.max(startDay + duration, safeDay(job.readyDay));
  const id = typeof job.id === "string" && job.id
    ? job.id
    : `bench-migrated-${String(index + 1).padStart(3, "0")}-${type}`;

  return {
    id,
    type,
    plantId,
    status: job.status === "ready" ? "ready" : "active",
    startDay,
    readyDay,
    previousSlot: Number.isInteger(job.previousSlot) ? job.previousSlot : null,
    lampAssisted: job?.lampAssisted === true,
    cost: normalizedCost(type, job.cost),
  };
}

function highestJobNumber(jobs) {
  return jobs.reduce((highest, job) => {
    const match = /^bench-(\d+)-/.exec(job.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
}

export function createDefaultBenchState() {
  return {
    version: CARE_BENCH_STATE_VERSION,
    slotCount: CARE_BENCH_BASE_SLOTS,
    nextJobNumber: 1,
    jobs: [],
  };
}

/**
 * Converts missing or older bench data to the current serializable shape.
 * Invalid jobs are ignored. Valid jobs are kept, even if an old save has more
 * jobs than its saved slot count.
 */
export function migrateBenchState(value) {
  const jobs = [];
  const usedIds = new Set();
  const usedPlants = new Set();

  if (Array.isArray(value?.jobs)) {
    value.jobs.forEach((source, index) => {
      const job = normalizedJob(source, index);
      if (!job || usedIds.has(job.id) || usedPlants.has(job.plantId)) return;
      jobs.push(job);
      usedIds.add(job.id);
      usedPlants.add(job.plantId);
    });
  }

  const savedNextNumber = safeInteger(value?.nextJobNumber, 1, 1);
  return {
    version: CARE_BENCH_STATE_VERSION,
    slotCount: safeInteger(value?.slotCount, CARE_BENCH_BASE_SLOTS, CARE_BENCH_BASE_SLOTS),
    nextJobNumber: Math.max(savedNextNumber, highestJobNumber(jobs) + 1),
    jobs,
  };
}

function benchStatusForJob(job) {
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    readyDay: job.readyDay,
    lampAssisted: job.lampAssisted === true,
  };
}

/**
 * Reconnects saved jobs and plants after save migration. This function removes
 * stale plant bench markers when no saved job uses the plant.
 */
export function reconcileBenchInventory({ benchState, inventory = [] } = {}) {
  const bench = migrateBenchState(benchState);
  const jobsByPlant = new Map(bench.jobs.map((job) => [job.plantId, job]));
  const nextInventory = cloneInventory(inventory).map((plant) => {
    const job = jobsByPlant.get(plant.id);
    if (!job) return plant.benchStatus ? { ...plant, benchStatus: null } : plant;
    return {
      ...plant,
      held: false,
      slot: null,
      benchStatus: benchStatusForJob(job),
    };
  });

  const plantIds = new Set(nextInventory.map((plant) => plant.id));
  const jobs = bench.jobs.filter((job) => plantIds.has(job.plantId));
  return {
    benchState: { ...bench, jobs },
    inventory: nextInventory,
  };
}

export function isConditionProtected(plant, day = 1) {
  return safeInteger(plant?.conditionProtectionUntilDay) >= safeDay(day);
}

function inferredPlantCondition(plant, suppliedCondition) {
  if (typeof suppliedCondition === "string" && suppliedCondition) return suppliedCondition;
  const savedCondition = typeof plant?.condition === "string" ? plant.condition : plant?.healthStatus;
  if (["thriving", "stressed", "drooping", "light-stressed", "recovering"].includes(savedCondition)) {
    return savedCondition;
  }
  if (plant?.thriving === true) return "thriving";

  const hydration = Number(plant?.hydration);
  if (Number.isFinite(hydration) && hydration < 42) return "drooping";

  const species = speciesForPlant(plant);
  const actualLight = SLOT_DATA[plant?.slot]?.lightLevel;
  if (species && actualLight && !species.toleratedLight?.includes(actualLight) && species.preferredLight !== actualLight) {
    return "light-stressed";
  }
  if (plant?.recoveredToday) return "recovering";
  if (species && Number.isFinite(hydration) && hydration >= 68 && actualLight === species.preferredLight) {
    return "thriving";
  }
  return "comfortable";
}

function failure(code, message, context) {
  return {
    ok: false,
    code,
    message,
    cost: context.cost,
    benchState: context.benchState,
    inventory: context.inventory,
    coins: context.coins,
    bloom: context.bloom,
  };
}

/**
 * Checks one requested job. It does not change the supplied values.
 */
export function validateBenchJob({
  type,
  plantId,
  inventory = [],
  benchState,
  coins = 0,
  bloom = 0,
  day = 1,
  capacity = INVENTORY_CAPACITY,
  condition,
  lampAssisted = false,
} = {}) {
  const bench = migrateBenchState(benchState);
  const nextInventory = cloneInventory(inventory);
  const safeCoins = safeInteger(coins);
  const safeBloom = safeInteger(bloom);
  const cost = VALID_JOB_TYPES.has(type) ? normalizedCost(type) : { coins: 0, bloom: 0 };
  const context = {
    cost,
    benchState: bench,
    inventory: nextInventory,
    coins: safeCoins,
    bloom: safeBloom,
  };

  if (!VALID_JOB_TYPES.has(type)) {
    return failure("unknown-job", "That bench job is not available.", context);
  }

  const plantIndex = nextInventory.findIndex((plant) => plant.id === plantId);
  if (plantIndex < 0) {
    return failure("plant-not-found", "Select a plant from your stock.", context);
  }

  const plant = nextInventory[plantIndex];
  if (plant.held) {
    return failure("plant-held", "Put the plant down before bench work starts.", context);
  }
  if (plant.benchStatus || bench.jobs.some((job) => job.plantId === plant.id)) {
    return failure("plant-busy", "This plant already has a bench job.", context);
  }
  if (bench.jobs.length >= bench.slotCount) {
    return failure("bench-full", "The care bench is busy.", context);
  }
  if (safeCoins < cost.coins) {
    return failure("not-enough-coins", `This job needs ${cost.coins} coins.`, context);
  }
  if (safeBloom < cost.bloom) {
    return failure("not-enough-bloom", `This job needs ${cost.bloom} Bloom.`, context);
  }

  const plantCondition = inferredPlantCondition(plant, condition);
  if (type === BENCH_JOB_TYPES.REPOT && plant.rootComfort === "comfortable") {
    return failure("repot-not-needed", "This plant already has comfortable roots.", context);
  }

  if (type === BENCH_JOB_TYPES.REHABILITATE) {
    const protectedUntilDay = safeInteger(plant.conditionProtectionUntilDay);
    if (plant.needsRehabilitation !== true || protectedUntilDay >= safeDay(day)) {
      return failure("rehabilitation-not-needed", "Only nursery-stressed rescue stock needs Rehabilitate. Water thirsty plants or move light-stressed plants.", context);
    }
  }

  if (type === BENCH_JOB_TYPES.PROPAGATE) {
    if (plant.lifeStage !== "mature") {
      return failure("parent-not-mature", "Only a mature plant can make a cutting.", context);
    }
    if (plant.rootComfort !== "comfortable") {
      return failure("parent-roots-uncomfortable", "Repot this plant before you make a cutting.", context);
    }
    if (plantCondition !== "thriving") {
      return failure("parent-not-thriving", "The parent plant must be thriving.", context);
    }

    const propagationReservations = bench.jobs.filter((job) => job.type === BENCH_JOB_TYPES.PROPAGATE).length;
    if (nextInventory.length + propagationReservations >= safeCapacity(capacity)) {
      return failure("inventory-full", "Make one stock space before you propagate.", context);
    }
  }

  return {
    ok: true,
    code: "ready",
    message: `${JOB_LABELS[type]} can start.`,
    type,
    plantId,
    plantIndex,
    plantCondition,
    cost,
    benchState: bench,
    inventory: nextInventory,
    coins: safeCoins,
    bloom: safeBloom,
    day: safeDay(day),
    capacity: safeCapacity(capacity),
    lampAssisted: lampAssisted === true,
  };
}

function nextJobIdentity(bench, type) {
  let number = bench.nextJobNumber;
  let id = `bench-${String(number).padStart(3, "0")}-${type}`;
  const usedIds = new Set(bench.jobs.map((job) => job.id));
  while (usedIds.has(id)) {
    number += 1;
    id = `bench-${String(number).padStart(3, "0")}-${type}`;
  }
  return { id, number };
}

/**
 * Starts one bench job and pays its cost. The returned data is safe to save.
 */
export function startBenchJob(options = {}) {
  const validation = validateBenchJob(options);
  if (!validation.ok) return validation;

  const { type, plantId, plantIndex, cost, day, lampAssisted } = validation;
  const identity = nextJobIdentity(validation.benchState, type);
  const sourcePlant = validation.inventory[plantIndex];
  const job = {
    id: identity.id,
    type,
    plantId,
    status: "active",
    startDay: day,
    readyDay: day + BENCH_JOB_DURATIONS[type],
    previousSlot: Number.isInteger(sourcePlant.slot) ? sourcePlant.slot : null,
    lampAssisted,
    cost: { ...cost },
  };
  const inventory = [...validation.inventory];
  inventory[plantIndex] = {
    ...sourcePlant,
    held: false,
    slot: null,
    benchStatus: benchStatusForJob(job),
  };
  const benchState = {
    ...validation.benchState,
    nextJobNumber: identity.number + 1,
    jobs: [...validation.benchState.jobs, job],
  };
  const timing = BENCH_JOB_DURATIONS[type] === 1 ? "tomorrow morning" : "in two mornings";

  return {
    ok: true,
    code: "job-started",
    message: `${JOB_LABELS[type]} started. It will finish ${timing}.`,
    job,
    cost,
    benchState,
    inventory,
    coins: validation.coins - cost.coins,
    bloom: validation.bloom - cost.bloom,
  };
}

export function startRepotJob(options = {}) {
  return startBenchJob({ ...options, type: BENCH_JOB_TYPES.REPOT });
}

export function startRehabilitateJob(options = {}) {
  return startBenchJob({ ...options, type: BENCH_JOB_TYPES.REHABILITATE });
}

export function startPropagateJob(options = {}) {
  return startBenchJob({ ...options, type: BENCH_JOB_TYPES.PROPAGATE });
}

/**
 * Marks jobs as ready when their due morning arrives. Effects are applied by
 * applyCompletedBenchJobs so the game can show a morning summary first.
 */
export function advanceBenchJobs({ benchState, inventory = [], day = 1 } = {}) {
  const bench = migrateBenchState(benchState);
  const currentDay = safeDay(day);
  const nextInventory = cloneInventory(inventory);
  const newlyReady = [];
  const jobs = bench.jobs.map((job) => {
    if (job.status === "ready" || currentDay < job.readyDay) return job;
    const readyJob = { ...job, status: "ready" };
    newlyReady.push(readyJob);
    return readyJob;
  });
  const jobsByPlant = new Map(jobs.map((job) => [job.plantId, job]));
  const syncedInventory = nextInventory.map((plant) => {
    const job = jobsByPlant.get(plant.id);
    if (!job) return plant;
    return {
      ...plant,
      held: false,
      slot: null,
      benchStatus: benchStatusForJob(job),
    };
  });

  return {
    ok: true,
    code: newlyReady.length ? "jobs-ready" : "no-jobs-ready",
    message: newlyReady.length
      ? `${newlyReady.length === 1 ? JOB_LABELS[newlyReady[0].type] : `${newlyReady.length} bench jobs`} finished this morning.`
      : "No bench job finished this morning.",
    benchState: { ...bench, jobs },
    inventory: syncedInventory,
    newlyReady,
  };
}

function completedPlantBase(plant, day) {
  return {
    ...plant,
    held: false,
    slot: null,
    benchStatus: null,
    lastBenchDay: day,
  };
}

function propagatedChild(parent, job, day) {
  const species = speciesForPlant(parent);
  const parentPrice = Math.max(1, safeInteger(parent.price, species?.price || 1, 1));
  const price = Math.max(1, Math.min(parentPrice - 1, Math.round(parentPrice * PROPAGATION_PRICE_MULTIPLIER)));
  const variation = ((hashText(job.id) % 81) - 40) / 1000;

  return {
    id: `plant-${job.id}-child`,
    speciesId: parent.speciesId || species?.id,
    species: parent.species || species?.name,
    traits: Array.isArray(parent.traits) && parent.traits.length ? [...parent.traits] : [...(species?.traits || [])],
    price,
    wholesaleCost: Number.isFinite(parent.wholesaleCost) ? parent.wholesaleCost : species?.wholesaleCost || 0,
    acquisitionCost: 0,
    colorShift: Math.max(-0.12, Math.min(0.12, (Number(parent.colorShift) || 0) + variation)),
    care: { water: false, mist: false, prune: false },
    hydration: 76,
    supplierLot: "propagation",
    priceBand: "fair",
    lifeStage: "juvenile",
    maturityDaysRemaining: job.lampAssisted
      ? GROW_LAMP_PROPAGATION_MATURITY_DAYS
      : PROPAGATION_MATURITY_DAYS,
    rootComfort: "comfortable",
    pot: "propagation-pot",
    soil: "propagation-mix",
    parentId: parent.id,
    propagationJobId: job.id,
    propagatedDay: day,
    arrivalDay: day,
    rootAgeDays: 0,
    benchStatus: null,
    held: false,
    condition: "healthy",
    cosmeticVariation: {
      ...(parent.cosmeticVariation || {}),
      hueShift: Math.max(-0.12, Math.min(0.12, (Number(parent.colorShift) || 0) + variation)),
    },
    recoveredToday: false,
    thirstWarned: false,
    slot: null,
  };
}

/**
 * Applies all ready jobs. A propagation job stays ready if stock became full
 * after the job started. This prevents plant loss.
 */
export function applyCompletedBenchJobs({
  benchState,
  inventory = [],
  day = 1,
  capacity = INVENTORY_CAPACITY,
} = {}) {
  const bench = migrateBenchState(benchState);
  const currentDay = safeDay(day);
  const safeInventoryCapacity = safeCapacity(capacity);
  let nextInventory = cloneInventory(inventory);
  const remainingJobs = [];
  const appliedJobs = [];
  const waitingJobs = [];
  const errors = [];
  const messages = [];

  bench.jobs.forEach((job) => {
    if (job.status !== "ready") {
      remainingJobs.push(job);
      return;
    }

    const plantIndex = nextInventory.findIndex((plant) => plant.id === job.plantId);
    if (plantIndex < 0) {
      errors.push({ jobId: job.id, code: "plant-not-found" });
      messages.push("A bench job was removed because its plant is missing.");
      return;
    }

    const plant = nextInventory[plantIndex];
    if (job.type === BENCH_JOB_TYPES.PROPAGATE) {
      const childId = `plant-${job.id}-child`;
      const existingChild = nextInventory.find((entry) => entry.id === childId);
      if (!existingChild && nextInventory.length >= safeInventoryCapacity) {
        waitingJobs.push(job);
        remainingJobs.push(job);
        messages.push("Propagation is ready. Make one stock space for the new plant.");
        return;
      }

      const parent = {
        ...completedPlantBase(plant, currentDay),
        lastPropagationDay: currentDay,
        acquisitionCost: safeInteger(plant.acquisitionCost, 0) + safeInteger(job.cost?.coins, 0),
      };
      nextInventory[plantIndex] = parent;
      const child = existingChild || propagatedChild(parent, job, currentDay);
      if (!existingChild) nextInventory.push(child);
      appliedJobs.push({ ...job, childId: child.id });
      messages.push(job.lampAssisted
        ? `${parent.species || "The plant"} made a new juvenile plant. The grow lamp shortened its growth time to two mornings.`
        : `${parent.species || "The plant"} made a new juvenile plant.`);
      return;
    }

    if (job.type === BENCH_JOB_TYPES.REPOT) {
      const valueBonus = REPOT_VALUE_BONUS + (job.lampAssisted ? GROW_LAMP_REPOT_VALUE_BONUS : 0);
      nextInventory[plantIndex] = {
        ...completedPlantBase(plant, currentDay),
        acquisitionCost: safeInteger(plant.acquisitionCost, 0) + safeInteger(job.cost?.coins, 0),
        price: safeInteger(plant.price, 0) + valueBonus,
        repotValueBonus: safeInteger(plant.repotValueBonus, 0) + valueBonus,
        rootComfort: "comfortable",
        rootAgeDays: 0,
        pot: "fresh-terracotta",
        repottedDay: currentDay,
      };
      appliedJobs.push(job);
      messages.push(job.lampAssisted
        ? `${plant.species || "The plant"} has comfortable roots and more value. The grow lamp added 2 more coins of value.`
        : `${plant.species || "The plant"} has comfortable roots and more value.`);
      return;
    }

    const protectionDays = REHABILITATE_PROTECTION_DAYS
      + (job.lampAssisted ? GROW_LAMP_REHABILITATE_PROTECTION_DAYS : 0);
    const restoredValue = safeInteger(plant.rehabilitationValueLoss, 0);
    nextInventory[plantIndex] = {
      ...completedPlantBase(plant, currentDay),
      acquisitionCost: safeInteger(plant.acquisitionCost, 0) + safeInteger(job.cost?.coins, 0),
      hydration: Math.max(Number(plant.hydration) || 0, REHABILITATE_HYDRATION),
      condition: "healthy",
      needsRehabilitation: false,
      nurseryAgeDays: 0,
      nurseryStressDay: null,
      price: safeInteger(plant.price, 1, 1) + restoredValue,
      rehabilitationValueLoss: 0,
      recoveredToday: true,
      rehabilitatedDay: currentDay,
      conditionProtectionUntilDay: currentDay + protectionDays - 1,
    };
    appliedJobs.push({ ...job, restoredValue });
    messages.push(job.lampAssisted
      ? `${plant.species || "The plant"} has no nursery stress. Full sale value is restored${restoredValue ? ` (+${restoredValue} coins)` : ""}. The grow lamp added one protection day.`
      : `${plant.species || "The plant"} has no nursery stress. Full sale value is restored${restoredValue ? ` (+${restoredValue} coins)` : ""}, with two protected days.`);
  });

  return {
    ok: errors.length === 0,
    code: waitingJobs.length ? "jobs-waiting-for-space" : appliedJobs.length ? "jobs-applied" : "no-ready-jobs",
    message: messages.join(" ") || "No ready bench job was applied.",
    messages,
    benchState: { ...bench, jobs: remainingJobs },
    inventory: nextInventory,
    appliedJobs,
    waitingJobs,
    errors,
  };
}

/** Advances due jobs and applies all results that can fit in stock. */
export function advanceAndApplyBenchJobs(options = {}) {
  const advanced = advanceBenchJobs(options);
  const applied = applyCompletedBenchJobs({
    ...options,
    benchState: advanced.benchState,
    inventory: advanced.inventory,
  });
  return {
    ...applied,
    newlyReady: advanced.newlyReady,
    message: applied.appliedJobs.length || applied.waitingJobs.length || applied.errors.length
      ? applied.message
      : advanced.message,
  };
}
