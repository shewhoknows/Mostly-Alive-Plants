import {
  BRIEF_TEMPLATES,
  CUSTOMERS,
  INVENTORY_CAPACITY,
  PRICE_BANDS,
  SPECIES,
  WEEKDAYS,
  WEEKLY_OBJECTIVES,
} from "./game-data.js";

const SPECIES_BY_ID = new Map(SPECIES.map((species) => [species.id, species]));
const SPECIES_BY_NAME = new Map(SPECIES.map((species) => [species.name, species]));
const OBJECTIVE_METRICS = new Set(WEEKLY_OBJECTIVES.map((objective) => objective.metric));

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : fallback;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicOrder(values, seed, identity) {
  return [...values].sort((left, right) => {
    const leftHash = hashText(`${seed}|${identity(left)}`);
    const rightHash = hashText(`${seed}|${identity(right)}`);
    return leftHash - rightHash || identity(left).localeCompare(identity(right));
  });
}

function speciesForRecord(record) {
  if (!record) return null;
  if (record.id && SPECIES_BY_ID.get(record.id) === record) return record;
  return SPECIES_BY_ID.get(record.speciesId)
    || SPECIES_BY_NAME.get(record.species)
    || SPECIES_BY_NAME.get(record.speciesName)
    || SPECIES_BY_ID.get(record.id)
    || null;
}

function memoryForCustomer(customerMemory, person) {
  if (customerMemory instanceof Map) return customerMemory.get(person.id) || {};
  if (!customerMemory || typeof customerMemory !== "object") return {};
  return customerMemory[person.id] || customerMemory[person.name] || {};
}

function templateMatchesPerson(template, person) {
  return template.archetypes === "all"
    || (Array.isArray(template.archetypes) && template.archetypes.includes(person.archetype));
}

function customerBudgetRange(person) {
  const source = Array.isArray(person.budgetRange) ? person.budgetRange : [0, Number.MAX_SAFE_INTEGER];
  const first = Number(source[0]);
  const second = Number(source[1]);
  const low = Number.isFinite(first) ? Math.max(0, Math.round(first)) : 0;
  const high = Number.isFinite(second) ? Math.max(low, Math.round(second)) : low;
  return [low, high];
}

function bufferedQuickPrice(species) {
  // New plant records vary up to three coins above the catalog price. Giving
  // every brief this full buffer keeps supplier previews and real stock honest.
  return askingPrice({ price: species.price, priceBand: "quick" }, species) + 3;
}

function briefOptions({ person, speciesEntries, templates, unlockedTraits }) {
  const [, maximumBudget] = customerBudgetRange(person);
  const options = [];

  templates.forEach((template) => {
    if (!templateMatchesPerson(template, person)) return;
    const required = template.strategy?.required;
    if (required?.type !== "trait" || !Array.isArray(required.options)) return;
    const requiredTraits = required.options.filter((trait) => unlockedTraits.has(trait));
    if (!requiredTraits.length) return;
    const preferredTraits = template.strategy?.preferred?.type === "trait"
      ? (template.strategy.preferred.options || []).filter((trait) => unlockedTraits.has(trait))
      : [];

    speciesEntries.forEach((entry) => {
      const species = entry.species;
      const actualQuickPrice = entry.plant
        ? askingPrice({ ...entry.plant, priceBand: "quick" }, species)
        : 0;
      const budgetFloor = Math.max(bufferedQuickPrice(species), actualQuickPrice);
      if (!entry.plant && budgetFloor > maximumBudget) return;
      requiredTraits.filter((trait) => species.traits.includes(trait)).forEach((need) => {
        const distinctPreferred = preferredTraits.filter((trait) => trait !== need && species.traits.includes(trait));
        const distinctFallback = species.traits.filter((trait) => trait !== need);
        const bonusTrait = distinctPreferred[0] || distinctFallback[0] || need;
        options.push({
          template,
          species,
          need,
          bonusTrait,
          budgetFloor,
          ownedStock: Boolean(entry.plant),
        });
      });
    });
  });

  return options;
}

