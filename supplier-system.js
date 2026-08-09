import { INVENTORY_CAPACITY, PRICE_BANDS, SPECIES, SUPPLIER_TYPES } from "./game-data.js";
import { askingPrice, availableSpeciesForWeek, calendarForDay } from "./progression-system.js";

const SPECIES_BY_ID = new Map(SPECIES.map((species) => [species.id, species]));
const SPECIES_BY_NAME = new Map(SPECIES.map((species) => [species.name, species]));

function customerNeed(customer) {
  return customer?.need
    || customer?.requiredTrait
    || customer?.requiredTraits?.[0]
    || customer?.traits?.required
    || null;
}

function plantTraits(plant) {
  if (Array.isArray(plant?.traits) && plant.traits.length) return plant.traits;
  const species = SPECIES_BY_ID.get(plant?.speciesId)
    || SPECIES_BY_NAME.get(plant?.species)
    || SPECIES_BY_NAME.get(plant?.speciesName);
  return species?.traits || [];
}

function plantSpecies(plant) {
  return SPECIES_BY_ID.get(plant?.speciesId)
    || SPECIES_BY_NAME.get(plant?.species)
    || SPECIES_BY_NAME.get(plant?.speciesName)
    || null;
}

function minimumAskingPrice(plant, priceBand = "quick") {
  return askingPrice({ ...plant, priceBand }, plantSpecies(plant));
}

function customerRequirement(customer) {
  const budget = Number(customer?.budget);
  const requestedBand = customer?.objectivePriceBand;
  return {
    need: customerNeed(customer),
    budget: customer?.budget !== undefined && customer?.budget !== null && Number.isFinite(budget)
      ? budget
      : null,
    priceBand: PRICE_BANDS[requestedBand] ? requestedBand : "quick",
  };
}

function canAssignNeeds(plants, requirements, customerIndex = 0, used = new Set()) {
  if (customerIndex >= requirements.length) return true;
  const { need, budget, priceBand } = requirements[customerIndex];

  for (let plantIndex = 0; plantIndex < plants.length; plantIndex += 1) {
    const plant = plants[plantIndex];
    if (used.has(plantIndex) || !plantTraits(plant).includes(need)) continue;
    if (budget !== null && minimumAskingPrice(plant, priceBand) > budget) continue;
    used.add(plantIndex);
    if (canAssignNeeds(plants, requirements, customerIndex + 1, used)) return true;
    used.delete(plantIndex);
  }

  return false;
}

/**
 * Returns true only when distinct inventory plants can be assigned to every
 * customer's required trait and budget at its minimum required price band. A
 * single plant can never cover two sales. Ordinary briefs use Quick; objective
 * briefs can request Boutique. Legacy customers remain trait-only.
 */
