import { INVENTORY_CAPACITY, PRICE_BANDS, SPECIES, SUPPLIER_TYPES } from "./game-data.js?v=20260819d";
import { askingPrice, availableSpeciesForWeek, calendarForDay } from "./progression-system.js?v=20260819d";
import { dailyTradeProfile } from "./trade-system.js?v=20260819d";

const SPECIES_BY_ID = new Map(SPECIES.map((species) => [species.id, species]));
const SPECIES_BY_NAME = new Map(SPECIES.map((species) => [species.name, species]));
const SPECIAL_SPECIES = SPECIES.filter((species) => species.special === true);

const RARE_NURSERY_TYPE = Object.freeze({
  id: "rare-nursery-collection",
  name: "Rare Nursery Collection",
  quantity: Object.freeze({ min: 3, max: 8 }),
  pricing: Object.freeze({
    basis: "sum-wholesale-cost",
    multiplier: 1.15,
    flatFee: 4,
    rounding: "nearest-coin",
  }),
  selection: Object.freeze({
    mode: "specialist-collection",
    reveal: "species-and-traits",
    avoidDuplicates: true,
    condition: "healthy",
  }),
});

const RARE_NURSERY_FILL_TYPE = Object.freeze({
  ...RARE_NURSERY_TYPE,
  id: "rare-nursery-stock-fill",
  name: "Rare Nursery Stock Fill",
  pricing: Object.freeze({
    basis: "sum-wholesale-cost",
    multiplier: 1,
    flatFee: 0,
    rounding: "nearest-coin",
  }),
});

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
  return plant && !plant.benchStatus && !plant.held && plant.lifeStage !== "juvenile";
}

function isHealthyForOrder(plant) {
  return isAvailableForCustomers(plant)
    && !plant.needsRehabilitation
    && !plant.healthIssue
    && (!plant.rootComfort || plant.rootComfort === "comfortable")
    && (!Number.isFinite(Number(plant.hydration)) || Number(plant.hydration) >= 42);
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
    healthyOnly: customer?.healthyOnly === true,
  };
}