function chooseBriefOption(options, day, person, slot, usedBriefIds) {
  const unused = options.filter((option) => !usedBriefIds.has(option.template.id));
  const pool = unused.length ? unused : options;
  if (!pool.length) return null;
  const ordered = deterministicOrder(
    pool,
    `brief|${day}|${person.id}|${slot}`,
    (option) => `${option.template.id}|${option.species.id}|${option.need}|${option.bonusTrait}`,
  );
  return ordered[0];
}

function makeBrief(person, option, { day, slot, customerMemory }) {
  const { template, species, need, bonusTrait, budgetFloor, ownedStock } = option;
  const memory = memoryForCustomer(customerMemory, person);
  const visits = Math.max(0, Math.floor(Number(memory.visits) || 0));
  const purchases = Math.max(0, Math.floor(Number(memory.purchases) || 0));
  const isReturning = visits > 0 || purchases > 0;
  const visitNumber = Math.max(1, visits + 1);
  const returningLines = Array.isArray(person.returningLines) ? person.returningLines : [];
  const returnLine = returningLines.length
    ? returningLines[hashText(`${day}|${person.id}|${visitNumber}`) % returningLines.length]
    : person.line;
  const [minimumBudget, maximumBudget] = customerBudgetRange(person);
  const positionValue = Number(template.strategy?.budget?.position);
  const position = Number.isFinite(positionValue) ? Math.max(0, Math.min(1, positionValue)) : 0.5;
  const positionedBudget = Math.round(minimumBudget + (maximumBudget - minimumBudget) * position);
  const budget = ownedStock
    ? Math.max(minimumBudget, positionedBudget, budgetFloor)
    : Math.min(maximumBudget, Math.max(minimumBudget, positionedBudget, budgetFloor));
  const careOptions = Array.isArray(species.beneficialCare) && species.beneficialCare.length
    ? species.beneficialCare
    : ["water"];
  const careWish = careOptions[hashText(`${day}|${slot}|${person.id}|${species.id}|care`) % careOptions.length];
  const line = isReturning && returnLine
    ? returnLine
    : template.framing || person.line;

  return {
    ...person,
    need,
    bonusTrait,
    careWish,
    speciesHint: species.name,
    budget,
    briefId: template.id,
    line,
    isReturning,
    visitNumber,
  };
}

export function calendarForDay(day) {
  const safeDay = positiveInteger(day);
  const weekdayIndex = (safeDay - 1) % WEEKDAYS.length;
  const week = Math.floor((safeDay - 1) / WEEKDAYS.length) + 1;
  return {
    day: safeDay,
    week,
    weekdayIndex,
    weekday: WEEKDAYS[weekdayIndex],
    isMonday: weekdayIndex === 0,
    isFriday: weekdayIndex === WEEKDAYS.length - 1,
  };
}

export function askingPrice(plant = {}, species = null) {
  const resolvedSpecies = speciesForRecord(species) || speciesForRecord(plant);
  const plantPrice = Number(plant?.price);
  const speciesPrice = Number(resolvedSpecies?.price);
  const basePrice = Number.isFinite(plantPrice)
    ? plantPrice
    : Number.isFinite(speciesPrice) ? speciesPrice : 0;
  const band = PRICE_BANDS[plant?.priceBand] || PRICE_BANDS.fair || { multiplier: 1 };
  return Math.max(0, Math.round(basePrice * (Number(band.multiplier) || 1)));
}

export function availableSpeciesForWeek(week) {
  const safeWeek = positiveInteger(week);
  return SPECIES.filter((species) => positiveInteger(species.unlockWeek) <= safeWeek);
}

export function availableCustomersForWeek(week) {
  const safeWeek = positiveInteger(week);
  return CUSTOMERS.filter((person) => positiveInteger(person.unlockWeek) <= safeWeek);
}