export function inventoryCoversCustomers(inventory = [], customers = []) {
  const requirements = customers.map(customerRequirement);
  if (requirements.some(({ need }) => !need)) return false;
  return canAssignNeeds(inventory, requirements);
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function combinations(speciesPool, count, allowDuplicates) {
  const results = [];

  function visit(start, chosen) {
    if (chosen.length === count) {
      results.push([...chosen]);
      return;
    }
    for (let index = start; index < speciesPool.length; index += 1) {
      chosen.push(speciesPool[index]);
      visit(allowDuplicates ? index : index + 1, chosen);
      chosen.pop();
    }
  }

  visit(0, []);
  return results;
}

function virtualPlants(speciesList) {
  return speciesList.map((species, index) => ({
    id: `supplier-preview-${index}-${species.id}`,
    speciesId: species.id,
    species: species.name,
    traits: species.traits,
    // Plant records can roll up to three coins above the catalog value. Price
    // supplier previews at that ceiling so a promised budget always survives
    // the carton opening.
    price: species.price + 3,
    priceBand: "quick",
  }));
}

function sumWholesale(speciesList) {
  return speciesList.reduce((total, species) => total + species.wholesaleCost, 0);
}

function calculateCost(type, speciesList) {
  const subtotal = sumWholesale(speciesList);
  const value = subtotal * type.pricing.multiplier + type.pricing.flatFee;
  return Math.max(0, Math.round(value));
}

function distinctCount(speciesList) {
  return new Set(speciesList.map((species) => species.id)).size;
}

function inventorySignature(inventory) {
  return inventory.map((plant) => {
    const species = SPECIES_BY_ID.get(plant?.speciesId)
      || SPECIES_BY_NAME.get(plant?.species)
      || SPECIES_BY_NAME.get(plant?.speciesName);
    return species?.id || [...plantTraits(plant)].sort().join("+") || "unknown";
  }).sort().join(",");
}

function chooseSpecies(type, day, customers, inventory, quantity = type.quantity.min) {
  const week = calendarForDay(day).week;
  const speciesPool = availableSpeciesForWeek(week);
  const needs = customers.map(customerNeed).filter(Boolean);
  const budgets = customers.map((customer) => Number.isFinite(Number(customer?.budget)) ? Number(customer.budget) : "legacy");
  const priceBands = customers.map((customer) => PRICE_BANDS[customer?.objectivePriceBand] ? customer.objectivePriceBand : "quick");
  const seedKey = [day, type.id, quantity, needs.join(","), budgets.join(","), priceBands.join(","), inventorySignature(inventory)].join("|");
  const requestedNoDuplicates = Boolean(type.selection.avoidDuplicates);

  let candidates = combinations(speciesPool, quantity, !requestedNoDuplicates)
    .filter((speciesList) => inventoryCoversCustomers(
      [...inventory, ...virtualPlants(speciesList)],
      customers,
    ));
  let duplicatePreferenceRelaxed = false;

  if (!candidates.length && requestedNoDuplicates) {
    duplicatePreferenceRelaxed = true;
    candidates = combinations(speciesPool, quantity, true)
      .filter((speciesList) => inventoryCoversCustomers(
        [...inventory, ...virtualPlants(speciesList)],
        customers,
      ));
  }

  if (!candidates.length) {
    const fallback = combinations(speciesPool, quantity, true);
    if (!fallback.length) return { speciesList: [], duplicatePreferenceRelaxed, coversRequests: false };
    const index = hashText(seedKey) % fallback.length;
    return { speciesList: fallback[index], duplicatePreferenceRelaxed, coversRequests: false };
  }

  if (type.id === "mystery-rescue-lot") {
    candidates.sort((left, right) => sumWholesale(left) - sumWholesale(right)
      || left.map((species) => species.id).join("|").localeCompare(right.map((species) => species.id).join("|")));
    const economicalPool = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
    const index = hashText(seedKey) % economicalPool.length;
    return { speciesList: economicalPool[index], duplicatePreferenceRelaxed, coversRequests: true };
  }

  const index = hashText(seedKey) % candidates.length;
  return { speciesList: candidates[index], duplicatePreferenceRelaxed, coversRequests: true };
}

function chooseLotSpecies(type, { day, customers, inventory, capacity }) {
  const configuredQuantity = Math.max(0, Math.floor(Number(type.quantity?.min) || 0));
  const freeCapacity = Math.max(0, capacity - inventory.length);
  const maximumQuantity = Math.min(configuredQuantity, freeCapacity);
  if (maximumQuantity === 0) {
    return {
      ...chooseSpecies(type, day, customers, inventory, 0),
      capacityAdjusted: configuredQuantity > 0,
      configuredQuantity,
    };
  }

  // A nearly full shop needs a top-up, not a tray it cannot accept. Search in
  // ascending quantities so one missing match never consumes two shelf spaces.
  if (freeCapacity <= 2 && !inventoryCoversCustomers(inventory, customers)) {
    for (let quantity = 1; quantity <= maximumQuantity; quantity += 1) {
      const candidate = chooseSpecies(type, day, customers, inventory, quantity);
      if (candidate.coversRequests) {
        return {
          ...candidate,
          capacityAdjusted: quantity !== configuredQuantity,
          configuredQuantity,
        };
      }
    }
  }

  return {
    ...chooseSpecies(type, day, customers, inventory, maximumQuantity),
    capacityAdjusted: maximumQuantity !== configuredQuantity,
    configuredQuantity,
  };
}

function revealMetadata(type, speciesList) {
  const level = type.selection.reveal;
  return {
    level,
    showSpecies: level === "species" || level === "species-and-traits",
    showTraits: level === "species-and-traits",
    showQuantity: true,
    concealedLabel: level === "count-only" ? "Mystery plants" : null,
    visibleSpeciesNames: level === "count-only" ? [] : speciesList.map((species) => species.name),
    visibleTraits: level === "species-and-traits"
      ? [...new Set(speciesList.flatMap((species) => species.traits))]
      : [],
  };
}

function supplierLot(type, { day, customers, inventory, coins, capacity }) {
  const chosen = chooseLotSpecies(type, { day, customers, inventory, capacity });
  const { speciesList } = chosen;
  const quantity = speciesList.length;
  const nurseryCost = calculateCost(type, speciesList);
  const hardshipCredit = type.id === "mystery-rescue-lot" && coins < nurseryCost;
  const cost = hardshipCredit ? coins : nurseryCost;
  const affordable = coins >= cost;
  const fitsCapacity = inventory.length + quantity <= capacity;
  const coversRequests = chosen.coversRequests && inventoryCoversCustomers(
    [...inventory, ...virtualPlants(speciesList)],
    customers,
  );

  return {
    id: `day-${String(day).padStart(3, "0")}-${type.id}`,
    kind: "supplier",
    supplierId: type.id,
    name: type.name,
    description: [
      chosen.capacityAdjusted
        ? quantity === 0
          ? "No shelf space remains for a delivery."
          : `${quantity === 1 ? "One plant" : `${quantity} plants`} selected as a shelf-space top-up.`
        : type.description,
      hardshipCredit ? "The nursery has put this one on a pay-what-you-can rescue tab." : "",
    ].filter(Boolean).join(" "),
    speciesNames: speciesList.map((species) => species.name),
    speciesIds: speciesList.map((species) => species.id),
    cost,
    reveal: revealMetadata(type, speciesList),
    condition: type.selection.condition,
    quantity,
    affordable,
    fitsCapacity,
    capacityRemainingAfter: capacity - inventory.length - quantity,
    coversRequests,
    selectable: quantity > 0 && affordable && fitsCapacity && coversRequests,
    duplicatePreferenceRelaxed: chosen.duplicatePreferenceRelaxed,
    capacityAdjusted: chosen.capacityAdjusted,
    configuredQuantity: chosen.configuredQuantity,
    hardshipCredit,
    nurseryCost,
  };
}

function noPurchaseFallback(day, inventory, customers, capacity) {
  if (!inventoryCoversCustomers(inventory, customers)) return null;
  return {
    id: `day-${String(day).padStart(3, "0")}-use-current-stock`,
    kind: "no-purchase",
    supplierId: null,
    name: "Use Current Stock",
    description: "Your displays already hold a suitable plant for every visitor. Keep your coins and open from current stock.",
    speciesNames: [],
    speciesIds: [],
    cost: 0,
    reveal: {
      level: "current-stock",
      showSpecies: false,
      showTraits: false,
      showQuantity: true,
      concealedLabel: null,
      visibleSpeciesNames: [],
      visibleTraits: [],
    },
    condition: "existing-stock",
    quantity: 0,
    affordable: true,
    fitsCapacity: true,
    capacityRemainingAfter: capacity - inventory.length,
    coversRequests: true,
    selectable: true,
    duplicatePreferenceRelaxed: false,
  };
}

/**
 * Generates three deterministic supplier cards. When current stock can already
 * serve the full customer queue, a fourth no-purchase choice is appended.
 */
export function generateSupplierLots({ day = 1, customers = [], inventory = [], coins = 0, capacity = INVENTORY_CAPACITY } = {}) {
  const safeDay = Math.max(1, Math.floor(Number(day) || 1));
  const safeCoins = Math.max(0, Math.floor(Number(coins) || 0));
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const safeCapacity = Math.max(INVENTORY_CAPACITY, Math.floor(Number(capacity) || INVENTORY_CAPACITY));
  const input = { day: safeDay, customers: safeCustomers, inventory: safeInventory, coins: safeCoins, capacity: safeCapacity };
  const lots = SUPPLIER_TYPES.map((type) => supplierLot(type, input));
  const fallback = noPurchaseFallback(safeDay, safeInventory, safeCustomers, safeCapacity);
  return fallback ? [...lots, fallback] : lots;
}
