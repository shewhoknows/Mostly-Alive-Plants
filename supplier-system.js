import { INVENTORY_CAPACITY, SPECIES, SUPPLIER_TYPES } from "./game-data.js";

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

function canAssignNeeds(plants, needs, customerIndex = 0, used = new Set()) {
  if (customerIndex >= needs.length) return true;
  const need = needs[customerIndex];

  for (let plantIndex = 0; plantIndex < plants.length; plantIndex += 1) {
    if (used.has(plantIndex) || !plantTraits(plants[plantIndex]).includes(need)) continue;
    used.add(plantIndex);
    if (canAssignNeeds(plants, needs, customerIndex + 1, used)) return true;
    used.delete(plantIndex);
  }

  return false;
}

/**
 * Returns true only when distinct inventory plants can be assigned to every
 * customer's required trait. A single plant can never cover two sales.
 */
export function inventoryCoversCustomers(inventory = [], customers = []) {
  const needs = customers.map(customerNeed);
  if (needs.some((need) => !need)) return false;
  return canAssignNeeds(inventory, needs);
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function combinations(count, allowDuplicates) {
  const results = [];

  function visit(start, chosen) {
    if (chosen.length === count) {
      results.push([...chosen]);
      return;
    }
    for (let index = start; index < SPECIES.length; index += 1) {
      chosen.push(SPECIES[index]);
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

function chooseSpecies(type, day, customers, inventory) {
  const quantity = type.quantity.min;
  const needs = customers.map(customerNeed).filter(Boolean);
  const seedKey = [day, type.id, needs.join(","), inventorySignature(inventory)].join("|");
  const requestedNoDuplicates = Boolean(type.selection.avoidDuplicates);

  let candidates = combinations(quantity, !requestedNoDuplicates)
    .filter((speciesList) => inventoryCoversCustomers(
      [...inventory, ...virtualPlants(speciesList)],
      customers,
    ));
  let duplicatePreferenceRelaxed = false;

  if (!candidates.length && requestedNoDuplicates) {
    duplicatePreferenceRelaxed = true;
    candidates = combinations(quantity, true)
      .filter((speciesList) => inventoryCoversCustomers(
        [...inventory, ...virtualPlants(speciesList)],
        customers,
      ));
  }

  if (!candidates.length) {
    const fallback = combinations(quantity, true);
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
  const chosen = chooseSpecies(type, day, customers, inventory);
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
    description: hardshipCredit
      ? `${type.description} The nursery has put this one on a pay-what-you-can rescue tab.`
      : type.description,
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
    selectable: affordable && fitsCapacity && coversRequests,
    duplicatePreferenceRelaxed: chosen.duplicatePreferenceRelaxed,
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