function canAssignNeeds(plants, requirements, customerIndex = 0, used = new Set()) {
  if (customerIndex >= requirements.length) return true;
  const { need, budget, priceBand, healthyOnly } = requirements[customerIndex];

  for (let plantIndex = 0; plantIndex < plants.length; plantIndex += 1) {
    const plant = plants[plantIndex];
    if (used.has(plantIndex) || !plantTraits(plant).includes(need)) continue;
    if (healthyOnly && !isHealthyForOrder(plant)) continue;
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
    const { need, budget, priceBand, healthyOnly } = requirements[requirementIndex];
    for (let plantIndex = 0; plantIndex < plants.length; plantIndex += 1) {
      const plant = plants[plantIndex];
      if (visitedPlants.has(plantIndex) || !plantTraits(plant).includes(need)) continue;
      if (healthyOnly && !isHealthyForOrder(plant)) continue;
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

function virtualPlants(speciesList, deliveries = []) {
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
    hydration: deliveries[index]?.condition === "stressed" ? 30 : 80,
    rootComfort: "comfortable",
    needsRehabilitation: deliveries[index]?.condition === "stressed",
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
      : plant?.held ? "held"
        : plant?.lifeStage === "juvenile" ? "juvenile" : "floor";
    return `${identity}:${availability}`;
  }).sort().join(",");
}

function deterministicSpeciesOrder(speciesPool, seedKey, type, suffix = "", inventory = []) {
  const ownedSpecies = new Set(inventory.map((plant) => plantSpecies(plant)?.id).filter(Boolean));
  return [...speciesPool].sort((left, right) => {
    const noveltyDifference = Number(ownedSpecies.has(left.id)) - Number(ownedSpecies.has(right.id));
    if (noveltyDifference) return noveltyDifference;
    if (type.id === "mystery-rescue-lot") {
      const costDifference = left.wholesaleCost - right.wholesaleCost;
      if (costDifference) return costDifference;
    }
    const leftHash = hashText(`${seedKey}|${suffix}|${left.id}`);
    const rightHash = hashText(`${seedKey}|${suffix}|${right.id}`);
    return leftHash - rightHash || left.id.localeCompare(right.id);
  });
}

function deterministicFallbackSpecies(speciesPool, quantity, allowDuplicates, seedKey, type, inventory = []) {
  if (!quantity || !speciesPool.length) return [];
  const ordered = deterministicSpeciesOrder(speciesPool, seedKey, type, "fallback", inventory);
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

  const orderedSpecies = deterministicSpeciesOrder(speciesPool, seedKey, type, "search", inventory);
  if (!orderedSpecies.length || (!allowDuplicates && quantity > orderedSpecies.length)) return null;

  // A supplier lot never needs to cover more than the day's visitor queue.
  // Represent that queue as a bit mask. Each plant can set one compatible bit,
  // so distinct plants still represent distinct sales. This replaces the old
  // combination DFS, whose work grew sharply as the species catalog expanded.
  const stateCount = 2 ** requirements.length;
  const fullMask = stateCount - 1;

  function compatibilityMask(plant) {
    const traits = plantTraits(plant);
    let mask = 0;
    requirements.forEach(({ need, budget, priceBand, healthyOnly }, requirementIndex) => {
      if (!traits.includes(need)) return;
      if (healthyOnly && !isHealthyForOrder(plant)) return;
      if (budget !== null && minimumAskingPrice(plant, priceBand) > budget) return;
      mask |= 1 << requirementIndex;
    });
    return mask;
  }

  // Keep every assignment that current inventory can make. One maximum
  // matching is not sufficient because a later supplier plant can make a
  // different inventory assignment become the useful one.
  const inventoryMasks = new Uint8Array(stateCount);
  inventoryMasks[0] = 1;
  availableInventory.forEach((plant) => {
    const compatible = compatibilityMask(plant);
    if (!compatible) return;
    for (let mask = fullMask; mask >= 0; mask -= 1) {
      if (!inventoryMasks[mask]) continue;
      let openRequirements = compatible & ~mask;
      while (openRequirements) {
        const requirementBit = openRequirements & -openRequirements;
        inventoryMasks[mask | requirementBit] = 1;
        openRequirements ^= requirementBit;
      }
    }
  });

  const compatibilityBySpecies = orderedSpecies.map((species) => compatibilityMask({
    speciesId: species.id,
    species: species.name,
    traits: species.traits,
    // Match virtualPlants(): real carton plants can roll three coins above the
    // catalog price, so every selected preview must pass that maximum price.
    price: species.price + 3,
  }));
  const paths = Array.from({ length: quantity + 1 }, () => Array(stateCount).fill(null));
  for (let mask = 0; mask < stateCount; mask += 1) {
    if (inventoryMasks[mask]) paths[0][mask] = [];
  }

  function earlierPath(candidate, current) {
    if (current === null) return true;
    const candidateVariety = new Set(candidate).size;
    const currentVariety = new Set(current).size;
    if (candidateVariety !== currentVariety) return candidateVariety > currentVariety;
    for (let index = 0; index < candidate.length; index += 1) {
      if (candidate[index] !== current[index]) return candidate[index] < current[index];
    }
    return false;
  }

  function addSpecies(speciesIndex, slot) {
    const previousStates = paths[slot - 1];
    const nextStates = paths[slot];
    const compatible = compatibilityBySpecies[speciesIndex];
    for (let mask = 0; mask < stateCount; mask += 1) {
      const previousPath = previousStates[mask];
      if (previousPath === null) continue;
      const candidatePath = [...previousPath, speciesIndex];

      // A shipment can contain useful choice stock after all requests are
      // covered. Preserve this filler transition to fill the configured tray.
      if (earlierPath(candidatePath, nextStates[mask])) nextStates[mask] = candidatePath;

      let openRequirements = compatible & ~mask;
      while (openRequirements) {
        const requirementBit = openRequirements & -openRequirements;
        const nextMask = mask | requirementBit;
        if (earlierPath(candidatePath, nextStates[nextMask])) nextStates[nextMask] = candidatePath;
        openRequirements ^= requirementBit;
      }
    }
  }

  orderedSpecies.forEach((_, speciesIndex) => {
    if (allowDuplicates) {
      // Ascending slots make the current species reusable. Species remain in
      // deterministic order, as they were in the former DFS.
      for (let slot = 1; slot <= quantity; slot += 1) addSpecies(speciesIndex, slot);
      return;
    }
    // Descending slots ensure that one species is selected at most once.
    for (let slot = quantity; slot >= 1; slot -= 1) addSpecies(speciesIndex, slot);
  });

  const selectedPath = paths[quantity][fullMask];
  return selectedPath ? selectedPath.map((speciesIndex) => orderedSpecies[speciesIndex]) : null;
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
    const fallback = deterministicFallbackSpecies(speciesPool, quantity, true, seedKey, type, inventory);
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
  const shipmentLimit = Math.min(capacity, Math.max(7, customers.length));
  if (type.id === "curated-pair") return recommended > 0 ? Math.min(shipmentLimit, Math.max(2, requiredTopUp, recommended)) : Math.max(2, requiredTopUp);
  if (type.id === "mystery-rescue-lot") return recommended > 0 ? Math.min(shipmentLimit, Math.max(requiredTopUp, recommended + 1)) : Math.max(4, requiredTopUp);
  return recommended > 0 ? Math.min(shipmentLimit, Math.max(3, requiredTopUp, recommended)) : Math.max(3, requiredTopUp);
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

function rescueStressCount(quantity) {
  if (quantity <= 0) return 0;
  if (quantity <= 2) return quantity;
  return quantity >= 6 ? 3 : 2;
}

function deliveryManifest(type, speciesList) {
  const stressedQuantity = type.id === "mystery-rescue-lot"
    ? rescueStressCount(speciesList.length)
    : 0;
  const healthyQuantity = speciesList.length - stressedQuantity;
  return {
    stressedQuantity,
    healthyQuantity,
    deliveries: speciesList.map((species, index) => ({
      speciesId: species.id,
      speciesName: species.name,
      condition: index < healthyQuantity ? "healthy" : "stressed",
    })),
  };
}

function lotDescription(type, quantity, manifest) {
  if (type.id === "curated-pair") {
    return `${quantity} previewed plants chosen to suit today's homes and improve the shop's range.`;
  }
  if (type.id === "mystery-rescue-lot") {
    const rescueCopy = `${manifest.stressedQuantity} discounted ${manifest.stressedQuantity === 1 ? "rescue plant" : "rescue plants"}`;
    const healthyCopy = manifest.healthyQuantity
      ? ` and ${manifest.healthyQuantity} healthy request-covering ${manifest.healthyQuantity === 1 ? "plant" : "plants"}`
      : "";
    return `${rescueCopy}${healthyCopy}. Rescue plants need Rehabilitation to restore their full value.`;
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

function supplierLot(type, { day, customers, inventory, coins, capacity, orderNeed }) {
  const chosen = chooseLotSpecies(type, { day, customers, inventory, capacity });
  const { speciesList } = chosen;
  const quantity = speciesList.length;
  const manifest = deliveryManifest(type, speciesList);
  const nurseryCost = calculateCost(type, speciesList);
  const hardshipCredit = type.id === "mystery-rescue-lot" && coins < nurseryCost;
  const cost = hardshipCredit ? coins : nurseryCost;
  const affordable = coins >= cost;
  const fitsCapacity = inventory.length + quantity <= capacity;
  const coversRequests = chosen.coversRequests && inventoryCoversCustomers(
    [...inventory, ...virtualPlants(speciesList, manifest.deliveries)],
    customers,
  );
  const uniqueSpeciesCount = new Set(speciesList.map((species) => species.id)).size;
  const ownedSpeciesIds = new Set(inventory.map((plant) => plantSpecies(plant)?.id).filter(Boolean));
  const newSpeciesCount = new Set(speciesList
    .filter((species) => !ownedSpeciesIds.has(species.id))
    .map((species) => species.id)).size;

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
        : lotDescription(type, quantity, manifest),
      hardshipCredit ? "The nursery has put this one on a pay-what-you-can rescue tab." : "",
      orderNeed?.count
        ? coversRequests
          ? `It also secures ${orderNeed.count} healthy ${orderNeed.trait} ${orderNeed.count === 1 ? "plant" : "plants"} for the Friday order.`
          : `It does not secure the remaining Friday order stock.`
        : "",
    ].filter(Boolean).join(" "),
    speciesNames: speciesList.map((species) => species.name),
    speciesIds: speciesList.map((species) => species.id),
    deliveries: manifest.deliveries,
    cost,
    reveal: revealMetadata(type, speciesList),
    condition: manifest.stressedQuantity && manifest.healthyQuantity
      ? "mixed"
      : manifest.stressedQuantity ? "stressed" : "healthy",
    stressedQuantity: manifest.stressedQuantity,
    healthyQuantity: manifest.healthyQuantity,
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
    uniqueSpeciesCount,
    newSpeciesCount,
    orderReady: orderNeed?.count ? coversRequests : null,
    orderNeeded: orderNeed?.count || 0,
    orderRequiredTrait: orderNeed?.trait || null,
  };
}

function rareNurseryLot({ day, customers, inventory, coins, capacity }) {
  const type = RARE_NURSERY_TYPE;
  const freeCapacity = Math.max(0, capacity - inventory.length);
  const requirements = customers.map(customerRequirement);
  const seedKey = [
    day,
    type.id,
    requirements.map(({ need }) => need || "unknown").join(","),
    requirements.map(({ budget }) => budget ?? "legacy").join(","),
    inventorySignature(inventory),
  ].join("|");
  const week = calendarForDay(day).week;
  const assignedNeeds = maximumAssignedNeeds(inventory.filter(isAvailableForCustomers), requirements);
  const configuredQuantity = Math.min(8, Math.max(3, customers.length - assignedNeeds + 1));
  const quantity = Math.min(configuredQuantity, freeCapacity);
  const rareCount = Math.min(SPECIAL_SPECIES.length, quantity > 1 ? 1 : quantity);
  const rareSpecies = deterministicFallbackSpecies(SPECIAL_SPECIES, rareCount, false, `${seedKey}|special`, type, inventory);
  const commonPool = availableSpeciesForWeek(week);
  const commonQuantity = Math.max(0, quantity - rareSpecies.length);
  const inventoryWithRare = [...inventory, ...virtualPlants(rareSpecies)];
  const commonSpecies = searchCoveringSpecies({
    type: RARE_NURSERY_FILL_TYPE,
    speciesPool: commonPool,
    quantity: commonQuantity,
    allowDuplicates: true,
    inventory: inventoryWithRare,
    customers,
    seedKey: `${seedKey}|common-fill`,
  }) || deterministicFallbackSpecies(
    commonPool,
    commonQuantity,
    true,
    `${seedKey}|common-fallback`,
    RARE_NURSERY_FILL_TYPE,
    inventoryWithRare,
  );
  const speciesList = [...rareSpecies, ...commonSpecies];
  const manifest = deliveryManifest(type, speciesList);
  const nurseryCost = calculateCost(type, speciesList);
  const affordable = coins >= nurseryCost;
  const fitsCapacity = inventory.length + speciesList.length <= capacity;
  const coversRequests = inventoryCoversCustomers(
    [...inventory, ...virtualPlants(speciesList)],
    customers,
  );
  const capacityAdjusted = speciesList.length !== configuredQuantity;
  const uniqueSpeciesCount = new Set(speciesList.map((species) => species.id)).size;
  const ownedSpeciesIds = new Set(inventory.map((plant) => plantSpecies(plant)?.id).filter(Boolean));
  const newSpeciesCount = new Set(speciesList
    .filter((species) => !ownedSpeciesIds.has(species.id))
    .map((species) => species.id)).size;

  return {
    id: `day-${String(day).padStart(3, "0")}-${type.id}`,
    kind: "supplier",
    supplierId: type.id,
    name: type.name,
    description: [
      speciesList.length === 0
        ? "No shelf space remains for a rare delivery."
        : `${speciesList.length} named plants, including one specialist specimen and the common stock needed for today.`,
      capacityAdjusted && speciesList.length > 0
        ? "The nursery reduced the collection to fit the shop."
        : "Rare stock carries a small specialist nursery fee.",
    ].join(" "),
    speciesNames: speciesList.map((species) => species.name),
    speciesIds: speciesList.map((species) => species.id),
    deliveries: manifest.deliveries,
    cost: nurseryCost,
    reveal: revealMetadata(type, speciesList),
    condition: type.selection.condition,
    stressedQuantity: 0,
    healthyQuantity: manifest.healthyQuantity,
    quantity: speciesList.length,
    affordable,
    fitsCapacity,
    capacityRemainingAfter: capacity - inventory.length - speciesList.length,
    coversRequests,
    selectable: speciesList.length > 0 && affordable && fitsCapacity && coversRequests,
    duplicatePreferenceRelaxed: false,
    capacityAdjusted,
    configuredQuantity,
    hardshipCredit: false,
    nurseryCost,
    rareCollection: true,
    rareSpeciesCount: rareSpecies.length,
    specialAccessRequired: true,
    uniqueSpeciesCount,
    newSpeciesCount,
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
    deliveries: [],
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
    stressedQuantity: 0,
    healthyQuantity: 0,
    quantity: 0,
    affordable: true,
    fitsCapacity: true,
    capacityRemainingAfter: capacity - inventory.length,
    coversRequests: true,
    selectable: true,
    duplicatePreferenceRelaxed: false,
  };
}

function activeOrderNeed(weeklyOrder, day) {
  if (!weeklyOrder || weeklyOrder.status !== "active" || Number(day) > Number(weeklyOrder.deadlineDay)) return null;
  const quantity = Math.max(0, Math.floor(Number(weeklyOrder.quantity) || 0));
  const held = Array.isArray(weeklyOrder.heldPlantIds) ? weeklyOrder.heldPlantIds.length : 0;
  const count = Math.max(0, quantity - held);
  const trait = typeof weeklyOrder.requiredTrait === "string" ? weeklyOrder.requiredTrait : null;
  return count > 0 && trait ? { count, trait } : null;
}

function orderRequirements(orderNeed) {
  if (!orderNeed) return [];
  return Array.from({ length: orderNeed.count }, (_, index) => ({
    id: `weekly-order-stock-${index}`,
    need: orderNeed.trait,
    budget: null,
    objectivePriceBand: "quick",
    healthyOnly: true,
  }));
}

/**
 * Generates three deterministic supplier cards. Rare Nursery Membership adds
 * one specialist card. When current stock can already serve the full customer
 * queue, a final no-purchase choice is appended.
 */
export function generateSupplierLots({
  day = 1,
  customers = [],
  inventory = [],
  coins = 0,
  capacity = INVENTORY_CAPACITY,
  rareNursery = false,
  weeklyOrder = null,
} = {}) {
  const safeDay = Math.max(1, Math.floor(Number(day) || 1));
  const safeCoins = Math.max(0, Math.floor(Number(coins) || 0));
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const safeCapacity = Math.max(INVENTORY_CAPACITY, Math.floor(Number(capacity) || INVENTORY_CAPACITY));
  const orderNeed = activeOrderNeed(weeklyOrder, safeDay);
  const planningCustomers = [...safeCustomers, ...orderRequirements(orderNeed)];
  const input = {
    day: safeDay,
    customers: planningCustomers,
    inventory: safeInventory,
    coins: safeCoins,
    capacity: safeCapacity,
    orderNeed,
  };
  const lots = SUPPLIER_TYPES.map((type) => supplierLot(type, input));
  if (rareNursery === true) lots.push(rareNurseryLot(input));
  const fallback = noPurchaseFallback(safeDay, safeInventory, safeCustomers, safeCapacity);
  if (fallback && orderNeed) {
    fallback.orderReady = false;
    fallback.orderNeeded = orderNeed.count;
    fallback.orderRequiredTrait = orderNeed.trait;
    fallback.description += ` This covers today's visitors, but it does not add the ${orderNeed.count} healthy ${orderNeed.trait} ${orderNeed.count === 1 ? "plant" : "plants"} still needed for Friday.`;
  }
  return fallback ? [...lots, fallback] : lots;
}