export function generateCustomerBriefs({
  day = 1,
  inventory = [],
  customerMemory = {},
  count = 3,
  capacity = INVENTORY_CAPACITY,
} = {}) {
  const calendar = calendarForDay(day);
  const speciesPool = availableSpeciesForWeek(calendar.week);
  const customerPool = availableCustomersForWeek(calendar.week);
  const safeCount = Math.min(
    customerPool.length,
    Math.max(0, Math.floor(Number(count) || 0)),
  );
  if (!safeCount || !speciesPool.length) return [];

  const unlockedTraits = new Set(speciesPool.flatMap((species) => species.traits));
  const templates = BRIEF_TEMPLATES.filter((template) => positiveInteger(template.unlockWeek) <= calendar.week);
  const people = deterministicOrder(customerPool, `people|${calendar.day}`, (person) => person.id);
  const speciesEntries = speciesPool.map((species) => ({ species, plant: null }));
  const stockEntries = deterministicOrder(
    (Array.isArray(inventory) ? inventory : [])
      .map((plant, stockIndex) => ({
        plant,
        stockIndex,
        species: speciesForRecord(plant),
      }))
      .filter((entry) => entry.species),
    `stock|${calendar.day}`,
    (entry) => `${entry.species.id}|${entry.plant.id || entry.stockIndex}`,
  );
  stockEntries.forEach((entry) => entry.species.traits.forEach((trait) => unlockedTraits.add(trait)));
  const briefs = [];
  const usedPeople = new Set();
  const usedBriefIds = new Set();

  // Carry enough distinct stock requests to leave no more missing matches than
  // the shelves can accept. With a full shop all three briefs come from stock;
  // with ordinary capacity there is still at least one carry-over request.
  if (stockEntries.length) {
    const capacityValue = Number(capacity);
    const safeCapacity = Number.isFinite(capacityValue)
      ? Math.max(0, Math.floor(capacityValue))
      : INVENTORY_CAPACITY;
    const freeCapacity = Math.max(0, safeCapacity - (Array.isArray(inventory) ? inventory.length : 0));
    const desiredStockBriefs = Math.min(
      safeCount,
      stockEntries.length,
      Math.max(1, safeCount - freeCapacity),
    );

    function findStockAssignments(target) {
      const assignments = [];
      const assignedPeople = new Set();
      const assignedStock = new Set();
      const assignedBriefs = new Set();

      function visit(slot) {
        if (slot >= target) return true;
        for (const person of people) {
          if (assignedPeople.has(person.id)) continue;
          for (const stockEntry of stockEntries) {
            const stockKey = stockEntry.plant.id || stockEntry.stockIndex;
            if (assignedStock.has(stockKey)) continue;
            const options = briefOptions({ person, speciesEntries: [stockEntry], templates, unlockedTraits });
            const chosen = chooseBriefOption(options, calendar.day, person, slot, assignedBriefs);
            if (!chosen) continue;
            assignments.push({ person, chosen });
            assignedPeople.add(person.id);
            assignedStock.add(stockKey);
            assignedBriefs.add(chosen.template.id);
            if (visit(slot + 1)) return true;
            assignments.pop();
            assignedPeople.delete(person.id);
            assignedStock.delete(stockKey);
            assignedBriefs.delete(chosen.template.id);
          }
        }
        return false;
      }

      return visit(0) ? assignments : null;
    }

    let stockAssignments = null;
    for (let target = desiredStockBriefs; target >= 1 && !stockAssignments; target -= 1) {
      stockAssignments = findStockAssignments(target);
    }
    (stockAssignments || []).forEach(({ person, chosen }, slot) => {
      briefs.push(makeBrief(person, chosen, { day: calendar.day, slot, customerMemory }));
      usedPeople.add(person.id);
      usedBriefIds.add(chosen.template.id);
    });
  }

  for (const person of people) {
    if (briefs.length >= safeCount) break;
    if (usedPeople.has(person.id)) continue;
    const options = briefOptions({ person, speciesEntries, templates, unlockedTraits });
    const chosen = chooseBriefOption(options, calendar.day, person, briefs.length, usedBriefIds);
    if (!chosen) continue;
    briefs.push(makeBrief(person, chosen, {
      day: calendar.day,
      slot: briefs.length,
      customerMemory,
    }));
    usedPeople.add(person.id);
    usedBriefIds.add(chosen.template.id);
  }

  return briefs;
}

