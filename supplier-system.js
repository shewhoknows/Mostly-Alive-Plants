import { INVENTORY_CAPACITY, PRICE_BANDS, SPECIES, SUPPLIER_TYPES } from "./game-data.js";
import { askingPrice, availableSpeciesForWeek, calendarForDay } from "./progression-system.js";
import { dailyTradeProfile } from "./trade-system.js";

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

function isAvailableForCustomers(plant) {
  return plant && !plant.benchStatus && plant.lifeStage !== "juvenile";
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

function maximumAssignedNeeds(plants, requirements) {
  if (!requirements.length || !plants.length) return 0;
  const assignedRequirementByPlant = new Array(plants.length).fill(-1);

  function assign(requirementIndex, visitedPlants) {
    const { need, budget, priceBand } = requirements[requirementIndex];
    for (let plantIndex = 0; plantIndex < plants.length; plantIndex += 1) {
      const plant = plants[plantIndex];
      if (visitedPlants.has(plantIndex) || !plantTraits(plant).includes(need)) continue;
      if (budget !== null && minimumAskingPrice(plant, priceBand) > budget) continue;
      visitedPlants.add(plantIndex);
      const previousRequirement = assignedRequirementByPlant[plantIndex];
      if (previousRequirement === -1 || assign(previousRequirement, visitedPlants)) {
        assignedRequirementByPlant[plantIndex] = requirementIndex;
        return true;
      }
    }
    return false;
  }

  let assigned = 0;
  requirements.forEach((_, requirementIndex) => {
    if (assign(requirementIndex, new Set())) assigned += 1;
  });
  return assigned;
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
  const availableInventory = inventory.filter(isAvailableForCustomers);
  return maximumAssignedNeeds(availableInventory, requirements) === requirements.length;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function inventorySignature(inventory) {
  return inventory.map((plant) => {
    const species = SPECIES_BY_ID.get(plant?.speciesId)
      || SPECIES_BY_NAME.get(plant?.species)
      || SPECIES_BY_NAME.get(plant?.speciesName);
    const identity = species?.id || [...plantTraits(plant)].sort().join("+") || "unknown";
    const availability = plant?.benchStatus
      ? "bench"
      : plant?.lifeStage === "juvenile" ? "juvenile" : "floor";
    return `${identity}:${availability}`;
  }).sort().join(",");
}

function deterministicSpeciesOrder(speciesPool, seedKey, type, suffix = "") {
  return [...speciesPool].sort((left, right) => {
    if (type.id === "mystery-rescue-lot") {
      const costDifference = left.wholesaleCost - right.wholesaleCost;
      if (costDifference) return costDifference;
    }
    const leftHash = hashText(`${seedKey}|${suffix}|${left.id}`);
    const rightHash = hashText(`${seedKey}|${suffix}|${right.id}`);
    return leftHash - rightHash || left.id.localeCompare(right.id);
  });
}

function deterministicFallbackSpecies(speciesPool, quantity, allowDuplicates, seedKey, type) {
  if (!quantity || !speciesPool.length) return [];
  const ordered = deterministicSpeciesOrder(speciesPool, seedKey, type, "fallback");
  if (!allowDuplicates) return ordered.slice(0, quantity);
  return Array.from({ length: quantity }, (_, index) => {
    const choice = hashText(`${seedKey}|fallback-slot|${index}`) % ordered.length;
    return ordered[choice];
  });
}

function searchCoveringSpecies({
  type,
  speciesPool,
  quantity,
  allowDuplicates,
  inventory,
  customers,
  seedKey,
}) {
  const requirements = customers.map(customerRequirement);
  if (requirements.some(({ need }) => !need)) return null;
  const availableInventory = inventory.filter(isAvailableForCustomers);
  if (availableInventory.length + quantity < requirements.length) return null;
  if (!quantity) return maximumAssignedNeeds(availableInventory, requirements) === requirements.length ? [] : null;

  const orderedSpecies = deterministicSpeciesOrder(speciesPool, seedKey, type, "search");
  const selectedSpecies = [];
  const selectedPlants = [];

  function visit(startIndex) {
    const remainingSlots = quantity - selectedSpecies.length;
    const currentPlants = [...availableInventory, ...selectedPlants];
    const assigned = maximumAssignedNeeds(currentPlants, requirements);
    if (assigned + remainingSlots < requirements.length) return null;
    if (!remainingSlots) return assigned === requirements.length ? [...selectedSpecies] : null;

    const choices = [];
    for (let index = startIndex; index < orderedSpecies.length; index += 1) {
      const species = orderedSpecies[index];
      const preview = virtualPlants([species])[0];
      const gain = maximumAssignedNeeds([...currentPlants, preview], requirements) - assigned;
      choices.push({ index, species, preview, gain });
    }
    choices.sort((left, right) => right.gain - left.gain
      || left.index - right.index);

    for (const choice of choices) {
      selectedSpecies.push(choice.species);
      selectedPlants.push(choice.preview);
      const result = visit(allowDuplicates ? choice.index : choice.index + 1);
      if (result) return result;
      selectedPlants.pop();
      selectedSpecies.pop();
    }
    return null;
  }

  return visit(0);
}

function chooseSpecies(type, day, customers, inventory, quantity = type.quantity.min) {
  const week = calendarForDay(day).week;
  const speciesPool = availableSpeciesForWeek(week);
  const needs = customers.map(customerNeed).filter(Boolean);
  const budgets = customers.map((customer) => Number.isFinite(Number(customer?.budget)) ? Number(customer.budget) : "legacy");
  const priceBands = customers.map((customer) => PRICE_BANDS[customer?.objectivePriceBand] ? customer.objectivePriceBand : "quick");
  const seedKey = [day, type.id, quantity, needs.join(","), budgets.join(","), priceBands.join(","), inventorySignature(inventory)].join("|");
  const requestedNoDuplicates = Boolean(type.selection.avoidDuplicates);

  let speciesList = searchCoveringSpecies({
    type,
    speciesPool,
    quantity,
    allowDuplicates: !requestedNoDuplicates,
    inventory,
    customers,
    seedKey,
  });
  let duplicatePreferenceRelaxed = false;

  if (!speciesList && requestedNoDuplicates) {
    duplicatePreferenceRelaxed = true;
    speciesList = searchCoveringSpecies({
      type,
      speciesPool,
      quantity,
      allowDuplicates: true,
      inventory,
      customers,
      seedKey: `${seedKey}|duplicates`,
    });
  }

  if (!speciesList) {
    const fallback = deterministicFallbackSpecies(speciesPool, quantity, true, seedKey, type);
    return { speciesList: fallback, duplicatePreferenceRelaxed, coversRequests: false };
  }

  return { speciesList, duplicatePreferenceRelaxed, coversRequests: true };
}

function configuredQuantityForLot(type, { day, customers, inventory, capacity }) {
  const calendar = calendarForDay(day);
  if (calendar.week === 1) return Math.max(0, Math.floor(Number(type.quantity?.min) || 0));
  const profile = dailyTradeProfile({ day, inventoryCount: inventory.length, capacity });
  const stockTarget = Math.min(capacity, customers.length + profile.choiceBuffer);
  const recommended = Math.max(0, stockTarget - inventory.length);
  const availableStock = inventory.filter(isAvailableForCustomers);
  const covered = maximumAssignedNeeds(availableStock, customers.map(customerRequirement));
  const requiredTopUp = Math.max(0, customers.length - covered);
  if (type.id === "curated-pair") return recommended > 0 ? Math.min(5, Math.max(2, recommended - 1)) : 2;
  if (type.id === "mystery-rescue-lot") return recommended > 0 ? Math.min(7, Math.max(requiredTopUp, recommended + 1)) : Math.max(4, requiredTopUp);
  return recommended > 0 ? Math.min(7, Math.max(3, requiredTopUp, recommended)) : Math.max(3, requiredTopUp);
}

function chooseLotSpecies(type, { day, customers, inventory, capacity }) {
  const configuredQuantity = configuredQuantityForLot(type, { day, customers, inventory, capacity });
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

function lotDescription(type, quantity) {
  if (type.id === "curated-pair") {
    return `${quantity} previewed plants chosen to suit today's homes and improve the shop's range.`;
  }
  if (type.id === "mystery-rescue-lot") {
    return `${quantity} discounted mystery plants that arrive stressed but can recover with thoughtful care.`;
  }
  return `${quantity} healthy, familiar plants with a balanced mix of care needs.`;
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
        : lotDescription(type, quantity),
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