export function createWeeklyObjective(week) {
  const safeWeek = positiveInteger(week);
  const source = WEEKLY_OBJECTIVES[(safeWeek - 1) % WEEKLY_OBJECTIVES.length];
  if (!source) return null;
  const base = Number(source.target?.base) || 0;
  const perWeek = Number(source.target?.perWeek) || 0;
  const maximum = Number(source.target?.maximum);
  const scaledTarget = Math.max(1, Math.round(base + perWeek * (safeWeek - 1)));
  const target = Number.isFinite(maximum) ? Math.min(scaledTarget, maximum) : scaledTarget;
  return {
    week: safeWeek,
    id: source.id,
    title: source.title,
    metric: source.metric,
    target,
    description: String(source.description || "").replaceAll("{target}", String(target)),
    reward: { ...(source.reward || {}) },
    progress: 0,
    completed: false,
    claimed: false,
    uniqueSpecies: [],
  };
}

export function progressWeeklyObjective(objective, event = {}) {
  if (!objective || typeof objective !== "object" || objective.completed) {
    return { changed: false, completedNow: false };
  }
  if (!OBJECTIVE_METRICS.has(objective.metric) || event.metric !== objective.metric) {
    return { changed: false, completedNow: false };
  }

  const target = Math.max(1, Math.floor(Number(objective.target) || 1));
  let changed = false;
  if (objective.metric === "uniqueSpeciesSold") {
    const value = event.value === undefined ? 1 : Number(event.value);
    if (!Number.isFinite(value) || value <= 0) return { changed: false, completedNow: false };
    const speciesId = typeof event.speciesId === "string" ? event.speciesId.trim() : "";
    if (!speciesId) return { changed: false, completedNow: false };
    if (!Array.isArray(objective.uniqueSpecies)) objective.uniqueSpecies = [];
    if (objective.uniqueSpecies.includes(speciesId)) return { changed: false, completedNow: false };
    objective.uniqueSpecies.push(speciesId);
    objective.progress = Math.min(target, objective.uniqueSpecies.length);
    changed = true;
  } else {
    const value = Number(event.value);
    if (!Number.isFinite(value) || value === 0) return { changed: false, completedNow: false };
    const previous = Math.max(0, Number(objective.progress) || 0);
    const next = Math.min(target, Math.max(0, previous + value));
    if (next === previous) return { changed: false, completedNow: false };
    objective.progress = next;
    changed = true;
  }

  const completedNow = !objective.completed && objective.progress >= target;
  if (completedNow) objective.completed = true;
  return { changed, completedNow };
}

export function weeklyObjectiveLabel(objective) {
  if (!objective) return "No weekly goal";
  if (objective.completed) return `${objective.title}: complete ✓`;
  const progress = Math.max(0, Number(objective.progress) || 0);
  const target = Math.max(1, Number(objective.target) || 1);
  const unit = objective.metric === "grossProfit" ? " coins" : "";
  return `${objective.title}: ${progress}/${target}${unit}`;
}

export function freshWeekStats(week) {
  return {
    week: positiveInteger(week),
    sales: 0,
    revenue: 0,
    costOfGoods: 0,
    profit: 0,
    bloom: 0,
    perfects: 0,
    care: 0,
    rescues: 0,
    healthyDisplayDays: 0,
    boutiqueSales: 0,
    quickSales: 0,
    returningCustomersDelighted: 0,
    uniqueSpeciesSold: [],
    closedDays: [],
    days: [],
  };
}
