import * as THREE from "./vendor/three.module.min.js";
import { createCharacter3D, animateCharacter3D } from "./character-models.js";
import { createDistinctPlant3D } from "./plant-models.js";
import {
  PRICE_BANDS,
  CARES,
  CUSTOMERS,
  INVENTORY_CAPACITY,
  SAVE_VERSION,
  SLOT_DATA,
  SPECIES,
} from "./game-data.js";
import { generateSupplierLots, inventoryCoversCustomers } from "./supplier-system.js";
import { closingOverstockCost, dailyTradeProfile, optionalSpendingBudget } from "./trade-system.js";
import {
  SHOP_PROJECTS,
  SHOP_PROJECT_START_WEEK,
  createDefaultProjectState,
  fundWeeklyProject,
  migrateProjectState,
  projectForWeek,
  validateProjectFunding,
} from "./shop-project-system.js";
import {
  SHOP_EXPANSIONS,
  expansionResaleValue,
  migrateExpansionState,
  purchaseExpansion,
  saleExpansionBonus,
  sellExpansion,
  validateExpansionPurchase,
} from "./shop-expansion-system.js";
import {
  BENCH_JOB_COSTS,
  BENCH_JOB_DURATIONS,
  BENCH_JOB_TYPES,
  CARE_BENCH_BASE_SLOTS,
  REHABILITATION_BASE_SLOTS,
  REHABILITATION_BLOOM_REWARD,
  REHABILITATION_UPGRADE_SLOTS,
  advanceAndApplyBenchJobs,
  createDefaultBenchState,
  isConditionProtected,
  migrateBenchState,
  reconcileBenchInventory,
  REHABILITATE_VALUE_RESTORE,
  startBenchJob,
  validateBenchJob,
} from "./care-bench-system.js";
import {
  PLANT_ISSUE_TYPES,
  advancePlantHealthInventoryMorning,
  applyPlantFertilizer,
  applyPlantTreatment,
  assignClipGrowLight as markClipGrowLightAssigned,
  hasFertilizerGrowthBoost,
  migratePlantHealth,
  migratePlantHealthInventory,
  removeClipGrowLight as markClipGrowLightRemoved,
  treatmentForIssue,
  validatePlantFertilizer,
  validatePlantTreatment,
} from "./plant-health-system.js";
import {
  SUPPLY_CATALOG,
  assignClipGrowLight as assignSupplyClipGrowLight,
  availableClipGrowLightCount,
  consumeSupply,
  createDefaultSupplyState,
  generateCustomerAddOnRequest,
  migrateSupplyState,
  purchaseSupply,
  releaseClipGrowLight as releaseSupplyClipGrowLight,
  sellCustomerAddOn,
  supplyItemForId,
  validateSupplyPurchase,
} from "./shop-supply-system.js";
import {
  askingPrice,
  calendarForDay,
  createWeeklyObjective,
  freshWeekStats,
  generateCustomerBriefs,
  progressWeeklyObjective,
  weeklyObjectiveLabel,
} from "./progression-system.js";
import {
  ORDER_STATUS,
  acceptWeeklyOrder,
  applyNeighborhoodEventToBriefs,
  applySupplierRelationshipToLots,
  completeWeeklyOrder,
  createDefaultNeighborhoodState,
  declineWeeklyOrder,
  eventSaleBonus,
  exactCustomerFollowUp,
  holdPlantForOrder,
  migrateNeighborhoodState,
  prepareNeighborhoodDay,
  recordSupplierOrder,
  releaseOrderPlant,
  supplierRelationship,
  validateOrderPlant,
} from "./neighborhood-system.js";
import {
  canBatchUnpack,
  plantSaleReadiness,
  sortKeyboardTargets,
} from "./daily-flow-system.js";

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const STORAGE_KEY = "mostly-alive-plants-save-v2";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ROOT_BOUND_AFTER_DAYS = 4;
const MAX_OUTSTANDING_COSTS = 45;

  function coinCopy(value) {
    return `${value} ${Math.abs(Number(value)) === 1 ? "coin" : "coins"}`;
  }

  function reservedCostCopy(value) {
    return `${coinCopy(value)} ${Math.abs(Number(value)) === 1 ? "is" : "are"} set aside for shop bills`;
  }

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function plantRecord(speciesName, seed = Math.random() * 99999, options = {}) {
  const species = SPECIES.find((item) => item.name === speciesName) || SPECIES[0];
  const rng = seeded(Math.floor(seed));
  const colorShift = rng() * 0.12 - 0.06;
  const needsRehabilitation = Boolean(options.needsRehabilitation);
  const rehabilitationValueLoss = needsRehabilitation ? REHABILITATE_VALUE_RESTORE : 0;
  return migratePlantHealth({
    id: `plant-${Date.now().toString(36)}-${Math.floor(rng() * 1e7).toString(36)}`,
    speciesId: species.id,
    species: species.name,
    traits: [...species.traits],
    price: Math.max(1, species.price + Math.floor(rng() * 4) - rehabilitationValueLoss),
    wholesaleCost: species.wholesaleCost,
    acquisitionCost: Number.isFinite(options.acquisitionCost) ? options.acquisitionCost : species.wholesaleCost,
    colorShift,
    care: { water: false, mist: false, prune: false },
    hydration: Number.isFinite(options.hydration)
      ? clamp(options.hydration, 8, 100)
      : Math.round(64 + rng() * 27),
    supplierLot: options.supplierLot || null,
    priceBand: "fair",
    lifeStage: "mature",
    maturityDaysRemaining: 0,
    rootComfort: "comfortable",
    rootAgeDays: 0,
    pot: "nursery-terracotta",
    soil: "standard",
    parentId: null,
    benchStatus: null,
    held: false,
    cosmeticVariation: { hueShift: colorShift },
    recoveredToday: false,
    thirstWarned: false,
    needsRehabilitation,
    rehabilitationValueLoss,
    arrivalDay: Number.isFinite(options.arrivalDay) ? Math.max(1, Math.floor(options.arrivalDay)) : 1,
    slot: null,
  });
}

function freshState() {
  const fern = plantRecord("Button Fern", 11);
  const pothos = plantRecord("Velvet Pothos", 17);
  fern.slot = 0;
  pothos.slot = 1;
  return {
    version: SAVE_VERSION,
    day: 1,
    coins: 42,
    bloom: 8,
    lifetimeBloom: 8,
    sound: true,
    inventoryCapacity: INVENTORY_CAPACITY,
    inventory: [fern, pothos],
    customers: [],
    crateQueue: [],
    crates: 0,
    phase: "supply",
    supplierOptions: [],
    selectedLotId: null,
    week: 1,
    weekdayIndex: 0,
    weeklyObjective: createWeeklyObjective(1),
    weekStats: freshWeekStats(1),
    customerMemory: {},
    customerIndex: 0,
    dailySales: 0,
    dailyRevenue: 0,
    dailyStockCost: 0,
    dailyCostOfGoods: 0,
    dailyStartingCoins: 42,
    accountingEstimate: false,
    dailyBloomStart: 8,
    dailyCare: 0,
    dailyPerfects: 0,
    dailyRecoveries: 0,
    dailySupplySales: 0,
    displayGoal: null,
    mothSeen: false,
    dailyOperatingCost: 0,
    dailyOperatingCostPaid: false,
    dailyOperatingPaidAmount: 0,
    dailyOperatingShortfall: 0,
    dailyOverstockCost: 0,
    outstandingCosts: 0,
    neighborhoodGrantUsed: false,
    projectState: createDefaultProjectState(),
    expansionState: migrateExpansionState(),
    benchState: createDefaultBenchState(),
    supplyState: createDefaultSupplyState(),
    neighborhoodState: createDefaultNeighborhoodState({ day: 1 }),
    upgrades: {
      growLamp: false,
      rainBarrel: false,
      deliveryRack: false,
      benchShelf: false,
      rehabilitationRack: false,
      shopSign: false,
    },
  };
}

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!value || !Array.isArray(value.inventory)) return freshState();
    const base = freshState();
    const oldVersion = Number(value.version) || 1;
    const migratedExpansion = migrateExpansionState(value.expansionState);
    const customers = Array.isArray(value.customers) ? value.customers.map((customer, index) => {
      const species = SPECIES.find((item) => item.name === customer.speciesHint) || SPECIES[index % SPECIES.length];
      const named = CUSTOMERS.find((item) => item.id === customer.id || item.name === customer.name) || CUSTOMERS[index % CUSTOMERS.length];
      const need = customer.need || species.traits[0];
      const budgetFloor = Math.round(species.price * PRICE_BANDS.quick.multiplier) + 3;
      const budgetRange = named.budgetRange || [budgetFloor, budgetFloor + 8];
      return {
        ...named,
        ...customer,
        id: customer.id || named.id,
        archetype: customer.archetype || named.archetype,
        budgetRange,
        budget: Number.isFinite(customer.budget)
          ? customer.budget
          : Math.max(budgetFloor, Math.round((budgetRange[0] + budgetRange[1]) / 2)),
        need,
        bonusTrait: customer.bonusTrait || species.traits.find((trait) => trait !== need) || species.traits[0],
        careWish: species.beneficialCare.includes(customer.careWish)
          ? customer.careWish
          : species.beneficialCare[index % species.beneficialCare.length],
      };
    }) : [];
    const migratedPhase = oldVersion >= 4 && ["supply", "preparation", "open", "report"].includes(value.phase)
      ? value.phase
      : Number(value.customerIndex) >= Math.max(3, value.customers?.length || 0)
        ? "report"
        : Number(value.crates) > 0
          ? "preparation"
          : "open";
    const occupiedSlots = new Set();
    const inventory = value.inventory.map((plant) => {
      const species = speciesForRecord(plant);
      const validSlot = Number.isInteger(plant.slot)
        && SLOT_DATA[plant.slot]
        && (!SLOT_DATA[plant.slot].requiresExpansion || migratedExpansion.purchased[SLOT_DATA[plant.slot].requiresExpansion])
        && !occupiedSlots.has(plant.slot);
      if (validSlot) occupiedSlots.add(plant.slot);
      const colorShift = Number.isFinite(plant.colorShift) ? plant.colorShift : 0;
      return migratePlantHealth({
        priceBand: PRICE_BANDS[plant.priceBand] ? plant.priceBand : "fair",
        lifeStage: "mature",
        maturityDaysRemaining: 0,
        rootComfort: "comfortable",
        rootAgeDays: 0,
        pot: "nursery-terracotta",
        soil: "standard",
        parentId: null,
        benchStatus: null,
        held: false,
        ...plant,
        species: species.name,
        speciesId: species.id,
        traits: Array.isArray(plant.traits) ? plant.traits : [...species.traits],
        wholesaleCost: Number.isFinite(plant.wholesaleCost) ? plant.wholesaleCost : species.wholesaleCost,
        acquisitionCost: Number.isFinite(plant.acquisitionCost) ? plant.acquisitionCost : species.wholesaleCost,
        colorShift,
        cosmeticVariation: { hueShift: colorShift, ...(plant.cosmeticVariation || {}) },
        slot: validSlot ? plant.slot : null,
        hydration: clamp(Number.isFinite(plant.hydration) ? plant.hydration : 78, 8, 100),
        maturityDaysRemaining: Math.max(0, Math.floor(Number(plant.maturityDaysRemaining) || 0)),
        rootAgeDays: Math.max(0, Math.floor(Number(plant.rootAgeDays) || 0)),
        arrivalDay: Math.max(1, Math.floor(Number(plant.arrivalDay) || Number(value.day) || 1)),
        needsRehabilitation: Boolean(plant.needsRehabilitation),
        rehabilitationValueLoss: Math.max(0, Math.floor(Number(plant.rehabilitationValueLoss) || 0)),
        recoveredToday: Boolean(plant.recoveredToday),
        thirstWarned: Boolean(plant.thirstWarned),
        care: { water: false, mist: false, prune: false, ...(plant.care || {}) },
      });
    });
    const crateQueue = Array.isArray(value.crateQueue)
      ? value.crateQueue.map((entry, index) => typeof entry === "string" ? {
        id: `legacy-day-${value.day || 1}-delivery-${index}`,
        speciesId: speciesOfName(entry).id,
        speciesName: speciesOfName(entry).name,
        seed: (value.day || 1) * 100 + index * 17,
        condition: "healthy",
        acquisitionCost: 0,
        status: "boxed",
      } : entry)
      : [];
    const legacyRevenue = Number.isFinite(value.dailyRevenue) ? value.dailyRevenue : 0;
    const hasLegacySales = oldVersion < 4 && Number(value.dailySales) > 0;
    const migratedCostOfGoods = Number.isFinite(value.dailyCostOfGoods)
      ? value.dailyCostOfGoods
      : hasLegacySales ? Math.round(legacyRevenue * 0.45) : 0;
    const migratedStartingCoins = Number.isFinite(value.dailyStartingCoins)
      ? value.dailyStartingCoins
      : oldVersion < 4 && Number.isFinite(value.coins)
        ? value.coins - legacyRevenue
        : Number.isFinite(value.coins) ? value.coins : base.coins;
    const calendar = calendarForDay(value.day);
    const weekStats = value.weekStats?.week === calendar.week
      ? { ...freshWeekStats(calendar.week), ...value.weekStats }
      : freshWeekStats(calendar.week);
    const weeklyObjective = value.weeklyObjective?.week === calendar.week
      ? { ...createWeeklyObjective(calendar.week), ...value.weeklyObjective }
      : createWeeklyObjective(calendar.week);
    const savedUpgrades = { ...base.upgrades, ...(value.upgrades || {}) };
    const fixtureCapacity = INVENTORY_CAPACITY
      + (savedUpgrades.deliveryRack ? 4 : 0)
      + (migratedExpansion.purchased["display-shelves"] ? 4 : 0);
    const upgradedCapacity = Math.max(fixtureCapacity, Math.min(20, inventory.length));
    const migratedBench = migrateBenchState(value.benchState);
    const migratedSupply = migrateSupplyState(value.supplyState);
    const reconciledBench = reconcileBenchInventory({
      benchState: {
        ...migratedBench,
        slotCount: savedUpgrades.benchShelf ? 2 : CARE_BENCH_BASE_SLOTS,
        rehabilitationSlotCount: savedUpgrades.rehabilitationRack
          ? REHABILITATION_UPGRADE_SLOTS
          : REHABILITATION_BASE_SLOTS,
      },
      inventory,
    });
    const migratedInventory = reconciledBench.inventory;
    const migratedNeighborhood = migrateNeighborhoodState(value.neighborhoodState, {
      day: calendar.day,
      inventory: migratedInventory,
    });
    const activeHeldIds = new Set(migratedNeighborhood.order?.status === ORDER_STATUS.ACTIVE
      ? migratedNeighborhood.order.heldPlantIds
      : []);
    const migratedPlantIds = new Set(migratedInventory.map((plant) => plant.id));
    migratedSupply.lightAssignments = Object.fromEntries(
      Object.entries(migratedSupply.lightAssignments).filter(([plantId]) => migratedPlantIds.has(plantId)),
    );
    const customerMemory = value.customerMemory && typeof value.customerMemory === "object"
      ? value.customerMemory
      : {};
    const visitorBonus = value.upgrades?.shopSign ? 1 : 0;
    const trade = dailyTradeProfile({
      day: calendar.day,
      inventoryCount: migratedInventory.length,
      capacity: upgradedCapacity,
      visitorBonus,
      serviceableCapacity: sellablePotential(migratedInventory, upgradedCapacity),
    });
    const refreshUnopenedBriefs = migratedPhase === "supply" && (oldVersion < SAVE_VERSION || !value.weeklyObjective);
    const generatedCustomers = refreshUnopenedBriefs
      ? applyNeighborhoodEventToBriefs({
        briefs: generateCustomerBriefs({
        day: calendar.day,
        inventory: migratedInventory,
        capacity: upgradedCapacity,
        customerMemory,
        count: trade.visitorCount,
        }),
        event: migratedNeighborhood.event,
        week: calendar.week,
        inventory: migratedInventory,
        capacity: upgradedCapacity,
      })
      : customers;
    const migratedCustomers = generatedCustomers.map((customer) => {
      const followUp = customer.isReturning ? exactCustomerFollowUp(customer, customerMemory[customer.id]) : null;
      return followUp ? { ...customer, line: followUp, exactFollowUp: true } : customer;
    });
    return {
      ...base,
      ...value,
      version: SAVE_VERSION,
      week: calendar.week,
      weekdayIndex: calendar.weekdayIndex,
      weeklyObjective,
      weekStats,
      customerMemory,
      phase: migratedPhase,
      supplierOptions: oldVersion >= SAVE_VERSION && value.weeklyObjective && Array.isArray(value.supplierOptions) ? value.supplierOptions : [],
      selectedLotId: value.selectedLotId || null,
      inventoryCapacity: upgradedCapacity,
      dailyStockCost: Number.isFinite(value.dailyStockCost) ? value.dailyStockCost : 0,
      dailyCostOfGoods: migratedCostOfGoods,
      dailyStartingCoins: migratedStartingCoins,
      accountingEstimate: Boolean(value.accountingEstimate || hasLegacySales),
      dailyBloomStart: Number.isFinite(value.dailyBloomStart) ? value.dailyBloomStart : Number.isFinite(value.bloom) ? value.bloom : base.bloom,
      lifetimeBloom: Math.max(
        Number.isFinite(value.lifetimeBloom) ? value.lifetimeBloom : 0,
        Number.isFinite(value.bloom) ? value.bloom : base.bloom,
      ),
      dailyOperatingCost: Number.isFinite(value.dailyOperatingCost)
        ? value.dailyOperatingCost
        : oldVersion < SAVE_VERSION && migratedPhase === "report" ? 0 : trade.operatingCost,
      dailyOperatingCostPaid: typeof value.dailyOperatingCostPaid === "boolean"
        ? value.dailyOperatingCostPaid
        : migratedPhase === "report",
      dailyOperatingPaidAmount: Number.isFinite(value.dailyOperatingPaidAmount) ? value.dailyOperatingPaidAmount : 0,
      dailyOperatingShortfall: Number.isFinite(value.dailyOperatingShortfall) ? value.dailyOperatingShortfall : 0,
      dailyOverstockCost: Number.isFinite(value.dailyOverstockCost) ? Math.max(0, value.dailyOverstockCost) : 0,
      dailySupplySales: Math.max(0, Math.floor(Number(value.dailySupplySales) || 0)),
      outstandingCosts: Math.min(MAX_OUTSTANDING_COSTS, Math.max(0, Math.floor(Number(value.outstandingCosts) || 0))),
      neighborhoodGrantUsed: Boolean(value.neighborhoodGrantUsed),
      projectState: migrateProjectState(value.projectState),
      expansionState: migratedExpansion,
      benchState: reconciledBench.benchState,
      supplyState: migratedSupply,
      neighborhoodState: migratedNeighborhood,
      upgrades: savedUpgrades,
      customers: migratedCustomers,
      crateQueue,
      crates: crateQueue.length,
      inventory: migratePlantHealthInventory(migratedInventory).map((plant) => ({
        ...plant,
        held: activeHeldIds.has(plant.id),
        clipGrowLightAssigned: Boolean(migratedSupply.lightAssignments[plant.id]),
      })),
    };
  } catch {
    return freshState();
  }
}

function speciesOfName(name) {
  return SPECIES.find((item) => item.name === name) || SPECIES[0];
}

function speciesForRecord(plant) {
  return SPECIES.find((item) => item.id === plant?.speciesId)
    || speciesOfName(plant?.species);
}

function deliverySpeciesName(entry) {
  if (typeof entry === "string") return entry;
  return entry?.speciesName || SPECIES.find((species) => species.id === entry?.speciesId)?.name || SPECIES[0].name;
}

function allocateLotCosts(speciesNames, totalCost) {
  if (!speciesNames.length) return [];
  const weights = speciesNames.map((name) => speciesOfName(name).wholesaleCost);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || speciesNames.length;
  const costs = weights.map((weight) => Math.floor((totalCost * weight) / totalWeight));
  let remainder = totalCost - costs.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % costs.length) {
    costs[index] += 1;
    remainder -= 1;
  }
  return costs;
}

  function sellablePotential(inventory = [], capacity = INVENTORY_CAPACITY) {
  const stock = Array.isArray(inventory) ? inventory : [];
  const freeCapacity = Math.max(0, capacity - stock.length);
  const readyStock = stock.filter((plant) => !plant.benchStatus && !plant.held && plant.lifeStage !== "juvenile").length;
  return Math.min(capacity, readyStock + freeCapacity);
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = $("game-canvas");
  if (!canvas) return;

  const ui = {
    title: $("title-screen") || document.querySelector(".title-screen"),
    start: $("start-game") || document.querySelector(".primary-button"),
    startLabel: $("start-game-label"),
    titleSaveDay: $("title-save-day"),
    resetGame: $("reset-game"),
    resetGameConfirm: $("reset-game-confirm"),
    confirmResetGame: $("confirm-reset-game"),
    cancelResetGame: $("cancel-reset-game"),
    loading: $("loading-progress") || $("status"),
    game: $("game-ui"),
    day: $("topbar-day"),
    week: $("topbar-week"),
    coins: $("topbar-coins"),
    bloom: $("topbar-bloom"),
    taskCard: document.querySelector(".task-card"),
    taskTitle: $("task-title"),
    taskCopy: $("task-copy"),
    plantReadiness: $("plant-readiness"),
    plantReadinessTitle: $("plant-readiness-title"),
    plantReadinessState: $("plant-readiness-state"),
    plantReadinessList: $("plant-readiness-list"),
    plantReadinessSummary: $("plant-readiness-summary"),
    weekObjective: $("week-objective"),
    tradeDemand: $("trade-demand"),
    tradeCost: $("trade-cost"),
    tradeStock: $("trade-stock"),
    weeklyPlanStrip: $("weekly-plan-strip"),
    weeklyEventTitle: $("weekly-event-title"),
    weeklyEventCopy: $("weekly-event-copy"),
    weeklyOrderButton: $("weekly-order-button"),
    weeklyOrderStripTitle: $("weekly-order-strip-title"),
    weeklyOrderStripProgress: $("weekly-order-strip-progress"),
    weeklyOrderStripDeadline: $("weekly-order-strip-deadline"),
    openShop: $("open-shop-button"),
    openAllCartons: $("open-all-cartons"),
    deliveryOverview: $("delivery-overview"),
    deliveryOverviewTitle: $("delivery-overview-title"),
    deliveryOverviewList: $("delivery-overview-list"),
    closeDeliveryOverview: $("close-delivery-overview"),
    action: $("action-button"),
    careTray: $("care-tray"),
    care: { water: $("care-water"), mist: $("care-mist"), prune: $("care-prune") },
    customerCard: $("customer-card"),
    customerAvatar: document.querySelector(".customer-avatar"),
    customerName: $("customer-name"),
    customerMeta: $("customer-meta"),
    customerRequest: $("customer-request"),
    customerMust: $("customer-must"),
    customerWish: $("customer-wish"),
    customerBudget: $("customer-budget"),
    customerChips: document.querySelector(".customer-chips"),
    customerAddonChip: $("customer-addon-chip"),
    customerAddon: $("customer-addon"),
    priceTray: $("price-tray"),
    priceAmount: $("price-amount"),
    priceButtons: [...document.querySelectorAll("[data-price-band]")],
    toast: $("toast"),
    report: $("day-report"),
    reportTitle: $("report-title"),
    reportCopy: $("report-copy"),
    reportProfit: $("report-profit"),
    reportLead: $("report-lead"),
    reportBloom: $("report-bloom"),
    reportStock: $("report-stock"),
    reportHighlight: $("report-highlight"),
    nextDay: $("next-day"),
    upgradeModal: $("upgrade-modal"),
    upgradeOptions: $("upgrade-options"),
    ownedImprovementOptions: $("owned-improvement-options"),
    ownedImprovementsCount: $("owned-improvements-count"),
    expansionOptions: $("expansion-options"),
    expansionProgress: $("expansion-progress"),
    projectPanel: $("project-panel"),
    projectTitle: $("project-title"),
    projectCopy: $("project-copy"),
    projectProgress: $("project-progress"),
    projectFund: $("project-fund"),
    closeUpgrades: $("close-upgrades"),
    upgradeButton: $("upgrade-button"),
    arrangeButton: $("arrange-button"),
    benchButton: $("bench-button"),
    benchOverview: $("bench-overview"),
    benchOverviewStatus: $("bench-overview-status"),
    benchModal: $("bench-modal"),
    benchSummary: $("bench-summary"),
    benchStatus: $("bench-status"),
    benchPlants: $("bench-plants"),
    benchActiveJobs: $("bench-active-jobs"),
    benchActions: $("bench-actions"),
    closeBench: $("close-bench"),
    supplyButton: $("supply-button"),
    supplyModal: $("supply-modal"),
    supplySummary: $("supply-summary"),
    supplyStatus: $("supply-status"),
    supplyCatalog: $("supply-catalog"),
    supplyPlant: $("supply-plant"),
    supplyActions: $("supply-actions"),
    closeSupply: $("close-supply"),
    supplierBoard: $("supplier-board"),
    supplierTitle: $("supplier-title"),
    supplierForecast: $("supplier-forecast"),
    supplierSummaryVisitors: $("supplier-summary-visitors"),
    supplierSummaryNeeds: $("supplier-summary-needs"),
    supplierSummaryCost: $("supplier-summary-cost"),
    supplierSummaryDebt: $("supplier-summary-debt"),
    supplierSummaryCoverage: $("supplier-summary-coverage"),
    supplierSummaryPressure: $("supplier-summary-pressure"),
    supplierStatus: $("supplier-status"),
    supplierOptions: $("supplier-options"),
    supplierRelationshipLevel: $("supplier-relationship-level"),
    supplierRelationshipName: $("supplier-relationship-name"),
    supplierRelationshipPerk: $("supplier-relationship-perk"),
    supplierRelationshipProgressCopy: $("supplier-relationship-progress-copy"),
    supplierRelationshipProgress: $("supplier-relationship-progress"),
    weeklyOrderModal: $("weekly-order-modal"),
    closeWeeklyOrder: $("close-weekly-order"),
    weeklyOrderStatus: $("weekly-order-status"),
    weeklyOrderOfferState: $("weekly-order-offer-state"),
    weeklyOrderCustomer: $("weekly-order-customer"),
    weeklyOrderOfferName: $("weekly-order-offer-name"),
    weeklyOrderRequest: $("weekly-order-request"),
    weeklyOrderDeadline: $("weekly-order-deadline"),
    weeklyOrderDeposit: $("weekly-order-deposit"),
    weeklyOrderReward: $("weekly-order-reward"),
    acceptWeeklyOrder: $("accept-weekly-order"),
    declineWeeklyOrder: $("decline-weekly-order"),
    weeklyOrderProgressCopy: $("weekly-order-progress-copy"),
    weeklyOrderDeadlineChip: $("weekly-order-deadline-chip"),
    weeklyOrderProgress: $("weekly-order-progress"),
    weeklyOrderAvailableList: $("weekly-order-available-list"),
    weeklyOrderHeldList: $("weekly-order-held-list"),
    completeWeeklyOrder: $("complete-weekly-order"),
    rehabilitationStationLabel: $("rehabilitation-station-label"),
    rehabilitationStationStatus: $("rehabilitation-station-status"),
    soundButton: $("sound-button"),
    helpButton: $("help-button"),
    helpModal: $("help-modal"),
    closeHelp: $("close-help"),
    rotateLeft: $("rotate-left"),
    rotateRight: $("rotate-right"),
    orientation: $("orientation-hint"),
  };

  let hasStoredSave = false;
  try {
    const storedSave = JSON.parse(localStorage.getItem(STORAGE_KEY));
    hasStoredSave = Boolean(storedSave && Array.isArray(storedSave.inventory));
  } catch { /* invalid saves already fall back to a fresh shop */ }
  const state = loadState();
  let discardSave = false;

  function hasExpansion(id) {
    return Boolean(state.expansionState?.purchased?.[id]);
  }

  function slotIsActive(slot) {
    return Boolean(slot && (!slot.requiresExpansion || hasExpansion(slot.requiresExpansion)));
  }

  function reservedShopCoins() {
    return optionalSpendingBudget(state).reserved;
  }

  function discretionaryCoins() {
    return optionalSpendingBudget(state).coins;
  }

  function dailySupplierLots() {
    return applySupplierRelationshipToLots(generateSupplierLots({
      day: state.day,
      customers: state.customers,
      inventory: state.inventory,
      coins: state.coins,
      capacity: state.inventoryCapacity,
      rareNursery: hasExpansion("rare-nursery"),
    }), state.neighborhoodState, state.coins);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8, 8, 7, -7, 0.1, 80);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  const world = new THREE.Group();
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const cameraTarget = new THREE.Vector3(0, 1.7, -0.3);
  const interactive = [];
  const plantObjects = new Map();
  const slotObjects = new Map();
  const effects = [];
  const movers = [];
  const exteriorAmbient = [];
  let exteriorDioramaRoot = null;
  const pointers = new Map();
  const staging = [
    new THREE.Vector3(3.15, 1.12, -2.45),
    new THREE.Vector3(3.95, 1.12, -2.45),
    new THREE.Vector3(4.75, 1.12, -2.45),
  ];
  const benchJobStaging = [
    new THREE.Vector3(3.95, 1.12, -3.35),
    new THREE.Vector3(3.95, 2.5, -3.86),
  ];
  const rehabilitationJobStaging = [
    new THREE.Vector3(-5.15, 1.17, 3.62),
    new THREE.Vector3(-4.05, 1.17, 3.75),
    new THREE.Vector3(-5.1, 0.94, 2.18),
  ];
  const propagationJobStaging = [
    new THREE.Vector3(-3.25, 0.92, 3.62),
    new THREE.Vector3(-2.05, 0.92, 3.62),
  ];
  const rackStaging = [
    new THREE.Vector3(4.55, 0.17, -0.66),
    new THREE.Vector3(5.35, 0.17, -0.66),
    new THREE.Vector3(4.55, 0.17, 0.04),
    new THREE.Vector3(5.35, 0.17, 0.04),
  ];
  const floorStaging = [
    new THREE.Vector3(1.85, 0.03, -1.35),
    new THREE.Vector3(0.75, 0.03, -1.25),
    new THREE.Vector3(1.2, 0.03, 1.45),
    new THREE.Vector3(-3.65, 0.03, 1.25),
    new THREE.Vector3(3.42, 0.03, -0.55),
    new THREE.Vector3(2.6, 0.03, -0.1),
    new THREE.Vector3(-1.1, 0.03, -0.35),
    new THREE.Vector3(-2.65, 0.03, -1.65),
    new THREE.Vector3(-0.25, 0.03, -1.7),
    new THREE.Vector3(-1.25, 0.03, 2.15),
    new THREE.Vector3(-2.4, 0.03, 0.25),
    new THREE.Vector3(-0.8, 0.03, 1.25),
  ];

  const run = {
    ready: false,
    started: false,
    busy: false,
    selected: null,
    carried: null,
    arranging: false,
    moveOrigin: null,
    crate: null,
    crateAnimation: null,
    batchUnpackActive: false,
    batchUnpackSpecies: [],
    batchUnpackPlantIds: [],
    deliveryOverviewPlantIds: [],
    customer: null,
    customerTween: null,
    moth: null,
    selectionRing: null,
    orientationDismissed: false,
    orientationTimer: 0,
    modalReturnFocus: null,
    keyboardIndex: -1,
    viewAngle: 0.67,
    zoom: 1,
    toastTimer: 0,
    lastPointer: null,
    pinchDistance: 0,
    audio: null,
    master: null,
    textures: {},
    conditionUiTimer: 0,
    conditionSaveTimer: 0,
    conditionDirty: false,
    lastSaleGrade: "good",
    lastPlantId: null,
    benchPlantId: null,
    benchMessage: "Choose a plant, then choose one available job.",
    supplyMessage: "Buy stock for plant care and optional customer add-ons.",
    wateringCan: null,
    canAnimation: null,
  };

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = new THREE.Color(0xcdd8bd);
  scene.fog = new THREE.Fog(0xcdd8bd, 22, 42);
  scene.add(world);
  canvas.style.touchAction = "none";

  setupDay();
  const titleCalendar = calendarForDay(state.day);
  if (ui.titleSaveDay) ui.titleSaveDay.textContent = `${titleCalendar.weekday} · Day ${String(state.day).padStart(2, "0")}`;
  if (ui.startLabel) ui.startLabel.textContent = hasStoredSave ? `Continue Day ${state.day}` : "Start the day";
  if (ui.resetGame) ui.resetGame.hidden = !hasStoredSave;
  bindUi();
  resize();
  loadShop();

  function save() {
    if (discardSave) return;
    state.version = SAVE_VERSION;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }

  function makeDisplayGoal(rng) {
    const deliveries = state.crateQueue.map((entry) => speciesOfName(deliverySpeciesName(entry))).filter(Boolean);
    const availableStock = state.inventory.filter((plant) => !plant.benchStatus);
    const stock = availableStock.map(speciesOf);
    const availableSpecies = [...stock, ...deliveries];
    const moments = [
      { trait: "trailing", zone: "upperShelf", copy: "Let something trailing cascade from the upper shelf." },
      { trait: "sunny", zone: "window", copy: "Make a sunny-window moment." },
      { trait: "upright", zone: "floor", copy: "Give an upright plant room on the floor." },
      { trait: "lush", zone: "lowerShelf", copy: "Build a lush little shelf vignette." },
      { trait: "strange", zone: "counter", copy: "Feature something strange at the front counter." },
    ];
    const possible = moments.filter((moment) => {
      if (!availableSpecies.some((species) => species.traits.includes(moment.trait))) return false;
      if (deliveries.some((species) => species.traits.includes(moment.trait))) return true;
      return availableStock.some((plant) => plant.traits.includes(moment.trait)
        && SLOT_DATA[plant.slot]?.zone !== moment.zone);
    });
    let choice = possible[Math.floor(rng() * possible.length)];
    if (!choice) {
      const fallback = [];
      availableStock.forEach((plant) => SLOT_DATA.filter(slotIsActive).forEach((slot) => {
        if (SLOT_DATA[plant.slot]?.zone === slot.zone) return;
        const trait = plant.traits[Math.floor(rng() * plant.traits.length)];
        fallback.push({ trait, zone: slot.zone, copy: `Feature something ${trait} on the ${slot.zoneLabel}.` });
      }));
      deliveries.forEach((species) => SLOT_DATA.filter(slotIsActive).forEach((slot) => {
        const trait = species.traits[Math.floor(rng() * species.traits.length)];
        fallback.push({ trait, zone: slot.zone, copy: `Feature something ${trait} on the ${slot.zoneLabel}.` });
      }));
      choice = fallback[Math.floor(rng() * fallback.length)];
      if (!choice) return null;
    }
    return {
      id: `day-${state.day}-${choice.zone}-${choice.trait}`,
      ...choice,
      rewardCoins: 6,
      rewardBloom: 3,
      claimed: false,
    };
  }

  function setupDay(force = false) {
    const calendar = calendarForDay(state.day);
    state.week = calendar.week;
    state.weekdayIndex = calendar.weekdayIndex;
    if (!state.weeklyObjective || state.weeklyObjective.week !== calendar.week) {
      state.weeklyObjective = createWeeklyObjective(calendar.week);
    }
    if (!state.weekStats || state.weekStats.week !== calendar.week) {
      state.weekStats = freshWeekStats(calendar.week);
    }
    state.neighborhoodState = migrateNeighborhoodState(state.neighborhoodState, { day: state.day, inventory: state.inventory });
    const trade = dailyTradeProfile({
      day: state.day,
      inventoryCount: state.inventory.length,
      capacity: state.inventoryCapacity,
      visitorBonus: state.upgrades.shopSign ? 1 : 0,
      serviceableCapacity: sellablePotential(state.inventory, state.inventoryCapacity),
    });
    if (!force && state.customers?.length > 0 && Array.isArray(state.crateQueue)
      && (state.phase !== "supply" || state.customers.length === trade.visitorCount)) {
      if (state.phase === "supply" && !state.supplierOptions?.length) {
        state.supplierOptions = dailySupplierLots();
      }
      if (!state.displayGoal && state.crateQueue.length) state.displayGoal = makeDisplayGoal(seeded(state.day * 1999 + 73));
      if (state.phase === "preparation" && state.crates === 0 && !state.displayGoal) {
        state.displayGoal = makeDisplayGoal(seeded(state.day * 1999 + 73));
      }
      save();
      return;
    }
    state.customers = applyNeighborhoodEventToBriefs({
      briefs: generateCustomerBriefs({
        day: state.day,
        inventory: state.inventory,
        capacity: state.inventoryCapacity,
        customerMemory: state.customerMemory,
        count: trade.visitorCount,
      }),
      event: state.neighborhoodState?.event,
      week: calendar.week,
      inventory: state.inventory,
      capacity: state.inventoryCapacity,
    }).map((customer) => {
      const followUp = customer.isReturning ? exactCustomerFollowUp(customer, state.customerMemory[customer.id]) : null;
      return followUp ? { ...customer, line: followUp, exactFollowUp: true } : customer;
    });
    state.crateQueue = [];
    state.phase = "supply";
    state.crates = 0;
    state.selectedLotId = null;
    state.dailyStockCost = 0;
    state.dailyOperatingCost = trade.operatingCost;
    state.dailyOperatingCostPaid = false;
    state.dailyOperatingPaidAmount = 0;
    state.dailyOperatingShortfall = 0;
    state.dailyOverstockCost = 0;
    state.dailyStartingCoins = state.coins;
    state.dailyBloomStart = state.bloom;
    state.displayGoal = null;
    state.supplierOptions = dailySupplierLots();
    save();
  }

  async function loadShop() {
    const files = {
      floor: "assets/textures/terracotta-floor.png",
      wood: "assets/textures/painted-oak.png",
      wall: "assets/textures/botanical-plaster.png",
      leafFern: "assets/textures/leaf-fern.png",
      leafVelvet: "assets/textures/leaf-velvet.png",
      leafPinstripe: "assets/textures/leaf-pinstripe.png",
      leafWaxy: "assets/textures/leaf-waxy.png",
    };
    const loader = new THREE.TextureLoader();
    const textures = {};
    const total = Object.keys(files).length;
    let done = 0;
    updateLoading(0, total);
    await Promise.all(Object.entries(files).map(async ([key, url]) => {
      try {
        textures[key] = await loader.loadAsync(url);
        textures[key].colorSpace = THREE.SRGBColorSpace;
        const repeats = key === "floor" || key === "wood" || key === "wall";
        textures[key].wrapS = textures[key].wrapT = repeats ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      } catch {
        textures[key] = null;
      }
      done += 1;
      updateLoading(done, total);
    }));
    if (textures.floor) textures.floor.repeat.set(3, 3);
    if (textures.wood) textures.wood.repeat.set(2, 2);
    if (textures.wall) textures.wall.repeat.set(2, 1);
    run.textures = textures;
    buildShop(textures);
    run.ready = true;
    if (ui.start) ui.start.disabled = false;
    if (ui.loading) {
      ui.loading.dataset.ready = "true";
      if (ui.loading.closest(".loading-line")) {
        ui.loading.style.width = "100%";
        const copy = ui.loading.closest(".title-card")?.querySelector(".loading-copy");
        if (copy) copy.textContent = "The shop is ready.";
      } else {
        ui.loading.textContent = "The shop is ready.";
      }
    }
    updateUi();
    animate();
  }

  function updateLoading(value, total) {
    if (!ui.loading) return;
    const percentage = (value / total) * 100;
    if (ui.loading instanceof HTMLProgressElement) {
      ui.loading.max = total;
      ui.loading.value = value;
    } else if (ui.loading.closest(".loading-line")) {
      ui.loading.style.width = `${percentage}%`;
    } else {
      ui.loading.textContent = `Growing the shop… ${Math.round(percentage)}%`;
    }
    ui.loading.style.setProperty("--progress", `${percentage}%`);
  }

  function material(color, extras = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...extras });
  }

  function box(parent, size, position, mat, rotation = null) {
    const object = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    object.position.set(...position);
    if (rotation) object.rotation.set(...rotation);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function cylinder(parent, radiusTop, radiusBottom, height, position, mat, sides = 8) {
    const object = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), mat);
    object.position.set(...position);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function registerStation(root, {
    id,
    label,
    ringScale = 1,
    selectionAnchor = new THREE.Vector3(),
  }) {
    root.userData.entity = { kind: "station", id };
    root.userData.stationLabel = label;
    root.userData.ringScale = ringScale;
    root.userData.selectionAnchor = selectionAnchor;
    if (!interactive.includes(root)) interactive.push(root);
    return root;
  }

  function makeExteriorStreet() {
    const grassMat = material(0xaebf98, { roughness: 1 });
    const roadMat = material(0x6f7771, { roughness: 0.96 });
    const sidewalkMat = material(0xd8cfb4, { roughness: 0.9 });
    const curbMat = material(0xeee4c9, { roughness: 0.88 });
    const lineMat = material(0xe6c86e, { roughness: 0.9 });
    const planterMat = material(0xae6e52, { roughness: 0.92 });
    const trunkMat = material(0x7f6548, { roughness: 1 });
    const leafMat = material(0x66825e, { roughness: 0.96 });
    const flowerMats = [material(0xd99276), material(0xe5c96f), material(0xa88db2)];

    const exterior = new THREE.Group();
    exterior.name = "neighborhood-exterior";

    const ground = box(exterior, [24, 0.06, 24], [0, -0.13, 2.8], grassMat);
    ground.castShadow = false;

    const road = box(exterior, [24, 0.08, 4.7], [1, -0.12, 9.85], roadMat);
    const sidewalk = box(exterior, [18, 0.09, 2.35], [0, -0.015, 6.15], sidewalkMat);
    const curb = box(exterior, [18, 0.16, 0.18], [0, 0.04, 7.38], curbMat);
    const sideRoad = box(exterior, [5, 0.08, 12.5], [11.1, -0.12, 1.15], roadMat);
    const sideWalk = box(exterior, [2.5, 0.09, 8.4], [7.25, -0.015, -0.82], sidewalkMat);
    const entryPaving = box(exterior, [2.5, 0.09, 1.7], [7.25, -0.015, 4.2], sidewalkMat);
    const sideCurb = box(exterior, [0.18, 0.16, 8.4], [8.56, 0.04, -0.82], curbMat);
    [road, sidewalk, curb, sideRoad, sideWalk, entryPaving, sideCurb].forEach((object) => { object.castShadow = false; });
    [-7, -3.5, 0, 3.5, 7].forEach((x) => {
      const mark = box(exterior, [1.6, 0.018, 0.12], [x, -0.07, 9.85], lineMat);
      mark.castShadow = false;
    });

    const crosswalkX = 5.6;
    for (let stripe = 0; stripe < 5; stripe += 1) {
      const mark = box(exterior, [0.2, 0.02, 1.15], [crosswalkX - 0.62 + stripe * 0.31, -0.065, 8.25], curbMat);
      mark.castShadow = false;
    }
    [-3, 0.5, 4].forEach((z) => {
      const mark = box(exterior, [0.12, 0.018, 1.5], [11.05, -0.07, z], lineMat);
      mark.castShadow = false;
    });

    const makePlanter = (x, z, phase, scale = 1) => {
      const root = new THREE.Group();
      root.position.set(x, 0.08, z);
      cylinder(root, 0.48 * scale, 0.4 * scale, 0.42 * scale, [0, 0.22 * scale, 0], planterMat, 10).castShadow = false;
      const stems = new THREE.Group();
      for (let index = 0; index < 5; index += 1) {
        const angle = (index / 5) * Math.PI * 2;
        const stem = cylinder(stems, 0.025, 0.035, 0.75 * scale, [Math.cos(angle) * 0.18 * scale, 0.7 * scale, Math.sin(angle) * 0.18 * scale], trunkMat, 5);
        stem.rotation.z = (index - 2) * 0.08;
        stem.castShadow = false;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.29 * scale, 7, 5), leafMat);
        crown.position.set(Math.cos(angle) * 0.28 * scale, (1.08 + (index % 2) * 0.13) * scale, Math.sin(angle) * 0.28 * scale);
        crown.scale.set(1.15, 0.74, 0.86);
        stems.add(crown);
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.08 * scale, 6, 4), flowerMats[index % flowerMats.length]);
        flower.position.copy(crown.position).add(new THREE.Vector3(0, 0.18 * scale, -0.02));
        stems.add(flower);
      }
      root.add(stems);
      exterior.add(root);
      exteriorAmbient.push({ root: stems, baseZ: stems.rotation.z, phase, speed: 0.62 + phase * 0.03, amplitude: 0.022 });
    };

    const makeTree = (x, z, phase) => {
      const root = new THREE.Group();
      root.position.set(x, 0.05, z);
      cylinder(root, 0.13, 0.2, 2.55, [0, 1.28, 0], trunkMat, 8).castShadow = false;
      const crown = new THREE.Group();
      crown.position.y = 2.45;
      [[0, 0.55, 0, 0.82], [-0.5, 0.12, 0.05, 0.65], [0.5, 0.16, -0.08, 0.68], [0, 0, 0.42, 0.58]].forEach(([cx, cy, cz, radius], index) => {
        const foliage = new THREE.Mesh(new THREE.SphereGeometry(radius, 7, 5), index % 2 ? leafMat : material(0x78966d, { roughness: 0.96 }));
        foliage.position.set(cx, cy, cz);
        foliage.scale.set(1.05, 0.9, 0.95);
        foliage.castShadow = false;
        crown.add(foliage);
      });
      root.add(crown);
      exterior.add(root);
      exteriorAmbient.push({ root: crown, baseZ: crown.rotation.z, phase, speed: 0.48, amplitude: 0.017 });
    };

    makePlanter(-4.5, 7.05, 0.7, 0.92);
    makePlanter(2.8, 7.08, 2.4, 0.86);
    makeTree(8.2, -4.6, 1.6);

    exteriorDioramaRoot = exterior;
    world.add(exterior);
  }

  function buildShop(textures) {
    const floorMat = material(0xb97758, { map: textures.floor });
    const wallMat = material(0xe7dfc5, { map: textures.wall });
    const woodMat = material(0x77906c, { map: textures.wood });
    const darkWood = material(0x46644f);
    const cream = material(0xece3c9);
    const peach = material(0xd98f6d);
    const brass = material(0xc7a553, { metalness: 0.35, roughness: 0.4 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -0.1;
    floor.receiveShadow = true;
    world.add(floor);
    box(world, [12, 5.8, 0.18], [0, 2.9, -5.05], wallMat);
    box(world, [0.18, 5.8, 10], [-6.02, 2.9, -0.05], wallMat);
    box(world, [12.25, 0.22, 0.35], [0, 0.08, -5.02], darkWood);
    box(world, [0.35, 0.22, 10], [-5.98, 0.08, -0.05], darkWood);
    makeExteriorStreet();

    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.1), material(0xc67d68));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-0.8, 0.012, 1.05);
    rug.receiveShadow = true;
    world.add(rug);
    for (let i = -4; i <= 4; i += 1) box(world, [0.08, 0.025, 2.8], [-0.8 + i * 0.45, 0.03, 1.05], cream);

    // Window and late-afternoon glow.
    box(world, [3.25, 2.55, 0.16], [2.5, 3.7, -4.92], darkWood);
    box(world, [2.86, 2.17, 0.18], [2.5, 3.7, -4.81], material(0xb9d8cf, { emissive: 0x5f6951, emissiveIntensity: 0.22 }));
    box(world, [0.09, 2.25, 0.22], [2.5, 3.7, -4.66], cream);
    box(world, [2.92, 0.09, 0.22], [2.5, 3.7, -4.66], cream);
    const sun = new THREE.DirectionalLight(0xffe6b0, 3.1);
    sun.position.set(5, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 30 });
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xf6edce, 0x6e8068, 2.15));

    // Display shelves.
    box(world, [4.2, 0.18, 0.85], [-3.75, 1.03, -4.32], woodMat);
    box(world, [4.2, 0.18, 0.85], [-3.75, 2.46, -4.32], woodMat);
    [-5.55, -1.95].forEach((x) => box(world, [0.18, 3.3, 0.72], [x, 1.65, -4.38], darkWood));
    box(world, [0.15, 3.3, 0.72], [-3.75, 1.65, -4.38], darkWood);

    // Potting bench and counter.
    const careBench = new THREE.Group();
    box(careBench, [2.4, 0.18, 2.1], [0, 1.02, 0], woodMat);
    [[-0.9, -0.8], [0.9, -0.8], [-0.9, 0.8], [0.9, 0.8]].forEach(([x, z]) => {
      box(careBench, [0.16, 1.05, 0.16], [x, 0.52, z], darkWood);
    });
    box(careBench, [2.05, 0.48, 0.12], [0, 0.72, 0.98], darkWood);
    careBench.position.set(3.9, 0, -3.05);
    careBench.name = "care-bench-station";
    registerStation(careBench, {
      id: "care-bench",
      label: "Care Bench",
      ringScale: 1.55,
      selectionAnchor: new THREE.Vector3(0, 1.04, 0),
    });
    world.add(careBench);
    makeRehabilitationStation(woodMat, darkWood, brass, cream);
    box(world, [2.7, 1.25, 1.0], [2.35, 0.64, 1.25], woodMat);
    box(world, [2.9, 0.16, 1.18], [2.35, 1.3, 1.25], cream);
    box(world, [0.75, 0.55, 0.08], [2.35, 0.75, 1.77], peach);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.35), material(0xf0e6cc, { map: textTexture("MOSTLY ALIVE", "PLANTS · CUTTINGS · HOPE") }));
    sign.position.set(-1.2, 4.25, -4.89);
    world.add(sign);
    box(world, [4.05, 1.58, 0.1], [-1.2, 4.25, -4.98], darkWood);
    sign.position.z = -4.9;

    // Tiny shop details.
    cylinder(world, 0.33, 0.29, 0.5, [4.75, 1.32, -3.45], material(0xbf765a));
    cylinder(world, 0.27, 0.22, 0.42, [4.75, 1.74, -3.45], material(0xd58f6b));
    cylinder(world, 0.22, 0.18, 0.34, [4.75, 2.08, -3.45], material(0xe0a382));
    const wateringCan = new THREE.Group();
    cylinder(wateringCan, 0.25, 0.25, 0.45, [0, 0.24, 0], material(0x8ba5a3), 10);
    const spout = cylinder(wateringCan, 0.07, 0.12, 0.75, [0.43, 0.34, 0], material(0x8ba5a3), 8);
    spout.rotation.z = -Math.PI / 2.8;
    wateringCan.position.set(3.15, 1.13, -3.45);
    wateringCan.scale.setScalar(0.8);
    wateringCan.name = "watering-can-station";
    wateringCan.userData.homePosition = wateringCan.position.clone();
    wateringCan.userData.homeQuaternion = wateringCan.quaternion.clone();
    registerStation(wateringCan, {
      id: "watering-can",
      label: "Watering Can",
      ringScale: 0.72,
      selectionAnchor: new THREE.Vector3(0, 0, 0),
    });
    world.add(wateringCan);
    run.wateringCan = wateringCan;

    makeSlots();
    makeCrates();
    makeGrowLamp(brass);
    makeRainBarrel(woodMat, brass);
    makeDeliveryRack(woodMat, darkWood);
    makeBenchShelf(woodMat, brass);
    makeShopSignUpgrade(darkWood);
    makeShopExpansions(woodMat, darkWood, brass, cream, peach);
    makeRetailSupplyShelf(woodMat, darkWood, brass, cream);
    makeShopProjects(woodMat, darkWood, brass);
    makeSelectionRing();
    rebuildPlants();
    updateCrates();
    updateCamera();
  }

  function textTexture(title, subtitle) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 270;
    const context = c.getContext("2d");
    context.fillStyle = "#eee5ce";
    context.fillRect(0, 0, c.width, c.height);
    context.fillStyle = "#294936";
    context.textAlign = "center";
    context.font = "700 78px Georgia";
    context.fillText(title, c.width / 2, 125);
    context.font = "500 27px monospace";
    context.fillText(subtitle, c.width / 2, 190);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeSlots() {
    const geometry = new THREE.RingGeometry(0.32, 0.45, 24);
    SLOT_DATA.forEach((slot, index) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xe8c66b, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
      const object = new THREE.Mesh(geometry, mat);
      object.rotation.x = -Math.PI / 2;
      object.position.set(slot.x, slot.y + 0.015, slot.z);
      object.userData.entity = { kind: "slot", id: index };
      const hitTarget = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 24),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide }),
      );
      hitTarget.position.z = 0.002;
      object.add(hitTarget);
      object.visible = slotIsActive(slot);
      world.add(object);
      if (slotIsActive(slot)) interactive.push(object);
      slotObjects.set(index, object);
    });
  }

  function makeCrates() {
    const root = new THREE.Group();
    root.position.set(3.9, 0.03, 3.15);
    const cardboard = material(0xc99863);
    const cardboardEdge = material(0x8c5f3c);
    const packingPaper = material(0xe7c985);

    for (let layer = 0; layer < 8; layer += 1) {
      const carton = new THREE.Group();
      carton.name = `carton-${layer}`;
      carton.position.set((layer % 2) * 1.18, Math.floor(layer / 2) * 0.65, -Math.floor(layer / 2) * 0.08);

      const body = new THREE.Group();
      box(body, [1.12, 0.08, 0.88], [0, 0.04, 0], cardboardEdge);
      box(body, [1.12, 0.54, 0.08], [0, 0.31, 0.4], cardboard);
      box(body, [1.12, 0.54, 0.08], [0, 0.31, -0.4], cardboard);
      box(body, [0.08, 0.54, 0.72], [-0.52, 0.31, 0], cardboard);
      box(body, [0.08, 0.54, 0.72], [0.52, 0.31, 0], cardboard);
      box(body, [0.16, 0.56, 0.09], [0, 0.3, 0.405], cardboardEdge);
      carton.add(body);

      const packing = new THREE.Group();
      for (let scrap = 0; scrap < 7; scrap += 1) {
        const angle = (scrap / 7) * Math.PI * 2;
        box(
          packing,
          [0.26 + (scrap % 2) * 0.08, 0.035, 0.07],
          [Math.cos(angle) * 0.29, 0.54 + (scrap % 3) * 0.018, Math.sin(angle) * 0.22],
          packingPaper,
          [0, angle + scrap * 0.22, (scrap % 2 ? -1 : 1) * 0.16],
        );
      }
      packing.visible = false;
      carton.add(packing);

      const flaps = [];
      const addFlap = (position, size, leafPosition, axis, openRotation) => {
        const pivot = new THREE.Group();
        pivot.position.set(...position);
        box(pivot, size, leafPosition, cardboard);
        pivot.userData.axis = axis;
        pivot.userData.openRotation = openRotation;
        carton.add(pivot);
        flaps.push(pivot);
      };
      addFlap([0, 0.58, 0.44], [1.1, 0.045, 0.43], [0, 0, -0.215], "x", 1.34);
      addFlap([0, 0.58, -0.44], [1.1, 0.045, 0.43], [0, 0, 0.215], "x", -1.34);
      addFlap([-0.56, 0.58, 0], [0.56, 0.05, 0.82], [0.28, 0, 0], "z", 1.24);
      addFlap([0.56, 0.58, 0], [0.56, 0.05, 0.82], [-0.28, 0, 0], "z", -1.24);

      carton.userData.restPosition = carton.position.clone();
      carton.userData.flaps = flaps;
      carton.userData.packing = packing;
      carton.userData.opened = false;
      root.add(carton);
    }
    root.userData.entity = { kind: "crate", id: "deliveries" };
    root.userData.ringY = 0;
    world.add(root);
    interactive.push(root);
    run.crate = root;
  }

  function resetCarton(carton) {
    carton.position.copy(carton.userData.restPosition);
    carton.rotation.set(0, 0, 0);
    carton.scale.set(1, 1, 1);
    carton.userData.flaps?.forEach((flap) => {
      flap.rotation[flap.userData.axis] = 0;
    });
    if (carton.userData.packing) carton.userData.packing.visible = false;
    carton.userData.opened = false;
  }

  function makeGrowLamp(brass) {
    const root = new THREE.Group();
    box(root, [0.18, 3.4, 0.18], [0, 1.7, 0], brass);
    box(root, [2.8, 0.15, 0.18], [-1.3, 3.35, 0], brass);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.32, 16, 1, true), material(0x556b55, { side: THREE.DoubleSide }));
    shade.position.set(-2.45, 3.08, 0);
    root.add(shade);
    const bulb = new THREE.PointLight(0xffd98a, 4.5, 7, 2);
    bulb.position.set(-2.45, 2.92, 0);
    root.add(bulb);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 8),
      material(0xffd98a, { emissive: 0xffc75f, emissiveIntensity: 1.8, roughness: 0.25 }),
    );
    glow.position.copy(bulb.position);
    root.add(glow);
    root.position.set(5.55, 0, -3.2);
    root.visible = Boolean(state.upgrades.growLamp);
    root.name = "grow-lamp";
    root.userData.bulb = bulb;
    root.userData.glow = glow;
    registerStation(root, {
      id: "grow-lamp",
      label: "Grow Lamp",
      ringScale: 1.05,
      selectionAnchor: new THREE.Vector3(-2.45, 0, 0),
    });
    world.add(root);
  }

  function makeRainBarrel(woodMat, brass) {
    const root = new THREE.Group();
    cylinder(root, 0.48, 0.43, 1.08, [0, 0.56, 0], woodMat, 14);
    cylinder(root, 0.51, 0.51, 0.07, [0, 0.18, 0], brass, 14);
    cylinder(root, 0.51, 0.51, 0.07, [0, 0.91, 0], brass, 14);
    const lid = cylinder(root, 0.5, 0.48, 0.1, [0, 1.13, 0], material(0x526b57), 14);
    lid.castShadow = true;
    const tap = cylinder(root, 0.07, 0.09, 0.38, [0.36, 0.38, 0], brass, 8);
    tap.rotation.z = -Math.PI / 2;
    root.position.set(5.45, 0.03, -1.95);
    root.visible = Boolean(state.upgrades.rainBarrel);
    root.name = "rain-barrel";
    world.add(root);
  }

  function makeDeliveryRack(woodMat, darkWood) {
    const root = new THREE.Group();
    box(root, [1.95, 0.12, 1.45], [4.95, 0.1, -0.3], woodMat);
    [[4.1, -0.88], [5.8, -0.88], [4.1, 0.28], [5.8, 0.28]].forEach(([x, z]) => {
      box(root, [0.11, 0.18, 0.11], [x, 0.07, z], darkWood);
    });
    root.visible = Boolean(state.upgrades.deliveryRack);
    root.name = "delivery-rack";
    world.add(root);
  }

  function makeBenchShelf(woodMat, brass) {
    const root = new THREE.Group();
    box(root, [2.1, 0.12, 0.52], [3.9, 2.4, -3.86], woodMat);
    [3.05, 4.75].forEach((x) => box(root, [0.09, 1.3, 0.12], [x, 1.78, -4.05], brass));
    root.visible = Boolean(state.upgrades.benchShelf);
    root.name = "bench-shelf";
    world.add(root);
  }

  function makeRehabilitationStation(woodMat, darkWood, brass, cream) {
    const root = new THREE.Group();
    const clinic = material(0x8eaea0, { roughness: 0.72 });
    const glass = material(0xc8ded2, { roughness: 0.3, metalness: 0.08 });
    const recoveryLabel = material(0xf0e6cc, { map: textTexture("PLANT RECOVERY", "2 CARE PLACES") });
    const propagationLabel = material(0xf0e6cc, { map: textTexture("PROPAGATION", "CUTTINGS") });
    box(root, [2.05, 0.16, 1.18], [0, 1.05, 0], clinic);
    box(root, [1.78, 0.08, 0.92], [0, 0.54, 0], cream);
    [[-0.86, -0.44], [0.86, -0.44], [-0.86, 0.44], [0.86, 0.44]].forEach(([x, z]) => {
      box(root, [0.11, 1.05, 0.11], [x, 0.52, z], darkWood);
    });
    box(root, [2.02, 0.56, 0.1], [0, 2.12, -0.64], glass);
    box(root, [2.12, 0.12, 0.18], [0, 2.43, -0.62], brass);
    [-0.72, 0, 0.72].forEach((x, index) => {
      cylinder(root, 0.09, 0.08, 0.28 + index * 0.04, [x, 1.29, -0.38], material([0xb67658, 0xd3a952, 0x6e8f83][index]), 9);
    });
    const inspectionLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      material(0x4f7164, { emissive: 0x6c8d70, emissiveIntensity: 0.22 }),
    );
    inspectionLamp.position.set(-0.82, 2.26, -0.6);
    inspectionLamp.rotation.z = Math.PI;
    root.add(inspectionLamp);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 0.3),
      recoveryLabel,
    );
    label.position.set(0, 0.78, 0.61);
    root.add(label);

    const propagationRack = new THREE.Group();
    box(propagationRack, [2.25, 0.14, 0.92], [2.05, 0.82, 0.04], woodMat);
    box(propagationRack, [2.25, 0.11, 0.76], [2.05, 0.24, 0.02], cream);
    [[1.02, -0.32], [3.08, -0.32], [1.02, 0.34], [3.08, 0.34]].forEach(([x, z]) => {
      box(propagationRack, [0.1, 0.82, 0.1], [x, 0.41, z], darkWood);
    });
    const propagationSign = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.28), propagationLabel);
    propagationSign.position.set(2.05, 0.56, 0.51);
    propagationRack.add(propagationSign);
    propagationRack.name = "propagation-workstation";
    root.add(propagationRack);

    const recoveryRack = new THREE.Group();
    box(recoveryRack, [1.16, 0.14, 0.88], [-0.4, 0.82, -1.37], clinic);
    [[-0.88, -1.68], [0.08, -1.68], [-0.88, -1.08], [0.08, -1.08]].forEach(([x, z]) => {
      box(recoveryRack, [0.09, 0.8, 0.09], [x, 0.4, z], brass);
    });
    const rackSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.25),
      material(0xf0e6cc, { map: textTexture("RECOVERY", "PLACE 3") }),
    );
    rackSign.position.set(-0.4, 0.57, -0.91);
    recoveryRack.add(rackSign);
    recoveryRack.visible = Boolean(state.upgrades.rehabilitationRack);
    recoveryRack.name = "rehabilitation-rack";
    root.add(recoveryRack);

    root.position.set(-4.7, 0, 3.55);
    root.name = "rehabilitation-station";
    registerStation(root, {
      id: "rehabilitation-station",
      label: "Recovery and Propagation Work Area",
      ringScale: 1.5,
      selectionAnchor: new THREE.Vector3(0, 1.06, 0),
    });
    world.add(root);
  }

  function makeShopSignUpgrade(darkWood) {
    const root = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 0.76),
      material(0xf0e6cc, { map: textTexture("OPEN", "MORE PLANTS TODAY") }),
    );
    board.position.set(5.05, 2.2, 3.9);
    board.rotation.y = -0.26;
    root.add(board);
    box(root, [1.72, 0.9, 0.08], [5.05, 2.2, 3.82], darkWood, [0, -0.26, 0]);
    root.visible = Boolean(state.upgrades.shopSign);
    root.name = "shop-sign-upgrade";
    world.add(root);
  }

  function makeRetailSupplyShelf(woodMat, darkWood, brass, cream) {
    const root = new THREE.Group();
    root.name = "retail-supply-shelf";
    const stockVisuals = Object.fromEntries(SUPPLY_CATALOG.map(({ id }) => [id, []]));
    Object.defineProperty(root.userData, "supplyStockVisuals", {
      configurable: true,
      enumerable: false,
      value: stockVisuals,
    });
    const sage = material(0x80977b, { roughness: 0.86 });
    const bottleGlass = material(0x547a69, { roughness: 0.45, metalness: 0.04 });
    const amber = material(0xa76f42, { roughness: 0.7 });
    const paper = material(0xe6d5a8, { roughness: 0.96 });
    box(root, [1.55, 2.55, 0.1], [-0.62, 1.3, -4.87], sage);
    [-1.34, 0.1].forEach((x) => box(root, [0.12, 2.65, 0.6], [x, 1.325, -4.58], darkWood));
    [0.12, 0.92, 1.72, 2.52].forEach((y) => box(root, [1.55, 0.12, 0.62], [-0.62, y, -4.58], woodMat));
    box(root, [1.65, 0.36, 0.12], [-0.62, 2.76, -4.32], darkWood);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 0.24),
      material(0xf2e7c9, { map: textTexture("PLANT SUPPLIES", "CARE · LIGHT · SOIL") }),
    );
    sign.position.set(-0.62, 2.76, -4.25);
    root.add(sign);

    const trackStockVisual = (itemId, object) => {
      stockVisuals[itemId]?.push(object);
      return object;
    };
    const addBag = (itemId, x, y, color, scale = 1) => {
      const visual = new THREE.Group();
      visual.position.set(x, y, -4.22);
      const bag = box(visual, [0.32 * scale, 0.42 * scale, 0.2 * scale], [0, 0, 0], material(color, { roughness: 0.95 }));
      bag.rotation.z = (x + 0.6) * 0.08;
      box(visual, [0.22 * scale, 0.05 * scale, 0.21 * scale], [0, 0.22 * scale, 0], paper);
      root.add(visual);
      return trackStockVisual(itemId, visual);
    };
    const addBottle = (itemId, x, y, color) => {
      const visual = new THREE.Group();
      visual.position.set(x, y, -4.22);
      cylinder(visual, 0.105, 0.12, 0.32, [0, 0, 0], color, 10);
      cylinder(visual, 0.055, 0.055, 0.1, [0, 0.21, 0], cream, 8);
      root.add(visual);
      return trackStockVisual(itemId, visual);
    };
    addBag("potting-soil", -1.08, 0.4, 0xb69264, 0.9);
    addBag("potting-soil", -0.72, 0.4, 0xd1ad6b, 0.9);
    addBag("potting-soil", -0.36, 0.4, 0x9aac82, 0.82);
    addBag("potting-soil", -0.04, 0.4, 0xb69264, 0.78);
    addBottle("fungicide", -1.08, 1.12, bottleGlass);
    addBottle("fungicide", -0.72, 1.12, bottleGlass);
    addBottle("fungicide", -0.36, 1.12, bottleGlass);
    addBottle("neem-spray", -0.14, 1.4, amber);
    [-1.04, -0.58, -0.14].forEach((x, index) => {
      addBag("fertilizer", x, 2.01, index === 0 ? 0xe0c16e : index === 1 ? 0x789486 : 0xc4866b, 0.78);
    });
    [0.32, 0.94, 1.56, 2.18].forEach((y) => {
      const lamp = new THREE.Group();
      lamp.position.set(0.3, y, -4.28);
      lamp.scale.setScalar(0.8);
      cylinder(lamp, 0.022, 0.026, 0.36, [0.1, 0.18, 0], brass, 7);
      box(lamp, [0.25, 0.035, 0.04], [0, 0.35, 0], brass, [0, 0, -0.12]);
      cylinder(lamp, 0.085, 0.05, 0.1, [-0.12, 0.29, 0], sage, 9).rotation.z = Math.PI;
      root.add(lamp);
      trackStockVisual("clip-grow-light", lamp);
    });

    registerStation(root, {
      id: "supply-shelf",
      label: "Retail Supply Shelf",
      ringScale: 1.25,
      selectionAnchor: new THREE.Vector3(-0.62, 0, -4.2),
    });
    world.add(root);
    updateRetailSupplyShelfStock();
  }

  function updateRetailSupplyShelfStock() {
    const shelf = world.getObjectByName("retail-supply-shelf");
    const visuals = shelf?.userData?.supplyStockVisuals;
    if (!visuals) return;
    const supplyState = migrateSupplyState(state.supplyState);
    Object.entries(visuals).forEach(([itemId, objects]) => {
      const item = supplyItemForId(itemId);
      if (!item || !objects.length) return;
      const count = itemId === "clip-grow-light"
        ? availableClipGrowLightCount(supplyState)
        : supplyState.stock[itemId] || 0;
      const visibleCount = Math.min(count, objects.length);
      objects.forEach((object, index) => {
        object.visible = index < visibleCount;
      });
    });
  }

  function makeShopExpansions(woodMat, darkWood, brass, cream, peach) {
    const expansionVisible = (id) => hasExpansion(id);

    const shelves = new THREE.Group();
    [[1.03, 0.9], [2.46, 2.33]].forEach(([boardY, apronY]) => {
      box(shelves, [1.12, 0.18, 3.65], [-5.37, boardY, -2.1], woodMat);
      box(shelves, [0.12, 0.26, 3.65], [-4.86, apronY, -2.1], darkWood);
    });
    [[-5.75, -3.8], [-5.75, -0.4], [-4.99, -3.8], [-4.99, -0.4]].forEach(([x, z]) => {
      box(shelves, [0.11, 2.2, 0.11], [x, 1.1, z], darkWood);
    });
    shelves.name = "expansion-display-shelves";
    shelves.visible = expansionVisible("display-shelves");
    world.add(shelves);

    const rare = new THREE.Group();
    const rarePlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 0.78),
      material(0xf0e6cc, { map: textTexture("RARE NURSERY", "SPECIALIST MEMBER") }),
    );
    rarePlaque.position.set(-5.91, 3.95, 1.08);
    rarePlaque.rotation.y = Math.PI / 2;
    rare.add(rarePlaque);
    box(rare, [0.08, 0.96, 1.73], [-5.97, 3.95, 1.08], darkWood);
    rare.name = "expansion-rare-nursery";
    rare.visible = expansionVisible("rare-nursery");
    world.add(rare);

    const bell = new THREE.Group();
    cylinder(bell, 0.3, 0.34, 0.08, [1.28, 1.45, 1.22], darkWood, 16);
    const bellDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      brass,
    );
    bellDome.position.set(1.28, 1.49, 1.22);
    bellDome.castShadow = true;
    bell.add(bellDome);
    cylinder(bell, 0.055, 0.07, 0.09, [1.28, 1.82, 1.22], brass, 10);
    bell.name = "expansion-checkout-bell";
    bell.visible = expansionVisible("checkout-bell");
    world.add(bell);

    const ceramic = new THREE.Group();
    box(ceramic, [1.42, 0.92, 0.1], [5.03, 3.95, -4.86], material(0xd7a879));
    const ceramicFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.22, 0.72),
      material(0xf4ead0, { map: textTexture("GROWN WITH CARE", "BOUTIQUE DISPLAY") }),
    );
    ceramicFace.position.set(5.03, 3.95, -4.79);
    ceramic.add(ceramicFace);
    ceramic.name = "expansion-ceramic-sign";
    ceramic.visible = expansionVisible("ceramic-sign");
    world.add(ceramic);

    const garden = new THREE.Group();
    box(garden, [0.36, 0.46, 1.75], [-5.73, 2.05, 2.05], peach);
    [-0.64, -0.2, 0.24, 0.65].forEach((offset, index) => {
      cylinder(garden, 0.025, 0.035, 0.68 + (index % 2) * 0.18, [-5.68, 2.55 + (index % 2) * 0.09, 2.05 + offset], material(0x67845d), 6);
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        material([0xe5a18b, 0xe8cf76, 0xb99ac4, 0xf0b77d][index]),
      );
      bloom.scale.set(0.65, 0.38, 1);
      bloom.position.set(-5.65, 2.91 + (index % 2) * 0.18, 2.05 + offset);
      bloom.castShadow = true;
      garden.add(bloom);
    });
    garden.name = "expansion-scent-garden";
    garden.visible = expansionVisible("scent-garden");
    world.add(garden);

    const wrapping = new THREE.Group();
    box(wrapping, [0.78, 0.24, 0.72], [3.35, 1.51, 1.22], cream);
    const paperRoll = cylinder(wrapping, 0.12, 0.12, 0.72, [3.35, 1.78, 1.22], material(0xd58f6b), 12);
    paperRoll.rotation.z = Math.PI / 2;
    [3.08, 3.35, 3.62].forEach((x, index) => {
      cylinder(wrapping, 0.08, 0.08, 0.09, [x, 1.69, 1.56], material([0x7aa6a0, 0xe0b945, 0x9a739d][index]), 12);
    });
    wrapping.name = "expansion-wrapping-station";
    wrapping.visible = expansionVisible("wrapping-station");
    world.add(wrapping);
  }

  function makeShopProjects(woodMat, darkWood, brass) {
    const countOf = (id) => Math.max(0, Number(state.projectState?.counts?.[id]) || 0);
    const leafyGreen = material(0x78966d);

    const garland = new THREE.Group();
    garland.position.set(2.5, 4.75, -4.6);
    for (let index = 0; index < 9; index += 1) {
      const angle = Math.PI + (index / 8) * Math.PI;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 5), leafyGreen);
      leaf.scale.set(1.5, 0.65, 0.5);
      leaf.position.set(Math.cos(angle) * 1.6, Math.sin(angle) * 0.42, 0);
      garland.add(leaf);
      const light = new THREE.PointLight(0xffd585, 0.22, 1.1);
      light.position.copy(leaf.position).add(new THREE.Vector3(0, -0.12, 0.12));
      garland.add(light);
    }
    garland.name = "project-window-garland";
    garland.visible = countOf("window-garland") > 0;
    world.add(garland);

    const board = new THREE.Group();
    board.position.set(-5.86, 5.08, -2.1);
    box(board, [0.09, 1.08, 1.75], [0, 0, 0], material(0xd6b47d));
    for (let index = 0; index < 5; index += 1) {
      box(board, [0.02, 0.25, 0.35], [0.06, 0.25 - (index % 2) * 0.42, -0.37 + Math.floor(index / 2) * 0.42], material([0xd98f6d, 0xe9dfba, 0xa4b995][index % 3]), [index % 2 ? 0.08 : -0.06, 0, 0]);
    }
    board.name = "project-community-board";
    board.visible = countOf("community-board") > 0;
    world.add(board);

    const hanging = new THREE.Group();
    hanging.position.set(0, 4.32, -2.6);
    [-1.1, 0, 1.1].forEach((x, index) => {
      cylinder(hanging, 0.02, 0.02, 1.2, [x, 0.63, 0], brass, 5);
      cylinder(hanging, 0.28, 0.22, 0.36, [x, 0, 0], material(0xb87558), 9);
      for (let leafIndex = 0; leafIndex < 5; leafIndex += 1) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 5), leafyGreen);
        leaf.scale.set(0.8, 1.6, 0.6);
        leaf.position.set(x + (leafIndex - 2) * 0.11, -0.27 - Math.abs(leafIndex - 2) * 0.08 - index * 0.03, 0);
        hanging.add(leaf);
      }
    });
    hanging.name = "project-hanging-garden";
    hanging.visible = countOf("hanging-garden") > 0;
    world.add(hanging);

    const pots = new THREE.Group();
    pots.position.set(3.7, 1.3, -3.88);
    [0xdf846e, 0x7aa6a0, 0xe0b945, 0x9a739d].forEach((color, index) => {
      cylinder(pots, 0.18, 0.14, 0.33, [(index - 1.5) * 0.46, 0, 0], material(color), 9);
    });
    pots.name = "project-painted-pots";
    pots.visible = countOf("painted-pots") > 0;
    world.add(pots);

    const corner = new THREE.Group();
    corner.position.set(-2.6, 0, 3.9);
    box(corner, [1.15, 0.18, 1.05], [0, 0.47, 0], woodMat);
    box(corner, [1.15, 1.05, 0.18], [0, 0.92, 0.43], darkWood, [0.15, 0, 0]);
    [[-0.45, -0.4], [0.45, -0.4]].forEach(([x, z]) => box(corner, [0.12, 0.48, 0.12], [x, 0.24, z], darkWood));
    [0xe6d69e, 0x8aa5a0, 0xce8e73].forEach((color, index) => box(corner, [0.48, 0.08, 0.32], [-0.55 + index * 0.08, 0.16 + index * 0.09, 0.25], material(color), [0, 0.15, index * 0.05]));
    corner.name = "project-reading-corner";
    corner.visible = countOf("reading-corner") > 0;
    world.add(corner);

    SHOP_PROJECTS.forEach((project) => {
      const count = countOf(project.id);
      const object = world.getObjectByName(project.objectName);
      if (object && count > 1) object.scale.setScalar(1 + Math.min(0.18, (count - 1) * 0.035));
    });
  }

  function makeSelectionRing() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd468, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.61, 32), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    world.add(ring);
    run.selectionRing = ring;
  }

  function speciesOf(plant) {
    return SPECIES.find((item) => item.name === plant.species) || SPECIES[0];
  }

  function lightFit(plant, slotIndex = plant?.slot) {
    const spec = speciesOf(plant);
    const preferred = spec.preferredLight;
    const slot = SLOT_DATA[slotIndex];
    const actual = slotIsActive(slot) ? slot.lightLevel : null;
    if (!actual) return { level: "unplaced", label: "light undecided", color: 0xffd15d };
    if (preferred === actual) return { level: "ideal", label: `ideal ${actual} light`, color: 0x75a86e };
    const clipCanAddLight = plant?.clipGrowLightAssigned
      && ((preferred === "indirect" && actual === "shade")
        || (preferred === "sun" && ["shade", "indirect"].includes(actual)));
    if (clipCanAddLight) {
      return { level: "ideal", label: `ideal light · clip lamp assisted`, color: 0x75a86e, assisted: true };
    }
    if (spec.toleratedLight?.includes(actual)) return { level: "tolerable", label: `${actual} light · tolerable`, color: 0xe2bd5d };
    return { level: "poor", label: `${actual} light · poor fit`, color: 0xdf846b };
  }

  function conditionOf(plant) {
    const fit = lightFit(plant);
    if (plant.healthIssue === PLANT_ISSUE_TYPES.MITES) return { label: "mite-infested", icon: "✣" };
    if (plant.healthIssue === PLANT_ISSUE_TYPES.FUNGUS) return { label: "fungal", icon: "✣" };
    if (plant.needsRehabilitation) return { label: "nursery-stressed", icon: "○" };
    if (plant.hydration < 42) return { label: "drooping", icon: "○" };
    if (plant.lifeStage === "juvenile") return { label: "growing", icon: "◔" };
    if (plant.rootComfort !== "comfortable") return { label: "root-bound", icon: "◑" };
    if (fit.level === "poor") return { label: "light-stressed", icon: "◐" };
    if (plant.recoveredToday && fit.level !== "poor") return { label: "recovering", icon: "◕" };
    if (plant.hydration >= 68 && fit.level === "ideal") return { label: "thriving", icon: "●" };
    return { label: "comfortable", icon: "◐" };
  }

  const priceTagColors = { quick: 0x7aa6a0, fair: 0xe0b945, boutique: 0x9a739d };
  const yellowLeafColor = new THREE.Color(0xc5ad49);

  function visibleLeafStress(plant) {
    const issueStress = plant.healthIssueSeverity === "severe"
      ? 0.68
      : plant.healthIssueSeverity === "established"
        ? 0.46
        : plant.healthIssue ? 0.28 : 0;
    const dryStress = plant.hydration < 24 ? 0.34 : plant.hydration < 36 ? 0.16 : 0;
    const nurseryStress = plant.needsRehabilitation ? 0.13 : 0;
    const rootStress = plant.rootComfort !== "comfortable" ? 0.16 : 0;
    return Math.max(issueStress, dryStress, nurseryStress, rootStress);
  }

  function priceBandOf(plant) {
    return PRICE_BANDS[plant?.priceBand] ? plant.priceBand : "fair";
  }

  function plantAskingPrice(plant) {
    return askingPrice(plant, speciesOf(plant));
  }

  function addPlantPriceTag(root, plant) {
    const tagRoot = new THREE.Group();
    tagRoot.name = "plant-price-tag";
    tagRoot.position.set(0.28, 0.47, 0.31);
    tagRoot.rotation.y = -0.18;
    const stringMat = material(0x6d5946, { roughness: 1 });
    const tagMat = material(plant.held ? 0x8f6c98 : priceTagColors[priceBandOf(plant)], { roughness: 0.88 });
    const string = cylinder(tagRoot, 0.008, 0.008, 0.2, [0, 0.08, -0.01], stringMat, 5);
    string.rotation.z = 0.24;
    const tag = box(tagRoot, [0.25, 0.16, 0.025], [0.025, -0.045, 0], tagMat, [0, 0, -0.08]);
    tag.name = "price-tag-card";
    root.add(tagRoot);
  }

  function updatePlantPriceTag(plant) {
    const tag = plantObjects.get(plant?.id)?.getObjectByName("price-tag-card");
    if (tag?.material?.color) tag.material.color.setHex(plant?.held ? 0x8f6c98 : priceTagColors[priceBandOf(plant)]);
  }

  function addRootOvergrowth(root) {
    const roots = new THREE.Group();
    roots.name = "root-overgrowth";
    const rootMaterial = material(0xd7c9a0, { roughness: 1 });
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2 + 0.22;
      const radial = (radius, y) => new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const curve = new THREE.CatmullRomCurve3([
        radial(0.22, 0.63),
        radial(0.38, 0.62),
        radial(0.47 + (index % 2) * 0.035, 0.44),
        radial(0.41, 0.18 + (index % 3) * 0.055),
      ]);
      const strand = new THREE.Mesh(new THREE.TubeGeometry(curve, 9, 0.014, 5, false), rootMaterial);
      strand.castShadow = true;
      roots.add(strand);
    }
    roots.scale.setScalar(0.001);
    roots.visible = false;
    root.add(roots);
    Object.defineProperty(root.userData, "rootOvergrowth", {
      configurable: true,
      enumerable: false,
      value: roots,
    });
    root.userData.rootGrowthVisual = 0;
  }

  function addClipGrowLightVisual(root, modelTop) {
    const lamp = new THREE.Group();
    lamp.name = "clip-grow-light-visual";
    const stemMaterial = material(0x556b55, { roughness: 0.58, metalness: 0.12 });
    const glowMaterial = material(0xffdc84, {
      emissive: 0xffc85e,
      emissiveIntensity: 1.65,
      roughness: 0.28,
    });
    const top = Math.min(2.65, Math.max(1.12, modelTop + 0.2));
    const stemHeight = Math.max(0.44, top - 0.62);
    cylinder(lamp, 0.025, 0.032, stemHeight, [0.39, 0.62 + stemHeight / 2, 0.05], stemMaterial, 7);
    box(lamp, [0.34, 0.045, 0.045], [0.23, top, 0.05], stemMaterial, [0, 0, -0.14]);
    const shade = cylinder(lamp, 0.14, 0.08, 0.15, [0.065, top - 0.08, 0.05], stemMaterial, 10);
    shade.rotation.z = Math.PI;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 9, 6), glowMaterial);
    bulb.position.set(0.065, top - 0.17, 0.05);
    lamp.add(bulb);
    const clip = box(lamp, [0.14, 0.18, 0.12], [0.36, 0.56, 0.05], stemMaterial, [0, 0, 0.2]);
    clip.castShadow = true;
    root.add(lamp);
    Object.defineProperty(root.userData, "clipGrowLight", {
      configurable: true,
      enumerable: false,
      value: lamp,
    });
  }

  function foliageMarkerAnchor(node) {
    let surface = null;
    let surfaceScore = -1;
    node.traverse((object) => {
      if (!object.isMesh || !object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const bounds = object.geometry.boundingBox;
      if (!bounds) return;
      const size = bounds.getSize(new THREE.Vector3());
      const score = size.x * size.y + size.x * size.z + size.y * size.z;
      if (score <= surfaceScore) return;
      surface = object;
      surfaceScore = score;
    });
    if (!surface?.geometry?.boundingBox) return null;
    const bounds = surface.geometry.boundingBox;
    const point = bounds.getCenter(new THREE.Vector3());
    point.z = bounds.max.z + 0.025;
    surface.localToWorld(point);
    return node.worldToLocal(point);
  }

  function addPlantIssueVisuals(root) {
    const leaves = (root.userData.leaves || [])
      .map((node) => ({ node, anchor: foliageMarkerAnchor(node) }))
      .filter(({ anchor }) => Boolean(anchor));
    const makeMarkers = (color, count, fungus = false) => {
      const markerMaterial = material(color, { roughness: 0.86, emissive: fungus ? 0x2a321f : 0x31170f, emissiveIntensity: 0.08 });
      const geometry = fungus
        ? new THREE.SphereGeometry(0.075, 7, 5)
        : new THREE.SphereGeometry(0.035, 6, 4);
      const markers = [];
      const markerCount = Math.min(count, leaves.length);
      for (let index = 0; index < markerCount; index += 1) {
        const leafIndex = Math.floor(((index + 0.5) / markerCount) * leaves.length + (fungus ? 1 : 0)) % leaves.length;
        const { node, anchor } = leaves[leafIndex];
        const marker = new THREE.Group();
        marker.position.copy(anchor);
        marker.rotation.z = (index % 2 ? -1 : 1) * (fungus ? 0.24 : 0.12);
        const spot = new THREE.Mesh(geometry, markerMaterial);
        spot.castShadow = false;
        spot.receiveShadow = false;
        if (fungus) spot.scale.set(1.25, 0.34, 1.05);
        marker.add(spot);
        marker.scale.setScalar(0.001);
        marker.visible = false;
        node.add(marker);
        markers.push(marker);
      }
      return markers;
    };
    Object.defineProperty(root.userData, "issueVisuals", {
      configurable: true,
      enumerable: false,
      value: {
        mites: makeMarkers(0x9b4935, 4),
        fungus: makeMarkers(0xd7d59b, 3, true),
      },
    });
    root.userData.issueVisualScale = { mites: 0, fungus: 0 };
  }

  function captureFoliageColors(root) {
    const seen = new Set();
    const colors = [];
    (root.userData.leaves || []).forEach((leaf) => leaf.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((surface) => {
        if (!surface?.color || seen.has(surface)) return;
        seen.add(surface);
        colors.push({ material: surface, healthy: surface.color.clone() });
      });
    }));
    Object.defineProperty(root.userData, "foliageColorStates", {
      configurable: true,
      enumerable: false,
      value: colors,
    });
  }

  function createPlant(plant) {
    const spec = speciesOf(plant);
    const root = createDistinctPlant3D(plant, spec, run.textures);
    addPlantPriceTag(root, plant);
    captureFoliageColors(root);
    addRootOvergrowth(root);
    root.userData.entity = { kind: "plant", id: plant.id };
    root.userData.plantId = plant.id;
    root.userData.phase = Math.abs(hash(plant.id)) % 100;
    root.userData.ringY = 0;
    root.userData.droop = clamp((48 - plant.hydration) / 40, 0, 1);
    root.userData.lifeScale = plant.lifeStage === "juvenile" ? 0.68 : 1;
    root.updateMatrixWorld(true);
    root.userData.plantModelTop = new THREE.Box3().setFromObject(root).max.y;
    root.userData.modelTop = root.userData.plantModelTop;
    addPlantIssueVisuals(root);
    if (plant.clipGrowLightAssigned) {
      addClipGrowLightVisual(root, root.userData.modelTop);
      root.updateMatrixWorld(true);
      root.userData.modelTop = new THREE.Box3().setFromObject(root).max.y;
    }
    const home = slotIsActive(SLOT_DATA[plant.slot]) ? SLOT_DATA[plant.slot] : null;
    root.userData.looseScale = 0.78 * root.userData.lifeScale;
    root.scale.setScalar(home ? scaleForSlot(root, home) : root.userData.looseScale);
    if (!plant.benchStatus) interactive.push(root);
    return root;
  }

  function scaleForSlot(object, slot) {
    if (!slot?.ceilingY || !object?.userData.modelTop) return (slot?.size || 0.78) * (object?.userData.lifeScale || 1);
    const clearance = Math.max(0.1, slot.ceilingY - slot.y - 0.09);
    return Math.min(slot.size * (object.userData.lifeScale || 1), clearance / object.userData.modelTop);
  }

  function stagingPosition(index) {
    if (index < staging.length) return staging[index].clone();
    const overflowIndex = index - staging.length;
    const positions = state.upgrades.deliveryRack ? [...rackStaging, ...floorStaging] : floorStaging;
    return positions[overflowIndex % positions.length].clone();
  }

  function looseScaleAt(position, object) {
    if (!object) return 0.78;
    if (state.upgrades.deliveryRack && position.z > -0.7 && position.z < 0.2 && position.x > 4) {
      return Math.min(object.userData.looseScale || 0.78, 0.62);
    }
    return object.userData.looseScale || 0.78;
  }

  function hash(text) {
    let result = 0;
    for (let i = 0; i < text.length; i += 1) result = ((result << 5) - result + text.charCodeAt(i)) | 0;
    return result;
  }

  function rebuildPlants() {
    plantObjects.forEach((object) => unregister(object, { dispose: true }));
    plantObjects.clear();
    let loose = 0;
    let repotJob = 0;
    let rehabilitationJob = 0;
    let propagationJob = 0;
    state.inventory.forEach((plant) => {
      const object = createPlant(plant);
      if (plant.benchStatus) {
        const type = plant.benchStatus.type;
        const positions = type === BENCH_JOB_TYPES.REHABILITATE
          ? rehabilitationJobStaging
          : type === BENCH_JOB_TYPES.PROPAGATE
            ? propagationJobStaging
            : benchJobStaging;
        const index = type === BENCH_JOB_TYPES.REHABILITATE
          ? rehabilitationJob
          : type === BENCH_JOB_TYPES.PROPAGATE
            ? propagationJob
            : repotJob;
        const position = positions[Math.min(index, positions.length - 1)];
        object.position.copy(position);
        object.scale.setScalar(type === BENCH_JOB_TYPES.REHABILITATE
          ? Math.min(object.userData.looseScale || 0.78, index < 2 ? 0.46 : 0.4)
          : type === BENCH_JOB_TYPES.PROPAGATE
            ? Math.min(object.userData.looseScale || 0.78, 0.38)
          : index === 0
            ? Math.min(object.userData.looseScale || 0.78, 0.7)
            : Math.min(object.userData.looseScale || 0.78, 0.55));
        if (type === BENCH_JOB_TYPES.REHABILITATE) rehabilitationJob += 1;
        else if (type === BENCH_JOB_TYPES.PROPAGATE) propagationJob += 1;
        else repotJob += 1;
      } else if (Number.isInteger(plant.slot) && slotIsActive(SLOT_DATA[plant.slot])) {
        const slot = SLOT_DATA[plant.slot];
        object.position.set(slot.x, slot.y, slot.z);
      } else {
        const position = stagingPosition(loose);
        object.position.copy(position);
        object.scale.setScalar(looseScaleAt(position, object));
        loose += 1;
      }
      world.add(object);
      plantObjects.set(plant.id, object);
    });
    updateSlotGlow();
  }

  function disposeObject3D(object) {
    const geometries = new Set();
    const materials = new Set();
    object.traverse((child) => {
      if (child.geometry?.dispose) geometries.add(child.geometry);
      const surfaces = Array.isArray(child.material) ? child.material : [child.material];
      surfaces.forEach((surface) => {
        if (surface?.dispose) materials.add(surface);
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((surface) => surface.dispose());
  }

  function unregister(object, { dispose = false } = {}) {
    const index = interactive.indexOf(object);
    if (index >= 0) interactive.splice(index, 1);
    for (let moverIndex = movers.length - 1; moverIndex >= 0; moverIndex -= 1) {
      if (movers[moverIndex].object === object) movers.splice(moverIndex, 1);
    }
    object.removeFromParent();
    if (dispose) disposeObject3D(object);
  }

  function updateCrates() {
    if (!run.crate) return;
    const activeCarton = run.crateAnimation?.carton || null;
    run.crate.visible = state.crates > 0 || Boolean(activeCarton);
    run.crate.children.forEach((carton, index) => {
      const shouldShow = index < state.crates || carton === activeCarton;
      carton.visible = shouldShow;
      if (shouldShow && carton !== activeCarton && carton.userData.opened) resetCarton(carton);
    });
  }

  function updateSlotGlow() {
    const occupants = new Map(state.inventory
      .filter((plant) => plant.id !== run.carried && Number.isInteger(plant.slot))
      .map((plant) => [plant.slot, plant]));
    const carriedPlant = state.inventory.find((plant) => plant.id === run.carried);
    slotObjects.forEach((slot, index) => {
      if (!slotIsActive(SLOT_DATA[index])) {
        const interactiveIndex = interactive.indexOf(slot);
        if (interactiveIndex >= 0) interactive.splice(interactiveIndex, 1);
        slot.visible = false;
        slot.userData.occupantId = null;
        return;
      }
      if (!interactive.includes(slot)) interactive.push(slot);
      const available = !occupants.has(index);
      const swapTarget = Boolean(carriedPlant && occupants.has(index) && (run.arranging || state.phase === "preparation"));
      const fit = carriedPlant ? lightFit(carriedPlant, index) : null;
      const goalMatch = (available || swapTarget) && carriedPlant && !state.displayGoal?.claimed
        && carriedPlant.traits.includes(state.displayGoal?.trait)
        && SLOT_DATA[index].zone === state.displayGoal?.zone;
      slot.visible = available || swapTarget;
      slot.material.opacity = run.carried && (available || swapTarget) ? (goalMatch ? 0.98 : 0.78) : 0.12;
      slot.material.color.set(fit ? fit.color : 0xd7be75);
      slot.scale.setScalar(goalMatch ? 1.22 : 1);
      slot.userData.occupantId = occupants.get(index)?.id || null;
    });
  }

  function goalSummary() {
    const goal = state.displayGoal;
    if (!goal) return "";
    const zone = SLOT_DATA.find((slot) => slot.zone === goal.zone)?.zoneLabel || goal.zone;
    return goal.claimed
      ? "Display vignette complete ✓"
      : `Display: ${goal.trait} → ${zone} · +${goal.rewardCoins} coins · +${goal.rewardBloom} Bloom`;
  }

  function bloomStanding() {
    const stages = [
      { threshold: 0, name: "New Shoots" },
      { threshold: 25, name: "Neighborhood Favorite" },
      { threshold: 60, name: "Trusted Plantkeeper" },
      { threshold: 120, name: "Shop in Full Bloom" },
    ];
    const earnedBloom = Math.max(0, Number(state.lifetimeBloom) || state.bloom);
    const currentIndex = stages.findLastIndex((stage) => earnedBloom >= stage.threshold);
    const current = stages[Math.max(0, currentIndex)];
    const next = stages[currentIndex + 1];
    return {
      name: current.name,
      copy: next ? `${next.threshold - earnedBloom} Bloom to ${next.name}` : "The whole neighborhood knows your windows",
    };
  }

  function earnBloom(amount) {
    const earned = Math.max(0, Number(amount) || 0);
    state.bloom += earned;
    state.lifetimeBloom = Math.max(0, Number(state.lifetimeBloom) || 0) + earned;
  }

  function addWeekStat(key, amount = 1) {
    if (!state.weekStats) state.weekStats = freshWeekStats(calendarForDay(state.day).week);
    state.weekStats[key] = (Number(state.weekStats[key]) || 0) + amount;
  }

  function advanceWeekGoal(event) {
    const result = progressWeeklyObjective(state.weeklyObjective, event);
    if (!result?.completedNow || state.weeklyObjective.claimed) return "";
    state.weeklyObjective.claimed = true;
    const reward = state.weeklyObjective.reward || {};
    state.coins += Number(reward.coins) || 0;
    earnBloom(Number(reward.bloom) || 0);
    return ` Weekly goal complete—+${Number(reward.coins) || 0} coins and +${Number(reward.bloom) || 0} Bloom!`;
  }

  function evaluateDisplayGoal(plant, slot) {
    const goal = state.displayGoal;
    if (!goal || goal.claimed || !plant?.traits.includes(goal.trait) || slot?.zone !== goal.zone) return false;
    goal.claimed = true;
    state.coins += goal.rewardCoins;
    earnBloom(goal.rewardBloom);
    return true;
  }

  function bindUi() {
    ui.start?.addEventListener("click", startGame);
    ui.resetGame?.addEventListener("click", () => {
      ui.resetGame.hidden = true;
      ui.resetGameConfirm.hidden = false;
      ui.confirmResetGame?.focus();
    });
    ui.cancelResetGame?.addEventListener("click", () => {
      ui.resetGameConfirm.hidden = true;
      ui.resetGame.hidden = false;
      ui.resetGame.focus();
    });
    ui.confirmResetGame?.addEventListener("click", () => {
      discardSave = true;
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
      window.location.reload();
    });
    ui.action?.addEventListener("click", doAction);
    ui.openShop?.addEventListener("click", openShop);
    ui.openAllCartons?.addEventListener("click", unpackAllCartons);
    ui.closeDeliveryOverview?.addEventListener("click", () => {
      run.deliveryOverviewPlantIds = [];
      updateUi();
    });
    ui.arrangeButton?.addEventListener("click", toggleArrangement);
    CARES.forEach((care) => ui.care[care]?.addEventListener("click", () => careForPlant(care)));
    ui.priceButtons.forEach((button) => button.addEventListener("click", () => setPriceBand(button.dataset.priceBand)));
    ui.nextDay?.addEventListener("click", nextDay);
    ui.upgradeButton?.addEventListener("click", () => openModal(ui.upgradeModal, true));
    ui.projectFund?.addEventListener("click", fundCurrentProject);
    ui.closeUpgrades?.addEventListener("click", () => openModal(ui.upgradeModal, false));
    ui.benchButton?.addEventListener("click", () => openModal(ui.benchModal, true));
    ui.benchOverview?.addEventListener("click", () => openModal(ui.benchModal, true));
    ui.closeBench?.addEventListener("click", () => openModal(ui.benchModal, false));
    ui.supplyButton?.addEventListener("click", () => openModal(ui.supplyModal, true));
    ui.closeSupply?.addEventListener("click", () => openModal(ui.supplyModal, false));
    ui.weeklyOrderButton?.addEventListener("click", () => openModal(ui.weeklyOrderModal, true));
    ui.closeWeeklyOrder?.addEventListener("click", () => openModal(ui.weeklyOrderModal, false));
    ui.acceptWeeklyOrder?.addEventListener("click", acceptCurrentWeeklyOrder);
    ui.declineWeeklyOrder?.addEventListener("click", declineCurrentWeeklyOrder);
    ui.completeWeeklyOrder?.addEventListener("click", completeCurrentWeeklyOrder);
    ui.helpButton?.addEventListener("click", () => openModal(ui.helpModal, true));
    ui.closeHelp?.addEventListener("click", () => openModal(ui.helpModal, false));
    ui.soundButton?.addEventListener("click", toggleSound);
    ui.rotateLeft?.addEventListener("click", () => rotateView(-1));
    ui.rotateRight?.addEventListener("click", () => rotateView(1));
    ui.orientation?.addEventListener("click", dismissOrientationHint);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  }

  function startGame() {
    if (!run.ready) return;
    run.started = true;
    document.body.classList.add("game-started");
    document.body.dataset.gameState = "playing";
    if (ui.title) {
      ui.title.hidden = true;
      ui.title.classList.add("is-dismissed");
    }
    if (ui.game) {
      ui.game.hidden = false;
      ui.game.classList.add("is-visible");
    }
    if (ui.rotateLeft) ui.rotateLeft.hidden = false;
    if (ui.rotateRight) ui.rotateRight.hidden = false;
    if (ui.arrangeButton) ui.arrangeButton.hidden = false;
    ensureAudio();
    sound("open");
    if (state.phase === "supply") {
      showSupplierBoard();
    } else if (state.phase === "preparation") {
      run.arranging = true;
      updateCrates();
    } else if (state.phase === "report") {
      showReport();
    } else {
      state.phase = "open";
      spawnCustomer(false);
    }
    updateUi();
    resize();
    const hello = state.day === 1 ? "Day one. The plants are nervous too." : `Day ${state.day}. Fresh leaves, fresh chances.`;
    const morning = state.phase === "supply" ? " Read the neighborhood notes and choose one nursery delivery." : "";
    toast(`${hello}${morning}`, morning ? 4300 : 3100);
  }

  function showSupplierBoard() {
    if (!ui.supplierBoard) return;
    if (!state.supplierOptions?.length) {
      state.supplierOptions = dailySupplierLots();
    }
    renderSupplierBoard();
    ui.supplierBoard.hidden = false;
    ui.supplierBoard.classList.add("is-open");
    ui.supplierBoard.setAttribute("aria-hidden", "false");
    if (ui.game) ui.game.inert = true;
    requestAnimationFrame(() => ui.supplierOptions?.querySelector("button:not([disabled])")?.focus());
  }

  function renderSupplierBoard() {
    if (!ui.supplierOptions) return;
    const calendar = calendarForDay(state.day);
    const relationship = supplierRelationship(state.neighborhoodState);
    if (ui.supplierRelationshipLevel) ui.supplierRelationshipLevel.textContent = `Level ${relationship.level}`;
    if (ui.supplierRelationshipName) ui.supplierRelationshipName.textContent = relationship.name;
    if (ui.supplierRelationshipPerk) ui.supplierRelationshipPerk.textContent = relationship.perk;
    if (ui.supplierRelationshipProgressCopy) ui.supplierRelationshipProgressCopy.textContent = relationship.nextAt
      ? `${relationship.orders}/${relationship.nextAt} nursery orders`
      : `${relationship.orders} nursery orders · top level`;
    if (ui.supplierRelationshipProgress) {
      ui.supplierRelationshipProgress.max = relationship.nextAt || Math.max(relationship.orders, 1);
      ui.supplierRelationshipProgress.value = relationship.orders;
    }
    if (ui.supplierTitle) ui.supplierTitle.textContent = `${calendar.weekday} · Week ${calendar.week}`;
    if (ui.supplierForecast) {
      const needs = [...new Set(state.customers.map((customer) => customer.need))];
      const trade = dailyTradeProfile({
        day: state.day,
        inventoryCount: state.inventory.length,
        capacity: state.inventoryCapacity,
        visitorBonus: state.upgrades.shopSign ? 1 : 0,
        serviceableCapacity: sellablePotential(state.inventory, state.inventoryCapacity),
      });
      const coverageLabels = {
        empty: "Start today’s stock",
        shortage: "More sale stock needed",
        thin: "Enough stock, small choice",
        balanced: "Stock is balanced",
        overstock: "Sell carry-over stock",
        full: "Shelves are full",
      };
      if (ui.supplierSummaryVisitors) ui.supplierSummaryVisitors.textContent = `${state.customers.length} today`;
      if (ui.supplierSummaryNeeds) ui.supplierSummaryNeeds.textContent = needs.length ? needs.join(" · ") : "No open requests";
      if (ui.supplierSummaryCost) ui.supplierSummaryCost.textContent = coinCopy(state.dailyOperatingCost);
      if (ui.supplierSummaryDebt) {
        ui.supplierSummaryDebt.textContent = state.outstandingCosts
          ? `${coinCopy(state.outstandingCosts)} from earlier days is also due`
          : calendar.week >= 4
            ? "Overstock costs 2 coins per plant at closing"
            : "No old costs are due";
      }
      if (ui.supplierSummaryCoverage) ui.supplierSummaryCoverage.textContent = coverageLabels[trade.stockPressure] || "Review today’s stock";
      if (ui.supplierSummaryPressure) ui.supplierSummaryPressure.textContent = trade.pressureCopy;
    }
    if (ui.supplierStatus) {
      const newPlants = SPECIES.filter((species) => species.unlockWeek === calendar.week).map((species) => species.name);
      const newNeighbors = CUSTOMERS.filter((customer) => customer.unlockWeek === calendar.week).map((customer) => customer.name);
      const arrivalNames = [...newPlants, ...newNeighbors];
      const arrivals = calendar.isMonday && calendar.week > 1 && arrivalNames.length
        ? `New this week: ${arrivalNames.join(" · ")}. `
        : "";
      const rareAccess = hasExpansion("rare-nursery")
        ? "Your Rare Nursery Collection is listed as an extra choice. "
        : "";
      ui.supplierStatus.textContent = `${arrivals}${rareAccess}${weeklyObjectiveLabel(state.weeklyObjective)}. Choose one delivery; unsold plants stay in your shop.`;
    }
    ui.supplierOptions.replaceChildren();
    state.supplierOptions.forEach((lot, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "supplier-option";
      button.style.setProperty("--option-color", ["#577a55", "#d49362", "#836b8c", "#8c7653"][index % 4]);
      const affordable = lot.affordable !== false && state.coins >= (lot.cost || 0);
      const fits = lot.fitsCapacity !== false && state.inventory.length + (lot.quantity ?? lot.speciesNames?.length ?? 0) <= state.inventoryCapacity;
      const selectable = lot.selectable !== false && affordable && fits;
      button.disabled = !selectable;
      button.setAttribute("aria-pressed", "false");

      const header = document.createElement("div");
      header.className = "supplier-option-header";
      const name = document.createElement("h3");
      name.className = "supplier-option-name";
      name.textContent = lot.name;
      const cost = document.createElement("span");
      cost.className = "supplier-cost";
      cost.textContent = lot.speciesNames?.length
        ? lot.cost ? `${lot.cost} coins` : "Rescue tab · 0"
        : "No order";
      header.append(name, cost);

      const copy = document.createElement("p");
      copy.className = "supplier-option-copy";
      copy.textContent = lot.description || "A small nursery assortment for today’s shop.";
      const contents = document.createElement("p");
      contents.className = "supplier-contents";
      contents.textContent = [supplierContents(lot), lot.relationshipClue, lot.relationshipDiscount ? `Trusted price saves ${lot.relationshipDiscount} coins.` : ""]
        .filter(Boolean).join(" · ");
      const badges = document.createElement("div");
      badges.className = "supplier-badges";
      const condition = document.createElement("span");
      condition.className = "supplier-badge";
      condition.textContent = lot.stressedQuantity
        ? `${lot.stressedQuantity} rescue · ${lot.healthyQuantity || 0} healthy`
        : lot.speciesNames?.length ? "Healthy stock" : "Current stock";
      const capacity = document.createElement("span");
      capacity.className = "supplier-badge";
      capacity.textContent = fits ? `${lot.speciesNames?.length || 0} spaces used` : "Not enough space";
      badges.append(condition, capacity);
      if (lot.speciesNames?.length) {
        const variety = document.createElement("span");
        variety.className = "supplier-badge";
        const deliveredSpecies = lot.speciesIds || [];
        const ownedSpecies = new Set(state.inventory.map((plant) => plant.speciesId));
        const uniqueSpeciesCount = lot.uniqueSpeciesCount ?? new Set(deliveredSpecies).size;
        const newSpeciesCount = lot.newSpeciesCount
          ?? new Set(deliveredSpecies.filter((speciesId) => !ownedSpecies.has(speciesId))).size;
        variety.textContent = `${uniqueSpeciesCount} unique · ${newSpeciesCount} new`;
        badges.append(variety);
      }
      if (lot.rareCollection) {
        const rareBadge = document.createElement("span");
        rareBadge.className = "supplier-badge supplier-badge-rare";
        rareBadge.textContent = "Special plants";
        badges.append(rareBadge);
      }
      if (!affordable) {
        const unavailable = document.createElement("span");
        unavailable.className = "supplier-badge";
        unavailable.textContent = "Not enough coins";
        badges.append(unavailable);
      }
      if (lot.coversRequests === false) {
        const uncovered = document.createElement("span");
        uncovered.className = "supplier-badge";
        uncovered.textContent = "Does not cover all notes";
        badges.append(uncovered);
      }
      button.append(header, copy, contents, badges);
      button.addEventListener("click", () => chooseSupplierLot(lot, button));
      ui.supplierOptions.append(button);
    });
  }

  function supplierContents(lot) {
    if (!lot.speciesNames?.length) return "Use the plants already in the shop";
    if (lot.reveal?.level === "count-only" || lot.supplierId === "mystery-rescue-lot" || lot.id?.includes("mystery")) {
      return `${lot.speciesNames.length} mystery plants · identities hidden until unboxed`;
    }
    return lot.speciesNames.join(" · ");
  }

  function chooseSupplierLot(lot, button) {
    if (state.phase !== "supply" || button.disabled) return;
    const quantity = lot.speciesNames?.length || 0;
    if (state.inventory.length + quantity > state.inventoryCapacity) {
      sound("error");
      if (ui.supplierStatus) ui.supplierStatus.textContent = `That lot needs ${quantity} spaces; only ${state.inventoryCapacity - state.inventory.length} are open.`;
      return;
    }
    if (state.coins < (lot.cost || 0)) {
      sound("error");
      if (ui.supplierStatus) ui.supplierStatus.textContent = "The till cannot quite cover that nursery invoice.";
      return;
    }
    state.selectedLotId = lot.id;
    state.coins -= lot.cost || 0;
    state.dailyStockCost += lot.cost || 0;
    state.neighborhoodState = recordSupplierOrder(state.neighborhoodState, lot.supplierId || lot.kind).state;
    const speciesNames = [...(lot.speciesNames || [])];
    const deliveries = Array.isArray(lot.deliveries) && lot.deliveries.length === speciesNames.length
      ? lot.deliveries
      : speciesNames.map((speciesName) => ({ speciesName, condition: lot.condition || "healthy" }));
    const acquisitionCosts = allocateLotCosts(speciesNames, lot.cost || 0);
    state.crateQueue = deliveries.map((delivery, index) => ({
      id: `${lot.id}-plant-${index}`,
      speciesId: delivery.speciesId || speciesOfName(delivery.speciesName).id,
      speciesName: delivery.speciesName,
      seed: state.day * 1009 + index * 131 + lot.id.length * 17,
      condition: delivery.condition || "healthy",
      acquisitionCost: acquisitionCosts[index] || 0,
      status: "boxed",
    }));
    state.crates = state.crateQueue.length;
    state.deliveryCondition = lot.condition || "healthy";
    state.phase = "preparation";
    state.displayGoal = lot.reveal?.level === "count-only"
      ? null
      : makeDisplayGoal(seeded(state.day * 1999 + 73));
    run.arranging = true;
    ui.supplierOptions.querySelectorAll("button").forEach((item) => {
      item.disabled = true;
      item.setAttribute("aria-pressed", String(item === button));
      item.classList.toggle("is-selected", item === button);
    });
    if (ui.supplierStatus) ui.supplierStatus.textContent = quantity
      ? `${lot.name} booked. The cartons are on the care bench.`
      : "No delivery today. Your existing stock is ready to arrange.";
    save();
    setTimeout(() => {
      if (ui.supplierBoard) {
        ui.supplierBoard.hidden = true;
        ui.supplierBoard.classList.remove("is-open");
        ui.supplierBoard.setAttribute("aria-hidden", "true");
      }
      if (ui.game) ui.game.inert = false;
      updateCrates();
      updateUi();
      canvas.focus({ preventScroll: true });
      sound("crate");
      toast(quantity
        ? `${lot.name} arrived. Open ${quantity} carton${quantity === 1 ? "" : "s"}, care for the plants, then arrange your displays.`
        : "No invoice, no boxes. Arrange the stock you have, then open the shop.", 4800);
    }, reduceMotion ? 0 : 420);
  }

  function openShop() {
    if (state.phase !== "preparation" || state.crates > 0 || run.crateAnimation) return;
    if (!inventoryCoversCustomers(state.inventory, state.customers.slice(state.customerIndex))) {
      sound("error");
      toast("The neighborhood notes are not covered yet. Check that every carton made it onto the bench.");
      return;
    }
    cancelMove();
    run.arranging = false;
    state.phase = "open";
    save();
    sound("open");
    spawnCustomer(true);
    updateUi();
    toast("The sign flips to OPEN. Your first customer is on the way.", 3600);
  }

  function toggleArrangement() {
    if (state.phase === "supply" || state.phase === "report" || run.busy) return;
    if (state.phase === "preparation") {
      toast("Preparation time is already arrangement time. Open the shop when the displays feel right.");
      return;
    }
    if (run.arranging) cancelMove();
    run.arranging = !run.arranging;
    sound("place");
    toast(run.arranging
      ? "Arrangement mode on. Move and swap plants without offering them."
      : "Arrangement mode off. Placed plants can be offered to customers.");
    updateSlotGlow();
    updateUi();
  }

  function openModal(element, open) {
    if (!element) return;
    if (open && (run.busy || run.customerTween) && [ui.helpModal, ui.upgradeModal, ui.benchModal, ui.supplyModal, ui.weeklyOrderModal].includes(element)) {
      toast("Finish the current shop moment first.");
      return;
    }
    if (element === ui.upgradeModal && open) renderUpgrades();
    if (element === ui.benchModal && open) renderBench();
    if (element === ui.supplyModal && open) renderSupplyShelf();
    if (element === ui.weeklyOrderModal && open) renderWeeklyOrder();
    if (open) run.modalReturnFocus = document.activeElement;
    element.hidden = !open;
    element.classList.toggle("is-open", open);
    element.setAttribute("aria-hidden", String(!open));
    if (element === ui.benchModal) {
      if (ui.benchButton) ui.benchButton.setAttribute("aria-expanded", String(open));
      if (ui.benchOverview) ui.benchOverview.setAttribute("aria-expanded", String(open));
    }
    if (element === ui.supplyModal && ui.supplyButton) ui.supplyButton.setAttribute("aria-expanded", String(open));
    if (element === ui.weeklyOrderModal && ui.weeklyOrderButton) ui.weeklyOrderButton.setAttribute("aria-expanded", String(open));
    const anyModalOpen = [ui.helpModal, ui.upgradeModal, ui.benchModal, ui.supplyModal, ui.weeklyOrderModal, ui.report, ui.supplierBoard]
      .some((modal) => modal && !modal.hidden);
    if (ui.game) ui.game.inert = anyModalOpen;
    if (open) {
      requestAnimationFrame(() => element.querySelector("button:not([disabled])")?.focus());
    } else if (!anyModalOpen && run.modalReturnFocus instanceof HTMLElement) {
      run.modalReturnFocus.focus();
      run.modalReturnFocus = null;
    }
  }

  function currentOpenModal() {
    return [ui.supplierBoard, ui.report, ui.weeklyOrderModal, ui.benchModal, ui.supplyModal, ui.upgradeModal, ui.helpModal]
      .find((modal) => modal && !modal.hidden) || null;
  }

  function trapModalFocus(event, modal) {
    const focusable = [...modal.querySelectorAll("button:not([disabled]):not([hidden]), [href], [tabindex]:not([tabindex='-1'])")]
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!modal.contains(active) || (!event.shiftKey && active === last) || (event.shiftKey && active === first)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  const benchJobInfo = {
    [BENCH_JOB_TYPES.REPOT]: {
      name: "Repot",
      copy: "Fresh soil, comfortable roots, and +4 base value.",
    },
    [BENCH_JOB_TYPES.REHABILITATE]: {
      name: "Rehabilitate",
      copy: `Clear nursery stress, restore lost sale value, protect the plant for two days, and earn ${REHABILITATION_BLOOM_REWARD} Bloom.`,
    },
    [BENCH_JOB_TYPES.PROPAGATE]: {
      name: "Propagate",
      copy: "Create one juvenile cutting. It matures in three mornings.",
    },
  };

  function benchJobCopy(type) {
    if (!state.upgrades.growLamp) return benchJobInfo[type].copy;
    if (type === BENCH_JOB_TYPES.REPOT) return "Fresh soil, comfortable roots, and +6 base value with lamp support.";
    if (type === BENCH_JOB_TYPES.REHABILITATE) return "Clear nursery stress, restore lost sale value, and protect the plant for three days with lamp support.";
    return "Create one juvenile cutting. Lamp support helps it mature in two mornings.";
  }

  function activeBenchJobCopy(job, plant) {
    if (job.type === BENCH_JOB_TYPES.REPOT) {
      return `Comfortable roots · +${job.lampAssisted ? 6 : 4} base value.`;
    }
    if (job.type === BENCH_JOB_TYPES.REHABILITATE) {
      const restore = Math.max(0, Number(plant?.rehabilitationValueLoss) || 0);
      return `Clears nursery stress${restore ? ` · restores ${restore} coins` : ""} · ${job.lampAssisted ? 3 : 2} protected days · +${REHABILITATION_BLOOM_REWARD} Bloom.`;
    }
    return `Creates a juvenile cutting · ${job.lampAssisted ? 2 : 3} mornings to mature.`;
  }

  function benchValidation(type, plant) {
    if (state.phase !== "preparation" && state.phase !== "supply") {
      return { ok: false, message: "Start bench work during morning preparation." };
    }
    if (state.phase === "supply") return { ok: false, message: "Choose today’s nursery shipment first." };
    if (state.crates > 0 || run.crateAnimation) {
      return { ok: false, message: "Open every carton before bench work starts." };
    }
    if (plant?.held && type === BENCH_JOB_TYPES.PROPAGATE) {
      return { ok: false, message: "A plant held for an order cannot be used for propagation." };
    }
    const jobCost = BENCH_JOB_COSTS[type]?.coins || 0;
    const freeCoins = discretionaryCoins();
    if (jobCost > freeCoins) {
      return {
        ok: false,
        code: "shop-cost-reserve",
        message: `${reservedCostCopy(reservedShopCoins())}. You need ${coinCopy(jobCost - freeCoins)} more for this job.`,
      };
    }
    const result = validateBenchJob({
      type,
      plantId: plant?.id,
      inventory: state.inventory,
      benchState: state.benchState,
      coins: state.coins,
      bloom: state.bloom,
      day: state.day,
      capacity: state.inventoryCapacity,
      condition: plant ? conditionOf(plant).label : null,
      lampAssisted: state.upgrades.growLamp,
    });
    if (!result.ok) return result;
    const preview = startBenchJob({
      type,
      plantId: plant.id,
      inventory: state.inventory,
      benchState: state.benchState,
      coins: state.coins,
      bloom: state.bloom,
      day: state.day,
      capacity: state.inventoryCapacity,
      condition: conditionOf(plant).label,
      lampAssisted: state.upgrades.growLamp,
    });
    if (preview.ok && !inventoryCoversCustomers(preview.inventory, state.customers.slice(state.customerIndex))) {
      return {
        ...result,
        ok: false,
        code: "needed-for-visitors",
        message: "Keep this plant available. It is needed for today’s visitors.",
      };
    }
    return result;
  }

  function renderBench() {
    if (!ui.benchPlants || !ui.benchActiveJobs || !ui.benchActions) return;
    state.benchState = {
      ...migrateBenchState(state.benchState),
      slotCount: state.upgrades.benchShelf ? 2 : CARE_BENCH_BASE_SLOTS,
      rehabilitationSlotCount: state.upgrades.rehabilitationRack
        ? REHABILITATION_UPGRADE_SLOTS
        : REHABILITATION_BASE_SLOTS,
    };
    const jobs = state.benchState.jobs || [];
    const rehabilitationJobs = jobs.filter((job) => job.type === BENCH_JOB_TYPES.REHABILITATE);
    const careBenchJobs = jobs.filter((job) => job.type !== BENCH_JOB_TYPES.REHABILITATE);
    const availablePlants = state.inventory.filter((plant) => !plant.benchStatus);
    if (!availablePlants.some((plant) => plant.id === run.benchPlantId)) {
      run.benchPlantId = availablePlants[0]?.id || null;
    }
    const selectedPlant = state.inventory.find((plant) => plant.id === run.benchPlantId) || null;
    const canStartJobs = state.phase === "preparation" && state.crates === 0 && !run.crateAnimation;
    const phaseGuidance = state.phase === "supply"
      ? "Choose today’s nursery shipment first."
      : state.phase === "preparation" && state.crates > 0
        ? `Open ${state.crates} more ${state.crates === 1 ? "carton" : "cartons"} before bench work starts.`
        : canStartJobs
          ? "The bench is ready. Choose one plant and one job."
          : "View active jobs now. New jobs start during tomorrow’s preparation.";
    if (ui.benchSummary) {
      const reserve = reservedShopCoins();
      const lampCopy = state.upgrades.growLamp
        ? " Grow lamp support is on: more Repot value, longer Rehabilitate protection, and faster Propagate growth."
        : "";
      ui.benchSummary.textContent = `${phaseGuidance} Care Bench: ${careBenchJobs.length}/${state.benchState.slotCount} Repot or Propagate places. Recovery Station: ${rehabilitationJobs.length}/${state.benchState.rehabilitationSlotCount} Rehabilitation places. You have ${state.coins} coins and ${state.bloom} Bloom.${reserve ? ` ${reservedCostCopy(reserve)}.` : ""}${lampCopy}`;
    }
    if (ui.benchStatus) {
      ui.benchStatus.textContent = canStartJobs ? run.benchMessage : phaseGuidance;
      ui.benchStatus.dataset.tone = careBenchJobs.length >= state.benchState.slotCount
        || rehabilitationJobs.length >= state.benchState.rehabilitationSlotCount
        ? "warning"
        : "";
    }
    ui.benchPlants.replaceChildren();
    if (!state.inventory.length) {
      const empty = document.createElement("p");
      empty.className = "bench-empty";
      empty.textContent = "There are no plants in the shop.";
      ui.benchPlants.append(empty);
    }
    state.inventory.forEach((plant) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bench-plant";
      button.disabled = Boolean(plant.benchStatus);
      const selected = plant.id === run.benchPlantId;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("is-selected", selected);
      const name = document.createElement("strong");
      name.textContent = plant.species;
      const detail = document.createElement("small");
      const condition = conditionOf(plant).label;
      const stage = plant.lifeStage === "juvenile"
        ? `juvenile · ${plant.maturityDaysRemaining} mornings to mature`
        : `${plant.rootComfort === "comfortable" ? "roots comfortable" : "root-bound"}`;
      detail.textContent = plant.benchStatus
        ? `${benchJobInfo[plant.benchStatus.type]?.name || "Bench job"} · ready Day ${plant.benchStatus.readyDay}`
        : `${condition} · ${stage}`;
      button.append(name, detail);
      button.addEventListener("click", () => {
        run.benchPlantId = plant.id;
        run.benchMessage = `${plant.species} selected. Choose one job.`;
        renderBench();
      });
      ui.benchPlants.append(button);
    });

    ui.benchActiveJobs.replaceChildren();
    ui.benchActions.replaceChildren();
    if (!jobs.length) {
      const empty = document.createElement("p");
      empty.className = "bench-empty";
      empty.textContent = `No work in progress. ${state.benchState.slotCount} Care Bench ${state.benchState.slotCount === 1 ? "place is" : "places are"} free. ${state.benchState.rehabilitationSlotCount} Recovery Station places are free.`;
      ui.benchActiveJobs.append(empty);
    }
    jobs.forEach((job) => {
      const card = document.createElement("article");
      card.className = "bench-job";
      card.dataset.state = job.status;
      card.dataset.workArea = job.type === BENCH_JOB_TYPES.REHABILITATE ? "recovery" : "care-bench";
      const name = document.createElement("strong");
      const plant = state.inventory.find((item) => item.id === job.plantId);
      name.textContent = `${benchJobInfo[job.type]?.name || "Bench job"} · ${plant?.species || "Plant"}`;
      const detail = document.createElement("small");
      const lampCopy = job.lampAssisted ? " Grow lamp assisted." : "";
      const timingCopy = job.status === "ready" ? "Ready. Waiting for stock space." : `Finishes on Day ${job.readyDay}.`;
      detail.textContent = `${timingCopy} ${activeBenchJobCopy(job, plant)}${lampCopy}`;
      card.append(name, detail);
      ui.benchActiveJobs.append(card);
    });
    Object.values(BENCH_JOB_TYPES).forEach((type) => {
      const info = benchJobInfo[type];
      const validation = benchValidation(type, selectedPlant);
      const cost = BENCH_JOB_COSTS[type];
      const duration = BENCH_JOB_DURATIONS[type];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bench-job";
      button.setAttribute("aria-disabled", String(!validation.ok));
      const jobCopy = benchJobCopy(type);
      button.title = validation.ok ? jobCopy : validation.message;
      const name = document.createElement("strong");
      name.textContent = info.name;
      const detail = document.createElement("small");
      detail.textContent = `${cost.coins} coins${cost.bloom ? ` + ${cost.bloom} Bloom` : ""} · ${duration} ${duration === 1 ? "morning" : "mornings"}. ${validation.ok ? jobCopy : validation.message}`;
      button.append(name, detail);
      button.addEventListener("click", () => {
        if (!validation.ok) {
          run.benchMessage = validation.message;
          if (ui.benchStatus) ui.benchStatus.textContent = validation.message;
          sound("error");
          return;
        }
        startSelectedBenchJob(type);
      });
      ui.benchActions.append(button);
    });
  }

  function startSelectedBenchJob(type) {
    const plant = state.inventory.find((item) => item.id === run.benchPlantId);
    const validation = benchValidation(type, plant);
    if (!validation.ok) {
      run.benchMessage = validation.message;
      sound("error");
      renderBench();
      return;
    }
    const result = startBenchJob({
      type,
      plantId: plant.id,
      inventory: state.inventory,
      benchState: state.benchState,
      coins: state.coins,
      bloom: state.bloom,
      day: state.day,
      capacity: state.inventoryCapacity,
      condition: conditionOf(plant).label,
      lampAssisted: state.upgrades.growLamp,
    });
    if (!result.ok) {
      run.benchMessage = result.message;
      sound("error");
      renderBench();
      return;
    }
    state.inventory = result.inventory;
    state.benchState = result.benchState;
    state.coins = result.coins;
    state.bloom = result.bloom;
    run.benchPlantId = null;
    run.benchMessage = result.message;
    run.selected = null;
    run.carried = null;
    run.moveOrigin = null;
    document.body.dataset.selection = "none";
    rebuildPlants();
    save();
    sound("upgrade");
    renderBench();
    updateUi();
  }

  const supplyAccentColors = {
    "clip-grow-light": "#d9b85f",
    fertilizer: "#7f9b68",
    fungicide: "#6f9c91",
    "neem-spray": "#b66f55",
    "potting-soil": "#9a7254",
  };

  function selectedSupplyPlant() {
    const plant = state.inventory.find((item) => item.id === run.lastPlantId);
    return plant && !plant.benchStatus ? plant : null;
  }

  function supplyActionButton({ title, copy, itemId, enabled, onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.style.setProperty("--supply-accent", supplyAccentColors[itemId] || "#d9b85f");
    button.setAttribute("aria-disabled", String(!enabled));
    const heading = document.createElement("strong");
    heading.textContent = title;
    const detail = document.createElement("small");
    detail.textContent = copy;
    button.append(heading, detail);
    button.addEventListener("click", () => {
      if (!enabled) {
        run.supplyMessage = copy;
        sound("error");
        renderSupplyShelf();
        return;
      }
      onClick();
    });
    return button;
  }

  function renderSupplyShelf() {
    if (!ui.supplyCatalog || !ui.supplyPlant || !ui.supplyActions) return;
    state.supplyState = migrateSupplyState(state.supplyState);
    const totalUnits = Object.values(state.supplyState.stock).reduce((sum, count) => sum + count, 0);
    const lightsOwned = state.supplyState.stock["clip-grow-light"] || 0;
    const lightsAvailable = availableClipGrowLightCount(state.supplyState);
    if (ui.supplySummary) {
      const reserve = reservedShopCoins();
      const unitCopy = `${totalUnits} supply ${totalUnits === 1 ? "unit is" : "units are"} on the shelf.`;
      const lightCopy = lightsOwned === 1
        ? `${lightsAvailable} of 1 clip grow light is free.`
        : `${lightsAvailable} of ${lightsOwned} clip grow lights are free.`;
      ui.supplySummary.textContent = `${unitCopy} ${lightCopy} You have ${state.coins} coins.${reserve ? ` ${reservedCostCopy(reserve)}.` : ""} Care items also work as optional customer add-ons.`;
    }
    if (ui.supplyStatus) {
      ui.supplyStatus.textContent = run.supplyMessage;
      ui.supplyStatus.dataset.tone = /added|treated|assigned|returned|fed|sold/i.test(run.supplyMessage) ? "success" : "";
    }

    ui.supplyCatalog.replaceChildren();
    SUPPLY_CATALOG.forEach((item) => {
      const validation = validateSupplyPurchase({
        id: item.id,
        supplyState: state.supplyState,
        coins: state.coins,
        reservedCoins: reservedShopCoins(),
      });
      const stock = state.supplyState.stock[item.id] || 0;
      const button = document.createElement("button");
      button.type = "button";
      button.style.setProperty("--supply-accent", supplyAccentColors[item.id] || "#d9b85f");
      button.setAttribute("aria-disabled", String(!validation.ok));
      button.title = validation.ok ? item.copy : validation.message;
      const name = document.createElement("strong");
      name.textContent = item.title;
      const meta = document.createElement("small");
      meta.textContent = `${item.category} · ${stock}/${item.maxStock} in stock`;
      const action = document.createElement("small");
      action.textContent = validation.ok
        ? `${validation.firstPurchase ? "Buy" : "Restock"} ${validation.quantity} · ${validation.price} coins. ${item.copy}`
        : `${validation.message} ${item.copy}`;
      button.append(name, meta, action);
      button.addEventListener("click", () => buySupplyItem(item.id));
      ui.supplyCatalog.append(button);
    });

    ui.supplyPlant.replaceChildren();
    ui.supplyActions.replaceChildren();
    const plant = selectedSupplyPlant();
    if (!plant) {
      const empty = document.createElement("p");
      empty.className = "supply-empty";
      empty.textContent = "Choose a plant in the shop. Then return here to add light, fertilizer, or the correct treatment.";
      ui.supplyPlant.append(empty);
      return;
    }

    const heading = document.createElement("h4");
    heading.textContent = plant.species;
    const detail = document.createElement("p");
    const issueCopy = plant.healthIssue
      ? `${plant.healthIssueSeverity || "mild"} ${plant.healthIssue}`
      : "no mites or fungus";
    detail.textContent = `${conditionOf(plant).label} · ${lightFit(plant).label} · ${issueCopy} · ${plant.growthPoints || 0}/6 growth`;
    ui.supplyPlant.append(heading, detail);

    const clipOwned = state.supplyState.stock["clip-grow-light"] || 0;
    const clipAssigned = Boolean(plant.clipGrowLightAssigned);
    const spec = speciesOf(plant);
    const currentFit = lightFit(plant);
    const assistedFit = lightFit({ ...plant, clipGrowLightAssigned: true });
    const clipUseful = clipAssigned
      || (spec.preferredLight !== "shade"
        && (currentFit.level === "unplaced" || assistedFit.assisted === true));
    const clipEnabled = clipAssigned || (clipUseful && lightsAvailable > 0);
    ui.supplyActions.append(supplyActionButton({
      title: clipAssigned ? "Return clip grow light" : "Assign clip grow light",
      itemId: "clip-grow-light",
      enabled: clipEnabled,
      copy: clipAssigned
        ? "Return this reusable lamp to the shelf."
        : !clipUseful
          ? "A lamp cannot improve this plant here. Move it away from excess light, or use its ideal display."
          : lightsAvailable > 0
            ? `Use one of ${lightsAvailable} available lamps to create enough light.`
            : clipOwned ? "Every clip grow light is already assigned." : "Buy a clip grow light first.",
      onClick: () => toggleClipGrowLight(plant),
    }));

    const fertilizerValidation = validatePlantFertilizer({ plant, day: state.day });
    const fertilizerStock = state.supplyState.stock.fertilizer || 0;
    ui.supplyActions.append(supplyActionButton({
      title: "Use gentle fertilizer",
      itemId: "fertilizer",
      enabled: fertilizerValidation.ok && fertilizerStock > 0,
      copy: fertilizerStock <= 0
        ? "Buy fertilizer first."
        : fertilizerValidation.ok ? fertilizerValidation.message : fertilizerValidation.message,
      onClick: () => useFertilizerOnPlant(plant),
    }));

    if (plant.healthIssue) {
      const treatmentId = treatmentForIssue(plant.healthIssue);
      const treatment = supplyItemForId(treatmentId);
      const treatmentStock = state.supplyState.stock[treatmentId] || 0;
      const treatmentValidation = validatePlantTreatment({ plant, treatmentId, day: state.day });
      ui.supplyActions.append(supplyActionButton({
        title: `Treat ${plant.healthIssue}`,
        itemId: treatmentId,
        enabled: treatmentValidation.ok && treatmentStock > 0,
        copy: treatmentStock > 0
          ? `Use 1 ${treatment?.title || "treatment"}. Yellow leaves and visible signs will recover.`
          : `Buy ${treatment?.title || "the correct treatment"} first.`,
        onClick: () => treatPlantHealthIssue(plant, treatmentId),
      }));
    } else {
      ui.supplyActions.append(supplyActionButton({
        title: "No treatment needed",
        itemId: "fungicide",
        enabled: false,
        copy: "This plant has no mites or fungus.",
        onClick: () => {},
      }));
    }
  }

  function buySupplyItem(id) {
    const result = purchaseSupply({
      id,
      supplyState: state.supplyState,
      coins: state.coins,
      reservedCoins: reservedShopCoins(),
    });
    if (!result.ok) {
      run.supplyMessage = result.message;
      sound("error");
      renderSupplyShelf();
      return;
    }
    state.supplyState = result.supplyState;
    state.coins = result.coins;
    run.supplyMessage = `${result.item.title} added to the retail shelf. ${result.stockAfter} now in stock.`;
    save();
    sound("upgrade");
    renderSupplyShelf();
    updateUi();
  }

  function replacePlantRecord(nextPlant) {
    const index = state.inventory.findIndex((plant) => plant.id === nextPlant.id);
    if (index >= 0) state.inventory[index] = nextPlant;
  }

  function toggleClipGrowLight(plant) {
    if (plant.clipGrowLightAssigned) {
      const released = releaseSupplyClipGrowLight({ supplyState: state.supplyState, plantId: plant.id });
      const unmarked = markClipGrowLightRemoved(plant);
      if (!released.ok || !unmarked.ok) {
        run.supplyMessage = released.message || unmarked.message;
        sound("error");
        renderSupplyShelf();
        return;
      }
      state.supplyState = released.supplyState;
      replacePlantRecord(unmarked.plant);
      run.supplyMessage = `Clip grow light returned. ${released.availableCount} are now available.`;
    } else {
      const assigned = assignSupplyClipGrowLight({ supplyState: state.supplyState, plantId: plant.id });
      if (!assigned.ok) {
        run.supplyMessage = assigned.message;
        sound("error");
        renderSupplyShelf();
        return;
      }
      const marked = markClipGrowLightAssigned({
        plant,
        assignedCount: assigned.assignedCount - 1,
        maxAssignments: assigned.totalOwned,
        day: state.day,
      });
      if (!marked.ok) {
        run.supplyMessage = marked.message;
        sound("error");
        renderSupplyShelf();
        return;
      }
      state.supplyState = assigned.supplyState;
      replacePlantRecord(marked.plant);
      run.supplyMessage = `Clip grow light assigned to ${plant.species}. It now supplies missing light on a dim display.`;
    }
    rebuildPlants();
    save();
    sound("upgrade");
    renderSupplyShelf();
    updateUi();
  }

  function useFertilizerOnPlant(plant) {
    const applied = applyPlantFertilizer({ plant, day: state.day });
    if (!applied.ok) {
      run.supplyMessage = applied.message;
      sound("error");
      renderSupplyShelf();
      return;
    }
    const consumed = consumeSupply({ id: "fertilizer", supplyState: state.supplyState });
    if (!consumed.ok) {
      run.supplyMessage = consumed.message;
      sound("error");
      renderSupplyShelf();
      return;
    }
    state.supplyState = consumed.supplyState;
    const fertilizerCost = supplyItemForId("fertilizer")?.unitCost || 0;
    replacePlantRecord({
      ...applied.plant,
      acquisitionCost: (Number(plant.acquisitionCost) || 0) + fertilizerCost,
    });
    run.supplyMessage = `${plant.species} was fed. ${applied.message}`;
    if (applied.effect === "juvenile-matured") rebuildPlants();
    else burst(plantObjects.get(plant.id)?.position.clone().add(new THREE.Vector3(0, 0.8, 0)) || new THREE.Vector3(), 0x8fb66c, 14);
    save();
    sound("upgrade");
    renderSupplyShelf();
    updateUi();
  }

  function treatPlantHealthIssue(plant, treatmentId) {
    const applied = applyPlantTreatment({ plant, treatmentId, day: state.day });
    if (!applied.ok) {
      run.supplyMessage = applied.message;
      sound("error");
      renderSupplyShelf();
      return;
    }
    const consumed = consumeSupply({ id: treatmentId, supplyState: state.supplyState });
    if (!consumed.ok) {
      run.supplyMessage = consumed.message;
      sound("error");
      renderSupplyShelf();
      return;
    }
    state.supplyState = consumed.supplyState;
    const treatmentCost = supplyItemForId(treatmentId)?.unitCost || 0;
    replacePlantRecord({
      ...applied.plant,
      acquisitionCost: (Number(plant.acquisitionCost) || 0) + treatmentCost,
    });
    const object = plantObjects.get(plant.id);
    if (object) burst(object.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 0x79a995, 18);
    run.supplyMessage = `${plant.species} was treated. The visible ${plant.healthIssue} signs will now fade.`;
    save();
    sound("mist");
    renderSupplyShelf();
    updateUi();
  }

  function renderUpgrades() {
    if (!ui.upgradeOptions) return;
    ui.upgradeOptions.replaceChildren();
    const upgrades = [
      {
        key: "growLamp",
        title: "Secondhand grow lamp",
        ownedTitle: "Grow lamp installed",
        copy: "Improves every new Care Bench job: more Repot value, longer Rehabilitate protection, and faster Propagate growth.",
        ownedCopy: "Its honey light now supports every new Care Bench job.",
        coins: 50,
        bloom: 10,
        objectName: "grow-lamp",
        message: "The grow lamp hums awake. Even the fern looks impressed.",
      },
      {
        key: "rainBarrel",
        title: "Little rain barrel",
        ownedTitle: "Rain barrel installed",
        copy: "Makes every plant dry out 35% more slowly.",
        ownedCopy: "Collected rain keeps every pot comfortable for longer.",
        coins: 45,
        bloom: 8,
        objectName: "rain-barrel",
        message: "The rain barrel is ready. Every plant exhales at once.",
      },
      {
        key: "deliveryRack",
        title: "Nursery delivery rack",
        ownedTitle: "Delivery rack installed",
        copy: "Raises shop capacity from 12 plants to 16.",
        ownedCopy: "Four more plants can wait safely between sales.",
        coins: 90,
        bloom: 18,
        objectName: "delivery-rack",
        message: "The new rack adds four real stock spaces to the room.",
      },
      {
        key: "benchShelf",
        title: "Second bench shelf",
        ownedTitle: "Bench shelf installed",
        copy: "Runs two Repot or Propagate jobs at the same time.",
        ownedCopy: "Two Repot or Propagate jobs can now run together.",
        coins: 75,
        bloom: 20,
        objectName: "bench-shelf",
        message: "The Care Bench now has room for two Repot or Propagate jobs.",
      },
      {
        key: "rehabilitationRack",
        title: "Recovery trolley",
        ownedTitle: "Recovery trolley installed",
        copy: "Adds a third Rehabilitation place at the separate Recovery Station.",
        ownedCopy: "Three nursery-stressed plants can now recover at the same time.",
        coins: 85,
        bloom: 22,
        objectName: "rehabilitation-rack",
        message: "The Recovery Station now has a third Rehabilitation place.",
      },
      {
        key: "shopSign",
        title: "Hand-painted shop sign",
        ownedTitle: "Shop sign installed",
        copy: "Brings one extra visitor from the next morning onward.",
        ownedCopy: "The brighter sign brings one extra daily visitor.",
        coins: 110,
        bloom: 30,
        objectName: "shop-sign-upgrade",
        message: "The new sign turns a few more heads on the street.",
      },
    ];
    const addCard = (upgrade) => {
      const owned = Boolean(state.upgrades[upgrade.key]);
      const card = document.createElement("article");
      card.className = "upgrade-card";
      const heading = document.createElement("h3");
      heading.textContent = owned ? upgrade.ownedTitle : upgrade.title;
      const detail = document.createElement("p");
      const costCopy = `${upgrade.coins} coins · ${upgrade.bloom} Bloom`;
      detail.textContent = owned ? upgrade.ownedCopy : `${costCopy} · ${upgrade.copy}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-primary upgrade-buy";
      button.textContent = owned ? "Already installed" : `Install · ${costCopy}`;
      button.disabled = owned;
      button.addEventListener("click", () => buyUpgrade(upgrade));
      const actions = document.createElement("div");
      actions.className = "upgrade-actions";
      actions.append(button);
      card.append(heading, detail, actions);
      ui.upgradeOptions.append(card);
    };
    upgrades.forEach(addCard);
    renderExpansionOptions();
    renderOwnedImprovements(upgrades);
    renderProjectPanel();
  }

  function renderOwnedImprovements(upgrades) {
    if (!ui.ownedImprovementOptions) return;
    ui.ownedImprovementOptions.replaceChildren();
    const ownedFixtures = upgrades.filter((upgrade) => state.upgrades[upgrade.key]).map((upgrade) => ({
      id: upgrade.key,
      title: upgrade.ownedTitle,
      effect: upgrade.ownedCopy,
      refund: improvementResaleValue(upgrade),
      remove: () => sellUpgrade(upgrade),
    }));
    const ownedExpansions = SHOP_EXPANSIONS.filter((expansion) => hasExpansion(expansion.id)).map((expansion) => ({
      id: expansion.id,
      title: expansion.title,
      effect: expansion.effectLabel,
      refund: expansionResaleValue(expansion.id),
      remove: () => sellShopExpansion(expansion.id),
    }));
    const owned = [...ownedFixtures, ...ownedExpansions];
    if (ui.ownedImprovementsCount) ui.ownedImprovementsCount.textContent = `${owned.length} placed`;
    if (!owned.length) {
      const empty = document.createElement("p");
      empty.className = "owned-improvements-empty";
      empty.textContent = "You have no removable improvements yet.";
      ui.ownedImprovementOptions.append(empty);
      return;
    }
    owned.forEach((item) => {
      const card = document.createElement("article");
      card.className = "upgrade-card improvement-card is-managed";
      card.dataset.improvementId = item.id;
      const copy = document.createElement("div");
      copy.className = "improvement-card-copy";
      const heading = document.createElement("h3");
      heading.textContent = item.title;
      const effect = document.createElement("p");
      effect.textContent = item.effect;
      copy.append(heading, effect);
      const footer = document.createElement("div");
      footer.className = "improvement-card-actions";
      const refund = document.createElement("span");
      refund.className = "improvement-refund";
      refund.textContent = `${item.refund.coins} coin refund · no Bloom`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button improvement-remove-button";
      remove.dataset.improvementAction = "remove";
      remove.dataset.improvementId = item.id;
      remove.textContent = "Sell and remove";
      remove.addEventListener("click", item.remove);
      footer.append(refund, remove);
      card.append(copy, footer);
      ui.ownedImprovementOptions.append(card);
    });
  }

  function renderExpansionOptions() {
    if (!ui.expansionOptions) return;
    ui.expansionOptions.replaceChildren();
    const calendar = calendarForDay(state.day);
    const ownedCount = SHOP_EXPANSIONS.filter((expansion) => hasExpansion(expansion.id)).length;
    if (ui.expansionProgress) ui.expansionProgress.textContent = `${ownedCount}/${SHOP_EXPANSIONS.length} added`;

    SHOP_EXPANSIONS.forEach((expansion) => {
      const owned = hasExpansion(expansion.id);
      const validation = validateExpansionPurchase({
        id: expansion.id,
        week: calendar.week,
        state: state.expansionState,
        coins: state.coins,
        bloom: state.bloom,
        reservedCoins: reservedShopCoins(),
      });
      const locked = validation.code === "locked";
      const card = document.createElement("article");
      card.className = `upgrade-card expansion-card${owned ? " is-owned" : ""}${locked ? " is-locked" : ""}`;
      const kicker = document.createElement("span");
      kicker.className = "expansion-card-kicker";
      kicker.textContent = expansion.category;
      const heading = document.createElement("h3");
      heading.textContent = expansion.title;
      const effect = document.createElement("p");
      effect.className = "expansion-effect";
      effect.textContent = expansion.effectLabel;
      const detail = document.createElement("p");
      detail.textContent = expansion.copy;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-primary upgrade-buy";
      const costCopy = `${expansion.cost.coins} coins · ${expansion.cost.bloom} Bloom`;
      button.textContent = owned
        ? "Added to the shop ✓"
        : locked
          ? `Unlocks in Week ${expansion.unlockWeek}`
          : validation.ok
            ? `Add · ${costCopy}`
            : validation.message;
      button.disabled = !validation.ok;
      button.addEventListener("click", () => buyExpansion(expansion.id));
      const actions = document.createElement("div");
      actions.className = "upgrade-actions";
      actions.append(button);
      card.append(kicker, heading, effect, detail, actions);
      ui.expansionOptions.append(card);
    });
  }

  function buyExpansion(id) {
    const result = purchaseExpansion({
      id,
      week: calendarForDay(state.day).week,
      state: state.expansionState,
      coins: state.coins,
      bloom: state.bloom,
      reservedCoins: reservedShopCoins(),
    });
    if (!result.ok) {
      sound("error");
      toast(result.message);
      renderExpansionOptions();
      return;
    }
    state.expansionState = result.state;
    state.coins = result.coins;
    state.bloom = result.bloom;
    if (id === "display-shelves") {
      const requiredCapacity = INVENTORY_CAPACITY + (state.upgrades.deliveryRack ? 4 : 0) + 4;
      state.inventoryCapacity = Math.max(requiredCapacity, state.inventoryCapacity);
      rebuildPlants();
      updateSlotGlow();
    }
    const object = world.getObjectByName(result.expansion.objectName);
    if (object) object.visible = true;
    save();
    sound("upgrade");
    toast(`${result.expansion.title} is now in the shop. ${result.expansion.effectLabel}.`, 4300);
    renderUpgrades();
    updateUi();
  }

  function sellShopExpansion(id) {
    const expansion = SHOP_EXPANSIONS.find((item) => item.id === id);
    if (!expansion || !hasExpansion(id)) return;
    if (id === "display-shelves") {
      const nextCapacity = INVENTORY_CAPACITY + (state.upgrades.deliveryRack ? 4 : 0);
      const committedStock = state.inventory.length + (state.crateQueue?.length || 0);
      if (committedStock > nextCapacity) {
        sound("error");
        toast(`Sell, rehome, or unpack ${committedStock - nextCapacity} committed plants before removing Display Shelves.`);
        return;
      }
      state.inventory.forEach((plant) => {
        if (SLOT_DATA[plant.slot]?.requiresExpansion === "display-shelves") plant.slot = null;
      });
      state.inventoryCapacity = nextCapacity;
    }
    const result = sellExpansion({ id, state: state.expansionState, coins: state.coins, bloom: state.bloom });
    if (!result.ok) {
      sound("error");
      toast(result.message);
      return;
    }
    state.expansionState = result.state;
    state.coins = result.coins;
    state.bloom = result.bloom;
    const object = world.getObjectByName(expansion.objectName);
    if (object) object.visible = false;
    rebuildPlants();
    updateSlotGlow();
    save();
    sound("coin");
    toast(`${expansion.title} was removed. You received ${result.refund.coins} coins.`);
    renderUpgrades();
    updateUi();
  }

  function renderProjectPanel() {
    if (!ui.projectPanel) return;
    const calendar = calendarForDay(state.day);
    const project = projectForWeek(calendar.week, state.projectState);
    const total = Math.max(0, Number(state.projectState?.total) || 0);
    ui.projectPanel.classList.toggle("is-funded", Boolean(project?.funded));
    if (!project) {
      if (ui.projectTitle) ui.projectTitle.textContent = "Weekly shop projects";
      if (ui.projectCopy) ui.projectCopy.textContent = `Projects unlock in Week ${SHOP_PROJECT_START_WEEK}. They give coins and Bloom a lasting use without changing the gentle opening weeks.`;
      if (ui.projectProgress) ui.projectProgress.textContent = `${total} ${total === 1 ? "project" : "projects"} funded`;
      if (ui.projectFund) {
        ui.projectFund.disabled = true;
        ui.projectFund.textContent = `Locked until Week ${SHOP_PROJECT_START_WEEK}`;
      }
      return;
    }
    const validation = validateProjectFunding({
      week: calendar.week,
      projectState: state.projectState,
      coins: discretionaryCoins(),
      bloom: state.bloom,
    });
    if (ui.projectTitle) ui.projectTitle.textContent = project.title;
    if (ui.projectCopy) ui.projectCopy.textContent = `${project.copy} Each time this project returns, its display grows a little richer.`;
    if (ui.projectProgress) {
      const count = Math.max(0, Number(state.projectState?.counts?.[project.id]) || 0);
      ui.projectProgress.textContent = project.funded
        ? `Funded this week · ${total} total projects · ${count} ${project.title} ${count === 1 ? "stage" : "stages"}`
        : `${project.cost.coins} coins + ${project.cost.bloom} Bloom · ${total} projects funded so far`;
    }
    if (ui.projectFund) {
      ui.projectFund.disabled = !validation.ok;
      ui.projectFund.textContent = project.funded
        ? "Funded this week ✓"
        : validation.code === "insufficient-resources"
          ? validation.message
          : `Fund ${project.title}`;
    }
  }

  function fundCurrentProject() {
    const calendar = calendarForDay(state.day);
    const spendableValidation = validateProjectFunding({
      week: calendar.week,
      projectState: state.projectState,
      coins: discretionaryCoins(),
      bloom: state.bloom,
    });
    if (!spendableValidation.ok) {
      sound("error");
      const reserve = reservedShopCoins();
      toast(reserve && spendableValidation.code === "insufficient-resources"
        ? `${reservedCostCopy(reserve)}. ${spendableValidation.message}`
        : spendableValidation.message);
      renderProjectPanel();
      return;
    }
    const result = fundWeeklyProject({
      week: calendar.week,
      projectState: state.projectState,
      coins: state.coins,
      bloom: state.bloom,
    });
    if (!result.ok) {
      sound("error");
      toast(result.message);
      renderProjectPanel();
      return;
    }
    state.projectState = result.projectState;
    state.coins = result.coins;
    state.bloom = result.bloom;
    const object = world.getObjectByName(result.project?.objectName);
    if (object) {
      object.visible = true;
      const count = Math.max(1, Number(state.projectState.counts[result.project.id]) || 1);
      object.scale.setScalar(1 + Math.min(0.18, (count - 1) * 0.035));
    }
    save();
    sound("upgrade");
    toast(`${result.message} ${result.cost.coins} coins and ${result.cost.bloom} Bloom funded a lasting shop change.`, 4800);
    renderProjectPanel();
    updateUi();
  }

  function buyUpgrade(upgrade) {
    if (!upgrade || state.upgrades[upgrade.key]) return;
    const missingCoins = Math.max(0, upgrade.coins - discretionaryCoins());
    const missingBloom = Math.max(0, upgrade.bloom - state.bloom);
    if (missingCoins || missingBloom) {
      sound("error");
      const needs = [
        missingCoins ? `${missingCoins} more coins` : "",
        missingBloom ? `${missingBloom} more Bloom` : "",
      ].filter(Boolean).join(" and ");
      const reserve = reservedShopCoins();
      toast(`${reserve ? `${reservedCostCopy(reserve)}. ` : ""}This upgrade needs ${needs}.`);
      return;
    }
    state.coins -= upgrade.coins;
    state.bloom -= upgrade.bloom;
    state.upgrades[upgrade.key] = true;
    if (upgrade.key === "deliveryRack") {
      const requiredCapacity = INVENTORY_CAPACITY + 4 + (hasExpansion("display-shelves") ? 4 : 0);
      state.inventoryCapacity = Math.max(requiredCapacity, state.inventoryCapacity);
      rebuildPlants();
    }
    if (upgrade.key === "benchShelf") {
      state.benchState = { ...migrateBenchState(state.benchState), slotCount: 2 };
    }
    if (upgrade.key === "rehabilitationRack") {
      state.benchState = {
        ...migrateBenchState(state.benchState),
        rehabilitationSlotCount: REHABILITATION_UPGRADE_SLOTS,
      };
    }
    const object = world.getObjectByName(upgrade.objectName);
    if (object) object.visible = true;
    save();
    sound("upgrade");
    toast(upgrade.message);
    renderUpgrades();
    if (ui.benchModal && !ui.benchModal.hidden) renderBench();
    updateUi();
  }

  function improvementResaleValue(upgrade) {
    return {
      coins: Math.floor((upgrade?.coins || 0) * 0.5),
      bloom: 0,
    };
  }

  function sellUpgrade(upgrade) {
    if (!upgrade || !state.upgrades[upgrade.key]) return;
    if (upgrade.key === "deliveryRack") {
      const nextCapacity = INVENTORY_CAPACITY + (hasExpansion("display-shelves") ? 4 : 0);
      const committedStock = state.inventory.length + (state.crateQueue?.length || 0);
      if (committedStock > nextCapacity) {
        sound("error");
        toast(`Sell, rehome, or unpack ${committedStock - nextCapacity} committed plants before removing the Delivery Rack.`);
        return;
      }
      state.inventoryCapacity = nextCapacity;
    }
    const savedBenchJobs = migrateBenchState(state.benchState).jobs;
    const careBenchJobCount = savedBenchJobs.filter((job) => job.type !== BENCH_JOB_TYPES.REHABILITATE).length;
    const rehabilitationJobCount = savedBenchJobs.filter((job) => job.type === BENCH_JOB_TYPES.REHABILITATE).length;
    if (upgrade.key === "benchShelf" && careBenchJobCount > CARE_BENCH_BASE_SLOTS) {
      sound("error");
      toast("Wait until only one Repot or Propagate job remains before selling the second shelf.");
      return;
    }
    if (upgrade.key === "rehabilitationRack" && rehabilitationJobCount > REHABILITATION_BASE_SLOTS) {
      sound("error");
      toast("Wait until only two Rehabilitation jobs remain before selling the Recovery trolley.");
      return;
    }
    const refund = improvementResaleValue(upgrade);
    state.upgrades[upgrade.key] = false;
    state.coins += refund.coins;
    state.bloom += refund.bloom;
    if (upgrade.key === "benchShelf") {
      state.benchState = { ...migrateBenchState(state.benchState), slotCount: CARE_BENCH_BASE_SLOTS };
    }
    if (upgrade.key === "rehabilitationRack") {
      state.benchState = {
        ...migrateBenchState(state.benchState),
        rehabilitationSlotCount: REHABILITATION_BASE_SLOTS,
      };
    }
    const object = world.getObjectByName(upgrade.objectName);
    if (object) object.visible = false;
    rebuildPlants();
    save();
    sound("coin");
    toast(`${upgrade.ownedTitle} was removed. You received ${refund.coins} coins.`);
    renderUpgrades();
    if (ui.benchModal && !ui.benchModal.hidden) renderBench();
    updateUi();
  }

  function currentCustomer() {
    return state.customers?.[state.customerIndex] || null;
  }

  function currentCustomerAddOn(person = currentCustomer()) {
    if (!person || state.day < 3) return null;
    return generateCustomerAddOnRequest({
      day: state.day,
      customer: person,
      plantId: "shop-supply-request",
      saleIndex: state.customerIndex,
    });
  }

  function renderWeeklyPlan() {
    state.neighborhoodState = migrateNeighborhoodState(state.neighborhoodState, { day: state.day, inventory: state.inventory });
    const event = state.neighborhoodState.event;
    const order = state.neighborhoodState.order;
    const heldCount = order?.status === ORDER_STATUS.COMPLETED
      ? order.quantity
      : order?.heldPlantIds?.length || 0;
    if (ui.weeklyEventTitle) ui.weeklyEventTitle.textContent = event?.title || "A quiet week";
    if (ui.weeklyEventCopy) ui.weeklyEventCopy.textContent = event?.copy || "Regular demand in the shop.";
    if (ui.weeklyOrderStripTitle) ui.weeklyOrderStripTitle.textContent = order
      ? order.status === ORDER_STATUS.OFFERED ? "New order available" : order.title
      : "Orders begin in Week 2";
    if (ui.weeklyOrderStripProgress) ui.weeklyOrderStripProgress.textContent = order
      ? `${heldCount}/${order.quantity} held`
      : "0/0 held";
    if (ui.weeklyOrderStripDeadline) ui.weeklyOrderStripDeadline.textContent = order
      ? order.status === ORDER_STATUS.COMPLETED ? "Collected" : `Due Day ${order.deadlineDay}`
      : "No deadline";
    if (ui.weeklyOrderButton) {
      ui.weeklyOrderButton.disabled = !order;
      ui.weeklyOrderButton.classList.toggle("is-active", order?.status === ORDER_STATUS.ACTIVE);
    }
    const specialistStationSelected = run.started
      && run.selected?.kind === "station"
      && run.selected.id === "rehabilitation-station";
    if (ui.rehabilitationStationLabel) ui.rehabilitationStationLabel.hidden = !specialistStationSelected;
    if (ui.rehabilitationStationStatus) {
      const rehabilitationCount = state.benchState?.jobs?.filter((job) => job.type === BENCH_JOB_TYPES.REHABILITATE).length || 0;
      const propagationCount = state.benchState?.jobs?.filter((job) => job.type === BENCH_JOB_TYPES.PROPAGATE).length || 0;
      const count = rehabilitationCount + propagationCount;
      ui.rehabilitationStationStatus.textContent = count
        ? `${rehabilitationCount} in Recovery · ${propagationCount} on the cutting rack`
        : "No recovery or propagation work is active";
    }
  }

  function renderWeeklyOrder() {
    if (!ui.weeklyOrderHeldList || !ui.weeklyOrderAvailableList) return;
    renderWeeklyPlan();
    const order = state.neighborhoodState.order;
    const heldIds = new Set(order?.heldPlantIds || []);
    const heldPlants = state.inventory.filter((plant) => heldIds.has(plant.id));
    const status = order?.status || "locked";
    const labels = {
      offered: "New offer",
      active: "Active",
      completed: "Complete",
      declined: "Declined",
      missed: "Missed",
      locked: "Locked",
    };
    if (ui.weeklyOrderOfferState) {
      ui.weeklyOrderOfferState.textContent = labels[status] || status;
      ui.weeklyOrderOfferState.dataset.state = status;
    }
    if (ui.weeklyOrderCustomer) ui.weeklyOrderCustomer.textContent = order?.customerName || "Neighborhood orders";
    if (ui.weeklyOrderOfferName) ui.weeklyOrderOfferName.textContent = order?.title || "Orders begin in Week 2";
    if (ui.weeklyOrderRequest) ui.weeklyOrderRequest.textContent = order
      ? `Hold ${order.quantity} healthy ${order.requiredTrait} plants. Held plants cannot be sold to daily visitors.`
      : "Build the shop through the opening week first.";
    if (ui.weeklyOrderDeadline) ui.weeklyOrderDeadline.textContent = order ? `Day ${order.deadlineDay} · Friday` : "No deadline";
    if (ui.weeklyOrderDeposit) ui.weeklyOrderDeposit.textContent = order ? `${order.deposit} coins` : "0 coins";
    if (ui.weeklyOrderReward) ui.weeklyOrderReward.textContent = order ? `${order.rewardCoins} coins · ${order.rewardBloom} Bloom` : "0 coins · 0 Bloom";
    const heldCount = status === ORDER_STATUS.COMPLETED
      ? order.quantity
      : heldPlants.length;
    if (ui.weeklyOrderProgressCopy) ui.weeklyOrderProgressCopy.textContent = order
      ? `${heldCount}/${order.quantity} plants held`
      : "No plants are held.";
    if (ui.weeklyOrderProgress) {
      ui.weeklyOrderProgress.max = order?.quantity || 1;
      ui.weeklyOrderProgress.value = heldCount;
    }
    const daysLeft = order ? order.deadlineDay - state.day : 0;
    if (ui.weeklyOrderDeadlineChip) {
      ui.weeklyOrderDeadlineChip.textContent = order ? `${Math.max(0, daysLeft)} ${Math.abs(daysLeft) === 1 ? "day" : "days"} left` : "No order";
      ui.weeklyOrderDeadlineChip.classList.toggle("is-urgent", Boolean(order && daysLeft <= 1 && status === ORDER_STATUS.ACTIVE));
    }
    ui.weeklyOrderAvailableList.replaceChildren();
    const baseCandidates = status === ORDER_STATUS.ACTIVE
      ? state.inventory
        .filter((plant) => !heldIds.has(plant.id))
        .map((plant) => ({
          plant,
          base: validateOrderPlant({ state: state.neighborhoodState, plant, day: state.day }),
        }))
        .filter(({ base }) => base.ok)
      : [];
    if (!baseCandidates.length) {
      const empty = document.createElement("p");
      empty.className = "held-stock-empty";
      empty.textContent = status === ORDER_STATUS.OFFERED
        ? "Accept the offer to see matching shop plants."
        : status === ORDER_STATUS.ACTIVE && heldCount >= (order?.quantity || 1)
          ? "Enough plants are held for this order."
          : status === ORDER_STATUS.ACTIVE
            ? `No ready ${order?.requiredTrait || "matching"} plants are available. Care for one or find one in a delivery.`
            : status === ORDER_STATUS.COMPLETED
              ? "This order was collected."
              : "There is no active stock request.";
      ui.weeklyOrderAvailableList.append(empty);
    }
    baseCandidates.forEach(({ plant }) => {
      const validation = weeklyOrderPlantValidation(plant);
      const row = document.createElement("article");
      row.className = "held-stock-item order-available-item";
      const copy = document.createElement("div");
      copy.className = "held-stock-item-copy";
      const name = document.createElement("strong");
      name.textContent = plant.species;
      const detail = document.createElement("small");
      const condition = conditionOf(plant);
      detail.textContent = `${plant.traits.join(" · ")} · ${condition.label}`;
      copy.append(name, detail);
      if (!validation.ok) {
        const reason = document.createElement("small");
        reason.className = "order-stock-reason";
        reason.textContent = validation.message;
        copy.append(reason);
      }
      const hold = document.createElement("button");
      hold.type = "button";
      hold.className = "button order-hold-button";
      hold.textContent = validation.ok ? "Hold" : "Needed today";
      hold.setAttribute("aria-disabled", String(!validation.ok));
      hold.addEventListener("click", () => holdPlantForWeeklyOrder(plant.id));
      row.append(copy, hold);
      ui.weeklyOrderAvailableList.append(row);
    });

    ui.weeklyOrderHeldList.replaceChildren();
    if (!heldPlants.length) {
      const empty = document.createElement("p");
      empty.className = "held-stock-empty";
      empty.textContent = status === ORDER_STATUS.COMPLETED
        ? "The held plants were collected. This order is complete."
        : status === ORDER_STATUS.DECLINED
          ? "This offer was declined. No stock is reserved."
          : status === ORDER_STATUS.MISSED
            ? "The deadline passed. All held stock was released."
            : status === ORDER_STATUS.OFFERED
              ? "Accept the offer before you reserve any stock."
              : "No plants are held yet. Choose one from Available matches.";
      ui.weeklyOrderHeldList.append(empty);
    }
    heldPlants.forEach((plant) => {
      const row = document.createElement("article");
      row.className = "held-stock-item";
      const copy = document.createElement("div");
      copy.className = "held-stock-item-copy";
      const name = document.createElement("strong");
      name.textContent = plant.species;
      const detail = document.createElement("small");
      detail.textContent = `${plant.traits.join(" · ")} · held for ${order.customerName}`;
      copy.append(name, detail);
      const release = document.createElement("button");
      release.type = "button";
      release.className = "button held-stock-release";
      release.dataset.orderAction = "release";
      release.textContent = "Release";
      release.addEventListener("click", () => releaseHeldPlant(plant.id));
      row.append(copy, release);
      ui.weeklyOrderHeldList.append(row);
    });
    if (ui.completeWeeklyOrder) {
      ui.completeWeeklyOrder.disabled = status !== ORDER_STATUS.ACTIVE || heldCount < (order?.quantity || 1);
      ui.completeWeeklyOrder.textContent = status === ORDER_STATUS.COMPLETED ? "Order collected ✓" : "Complete order";
    }
    if (ui.acceptWeeklyOrder) ui.acceptWeeklyOrder.hidden = status !== ORDER_STATUS.OFFERED;
    if (ui.declineWeeklyOrder) ui.declineWeeklyOrder.hidden = status !== ORDER_STATUS.OFFERED;
    if (ui.weeklyOrderStatus) {
      ui.weeklyOrderStatus.textContent = order
        ? status === ORDER_STATUS.OFFERED ? "Accept the order to receive its deposit. It is optional."
          : status === ORDER_STATUS.ACTIVE ? `${heldCount}/${order.quantity} suitable plants are held.`
            : status === ORDER_STATUS.COMPLETED ? "This order was collected and paid in full."
              : status === ORDER_STATUS.DECLINED ? "This week has no order commitment."
                : "The deadline passed. Held stock returned to normal sale."
        : "Weekly orders unlock in Week 2.";
      ui.weeklyOrderStatus.dataset.tone = status === ORDER_STATUS.COMPLETED ? "success" : status === ORDER_STATUS.MISSED ? "warning" : "";
    }
  }

  function acceptCurrentWeeklyOrder() {
    const result = acceptWeeklyOrder({ state: state.neighborhoodState, day: state.day, coins: state.coins });
    if (!result.ok) return toast(result.message);
    state.neighborhoodState = result.state;
    state.coins = result.coins;
    state.dailyRevenue += result.deposit;
    addWeekStat("revenue", result.deposit);
    addWeekStat("profit", result.deposit);
    save();
    sound("coin");
    toast(result.message);
    renderWeeklyOrder();
    updateUi();
  }

  function declineCurrentWeeklyOrder() {
    const result = declineWeeklyOrder({ state: state.neighborhoodState, day: state.day });
    if (!result.ok) return toast(result.message);
    state.neighborhoodState = result.state;
    save();
    sound("hint");
    renderWeeklyOrder();
    updateUi();
  }

  function weeklyOrderPlantValidation(plant) {
    if (state.phase === "supply" || state.crates > 0 || run.crateAnimation) {
      return {
        ok: false,
        code: "shipment-first",
        message: "Choose and unpack today’s shipment before you reserve weekly-order stock.",
      };
    }
    const result = holdPlantForOrder({ state: state.neighborhoodState, plant, day: state.day });
    if (!result.ok) return result;
    const remainingCustomers = state.phase === "open"
      ? state.customers.slice(state.customerIndex)
      : state.customers;
    const afterHold = state.inventory.map((item) => item.id === plant.id ? { ...item, held: true } : item);
    if (!inventoryCoversCustomers(afterHold, remainingCustomers)) {
      return {
        ok: false,
        code: "needed-today",
        message: `${plant.species} is still needed for today’s visitor notes. Hold another ${result.state.order.requiredTrait} plant.`,
      };
    }
    return result;
  }

  function holdPlantForWeeklyOrder(plantId) {
    const plant = state.inventory.find((item) => item.id === plantId);
    const validation = weeklyOrderPlantValidation(plant);
    if (!validation.ok) {
      sound("error");
      toast(validation.message);
      return;
    }
    const result = holdPlantForOrder({ state: state.neighborhoodState, plant, day: state.day });
    if (!result.ok) {
      sound("error");
      toast(result.message);
      return;
    }
    state.neighborhoodState = result.state;
    plant.held = true;
    save();
    sound("upgrade");
    toast(result.message);
    renderWeeklyOrder();
    updateUi();
  }

  function releaseHeldPlant(plantId) {
    const result = releaseOrderPlant({ state: state.neighborhoodState, plantId, day: state.day, inventory: state.inventory });
    if (!result.ok) return toast(result.message);
    state.neighborhoodState = result.state;
    const plant = state.inventory.find((item) => item.id === plantId);
    if (plant) plant.held = false;
    save();
    sound("hint");
    renderWeeklyOrder();
    updateUi();
  }

  function completeCurrentWeeklyOrder() {
    const result = completeWeeklyOrder({ state: state.neighborhoodState, day: state.day, inventory: state.inventory, coins: state.coins, bloom: state.bloom });
    if (!result.ok) {
      sound("error");
      toast(result.message);
      return;
    }
    const soldIds = new Set(result.soldPlantIds);
    const soldPlants = state.inventory.filter((plant) => soldIds.has(plant.id));
    const costOfGoods = soldPlants.reduce((sum, plant) => sum + (Number(plant.acquisitionCost) || 0), 0);
    soldPlants.forEach((plant) => {
      if (plant.clipGrowLightAssigned) {
        const released = releaseSupplyClipGrowLight({ supplyState: state.supplyState, plantId: plant.id });
        if (released.ok) state.supplyState = released.supplyState;
      }
    });
    state.inventory = state.inventory.filter((plant) => !soldIds.has(plant.id));
    state.neighborhoodState = result.state;
    state.coins = result.coins;
    state.bloom = result.bloom;
    state.lifetimeBloom += result.bloomReward;
    state.dailySales += result.soldPlantIds.length;
    state.dailyRevenue += result.payout;
    state.dailyCostOfGoods += costOfGoods;
    addWeekStat("sales", result.soldPlantIds.length);
    addWeekStat("revenue", result.payout);
    addWeekStat("costOfGoods", costOfGoods);
    addWeekStat("profit", result.payout - costOfGoods);
    addWeekStat("bloom", result.bloomReward);
    if (!Array.isArray(state.weekStats.uniqueSpeciesSold)) state.weekStats.uniqueSpeciesSold = [];
    const soldSpeciesIds = [...new Set(soldPlants.map((plant) => plant.speciesId || speciesOf(plant).id))];
    soldSpeciesIds.forEach((speciesId) => {
      if (!state.weekStats.uniqueSpeciesSold.includes(speciesId)) state.weekStats.uniqueSpeciesSold.push(speciesId);
    });
    const completedOrder = state.neighborhoodState.order;
    const orderMemory = customerMemoryFor({ id: completedOrder.customerId, name: completedOrder.customerName });
    orderMemory.purchases += soldPlants.length;
    orderMemory.satisfaction += soldPlants.length * 3;
    orderMemory.lastVisitDay = state.day;
    orderMemory.lastOrderDay = state.day;
    orderMemory.lastOrderTitle = completedOrder.title;
    orderMemory.lastOrderQuantity = soldPlants.length;
    if (soldPlants.length) orderMemory.lastSpecies = soldPlants.at(-1).species;
    let weeklyRewardCopy = "";
    const orderMargin = completedOrder.deposit + result.payout - costOfGoods;
    [
      { metric: "plantsSold", value: soldPlants.length },
      { metric: "grossProfit", value: orderMargin },
      ...soldSpeciesIds.map((speciesId) => ({ metric: "uniqueSpeciesSold", value: 1, speciesId })),
    ].forEach((event) => {
      if (!event.value || weeklyRewardCopy) return;
      weeklyRewardCopy = advanceWeekGoal(event);
    });
    rebuildPlants();
    save();
    sound("sale");
    toast(`${result.message} +${result.payout} coins and +${result.bloomReward} Bloom.${weeklyRewardCopy}`, 4800);
    renderWeeklyOrder();
    updateUi();
  }

  function customerMemoryFor(person) {
    const id = person?.id || String(person?.name || "neighbor").toLowerCase();
    return state.customerMemory[id] || (state.customerMemory[id] = {
      visits: 0,
      purchases: 0,
      satisfaction: 0,
      lastVisitDay: 0,
      lastSpecies: null,
      lastPriceBand: null,
    });
  }

  function beginCustomerVisit(person) {
    if (!person) return;
    const memory = customerMemoryFor(person);
    if (memory.lastVisitDay === state.day) return;
    memory.visits += 1;
    memory.lastVisitDay = state.day;
    save();
  }

  function rememberCustomerSale(person, plant, satisfaction) {
    const memory = customerMemoryFor(person);
    memory.purchases += 1;
    memory.satisfaction += satisfaction;
    memory.lastSpecies = plant.species;
    memory.lastPriceBand = priceBandOf(plant);
    memory.lastVisitDay = state.day;
    return memory;
  }

  function createCustomer(person) {
    const root = createCharacter3D(person, state.day * 101 + state.customerIndex * 17);
    root.userData.entity = { kind: "customer", id: state.customerIndex };
    root.userData.ringY = 0;
    interactive.push(root);
    return root;
  }

  function stageCustomerCarry(plantObject) {
    const carry = run.customer?.userData?.rig?.carriedPlant;
    if (!carry || !plantObject) return;
    const liveLeaves = plantObject.userData.leaves;
    delete plantObject.userData.leaves;
    let model;
    try {
      model = plantObject.clone(true);
    } finally {
      plantObject.userData.leaves = liveLeaves;
    }
    model.traverse((child) => {
      child.userData = {};
    });
    const modelTop = Math.max(plantObject.userData.plantModelTop || plantObject.userData.modelTop || 1.4, 0.8);
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0.24, 0);
    model.scale.setScalar(0.78 / modelTop);
    carry.clear();
    carry.add(model);
  }

  function spawnCustomer(enter = true) {
    if (run.customer) unregister(run.customer, { dispose: true });
    run.customer = null;
    const person = currentCustomer();
    if (!person) {
      showReport();
      return;
    }
    beginCustomerVisit(person);
    const object = createCustomer(person);
    object.position.set(enter && !reduceMotion ? 6.2 : 0.15, 0, enter && !reduceMotion ? 4.45 : 3.32);
    object.rotation.y = enter && !reduceMotion ? -1.75 : 0.68;
    world.add(object);
    run.customer = object;
    run.customerTween = enter && !reduceMotion ? { mode: "enter", time: 0 } : null;
    run.busy = Boolean(run.customerTween);
    animateCharacter3D(object, {
      time: clock.elapsedTime,
      walking: Boolean(run.customerTween),
      carrying: false,
      reduceMotion,
    });
    updateUi();
  }

  function selectEntity(entity, object) {
    run.selected = { ...entity, object };
    document.body.dataset.selection = entity.kind;
    if (entity.kind === "plant") {
      run.deliveryOverviewPlantIds = [];
      const plant = state.inventory.find((item) => item.id === entity.id);
      if (plant && !plant.benchStatus) run.lastPlantId = plant.id;
      const comparingSwap = run.carried && run.carried !== plant?.id && (run.arranging || state.phase === "preparation");
      if (!comparingSwap) {
        run.carried = plant && !Number.isInteger(plant.slot) ? plant.id : null;
        if (!run.carried) run.moveOrigin = null;
      }
      sound("pluck");
    } else if (entity.kind !== "slot") {
      cancelMove();
    }
    updateSelectionRing();
    updateSlotGlow();
    updateUi();
  }

  function updateSelectionRing() {
    const ring = run.selectionRing;
    const object = run.selected?.object;
    if (!ring || !object || !object.parent) {
      if (ring) ring.visible = false;
      return;
    }
    ring.visible = true;
    const anchor = object.userData.selectionAnchor?.clone?.() || new THREE.Vector3();
    if (object === run.wateringCan && run.canAnimation) {
      anchor.add(run.canAnimation.homePosition);
    } else {
      object.localToWorld(anchor);
    }
    ring.position.set(anchor.x, anchor.y + 0.025, anchor.z);
    const pulse = run.selected.kind === "customer" ? 1.15 : 1;
    ring.scale.setScalar((object.userData.ringScale || 1) * pulse);
  }

  function stationTargetPlant() {
    const plant = state.inventory.find((item) => item.id === run.lastPlantId);
    return plant && !plant.benchStatus ? plant : null;
  }

  function openCareBenchFromRoom() {
    canvas.focus({ preventScroll: true });
    openModal(ui.benchModal, true);
  }

  function useWateringCan() {
    const plant = stationTargetPlant();
    if (!plant) {
      sound("hint");
      toast("Choose a plant first. Then return to the watering can.");
      return;
    }
    careForPlant("water", plant.id);
  }

  function doAction() {
    if (run.busy || !run.selected) return;
    const { kind, id } = run.selected;
    if (kind === "crate") unpackCrate();
    else if (kind === "plant") {
      const plant = state.inventory.find((item) => item.id === id);
      if (!plant) return;
      if (plant.benchStatus) {
        toast(`${plant.species} is busy at the care bench.`);
        return;
      }
      if (run.carried && run.carried !== plant.id && (run.arranging || state.phase === "preparation")) {
        swapPlants(run.carried, plant.id);
        return;
      }
      if (!Number.isInteger(plant.slot)) {
        const slot = firstFreeSlot(plant);
        if (slot === null) toast("Every display is full. A good problem, briefly.");
        else placePlant(plant.id, slot);
      } else if (run.arranging || state.phase === "preparation") {
        beginMove(plant);
      } else if (state.phase === "open") {
        offerPlant(plant);
      }
    } else if (kind === "customer") {
      const person = currentCustomer();
      toast(`${person.name} needs ${person.need}, would love ${person.bonusTrait}, and can spend ${person.budget} coins. Select a plant to recommend it.`, 4400);
      sound("hint");
    } else if (kind === "slot" && run.carried) {
      placePlant(run.carried, id);
    } else if (kind === "station") {
      if (id === "watering-can") useWateringCan();
      else if (id === "care-bench" || id === "rehabilitation-station" || id === "grow-lamp") openCareBenchFromRoom();
      else if (id === "supply-shelf") {
        canvas.focus({ preventScroll: true });
        openModal(ui.supplyModal, true);
      }
    }
  }

  function beginMove(plant) {
    if (!plant || plant.benchStatus) return;
    if (!Number.isInteger(plant.slot)) {
      run.carried = plant.id;
      run.moveOrigin = null;
      updateSlotGlow();
      updateUi();
      return;
    }
    run.moveOrigin = plant.slot;
    run.carried = plant.id;
    sound("pluck");
    toast(`Moving ${plant.species}. Green rings match its light; select another plant to swap.`);
    updateSlotGlow();
    updateUi();
  }

  function cancelMove() {
    if (!run.carried) {
      run.moveOrigin = null;
      return;
    }
    const plant = state.inventory.find((item) => item.id === run.carried);
    run.carried = null;
    run.moveOrigin = null;
    updateSlotGlow();
  }

  function swapPlants(carriedId, targetId) {
    const carried = state.inventory.find((plant) => plant.id === carriedId);
    const other = state.inventory.find((plant) => plant.id === targetId);
    if (!carried || !other || carried.benchStatus || other.benchStatus || !Number.isInteger(other.slot)) return;
    if (!slotIsActive(SLOT_DATA[other.slot])) return;
    if (!Number.isInteger(run.moveOrigin)) {
      const destinationIndex = other.slot;
      const destination = SLOT_DATA[destinationIndex];
      const carriedObject = plantObjects.get(carried.id);
      const otherObject = plantObjects.get(other.id);
      const looseCount = state.inventory.filter((plant) => !Number.isInteger(plant.slot)
        && plant.id !== carried.id
        && plant.id !== other.id).length;
      const bench = stagingPosition(looseCount);
      carried.slot = destinationIndex;
      other.slot = null;
      if (carriedObject) queueMover({
        object: carriedObject,
        from: carriedObject.position.clone(),
        to: new THREE.Vector3(destination.x, destination.y, destination.z),
        startScale: carriedObject.scale.x,
        endScale: scaleForSlot(carriedObject, destination),
        time: 0,
        duration: 0.5,
        arc: 0.62,
      });
      if (otherObject) queueMover({
        object: otherObject,
        from: otherObject.position.clone(),
        to: bench.clone(),
        startScale: otherObject.scale.x,
        endScale: looseScaleAt(bench, otherObject),
        time: 0,
        duration: 0.5,
        arc: 0.52,
      });
      const goalWon = evaluateDisplayGoal(carried, destination);
      run.carried = null;
      run.moveOrigin = null;
      run.selected = carriedObject ? { kind: "plant", id: carried.id, object: carriedObject } : null;
      save();
      sound(goalWon ? "upgrade" : "place");
      toast(goalWon
        ? `The bench swap completes the vignette. +${state.displayGoal.rewardCoins} coins and +${state.displayGoal.rewardBloom} Bloom.`
        : `${carried.species} takes the display; ${other.species} waits on the care bench.`);
      updateSlotGlow();
      updateUi();
      return;
    }
    const destinationIndex = other.slot;
    const originIndex = run.moveOrigin;
    const destination = SLOT_DATA[destinationIndex];
    const origin = SLOT_DATA[originIndex];
    const carriedObject = plantObjects.get(carried.id);
    const otherObject = plantObjects.get(other.id);
    carried.slot = destinationIndex;
    other.slot = originIndex;
    if (carriedObject) queueMover({
      object: carriedObject,
      from: carriedObject.position.clone(),
      to: new THREE.Vector3(destination.x, destination.y, destination.z),
      startScale: carriedObject.scale.x,
      endScale: scaleForSlot(carriedObject, destination),
      time: 0,
      duration: 0.5,
      arc: 0.62,
    });
    if (otherObject) queueMover({
      object: otherObject,
      from: otherObject.position.clone(),
      to: new THREE.Vector3(origin.x, origin.y, origin.z),
      startScale: otherObject.scale.x,
      endScale: scaleForSlot(otherObject, origin),
      time: 0,
      duration: 0.5,
      arc: 0.52,
    });
    const goalWon = evaluateDisplayGoal(carried, destination) || evaluateDisplayGoal(other, origin);
    run.carried = null;
    run.moveOrigin = null;
    run.selected = carriedObject ? { kind: "plant", id: carried.id, object: carriedObject } : null;
    save();
    sound(goalWon ? "upgrade" : "place");
    toast(goalWon
      ? `A clever swap completes the vignette. +${state.displayGoal.rewardCoins} coins and +${state.displayGoal.rewardBloom} Bloom.`
      : `${carried.species} and ${other.species} traded places.`);
    updateSlotGlow();
    updateUi();
  }

  function unpackAllCartons() {
    if (run.busy || run.crateAnimation || !canBatchUnpack({ day: state.day, crates: state.crates })) return;
    run.batchUnpackActive = true;
    run.batchUnpackSpecies = [];
    run.batchUnpackPlantIds = [];
    sound("crate");
    toast(`Opening ${state.crates} cartons. The delivery overview will appear when the last plant is out.`, 3600);
    unpackCrate();
  }

  function unpackCrate() {
    if (state.crates <= 0 || !state.crateQueue.length) {
      toast("Only packing straw. It smells oddly optimistic.");
      return;
    }
    const carton = run.crate?.children[state.crates - 1];
    const delivery = state.crateQueue.shift();
    const speciesName = deliverySpeciesName(delivery);
    const rescue = (delivery?.condition || state.deliveryCondition) === "stressed";
    const plant = plantRecord(speciesName, delivery?.seed || state.day * 100 + state.crates * 17, {
      hydration: rescue ? 30 + ((state.day + state.crates * 3) % 11) : 70 + ((state.day + state.crates * 7) % 21),
      supplierLot: state.selectedLotId,
      acquisitionCost: Number.isFinite(delivery?.acquisitionCost) ? delivery.acquisitionCost : 0,
      needsRehabilitation: rescue,
      arrivalDay: state.day,
    });
    if (run.batchUnpackActive) {
      run.batchUnpackSpecies.push(plant.species);
      run.batchUnpackPlantIds.push(plant.id);
    }
    state.inventory.push(plant);
    state.crates -= 1;
    const object = createPlant(plant);
    const looseCount = state.inventory.filter((item) => !Number.isInteger(item.slot)).length;
    const target = stagingPosition(looseCount - 1);
    object.position.copy(target);
    object.scale.setScalar(0.05);
    object.visible = false;
    world.add(object);
    plantObjects.set(plant.id, object);
    const origin = carton
      ? world.worldToLocal(carton.getWorldPosition(new THREE.Vector3()))
      : target.clone();
    run.busy = true;
    run.selected = null;
    run.carried = null;
    run.crateAnimation = {
      carton,
      object,
      plant,
      origin,
      target: target.clone(),
      time: 0,
      packingBurst: false,
    };
    if (carton) carton.userData.opened = true;
    document.body.dataset.selection = "none";
    updateCrates();
    updateSelectionRing();
    updateSlotGlow();
    save();
    sound("crate");
    updateUi();
  }

  function updateCartonOpening(dt) {
    const opening = run.crateAnimation;
    if (!opening) return;
    const { carton, object, origin, target } = opening;
    opening.time += dt * (run.batchUnpackActive ? 3.2 : 1);

    if (reduceMotion || !carton) {
      if (carton) {
        carton.userData.flaps?.forEach((flap) => {
          flap.rotation[flap.userData.axis] = flap.userData.openRotation;
        });
        if (carton.userData.packing) carton.userData.packing.visible = true;
      }
      if (!opening.packingBurst) {
        opening.packingBurst = true;
        burst(origin.clone().add(new THREE.Vector3(0, 0.7, 0)), 0xe9c47c, 8);
      }
      object.visible = true;
      object.position.copy(target);
      object.scale.setScalar(looseScaleAt(target, object));
      finishCartonOpening(opening);
      return;
    }

    const settleProgress = clamp(opening.time / 0.26, 0, 1);
    const settle = Math.sin(settleProgress * Math.PI);
    carton.position.copy(carton.userData.restPosition);
    carton.position.y -= settle * 0.065;
    carton.scale.set(1 + settle * 0.025, 1 - settle * 0.055, 1 + settle * 0.025);

    const flapProgress = clamp((opening.time - 0.14) / 0.5, 0, 1);
    const flapEase = flapProgress * flapProgress * (3 - 2 * flapProgress);
    carton.userData.flaps?.forEach((flap) => {
      flap.rotation[flap.userData.axis] = flap.userData.openRotation * flapEase;
    });

    if (opening.time >= 0.68 && !opening.packingBurst) {
      opening.packingBurst = true;
      if (carton.userData.packing) carton.userData.packing.visible = true;
      burst(origin.clone().add(new THREE.Vector3(0, 0.72, 0)), 0xe9c47c, 18);
    }

    const revealProgress = clamp((opening.time - 0.7) / 0.35, 0, 1);
    if (revealProgress > 0) {
      const revealEase = 1 - (1 - revealProgress) ** 3;
      const revealStart = origin.clone().add(new THREE.Vector3(0, 0.4, 0));
      const revealTop = origin.clone().add(new THREE.Vector3(0, 1.0, 0));
      object.visible = true;
      object.position.lerpVectors(revealStart, revealTop, revealEase);
      object.scale.setScalar(lerp(0.05, 0.46, revealEase));
    }

    const transferProgress = clamp((opening.time - 1.05) / 0.95, 0, 1);
    if (transferProgress > 0) {
      const transferEase = transferProgress * transferProgress * (3 - 2 * transferProgress);
      const revealTop = origin.clone().add(new THREE.Vector3(0, 1.0, 0));
      object.position.lerpVectors(revealTop, target, transferEase);
      object.position.y += Math.sin(transferProgress * Math.PI) * 0.42;
      object.scale.setScalar(lerp(0.46, looseScaleAt(target, object), transferEase));
    }

    if (opening.time >= 2) finishCartonOpening(opening);
  }

  function finishCartonOpening(opening) {
    if (run.crateAnimation !== opening) return;
    const { carton, object, plant, target } = opening;
    if (carton) {
      carton.position.copy(carton.userData.restPosition);
      carton.scale.set(1, 1, 1);
    }
    object.visible = true;
    object.position.copy(target);
    object.scale.setScalar(looseScaleAt(target, object));
    run.crateAnimation = null;
    run.busy = false;
    if (run.batchUnpackActive && state.crates > 0) {
      run.selected = null;
      run.carried = null;
      document.body.dataset.selection = "none";
      updateCrates();
      updateSelectionRing();
      updateSlotGlow();
      save();
      unpackCrate();
      return;
    }
    run.selected = { kind: "plant", id: plant.id, object };
    run.carried = plant.id;
    document.body.dataset.selection = "plant";
    if (state.crates === 0 && !state.displayGoal) {
      state.displayGoal = makeDisplayGoal(seeded(state.day * 1999 + 73));
      save();
    }
    updateCrates();
    updateSelectionRing();
    updateSlotGlow();
    const lastCarton = state.crates === 0;
    if (run.batchUnpackActive) {
      const names = [...run.batchUnpackSpecies];
      const uniqueCount = new Set(names).size;
      const batchPlantIds = new Set(run.batchUnpackPlantIds);
      const thirstyCount = state.inventory.filter((item) => batchPlantIds.has(item.id) && item.hydration < 42).length;
      run.deliveryOverviewPlantIds = [...run.batchUnpackPlantIds];
      run.batchUnpackActive = false;
      run.batchUnpackSpecies = [];
      run.batchUnpackPlantIds = [];
      run.selected = null;
      run.carried = null;
      document.body.dataset.selection = "none";
      updateSelectionRing();
      updateSlotGlow();
      toast(`${names.length} cartons open · ${uniqueCount} species. ${thirstyCount ? `${thirstyCount} arrived thirsty. ` : ""}The delivery overview is ready.`, 5600);
    } else {
      toast(plant.hydration < 42
        ? `${plant.species}! Thirsty and drooping after the trip—water will perk it up.`
        : lastCarton
          ? `${plant.species}! Last carton open. The Care Bench and separate Recovery Station are ready.`
          : `${plant.species}! A little rumpled, fundamentally promising.`);
    }
    updateUi();
  }

  function firstFreeSlot(plant = null) {
    const used = new Set(state.inventory.map((plant) => plant.slot).filter(Number.isInteger));
    const object = plant ? plantObjects.get(plant.id) : null;
    if (plant && state.displayGoal && !state.displayGoal.claimed && plant.traits.includes(state.displayGoal.trait)) {
      const goalIndex = SLOT_DATA.findIndex((slot, index) => !used.has(index)
        && slotIsActive(slot)
        && slot.zone === state.displayGoal.zone
        && (!object || scaleForSlot(object, slot) >= slot.size * 0.74));
      if (goalIndex >= 0) return goalIndex;
    }
    if (plant) {
      const idealIndex = SLOT_DATA.findIndex((slot, index) => !used.has(index)
        && slotIsActive(slot)
        && lightFit(plant, index).level === "ideal"
        && (!object || scaleForSlot(object, slot) >= slot.size * 0.74));
      if (idealIndex >= 0) return idealIndex;
    }
    for (let index = 0; index < SLOT_DATA.length; index += 1) {
      if (used.has(index)) continue;
      const slot = SLOT_DATA[index];
      if (!slotIsActive(slot)) continue;
      if (object && scaleForSlot(object, slot) < slot.size * 0.74) continue;
      return index;
    }
    for (let index = 0; index < SLOT_DATA.length; index += 1) {
      if (!used.has(index) && slotIsActive(SLOT_DATA[index])) return index;
    }
    return null;
  }

  function placePlant(id, slotIndex) {
    const plant = state.inventory.find((item) => item.id === id);
    const target = SLOT_DATA[slotIndex];
    if (!plant || plant.benchStatus || !slotIsActive(target)) return;
    if (state.inventory.some((item) => item.slot === slotIndex && item.id !== id)) {
      toast("That spot already has a tenant.");
      return;
    }
    plant.slot = slotIndex;
    const object = plantObjects.get(id);
    if (object) {
      queueMover({
        object,
        from: object.position.clone(),
        to: new THREE.Vector3(target.x, target.y, target.z),
        startScale: object.scale.x,
        endScale: scaleForSlot(object, target),
        time: 0,
        duration: 0.48,
        arc: 0.65,
      });
    }
    run.carried = null;
    run.moveOrigin = null;
    const goalWon = evaluateDisplayGoal(plant, target);
    save();
    sound(goalWon ? "upgrade" : "place");
    toast(goalWon
      ? `Display vignette complete! +${state.displayGoal.rewardCoins} coins and +${state.displayGoal.rewardBloom} Bloom.`
      : `${plant.species}: ${lightFit(plant).label}.`);
    updateSlotGlow();
    updateUi();
  }

  function setPriceBand(band) {
    if (run.busy || !PRICE_BANDS[band] || run.selected?.kind !== "plant") return;
    const plant = state.inventory.find((item) => item.id === run.selected.id);
    if (!plant || plant.benchStatus) return;
    plant.priceBand = band;
    updatePlantPriceTag(plant);
    save();
    sound("place");
    const label = PRICE_BANDS[band].label;
    toast(`${plant.species} is tagged ${label} at ${plantAskingPrice(plant)} coins.`);
    updateUi();
  }

  function animateWateringCan(plantObject) {
    const can = run.wateringCan;
    if (!can || !can.visible || !plantObject?.parent) {
      waterPour(plantObject);
      return;
    }
    if (reduceMotion) {
      waterPour(plantObject);
      return;
    }
    const plantPosition = new THREE.Vector3();
    plantObject.getWorldPosition(plantPosition);
    const plantHeight = Math.max(0.75, (plantObject.userData.modelTop || 1.4) * plantObject.scale.x * 0.62);
    const targetPosition = plantPosition.clone().add(new THREE.Vector3(-0.62, plantHeight, 0.12));
    const targetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.66));
    run.canAnimation = {
      age: 0,
      duration: 1.18,
      object: can,
      plantObject,
      homePosition: can.userData.homePosition.clone(),
      homeQuaternion: can.userData.homeQuaternion.clone(),
      targetPosition,
      targetQuaternion,
      poured: false,
    };
  }

  function updateWateringCan(dt) {
    const animation = run.canAnimation;
    if (!animation) return;
    animation.age += dt;
    const raw = clamp(animation.age / animation.duration, 0, 1);
    const ease = (value) => value * value * (3 - 2 * value);
    if (raw < 0.34) {
      const travel = ease(raw / 0.34);
      animation.object.position.lerpVectors(animation.homePosition, animation.targetPosition, travel);
      animation.object.quaternion.slerpQuaternions(animation.homeQuaternion, animation.targetQuaternion, travel);
    } else if (raw < 0.66) {
      animation.object.position.copy(animation.targetPosition);
      animation.object.quaternion.copy(animation.targetQuaternion);
    } else {
      const travel = ease((raw - 0.66) / 0.34);
      animation.object.position.lerpVectors(animation.targetPosition, animation.homePosition, travel);
      animation.object.quaternion.slerpQuaternions(animation.targetQuaternion, animation.homeQuaternion, travel);
    }
    if (!animation.poured && raw >= 0.47) {
      animation.poured = true;
      if (animation.plantObject?.parent) waterPour(animation.plantObject);
    }
    if (raw >= 1) {
      animation.object.position.copy(animation.homePosition);
      animation.object.quaternion.copy(animation.homeQuaternion);
      run.canAnimation = null;
    }
  }

  function careForPlant(type, plantId = run.selected?.kind === "plant" ? run.selected.id : null) {
    if (run.busy || !plantId) {
      toast("Choose a plant first.");
      return;
    }
    if (type === "water" && run.canAnimation) {
      toast("The watering can is already pouring.");
      return;
    }
    const plant = state.inventory.find((item) => item.id === plantId);
    const object = plantObjects.get(plantId);
    if (!plant || plant.benchStatus || !object) return;
    const spec = speciesOf(plant);
    const beneficial = spec.beneficialCare.includes(type);
    const canRewater = type === "water" && plant.hydration < 78;
    if (type === "water" && plant.hydration >= 78 && !plant.care.water) {
      toast(`${plant.species} still has damp soil. Save the watering can for later.`);
      sound("error");
      return;
    }
    if (plant.care[type] && !canRewater) {
      toast(type === "water" ? "No swamp ambitions today." : `Already ${type === "mist" ? "misty" : "tidy"} enough.`);
      sound("error");
      return;
    }
    const firstCare = !plant.care[type];
    const wasDrooping = plant.hydration < 42;
    plant.care[type] = true;
    let weeklyRewardCopy = "";
    if (firstCare && beneficial) {
      state.dailyCare += 1;
      earnBloom(1);
      addWeekStat("care", 1);
      weeklyRewardCopy = advanceWeekGoal({ metric: "beneficialCare", value: 1 });
    }
    let recoveryReward = false;
    if (type === "water") {
      plant.hydration = 100;
      plant.thirstWarned = false;
      if (wasDrooping && !plant.recoveredToday) {
        plant.recoveredToday = true;
        state.dailyRecoveries += 1;
        earnBloom(1);
        addWeekStat("rescues", 1);
        weeklyRewardCopy ||= advanceWeekGoal({ metric: "thirstRescues", value: 1 });
        recoveryReward = true;
      }
      animateWateringCan(object);
    } else if (type === "mist") {
      mistCloud(object);
    } else {
      burst(object.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x719e65, 12);
    }
    if (!reduceMotion) queueMover({ object, from: object.position.clone(), to: object.position.clone(), startScale: object.scale.x, endScale: object.scale.x, time: 0, duration: 0.42, arc: 0.16 });
    save();
    sound(type);
    const messages = {
      water: recoveryReward
        ? `${plant.species} lifts every leaf. Thirst rescue! +1 Bloom.`
        : `${plant.species} drinks with surprising urgency.`,
      mist: beneficial
        ? `${plant.species} is now experiencing weather. +1 Bloom.`
        : `${plant.species} tolerates the weather, but prefers drier air. No care bonus.`,
      prune: beneficial
        ? `One tiny haircut. Considerable confidence. +1 Bloom.`
        : `${plant.species} would rather keep that growth. No care bonus.`,
    };
    const stressCopy = plant.needsRehabilitation
      ? ` Its normal care is complete, but nursery stress remains. Rehabilitate it to restore ${plant.rehabilitationValueLoss || 0} coins of sale value.`
      : "";
    const issueCopy = plant.healthIssue
      ? ` The ${plant.healthIssue} remain. Use ${supplyItemForId(treatmentForIssue(plant.healthIssue))?.title || "the correct treatment"} from the retail shelf.`
      : "";
    toast(`${messages[type]}${stressCopy}${issueCopy}${weeklyRewardCopy}`, weeklyRewardCopy || stressCopy || issueCopy ? 5200 : 3100);
    updateUi();
  }

  function offerPlant(plant) {
    const person = currentCustomer();
    if (!person) return;
    if (plant.benchStatus) {
      sound("error");
      toast(`${plant.species} is still on the care bench.`);
      return;
    }
    if (plant.lifeStage === "juvenile") {
      sound("error");
      toast(`${plant.species} is still growing. It needs ${plant.maturityDaysRemaining} more mornings before sale.`);
      return;
    }
    if (plant.held) {
      sound("error");
      toast(`${plant.species} is held for the weekly order. Release it in the order book before a regular sale.`);
      return;
    }
    if (!plant.traits.includes(person.need)) {
      sound("error");
      toast(`${person.name} likes it, but really needs something ${person.need}.`);
      updateUi();
      save();
      return;
    }
    const band = priceBandOf(plant);
    const price = plantAskingPrice(plant);
    if (Number.isFinite(person.budget) && price > person.budget) {
      sound("error");
      toast(`${person.name}'s budget is ${person.budget} coins. Retag ${plant.species} or recommend another plant.`);
      updateUi();
      return;
    }
    const careWishMet = person.careWish === "water"
      ? plant.hydration >= 78 || plant.care.water
      : speciesOf(plant).beneficialCare.includes(person.careWish) && plant.care[person.careWish];
    const condition = conditionOf(plant);
    const wishMet = plant.traits.includes(person.bonusTrait);
    const thriving = condition.label === "thriving";
    const idealLight = lightFit(plant).level === "ideal";
    const extras = [wishMet, Boolean(careWishMet), thriving].filter(Boolean).length;
    if (["drooping", "nursery-stressed", "root-bound", "light-stressed", "mite-infested", "fungal"].includes(condition.label) && band !== "quick") {
      sound("error");
      toast(`${person.name} notices that ${plant.species} is ${condition.label}. Improve its condition or use a Quick tag.`);
      return;
    }
    if (band === "boutique" && [wishMet, Boolean(careWishMet), thriving, idealLight].filter(Boolean).length < 2) {
      sound("error");
      toast(`${person.name} likes it, but Boutique needs a stronger fit or presentation. Care, rearrange, or retag it.`);
      return;
    }
    const remainingCustomers = state.customers.slice(state.customerIndex + 1);
    const remainingInventory = state.inventory.filter((item) => item.id !== plant.id);
    if (!inventoryCoversCustomers(remainingInventory, remainingCustomers)) {
      sound("error");
      toast(`${person.name} would love it, but that plant is the only good match for someone later. Try another ${person.need} plant.`);
      return;
    }
    run.busy = true;
    const perfect = extras === 3;
    const expansionBonus = saleExpansionBonus({
      state: state.expansionState,
      priceBand: band,
      perfect,
      extras: extras > 0 ? ["lovely"] : [],
      basePayout: price,
    });
    const eventBonus = eventSaleBonus(person, plant, state.neighborhoodState?.event);
    const payout = price + expansionBonus + eventBonus;
    const satisfaction = 1 + extras + (idealLight ? 1 : 0) + (band === "quick" ? 1 : 0);
    const delighted = satisfaction >= 4;
    const bloomReward = 2 + extras;
    const plantCostOfGoods = Number.isFinite(plant.acquisitionCost) ? plant.acquisitionCost : plant.wholesaleCost || 0;
    state.coins += payout;
    const addOnRequest = currentCustomerAddOn(person);
    const addOnSale = addOnRequest
      ? sellCustomerAddOn({ request: addOnRequest, supplyState: state.supplyState, coins: state.coins })
      : null;
    if (addOnSale) {
      state.supplyState = addOnSale.supplyState;
      state.coins = addOnSale.coins;
    }
    if (addOnSale?.addOnSold) {
      state.dailySupplySales = (Number(state.dailySupplySales) || 0) + 1;
      updateRetailSupplyShelfStock();
    }
    const addOnRevenue = addOnSale?.addOnSold ? addOnSale.revenue : 0;
    const addOnCostOfGoods = addOnSale?.addOnSold ? addOnSale.costOfGoods : 0;
    const saleRevenue = payout + addOnRevenue;
    const costOfGoods = plantCostOfGoods + addOnCostOfGoods;
    earnBloom(bloomReward);
    if (perfect) state.dailyPerfects += 1;
    const perfectDayBonus = perfect && state.dailyPerfects === 3;
    if (perfectDayBonus) earnBloom(8);
    state.dailyRevenue += saleRevenue;
    state.dailyCostOfGoods += costOfGoods;
    state.dailySales += 1;
    addWeekStat("sales", 1);
    addWeekStat("revenue", saleRevenue);
    addWeekStat("costOfGoods", costOfGoods);
    addWeekStat("profit", saleRevenue - costOfGoods);
    addWeekStat("bloom", bloomReward + (perfectDayBonus ? 8 : 0));
    if (perfect) addWeekStat("perfects", 1);
    if (band === "boutique") addWeekStat("boutiqueSales", 1);
    if (band === "quick") addWeekStat("quickSales", 1);
    if (person.isReturning && delighted) addWeekStat("returningCustomersDelighted", 1);
    if (!Array.isArray(state.weekStats.uniqueSpeciesSold)) state.weekStats.uniqueSpeciesSold = [];
    const soldSpeciesId = plant.speciesId || speciesOf(plant).id;
    if (!state.weekStats.uniqueSpeciesSold.includes(soldSpeciesId)) state.weekStats.uniqueSpeciesSold.push(soldSpeciesId);
    const saleMemory = rememberCustomerSale(person, plant, satisfaction);
    if (eventBonus > 0 && state.neighborhoodState?.event) {
      saleMemory.lastEventDay = state.day;
      saleMemory.lastEventTitle = state.neighborhoodState.event.title;
      saleMemory.lastEventTrait = state.neighborhoodState.event.trait;
    }
    let weeklyRewardCopy = "";
    [
      { metric: "plantsSold", value: 1 },
      { metric: "grossProfit", value: saleRevenue - costOfGoods },
      { metric: "perfectBriefs", value: perfect ? 1 : 0 },
      { metric: "boutiqueSales", value: band === "boutique" ? 1 : 0 },
      { metric: "quickSales", value: band === "quick" ? 1 : 0 },
      { metric: "uniqueSpeciesSold", value: 1, speciesId: soldSpeciesId },
      { metric: "returningCustomersDelighted", value: person.isReturning && delighted ? 1 : 0 },
    ].forEach((event) => {
      if (!event.value) return;
      weeklyRewardCopy ||= advanceWeekGoal(event);
    });
    state.customerIndex += 1;
    const object = plantObjects.get(plant.id);
    const target = run.customer?.position.clone().add(new THREE.Vector3(0, 1.0, 0)) || new THREE.Vector3(0, 1, 3);
    if (object) {
      const clipVisual = object.getObjectByName("clip-grow-light-visual");
      if (clipVisual) clipVisual.visible = false;
      stageCustomerCarry(object);
      const index = interactive.indexOf(object);
      if (index >= 0) interactive.splice(index, 1);
      queueMover({ object, from: object.position.clone(), to: target, startScale: object.scale.x, endScale: 0.08, time: 0, duration: 0.62, arc: 1.2, remove: true });
      plantObjects.delete(plant.id);
    }
    if (plant.clipGrowLightAssigned) {
      const released = releaseSupplyClipGrowLight({ supplyState: state.supplyState, plantId: plant.id });
      if (released.ok) state.supplyState = released.supplyState;
    }
    state.inventory = state.inventory.filter((item) => item.id !== plant.id);
    run.selected = null;
    run.carried = null;
    if (run.selectionRing) run.selectionRing.visible = false;
    document.body.dataset.selection = "none";
    if (run.customer) run.customer.userData.entity = null;
    run.customerTween = {
      mode: "exit",
      time: 0,
      delay: reduceMotion ? 0 : 0.58,
      advance: state.customerIndex >= state.customers.length ? "report" : "customer",
    };
    run.lastSaleGrade = perfect ? "perfect" : extras >= 1 ? "lovely" : "good";
    save();
    sound("sale");
    const shopBonusCopy = expansionBonus ? ` Shop details add ${expansionBonus} bonus ${expansionBonus === 1 ? "coin" : "coins"}.` : "";
    const eventBonusCopy = eventBonus ? ` ${state.neighborhoodState.event.title} adds ${eventBonus} coins.` : "";
    const addOnCopy = addOnSale?.addOnSold
      ? ` They also buy ${addOnSale.item.title} for ${addOnSale.revenue} coins.`
      : addOnRequest ? ` ${addOnRequest.title} was requested, but it was out of stock.` : "";
    toast(`${perfect ? "Perfect" : extras ? "Lovely" : "Good"} match! ${person.name} pays the ${PRICE_BANDS[band].label} tag: ${price} coins.${shopBonusCopy}${eventBonusCopy}${addOnCopy}${perfectDayBonus ? " Three perfect matches—+8 Bloom!" : ""}${weeklyRewardCopy}`, weeklyRewardCopy || addOnCopy || eventBonusCopy ? 5200 : 3100);
    updateSlotGlow();
    updateUi(true);
    if (state.day === 1 && state.dailySales === 1 && !state.mothSeen) moonMoth();
  }

  function moonMoth() {
    state.mothSeen = true;
    earnBloom(5);
    const root = new THREE.Group();
    const glow = material(0xffefba, { emissive: 0xffcc72, emissiveIntensity: 1.5, side: THREE.DoubleSide });
    const body = cylinder(root, 0.055, 0.075, 0.32, [0, 0, 0], material(0x63584a), 7);
    body.rotation.z = Math.PI / 2;
    const wingGeometry = new THREE.CircleGeometry(0.32, 8, 0, Math.PI);
    const left = new THREE.Mesh(wingGeometry, glow);
    const right = new THREE.Mesh(wingGeometry, glow);
    left.position.x = -0.2;
    right.position.x = 0.2;
    right.rotation.y = Math.PI;
    root.add(left, right);
    const light = new THREE.PointLight(0xffd98e, 2.8, 3);
    root.add(light);
    root.position.set(2.5, 3.8, -4.3);
    world.add(root);
    run.moth = { root, left, right, age: 0 };
    save();
    sound("moth");
    toast("A moon moth slips through the window. +5 Bloom. Nobody mentions it.", 5200);
    updateUi();
  }

  function burst(position, color, count) {
    if (reduceMotion) count = Math.min(count, 5);
    const root = new THREE.Group();
    root.position.copy(position);
    const bits = [];
    const geometry = new THREE.IcosahedronGeometry(0.045, 0);
    const mat = material(color, { emissive: color, emissiveIntensity: 0.15 });
    for (let index = 0; index < count; index += 1) {
      const bit = new THREE.Mesh(geometry, mat);
      bit.scale.setScalar(0.65 + Math.random());
      root.add(bit);
      bits.push({ object: bit, velocity: new THREE.Vector3((Math.random() - 0.5) * 1.3, Math.random() * 1.4 + 0.4, (Math.random() - 0.5) * 1.3) });
    }
    world.add(root);
    effects.push({ kind: "burst", root, bits, age: 0, duration: 1.1, geometries: [geometry], materials: [mat] });
  }

  function waterPour(object) {
    const root = new THREE.Group();
    const size = object.scale.x;
    const target = object.position.clone().add(new THREE.Vector3(0, 0.67 * size, 0));
    const origin = target.clone().add(new THREE.Vector3(-0.34 * size, 1.42 * size, 0.18 * size));
    const bits = [];
    const geometry = new THREE.SphereGeometry(0.052, 7, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0x69b9df, transparent: true, opacity: 0.92, depthWrite: false });
    const count = reduceMotion ? 5 : 14;
    for (let index = 0; index < count; index += 1) {
      const drop = new THREE.Mesh(geometry, mat);
      drop.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.12, Math.random() * 0.14, (Math.random() - 0.5) * 0.12));
      drop.scale.set(0.72, 2.8 + Math.random() * 1.7, 0.72);
      drop.visible = false;
      root.add(drop);
      const travel = 0.48 + Math.random() * 0.09;
      bits.push({
        object: drop,
        delay: index * (reduceMotion ? 0.07 : 0.035),
        velocity: target.clone().sub(origin).divideScalar(travel).add(new THREE.Vector3((Math.random() - 0.5) * 0.18, 0.35, (Math.random() - 0.5) * 0.18)),
      });
    }
    const rippleMaterial = new THREE.MeshBasicMaterial({ color: 0x91d6ec, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const rippleGeometry = new THREE.RingGeometry(0.09, 0.15, 20);
    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.copy(target).add(new THREE.Vector3(0, 0.025, 0));
    ripple.scale.setScalar(0.2);
    root.add(ripple);
    world.add(root);
    effects.push({
      kind: "water",
      root,
      bits,
      ripple,
      rippleMaterial,
      age: 0,
      duration: reduceMotion ? 0.78 : 1.05,
      geometries: [geometry, rippleGeometry],
      materials: [mat, rippleMaterial],
    });
  }

  function mistCloud(object) {
    const root = new THREE.Group();
    const size = object.scale.x;
    root.position.copy(object.position).add(new THREE.Vector3(0, object.userData.modelTop * size * 0.63, 0));
    const bits = [];
    const geometry = new THREE.SphereGeometry(0.12, 7, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xdff7f1, transparent: true, opacity: 0.48, depthWrite: false });
    const count = reduceMotion ? 7 : 22;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 0.12 + Math.random() * 0.42 * size;
      const puff = new THREE.Mesh(geometry, mat);
      puff.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 0.65 * size, Math.sin(angle) * radius);
      const scale = 0.65 + Math.random() * 1.1;
      puff.scale.set(scale, scale * 0.82, scale);
      root.add(puff);
      bits.push({
        object: puff,
        velocity: new THREE.Vector3(Math.cos(angle) * (0.12 + Math.random() * 0.28), 0.08 + Math.random() * 0.22, Math.sin(angle) * (0.12 + Math.random() * 0.28)),
      });
    }
    world.add(root);
    effects.push({ kind: "mist", root, bits, age: 0, duration: 1.45, geometries: [geometry], materials: [mat] });
  }

  function recordClosingProgress() {
    if (!state.weekStats) state.weekStats = freshWeekStats(calendarForDay(state.day).week);
    const closedDays = Array.isArray(state.weekStats.closedDays) ? state.weekStats.closedDays : [];
    state.weekStats.closedDays = closedDays;
    if (closedDays.includes(state.day)) return "";
    closedDays.push(state.day);
    const displayed = state.inventory.filter((plant) => Number.isInteger(plant.slot));
    const healthyDisplay = displayed.length > 0 && displayed.every((plant) => lightFit(plant).level !== "poor");
    if (!healthyDisplay) return "";
    addWeekStat("healthyDisplayDays", 1);
    return advanceWeekGoal({ metric: "healthyDisplayDays", value: 1 });
  }

  function settleOperatingCost() {
    if (state.dailyOperatingCostPaid) return;
    const profile = dailyTradeProfile({
      day: state.day,
      inventoryCount: state.inventory.length,
      capacity: state.inventoryCapacity,
      visitorBonus: state.upgrades.shopSign ? 1 : 0,
      serviceableCapacity: sellablePotential(state.inventory, state.inventoryCapacity),
    });
    const calendar = calendarForDay(state.day);
    const closingStockTarget = Math.min(state.inventoryCapacity, profile.choiceBuffer);
    state.dailyOverstockCost = closingOverstockCost({
      week: calendar.week,
      inventoryCount: state.inventory.length,
      stockTarget: closingStockTarget,
    });
    const baseCost = Math.max(0, Math.floor(Number(state.dailyOperatingCost) || 0));
    const currentDue = baseCost + state.dailyOverstockCost;
    const oldBalance = Math.max(0, Math.floor(Number(state.outstandingCosts) || 0));
    const due = currentDue + oldBalance;
    const paid = Math.min(Math.max(0, state.coins), due);
    state.coins -= paid;
    state.dailyOperatingCostPaid = true;
    state.dailyOperatingPaidAmount = paid;
    let shortfall = due - paid;
    if (shortfall > 0 && !state.neighborhoodGrantUsed) {
      state.neighborhoodGrantUsed = true;
      shortfall = 0;
    }
    state.dailyOperatingShortfall = due - paid;
    state.outstandingCosts = Math.min(MAX_OUTSTANDING_COSTS, shortfall);
    addWeekStat("operatingCosts", currentDue);
    addWeekStat("profit", -currentDue);
  }

  function showReport() {
    [ui.helpModal, ui.upgradeModal, ui.benchModal, ui.supplyModal, ui.weeklyOrderModal].forEach((modal) => {
      if (!modal) return;
      modal.hidden = true;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    });
    if (ui.benchButton) ui.benchButton.setAttribute("aria-expanded", "false");
    if (ui.supplyButton) ui.supplyButton.setAttribute("aria-expanded", "false");
    if (ui.weeklyOrderButton) ui.weeklyOrderButton.setAttribute("aria-expanded", "false");
    state.phase = "report";
    run.arranging = false;
    cancelMove();
    run.busy = true;
    document.body.dataset.gameState = "report";
    if (ui.report) {
      ui.report.hidden = false;
      ui.report.classList.add("is-open");
      ui.report.setAttribute("aria-hidden", "false");
    }
    if (ui.game) ui.game.inert = true;
    requestAnimationFrame(() => ui.nextDay?.focus());
    settleOperatingCost();
    const calendar = calendarForDay(state.day);
    const closingRewardCopy = recordClosingProgress();
    if (ui.reportTitle) ui.reportTitle.textContent = calendar.isFriday
      ? `Week ${String(calendar.week).padStart(2, "0")} complete`
      : `${calendar.weekday} complete`;
    if (ui.reportCopy) {
      const netProfit = state.dailyRevenue - state.dailyCostOfGoods - state.dailyOperatingCost - state.dailyOverstockCost;
      const bloomChange = state.bloom - state.dailyBloomStart;
      const profitCopy = `${netProfit >= 0 ? "+" : ""}${coinCopy(netProfit)}`;
      const leadCopy = state.dailySales
        ? `${state.dailySales} plant${state.dailySales === 1 ? "" : "s"} found ${state.dailySales === 1 ? "a new home" : "new homes"}.${state.dailySupplySales ? ` ${state.dailySupplySales} supply add-on${state.dailySupplySales === 1 ? "" : "s"} sold.` : ""}`
        : "The shop was quiet today.";
      const bloomCopy = `${bloomChange >= 0 ? "+" : ""}${bloomChange}`;
      const stockCopy = `${state.inventory.length} plant${state.inventory.length === 1 ? "" : "s"}`;
      let highlightCopy = "The shop is ready for another morning.";
      if (calendar.isFriday) {
        const sales = Number(state.weekStats?.sales) || 0;
        const profit = Number(state.weekStats?.profit) || 0;
        const objective = state.weeklyObjective?.completed ? "Weekly goal complete." : `${weeklyObjectiveLabel(state.weeklyObjective)}.`;
        highlightCopy = `Week ${calendar.week}: ${sales} plants rehomed · ${profit >= 0 ? "+" : ""}${coinCopy(profit)} profit. ${objective}`;
      } else if (state.displayGoal?.claimed) highlightCopy = "Display challenge complete. The front shelves really worked.";
      else if (state.dailyPerfects) highlightCopy = "A customer found exactly what they were hoping for.";
      else if (state.dailyRecoveries) highlightCopy = "A thirsty plant bounced back beautifully.";
      else if (state.dailyCare >= 6) highlightCopy = "The leaves are looking immaculate.";
      if (state.dailyOperatingCost > 0 && !calendar.isFriday) {
        highlightCopy += ` Daily costs used ${coinCopy(state.dailyOperatingCost)}.`;
      }
      if (state.dailyOverstockCost > 0) {
        highlightCopy += ` Extra stock care used ${coinCopy(state.dailyOverstockCost)}.`;
      }
      if (state.dailyOperatingShortfall > 0) {
        highlightCopy += state.outstandingCosts > 0
          ? ` ${coinCopy(state.outstandingCosts)} carry into tomorrow.`
          : ` The neighborhood fund covered ${coinCopy(state.dailyOperatingShortfall)}. This one-time help is now used.`;
      }
      if (closingRewardCopy) highlightCopy += closingRewardCopy;

      if (ui.reportProfit && ui.reportLead && ui.reportBloom && ui.reportStock && ui.reportHighlight) {
        ui.reportProfit.textContent = profitCopy;
        ui.reportProfit.dataset.tone = netProfit >= 0 ? "positive" : "negative";
        ui.reportLead.textContent = leadCopy;
        ui.reportBloom.textContent = bloomCopy;
        ui.reportStock.textContent = stockCopy;
        ui.reportHighlight.lastChild.textContent = ` ${highlightCopy}`;
      } else {
        ui.reportCopy.textContent = `${leadCopy} ${profitCopy} net profit, ${bloomCopy} Bloom, and ${stockCopy} ready for tomorrow.`;
      }
    }
    sound("report");
    save();
    updateUi();
  }

  function nextDay() {
    state.day += 1;
    const calendar = calendarForDay(state.day);
    state.week = calendar.week;
    state.weekdayIndex = calendar.weekdayIndex;
    if (!state.weeklyObjective || state.weeklyObjective.week !== calendar.week) {
      state.weeklyObjective = createWeeklyObjective(calendar.week);
      state.weekStats = freshWeekStats(calendar.week);
    }
    state.customerIndex = 0;
    state.dailySales = 0;
    state.dailyRevenue = 0;
    state.dailyStockCost = 0;
    state.dailyCostOfGoods = 0;
    state.dailyOverstockCost = 0;
    state.accountingEstimate = false;
    state.dailyCare = 0;
    state.dailyPerfects = 0;
    state.dailyRecoveries = 0;
    state.dailySupplySales = 0;
    state.customers = [];
    state.crateQueue = [];
    state.displayGoal = null;
    const neighborhoodMorning = prepareNeighborhoodDay({
      state: state.neighborhoodState,
      day: state.day,
      inventory: state.inventory,
    });
    state.neighborhoodState = neighborhoodMorning.state;
    const heldIds = new Set(state.neighborhoodState.order?.status === ORDER_STATUS.ACTIVE
      ? state.neighborhoodState.order.heldPlantIds
      : []);
    state.inventory.forEach((plant) => { plant.held = heldIds.has(plant.id); });
    const healthMorning = advancePlantHealthInventoryMorning(state.inventory, { day: state.day });
    state.inventory = healthMorning.inventory;
    const maturedPlants = [];
    const newlyRootBound = [];
    state.inventory.forEach((plant) => {
      if (plant.benchStatus) return;
      if (plant.lifeStage === "juvenile") {
        plant.maturityDaysRemaining = Math.max(0, (Number(plant.maturityDaysRemaining) || 0) - 1);
        if (plant.maturityDaysRemaining === 0) {
          plant.lifeStage = "mature";
          plant.rootAgeDays = 0;
          maturedPlants.push(plant.species);
        }
        return;
      }
      plant.rootAgeDays = Math.max(0, Number(plant.rootAgeDays) || 0) + 1;
      if (plant.rootAgeDays >= ROOT_BOUND_AFTER_DAYS && plant.rootComfort === "comfortable") {
        plant.rootComfort = "cramped";
        newlyRootBound.push(plant.species);
      }
    });
    const benchMorning = advanceAndApplyBenchJobs({
      benchState: state.benchState,
      inventory: state.inventory,
      day: state.day,
      capacity: state.inventoryCapacity,
    });
    const completedRehabilitations = (benchMorning.appliedJobs || [])
      .filter((job) => job.type === BENCH_JOB_TYPES.REHABILITATE).length;
    if (completedRehabilitations) earnBloom(completedRehabilitations * REHABILITATION_BLOOM_REWARD);
    state.benchState = {
      ...benchMorning.benchState,
      slotCount: state.upgrades.benchShelf ? 2 : CARE_BENCH_BASE_SLOTS,
      rehabilitationSlotCount: state.upgrades.rehabilitationRack
        ? REHABILITATION_UPGRADE_SLOTS
        : REHABILITATION_BASE_SLOTS,
    };
    state.inventory = migratePlantHealthInventory(benchMorning.inventory);
    const rehabilitationRewardCopy = completedRehabilitations
      ? ` Recovery work earned ${completedRehabilitations * REHABILITATION_BLOOM_REWARD} Bloom.`
      : "";
    run.benchMessage = benchMorning.appliedJobs?.length || benchMorning.waitingJobs?.length
      ? `${benchMorning.message}${rehabilitationRewardCopy}`
      : "Choose a plant, then choose one available job.";
    state.inventory.forEach((plant) => {
      plant.care = { water: false, mist: false, prune: false };
      plant.recoveredToday = plant.rehabilitatedDay === state.day;
      plant.thirstWarned = plant.hydration <= 34;
    });
    setupDay(true);
    run.busy = false;
    run.selected = null;
    run.carried = null;
    run.moveOrigin = null;
    run.arranging = false;
    document.body.dataset.gameState = "playing";
    if (ui.report) {
      ui.report.hidden = true;
      ui.report.classList.remove("is-open");
      ui.report.setAttribute("aria-hidden", "true");
    }
    if (ui.game) ui.game.inert = false;
    canvas.focus({ preventScroll: true });
    rebuildPlants();
    updateCrates();
    save();
    showSupplierBoard();
    sound("open");
    const morningNotes = [
      benchMorning.appliedJobs?.length || benchMorning.waitingJobs?.length ? `${benchMorning.message}${rehabilitationRewardCopy}` : "",
      maturedPlants.length ? `${maturedPlants.join(" and ")} ${maturedPlants.length === 1 ? "is" : "are"} mature and ready for sale.` : "",
      newlyRootBound.length ? `${newlyRootBound.join(" and ")} ${newlyRootBound.length === 1 ? "needs" : "need"} repotting soon.` : "",
      healthMorning.newlyStressed.length || healthMorning.newIssues.length ? healthMorning.message : "",
      neighborhoodMorning.message,
      calendar.isMonday && state.neighborhoodState.event ? `${state.neighborhoodState.event.title}: ${state.neighborhoodState.event.copy}` : "",
      state.upgrades.growLamp && state.benchState.jobs.some((job) => job.lampAssisted)
        ? "The grow lamp is helping the active Care Bench work."
        : "",
      "The nursery clipboard is ready.",
    ].filter(Boolean).join(" ");
    toast(morningNotes, morningNotes.length > 110 ? 5200 : 3100);
    updateUi();
  }

  function renderPlantReadiness(plant, person) {
    if (!ui.plantReadiness || !ui.plantReadinessList) return;
    if (!plant) {
      ui.plantReadiness.hidden = true;
      ui.plantReadinessList.replaceChildren();
      return;
    }
    const remainingCustomers = person ? state.customers.slice(state.customerIndex + 1) : [];
    const remainingInventory = person ? state.inventory.filter((item) => item.id !== plant.id) : state.inventory;
    const species = speciesOf(plant);
    const fit = lightFit(plant);
    const condition = conditionOf(plant);
    const careWishMet = person?.careWish === "water"
      ? plant.hydration >= 78 || plant.care.water
      : Boolean(person && species.beneficialCare.includes(person.careWish) && plant.care[person.careWish]);
    const boutiqueMatches = person
      ? [
        plant.traits.includes(person.bonusTrait),
        careWishMet,
        condition.label === "thriving",
        fit.level === "ideal",
      ].filter(Boolean).length
      : 0;
    const readiness = plantSaleReadiness({
      plant,
      species,
      light: fit,
      conditionLabel: condition.label,
      customer: person,
      askingPrice: plantAskingPrice(plant),
      priceBand: priceBandOf(plant),
      boutiqueReady: !person || boutiqueMatches >= 2,
      remainingCoverage: !person || inventoryCoversCustomers(remainingInventory, remainingCustomers),
    });
    ui.plantReadiness.hidden = false;
    ui.plantReadiness.dataset.state = readiness.status;
    const plantIndex = state.inventory.findIndex((item) => item.id === plant.id);
    if (ui.plantReadinessTitle) ui.plantReadinessTitle.textContent = state.inventory.length > 6
      ? `Sale readiness · plant ${plantIndex + 1} of ${state.inventory.length} · Q next`
      : "Sale readiness";
    if (ui.plantReadinessState) ui.plantReadinessState.textContent = readiness.label;
    if (ui.plantReadinessSummary) ui.plantReadinessSummary.textContent = readiness.summary;
    ui.plantReadinessList.replaceChildren();
    readiness.checks.forEach((check) => {
      const item = document.createElement("li");
      item.dataset.state = check.state;
      const label = document.createElement("strong");
      label.textContent = check.label;
      const detail = document.createElement("small");
      detail.textContent = check.detail;
      item.title = check.detail;
      item.append(label, detail);
      ui.plantReadinessList.append(item);
    });
  }

  function renderDeliveryOverview() {
    if (!ui.deliveryOverview || !ui.deliveryOverviewList) return;
    const plants = run.deliveryOverviewPlantIds
      .map((id) => state.inventory.find((plant) => plant.id === id))
      .filter(Boolean);
    ui.deliveryOverview.hidden = plants.length === 0;
    ui.deliveryOverviewList.replaceChildren();
    if (!plants.length) return;
    const uniqueCount = new Set(plants.map((plant) => plant.speciesId || plant.species)).size;
    if (ui.deliveryOverviewTitle) ui.deliveryOverviewTitle.textContent = `${plants.length} plants · ${uniqueCount} species`;
    plants.forEach((plant) => {
      const species = speciesOf(plant);
      const item = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = plant.species;
      const detail = document.createElement("small");
      detail.textContent = `${plant.needsRehabilitation ? "Rescue · needs Rehabilitation" : "Healthy arrival"} · likes ${species.preferredLight} light`;
      item.append(name, detail);
      ui.deliveryOverviewList.append(item);
    });
  }

  function updateUi(saleMessage = false) {
    updateRetailSupplyShelfStock();
    renderWeeklyPlan();
    const calendar = calendarForDay(state.day);
    const trade = dailyTradeProfile({
      day: state.day,
      inventoryCount: state.inventory.length,
      capacity: state.inventoryCapacity,
      visitorBonus: state.upgrades.shopSign ? 1 : 0,
      serviceableCapacity: sellablePotential(state.inventory, state.inventoryCapacity),
    });
    if (ui.day) ui.day.textContent = calendar.weekday.slice(0, 3);
    if (ui.week) ui.week.textContent = `Week ${calendar.week}`;
    if (ui.coins) ui.coins.textContent = String(state.coins);
    if (ui.bloom) ui.bloom.textContent = String(state.bloom);
    if (ui.bloom) {
      const standing = bloomStanding();
      ui.bloom.title = `${standing.name} · ${standing.copy}`;
    }
    if (ui.upgradeButton) {
      const project = projectForWeek(calendar.week, state.projectState);
      const projectWaiting = Boolean(project && !project.funded);
      const expansionWaiting = SHOP_EXPANSIONS.some((expansion) => calendar.week >= expansion.unlockWeek && !hasExpansion(expansion.id));
      const improvementWaiting = projectWaiting || expansionWaiting;
      const waitingLabel = projectWaiting ? `${project.title} is available this week` : "New permanent shop growth is available";
      ui.upgradeButton.classList.toggle("has-project", improvementWaiting);
      ui.upgradeButton.title = improvementWaiting ? waitingLabel : "Shop upgrades";
      ui.upgradeButton.setAttribute("aria-label", improvementWaiting ? `Shop upgrades, ${waitingLabel}` : "Shop upgrades");
    }
    if (ui.tradeDemand) ui.tradeDemand.textContent = `${state.customers.length || trade.visitorCount} visitors`;
    if (ui.tradeCost) {
      const cost = Number.isFinite(state.dailyOperatingCost) ? state.dailyOperatingCost : trade.operatingCost;
      ui.tradeCost.textContent = state.outstandingCosts
        ? `${coinCopy(cost)} + ${coinCopy(state.outstandingCosts)} due`
        : coinCopy(cost);
      ui.tradeCost.title = calendar.week >= 4
        ? "Base shop cost. Stock above the closing target uses 2 extra coins per plant."
        : "Today’s base shop cost.";
    }
    if (ui.tradeStock) ui.tradeStock.textContent = `${state.inventory.length}/${state.inventoryCapacity} plants`;
    if (ui.weekObjective) {
      const label = ui.weekObjective.querySelector("strong");
      if (label) label.textContent = weeklyObjectiveLabel(state.weeklyObjective);
      ui.weekObjective.classList.toggle("is-complete", Boolean(state.weeklyObjective?.completed));
      ui.weekObjective.title = state.weeklyObjective?.description || "This week's neighborhood goal";
    }
    document.body.dataset.shopPhase = state.phase;
    if (ui.soundButton) {
      ui.soundButton.setAttribute("aria-pressed", String(state.sound));
      ui.soundButton.dataset.sound = state.sound ? "on" : "off";
      ui.soundButton.title = state.sound ? "Mute sound" : "Turn sound on";
    }
    const person = state.phase === "open" ? currentCustomer() : null;
    const saleTransition = saleMessage || run.customerTween?.mode === "exit";
    if (ui.customerCard) {
      ui.customerCard.hidden = !person || saleTransition;
      ui.customerCard.classList.toggle("is-waiting", Boolean(person && !saleTransition));
    }
    if (person && !saleTransition) {
      if (ui.customerName) ui.customerName.textContent = person.name;
      if (ui.customerMeta) {
        const archetype = String(person.archetype || "neighbor").replaceAll("-", " ");
        ui.customerMeta.textContent = `${archetype} · ${person.isReturning ? `visit ${person.visitNumber || 2}` : "first visit"}`;
      }
      if (ui.customerRequest) ui.customerRequest.textContent = `“${person.line}”`;
      if (ui.customerMust) ui.customerMust.textContent = person.need;
      if (ui.customerWish) ui.customerWish.textContent = person.bonusTrait || "a thriving plant";
      if (ui.customerBudget) ui.customerBudget.textContent = `${person.budget} coins`;
      const addOn = currentCustomerAddOn(person);
      if (ui.customerAddonChip) ui.customerAddonChip.hidden = !addOn;
      if (ui.customerAddon) ui.customerAddon.textContent = addOn?.title || "none";
      if (ui.customerChips) ui.customerChips.classList.toggle("has-addon", Boolean(addOn));
      if (ui.customerAvatar) {
        ui.customerAvatar.style.backgroundImage = "";
        ui.customerAvatar.style.setProperty("--customer-color", `#${person.color.toString(16).padStart(6, "0")}`);
        const initial = ui.customerAvatar.querySelector("span");
        if (initial) initial.textContent = person.name.slice(0, 1);
      }
    }

    if (ui.arrangeButton) {
      const active = state.phase === "preparation" || run.arranging;
      ui.arrangeButton.hidden = !run.started || state.phase === "supply" || state.phase === "preparation" || state.phase === "report";
      ui.arrangeButton.setAttribute("aria-pressed", String(active));
      ui.arrangeButton.classList.toggle("is-active", active);
      ui.arrangeButton.title = active ? "Finish arranging displays" : "Arrange displays";
    }
    if (ui.benchButton) {
      const jobs = state.benchState?.jobs?.length || 0;
      ui.benchButton.hidden = !run.started || state.phase !== "preparation";
      ui.benchButton.classList.toggle("is-active", jobs > 0);
      ui.benchButton.title = jobs ? `Care bench · ${jobs} active ${jobs === 1 ? "job" : "jobs"}` : "Care bench";
      ui.benchButton.setAttribute("aria-label", jobs ? `Open the care bench, ${jobs} active ${jobs === 1 ? "job" : "jobs"}` : "Open the care bench");
    }
    if (ui.supplyButton) {
      const supply = migrateSupplyState(state.supplyState);
      const total = Object.values(supply.stock).reduce((sum, count) => sum + count, 0);
      const concerns = state.inventory.filter((plant) => plant.healthIssue).length;
      ui.supplyButton.hidden = !run.started || state.phase === "report";
      ui.supplyButton.classList.toggle("is-active", concerns > 0);
      ui.supplyButton.title = concerns
        ? `Retail supply shelf · ${concerns} ${concerns === 1 ? "plant needs" : "plants need"} treatment`
        : `Retail supply shelf · ${total} ${total === 1 ? "unit" : "units"} in stock`;
      ui.supplyButton.setAttribute("aria-label", ui.supplyButton.title);
    }
    if (ui.benchOverview) {
      const jobs = state.benchState?.jobs?.length || 0;
      const benchReady = state.phase === "preparation" && state.crates === 0 && !run.crateAnimation;
      ui.benchOverview.hidden = !run.started;
      ui.benchOverview.disabled = false;
      ui.benchOverview.classList.toggle("has-jobs", jobs > 0);
      ui.benchOverview.classList.toggle("is-ready", benchReady);
      if (ui.benchOverviewStatus) {
        if (jobs) {
          ui.benchOverviewStatus.textContent = `${jobs} active ${jobs === 1 ? "job" : "jobs"}. Open the bench to check completion days.`;
        } else if (benchReady) {
          ui.benchOverviewStatus.textContent = "Ready now. Choose a plant and start Repot, Rehabilitate, or Propagate.";
        } else if (state.phase === "preparation") {
          ui.benchOverviewStatus.textContent = `Open ${state.crates} more ${state.crates === 1 ? "carton" : "cartons"}, then start a bench job.`;
        } else if (state.phase === "supply") {
          ui.benchOverviewStatus.textContent = "Choose a shipment first. Bench jobs start during preparation.";
        } else {
          ui.benchOverviewStatus.textContent = "View jobs now. New jobs start during tomorrow’s preparation.";
        }
      }
    }
    if (ui.openShop) {
      const readyToOpen = state.phase === "preparation" && state.crates === 0 && !run.crateAnimation;
      ui.openShop.hidden = !readyToOpen;
      ui.openShop.disabled = !readyToOpen || !inventoryCoversCustomers(state.inventory, state.customers.slice(state.customerIndex));
    }
    if (ui.openAllCartons) {
      const batchAvailable = state.phase === "preparation"
        && canBatchUnpack({ day: state.day, crates: state.crates });
      ui.openAllCartons.hidden = !batchAvailable && !run.batchUnpackActive;
      ui.openAllCartons.disabled = run.busy || run.batchUnpackActive;
      const label = ui.openAllCartons.querySelector("span:first-child");
      if (label) label.textContent = run.batchUnpackActive
        ? `Opening delivery · ${state.crates} left`
        : `Open all ${state.crates} cartons`;
    }

    let action = "Select something";
    let disabled = true;
    let title = "Choose today’s stock";
    let copy = "Read the nursery clipboard and book one delivery.";
    if (state.phase === "preparation") {
      title = state.crates ? "Unpack the delivery" : "Prepare the displays";
      copy = state.crates
        ? `${state.crates} carton${state.crates === 1 ? "" : "s"} left. Open, care for, and place every arrival.`
        : "Care for anything thirsty, arrange the light, then open the shop when you are ready.";
    } else if (state.phase === "open") {
      title = person ? `A plant for ${person.name}` : "The last parcel is leaving";
      copy = person ? `Find a ${person.need} plant within ${person.name}'s ${person.budget}-coin budget.` : "Wrapping the last pot for its new home.";
    } else if (state.phase === "report") {
      title = "Shutters down";
      copy = "The day’s numbers and small victories are ready.";
    }
    if (state.displayGoal) copy += ` ${goalSummary()}.`;
    const selected = run.selected;
    if (selected?.kind === "crate") {
      action = state.crates ? `Open carton · ${state.crates} left` : "All cartons opened";
      disabled = state.phase !== "preparation" || state.crates <= 0;
    } else if (selected?.kind === "plant") {
      const plant = state.inventory.find((item) => item.id === selected.id);
      if (plant) {
        const spec = speciesOf(plant);
        const condition = conditionOf(plant);
        const fit = lightFit(plant);
        const specialCopy = spec.special ? " · rare nursery specimen" : "";
        const heldCopy = plant.held ? " · HELD for weekly order" : "";
        const goalFit = state.displayGoal && !state.displayGoal.claimed && plant.traits.includes(state.displayGoal.trait)
          ? ` Display fit: ${SLOT_DATA.find((slot) => slot.zone === state.displayGoal.zone)?.zoneLabel || state.displayGoal.zone}.`
          : "";
        title = plant.species;
        const growth = plant.lifeStage === "juvenile" ? ` · juvenile, ${plant.maturityDaysRemaining} mornings to mature` : "";
        const nurseryAgeCopy = plant.lifeStage === "mature" ? ` · shop age ${plant.nurseryAgeDays || 0} days` : "";
        const rehabCopy = plant.rehabilitationValueLoss ? ` · Rehabilitate restores ${plant.rehabilitationValueLoss} coins` : "";
        const treatmentCopy = plant.healthIssue
          ? ` · needs ${supplyItemForId(treatmentForIssue(plant.healthIssue))?.title || "treatment"}`
          : "";
        const fertilizerCopy = hasFertilizerGrowthBoost(plant, { day: state.day }) ? " · fertilizer boost active" : "";
        copy = `${plant.traits.join(" · ")}${specialCopy}${heldCopy}. ${condition.icon} ${condition.label}${growth}${nurseryAgeCopy}${rehabCopy}${treatmentCopy}${fertilizerCopy}. Soil ${Math.round(plant.hydration)}%. ${fit.label}. ${PRICE_BANDS[priceBandOf(plant)].label} tag: ${plantAskingPrice(plant)} coins.${goalFit}`;
        if (run.carried && run.carried !== plant.id && (run.arranging || state.phase === "preparation")) {
          const carried = state.inventory.find((item) => item.id === run.carried);
          action = `Swap with ${carried?.species || "moving plant"}`;
          disabled = !Number.isInteger(plant.slot);
        } else if (run.carried === plant.id) {
          action = "Choose a glowing display spot";
          disabled = true;
        } else if (!Number.isInteger(plant.slot)) {
          action = "Place on display";
          disabled = false;
        } else if (run.arranging || state.phase === "preparation") {
          action = "Move this plant";
          disabled = false;
        } else if (person) {
          action = plant.held ? "Held for weekly order" : `Offer for ${plantAskingPrice(plant)} coins`;
          disabled = Boolean(plant.held);
        }
      }
    } else if (selected?.kind === "customer" && person) {
      action = `What does ${person.name} need?`;
      disabled = false;
    } else if (selected?.kind === "slot") {
      action = run.carried ? "Place in this light" : "An empty display spot";
      disabled = !run.carried;
    } else if (selected?.kind === "station") {
      if (selected.id === "care-bench") {
        const jobs = state.benchState?.jobs?.filter((job) => job.type !== BENCH_JOB_TYPES.REHABILITATE).length || 0;
        title = "Care Bench";
        copy = jobs
          ? `${jobs} Repot or Propagate ${jobs === 1 ? "job is" : "jobs are"} using this bench capacity. Propagation plants root on the cutting rack.`
          : "Use this bench capacity for Repot and Propagate work. Rehabilitation has two separate Recovery Station places.";
        action = "Open Care Bench";
        disabled = false;
      } else if (selected.id === "rehabilitation-station") {
        const specialistJobs = state.benchState?.jobs?.filter((job) => (
          job.type === BENCH_JOB_TYPES.REHABILITATE || job.type === BENCH_JOB_TYPES.PROPAGATE
        )).length || 0;
        title = "Recovery and Propagation Work Area";
        copy = specialistJobs
          ? `${specialistJobs} specialist ${specialistJobs === 1 ? "job is" : "jobs are"} active here. Recovery plants and new cuttings stay on this separate bench.`
          : "This station clears nursery stress, restores lost sale value, and gives new cuttings a safe place to root.";
        action = "Open Specialist Jobs";
        disabled = false;
      } else if (selected.id === "watering-can") {
        const target = stationTargetPlant();
        title = "Watering Can";
        copy = target
          ? `${target.species} is the current plant. Its soil is ${Math.round(target.hydration)}% hydrated.`
          : "Choose a plant, then return here for a clear watering action.";
        action = target ? `Water ${target.species}` : "Choose a plant first";
        disabled = false;
      } else if (selected.id === "grow-lamp") {
        const assisted = state.benchState?.jobs?.filter((job) => job.lampAssisted).length || 0;
        title = "Grow Lamp";
        copy = assisted
          ? `Honey light is helping ${assisted} active Care Bench ${assisted === 1 ? "job" : "jobs"}.`
          : "New Care Bench jobs get more Repot value, longer Rehabilitate protection, or faster Propagate growth.";
        action = "Open Care Bench";
        disabled = false;
      } else if (selected.id === "supply-shelf") {
        const units = Object.values(migrateSupplyState(state.supplyState).stock).reduce((sum, count) => sum + count, 0);
        title = "Retail Supply Shelf";
        copy = `${units} care and retail items are in stock. Buy clip grow lights, fertilizer, treatments, and potting soil.`;
        action = "Open Supply Shelf";
        disabled = false;
      }
    }
    if (saleTransition) {
      title = run.lastSaleGrade === "perfect" ? "A perfect match" : run.lastSaleGrade === "lovely" ? "A lovely match" : "A good match";
      copy = "Wrapping the pot in yesterday’s newspaper…";
    }
    if (ui.taskTitle) ui.taskTitle.textContent = title;
    if (ui.taskCopy) ui.taskCopy.textContent = copy;
    if (ui.action) {
      const label = ui.action.querySelector("span:last-child");
      if (label) label.textContent = action;
      else ui.action.textContent = action;
      ui.action.disabled = disabled || run.busy;
    }
    const plant = selected?.kind === "plant" ? state.inventory.find((item) => item.id === selected.id) : null;
    renderPlantReadiness(plant, person);
    renderDeliveryOverview();
    if (ui.priceTray) {
      const showPrice = Boolean(plant && !plant.benchStatus && state.phase !== "supply" && state.phase !== "report");
      ui.priceTray.hidden = !showPrice;
      if (ui.priceAmount && plant) ui.priceAmount.textContent = `${plantAskingPrice(plant)} coins`;
      ui.priceButtons.forEach((button) => {
        const pressed = Boolean(plant && button.dataset.priceBand === priceBandOf(plant));
        button.setAttribute("aria-pressed", String(pressed));
        button.disabled = !plant || run.busy;
      });
    }
    if (ui.careTray) {
      const showCare = Boolean(plant && !plant.benchStatus && state.phase !== "supply" && state.phase !== "report");
      ui.careTray.hidden = !showCare;
      ui.careTray.classList.toggle("is-visible", showCare);
    }
    CARES.forEach((care) => {
      if (!ui.care[care]) return;
      const beneficial = Boolean(plant && speciesOf(plant).beneficialCare.includes(care));
      const done = care === "water"
        ? Boolean(plant?.care.water && plant.hydration >= 78)
        : Boolean(plant?.care[care]);
      const needed = care === "water"
        ? Boolean(plant && plant.hydration < 78)
        : Boolean(plant && beneficial && !plant.care[care]);
      ui.care[care].disabled = !plant || run.busy;
      ui.care[care].classList.toggle("is-done", done);
      ui.care[care].dataset.needed = String(needed);
      ui.care[care].dataset.helpful = String(beneficial);
      ui.care[care].title = beneficial ? `Helpful care for ${plant?.species || "this plant"}` : `Optional; ${plant?.species || "this plant"} does not benefit from this`;
      ui.care[care].setAttribute("aria-pressed", String(done));
      if (care === "water" && plant) ui.care[care].setAttribute("aria-label", `Water plant, soil hydration ${Math.round(plant.hydration)} percent`);
    });
    requestAnimationFrame(positionCustomerCard);
  }

  function positionCustomerCard() {
    if (!ui.customerCard || !ui.taskCard) return;
    if (innerWidth <= 600 && innerHeight > innerWidth) {
      ui.customerCard.style.top = `${Math.ceil(ui.taskCard.getBoundingClientRect().bottom + 10)}px`;
    } else {
      ui.customerCard.style.top = "";
    }
  }

  function toast(message, duration = 3100) {
    if (!ui.toast) return;
    clearTimeout(run.toastTimer);
    ui.toast.textContent = message;
    ui.toast.hidden = false;
    ui.toast.classList.add("is-visible");
    run.toastTimer = setTimeout(() => {
      ui.toast.classList.remove("is-visible");
      setTimeout(() => { ui.toast.hidden = true; }, reduceMotion ? 0 : 250);
    }, duration);
  }

  function pointerDown(event) {
    if (!run.started) return;
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, time: performance.now() });
    if (pointers.size === 1) run.lastPointer = { x: event.clientX, y: event.clientY };
    if (pointers.size === 2) run.pinchDistance = pointerDistance();
  }

  function pointerMove(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7) pointer.moved = true;
    if (pointers.size === 2) {
      const distance = pointerDistance();
      if (run.pinchDistance > 0) setZoom(run.zoom * (distance / run.pinchDistance));
      run.pinchDistance = distance;
      pointers.forEach((item) => { item.moved = true; });
    } else if (pointers.size === 1 && pointer.moved) {
      panCamera(dx, dy);
    }
  }

  function pointerUp(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    if (!pointer.moved && performance.now() - pointer.time < 600) pick(event.clientX, event.clientY);
    pointers.delete(event.pointerId);
    run.lastPointer = null;
    run.pinchDistance = pointers.size === 2 ? pointerDistance() : 0;
  }

  function pointerDistance() {
    const values = [...pointers.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  function panCamera(dx, dy) {
    const scale = 14 / run.zoom / Math.max(canvas.clientHeight, 1);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    right.y = 0;
    right.normalize();
    const forward = new THREE.Vector3(cameraTarget.x - camera.position.x, 0, cameraTarget.z - camera.position.z).normalize();
    cameraTarget.addScaledVector(right, -dx * scale);
    cameraTarget.addScaledVector(forward, -dy * scale * 1.1);
    cameraTarget.x = clamp(cameraTarget.x, -2.6, 2.6);
    cameraTarget.z = clamp(cameraTarget.z, -2.1, 2.2);
    updateCamera();
  }

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(interactive.filter((object) => object.visible && object.parent), true);
    let object = hits[0]?.object;
    while (object && !object.userData.entity) object = object.parent;
    const entity = object?.userData.entity;
    if (!entity) {
      cancelMove();
      run.selected = null;
      if (run.selectionRing) run.selectionRing.visible = false;
      document.body.dataset.selection = "none";
      updateSlotGlow();
      updateUi();
      return;
    }
    if (entity.kind === "slot" && run.carried) {
      const occupant = state.inventory.find((plant) => plant.id === object.userData.occupantId)
        || state.inventory.find((plant) => plant.slot === entity.id && plant.id !== run.carried);
      if (occupant && (run.arranging || state.phase === "preparation")) swapPlants(run.carried, occupant.id);
      else placePlant(run.carried, entity.id);
      return;
    }
    selectEntity(entity, object);
  }

  function wheel(event) {
    if (!run.started) return;
    event.preventDefault();
    setZoom(run.zoom * Math.exp(-event.deltaY * 0.0012));
  }

  function setZoom(value) {
    run.zoom = clamp(value, 0.72, 1.75);
    resize();
  }

  function rotateView(direction) {
    run.viewAngle = clamp(run.viewAngle + direction * 0.16, 0.28, 1.08);
    updateCamera();
    sound("rotate");
  }

  function updateCamera() {
    const radius = 18;
    camera.position.set(cameraTarget.x + Math.sin(run.viewAngle) * radius, cameraTarget.y + 12.3, cameraTarget.z + Math.cos(run.viewAngle) * radius);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
  }

  function resize() {
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    const aspect = width / height;
    const portraitBoost = aspect < 0.75 ? 1.14 : 1;
    const desktopDiorama = width >= 1024 && height >= 600;
    if (exteriorDioramaRoot) exteriorDioramaRoot.visible = desktopDiorama;
    const viewHeight = (desktopDiorama ? 15.4 : 13.2) * portraitBoost / run.zoom;
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 700 ? 1.5 : 2));
    renderer.setSize(width, height, false);
    if (ui.orientation) {
      const show = run.started && !run.orientationDismissed && width < 350 && height > width * 1.8;
      ui.orientation.hidden = !show;
      ui.orientation.classList.toggle("is-visible", show);
      clearTimeout(run.orientationTimer);
      if (show) run.orientationTimer = setTimeout(dismissOrientationHint, 2200);
    }
    requestAnimationFrame(positionCustomerCard);
  }

  function dismissOrientationHint() {
    run.orientationDismissed = true;
    clearTimeout(run.orientationTimer);
    if (!ui.orientation) return;
    ui.orientation.hidden = true;
    ui.orientation.classList.remove("is-visible");
  }

  function keyDown(event) {
    const modal = currentOpenModal();
    if (modal && event.key === "Tab") {
      trapModalFocus(event, modal);
      return;
    }
    if (event.key === "Escape") {
      if (modal === ui.upgradeModal) openModal(ui.upgradeModal, false);
      if (modal === ui.benchModal) openModal(ui.benchModal, false);
      if (modal === ui.supplyModal) openModal(ui.supplyModal, false);
      if (modal === ui.weeklyOrderModal) openModal(ui.weeklyOrderModal, false);
      if (modal === ui.helpModal) openModal(ui.helpModal, false);
      return;
    }
    if (modal) return;
    if (!run.started || event.target instanceof HTMLInputElement) return;
    if (event.key === "1") careForPlant("water");
    if (event.key === "2") careForPlant("mist");
    if (event.key === "3") careForPlant("prune");
    if (event.key === "4") setPriceBand("quick");
    if (event.key === "5") setPriceBand("fair");
    if (event.key === "6") setPriceBand("boutique");
    if (event.key.toLowerCase() === "q") {
      event.preventDefault();
      cycleKeyboardSelection(event.shiftKey ? -1 : 1);
    }
    if (event.key.toLowerCase() === "e") doAction();
    if (event.key === "ArrowLeft") rotateView(-1);
    if (event.key === "ArrowRight") rotateView(1);
  }

  function cycleKeyboardSelection(direction) {
    const candidates = sortKeyboardTargets(
      interactive.filter((object) => object.visible && object.parent && object.userData.entity),
      state.inventory.map((plant) => plant.id),
    );
    if (!candidates.length) return;
    const currentIndex = candidates.indexOf(run.selected?.object);
    const nextIndex = currentIndex < 0
      ? direction > 0 ? 0 : candidates.length - 1
      : (currentIndex + direction + candidates.length) % candidates.length;
    const object = candidates[nextIndex];
    run.keyboardIndex = nextIndex;
    const entity = object.userData.entity;
    selectEntity(entity, object);
    const plant = entity.kind === "plant" ? state.inventory.find((item) => item.id === entity.id) : null;
    const label = plant?.species || object.userData.stationLabel || (entity.kind === "crate" ? "cartons" : entity.kind);
    toast(`Selected ${label}. Press E to act.`, 1700);
  }

  function ensureAudio() {
    if (!state.sound) return null;
    if (!run.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      run.audio = new AudioContext();
      run.master = run.audio.createGain();
      run.master.gain.value = 0.13;
      run.master.connect(run.audio.destination);
    }
    if (run.audio.state === "suspended") run.audio.resume();
    return run.audio;
  }

  function toggleSound() {
    state.sound = !state.sound;
    save();
    if (state.sound) {
      ensureAudio();
      sound("open");
    }
    updateUi();
  }

  function tone(frequency, at, length, type = "sine", gain = 0.12) {
    const context = ensureAudio();
    if (!context || !run.master) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + at);
    envelope.gain.setValueAtTime(0.0001, context.currentTime + at);
    envelope.gain.exponentialRampToValueAtTime(gain, context.currentTime + at + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + at + length);
    oscillator.connect(envelope).connect(run.master);
    oscillator.start(context.currentTime + at);
    oscillator.stop(context.currentTime + at + length + 0.03);
  }

  function sound(kind) {
    if (!state.sound) return;
    const sounds = {
      open: [[262, 0, 0.16], [330, 0.08, 0.18], [392, 0.17, 0.28]],
      crate: [[120, 0, 0.12, "square", 0.05], [196, 0.1, 0.2]],
      pluck: [[440, 0, 0.09, "triangle", 0.06]],
      place: [[330, 0, 0.1], [495, 0.07, 0.18]],
      water: [[240, 0, 0.18, "sine", 0.04], [185, 0.12, 0.2, "sine", 0.04]],
      mist: [[700, 0, 0.08, "sine", 0.03], [820, 0.06, 0.12, "sine", 0.025]],
      prune: [[520, 0, 0.06, "square", 0.035], [360, 0.07, 0.08, "square", 0.025]],
      sale: [[392, 0, 0.14], [494, 0.1, 0.18], [659, 0.2, 0.32]],
      error: [[155, 0, 0.12, "sawtooth", 0.035], [135, 0.1, 0.18, "sawtooth", 0.025]],
      hint: [[330, 0, 0.12], [392, 0.09, 0.16]],
      rotate: [[260, 0, 0.08, "triangle", 0.025]],
      upgrade: [[262, 0, 0.18], [392, 0.12, 0.22], [523, 0.25, 0.45]],
      moth: [[523, 0, 0.28], [659, 0.18, 0.35], [784, 0.38, 0.52]],
      report: [[330, 0, 0.18], [294, 0.14, 0.2], [262, 0.28, 0.38]],
    };
    (sounds[kind] || []).forEach((args) => tone(...args));
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    updatePlantCondition(dt);
    plantObjects.forEach((object) => {
      const plant = state.inventory.find((item) => item.id === object.userData.plantId);
      if (!plant) return;
      const issueDroop = plant.healthIssueSeverity === "severe"
        ? 0.54
        : plant.healthIssueSeverity === "established"
          ? 0.34
          : plant.healthIssue ? 0.18 : 0;
      const targetDroop = Math.max(
        clamp((48 - plant.hydration) / 40, 0, 1),
        issueDroop,
        plant.needsRehabilitation ? 0.14 : 0,
      );
      object.userData.droop = lerp(object.userData.droop || 0, targetDroop, 1 - Math.exp(-dt * 3.3));
      const droop = object.userData.droop;
      const growth = 1
        + Math.min(0.055, Math.max(0, Number(plant.growthPoints) || 0) * 0.009)
        + (plant.growthBoost ? 0.025 : 0);
      (object.userData.leaves || []).forEach((leaf, index) => {
        const basePosition = leaf.userData.basePosition;
        const baseEuler = leaf.userData.baseEuler;
        const baseScale = leaf.userData.baseScale;
        if (!basePosition || !baseEuler || !baseScale) return;
        const angle = leaf.userData.radialAngle;
        const sway = reduceMotion ? 0 : Math.sin(time * 0.75 + object.userData.phase + index) * 0.018;
        leaf.position.copy(basePosition);
        leaf.position.y -= droop * (0.12 + (index % 3) * 0.025);
        leaf.rotation.copy(baseEuler);
        leaf.rotation.x += Math.sin(angle) * droop * 0.34;
        leaf.rotation.z += Math.cos(angle) * droop * 0.46 + sway;
        leaf.scale.copy(baseScale);
        leaf.scale.y *= 1 - droop * 0.18;
        leaf.scale.multiplyScalar(growth);
      });

      const yellow = visibleLeafStress(plant);
      const colorEase = 1 - Math.exp(-dt * 1.8);
      (object.userData.foliageColorStates || []).forEach((entry) => {
        const targetR = lerp(entry.healthy.r, yellowLeafColor.r, yellow);
        const targetG = lerp(entry.healthy.g, yellowLeafColor.g, yellow);
        const targetB = lerp(entry.healthy.b, yellowLeafColor.b, yellow);
        entry.material.color.r = lerp(entry.material.color.r, targetR, colorEase);
        entry.material.color.g = lerp(entry.material.color.g, targetG, colorEase);
        entry.material.color.b = lerp(entry.material.color.b, targetB, colorEase);
      });

      const roots = object.userData.rootOvergrowth;
      if (roots) {
        const rootsTarget = plant.rootComfort === "comfortable" ? 0 : 1;
        object.userData.rootGrowthVisual = lerp(
          object.userData.rootGrowthVisual || 0,
          rootsTarget,
          1 - Math.exp(-dt * 2.25),
        );
        const rootScale = object.userData.rootGrowthVisual;
        roots.visible = rootScale > 0.012;
        roots.scale.setScalar(Math.max(0.001, rootScale));
      }

      Object.entries(object.userData.issueVisuals || {}).forEach(([issue, markers]) => {
        const issueTarget = plant.healthIssue === issue ? 1 : 0;
        const current = object.userData.issueVisualScale?.[issue] || 0;
        const next = lerp(current, issueTarget, 1 - Math.exp(-dt * 3.2));
        object.userData.issueVisualScale[issue] = next;
        markers.forEach((marker, index) => {
          marker.visible = next > 0.012;
          const pulse = !reduceMotion && issueTarget
            ? 1 + Math.sin(time * 1.8 + index * 1.7) * 0.045
            : 1;
          marker.scale.setScalar(Math.max(0.001, next * pulse));
        });
      });
    });
    if (!reduceMotion && run.selectionRing?.visible) run.selectionRing.material.opacity = 0.65 + Math.sin(time * 4) * 0.18;
    updateCartonOpening(dt);
    updateMovers(dt);
    updateWateringCan(dt);
    updateEffects(dt);
    updateGrowLamp(time);
    updateExteriorAmbient(time);
    updateCustomer(dt, time);
    updateMoth(dt);
    updateSelectionRing();
    renderer.render(scene, camera);
  }

  function updateGrowLamp(time) {
    const lamp = world.getObjectByName("grow-lamp");
    if (!lamp?.visible) return;
    const active = state.benchState?.jobs?.some((job) => job.lampAssisted && job.status !== "ready");
    const pulse = active && !reduceMotion ? (Math.sin(time * 4.2) + 1) * 0.5 : 0;
    if (lamp.userData.bulb) lamp.userData.bulb.intensity = active ? 5.2 + pulse * 1.8 : 2.3;
    if (lamp.userData.glow) {
      lamp.userData.glow.material.emissiveIntensity = active ? 2.2 + pulse * 1.5 : 1.25;
      lamp.userData.glow.scale.setScalar(active ? 1 + pulse * 0.16 : 1);
    }
  }

  function updateExteriorAmbient(time) {
    if (!exteriorDioramaRoot?.visible || reduceMotion || document.hidden) return;
    const breeze = Math.sin(time * 0.33) * 0.65 + Math.sin(time * 0.11) * 0.35;
    exteriorAmbient.forEach((item) => {
      item.root.rotation.z = item.baseZ
        + breeze * item.amplitude
        + Math.sin(time * item.speed + item.phase) * item.amplitude * 0.35;
    });
  }

  function updatePlantCondition(dt) {
    const active = run.started
      && document.body.dataset.gameState === "playing"
      && !document.hidden
      && !run.busy
      && !ui.game?.inert;
    if (active) {
      const barrelMultiplier = state.upgrades.rainBarrel ? 0.65 : 1;
      state.inventory.forEach((plant) => {
        if (plant.benchStatus) return;
        const before = plant.hydration;
        const protectionMultiplier = isConditionProtected(plant, state.day) ? 0.25 : 1;
        plant.hydration = clamp(plant.hydration - speciesOf(plant).dryRate * barrelMultiplier * protectionMultiplier * dt, 8, 100);
        if (plant.hydration !== before) run.conditionDirty = true;
        if (plant.hydration <= 34 && !plant.thirstWarned) {
          plant.thirstWarned = true;
          if (run.selected?.kind === "plant" && run.selected.id === plant.id) {
            toast(`${plant.species} is properly drooping now. A drink will bring it back.`);
          }
        }
      });
      run.conditionUiTimer += dt;
      run.conditionSaveTimer += dt;
      if (run.conditionUiTimer >= 0.8) {
        run.conditionUiTimer = 0;
        if (run.selected?.kind === "plant") updateUi();
      }
      if (run.conditionDirty && run.conditionSaveTimer >= 8) {
        run.conditionSaveTimer = 0;
        run.conditionDirty = false;
        save();
      }
    }
  }

  function queueMover(move) {
    const stationaryMove = move.from.distanceToSquared(move.to) < 0.000001;
    for (let index = movers.length - 1; index >= 0; index -= 1) {
      const current = movers[index];
      if (current.object !== move.object) continue;
      current.object.position.copy(current.to);
      current.object.scale.setScalar(current.endScale);
      if (current.remove) current.object.removeFromParent();
      movers.splice(index, 1);
    }
    move.from = move.object.position.clone();
    move.startScale = move.object.scale.x;
    if (stationaryMove) move.to = move.object.position.clone();
    movers.push(move);
  }

  function updateMovers(dt) {
    for (let index = movers.length - 1; index >= 0; index -= 1) {
      const move = movers[index];
      move.time += dt;
      const raw = clamp(move.time / move.duration, 0, 1);
      const t = 1 - (1 - raw) ** 3;
      move.object.position.lerpVectors(move.from, move.to, t);
      move.object.position.y += Math.sin(raw * Math.PI) * move.arc;
      const scale = lerp(move.startScale, move.endScale, t);
      move.object.scale.setScalar(scale);
      if (raw >= 1) {
        move.object.position.copy(move.to);
        move.object.scale.setScalar(move.endScale);
        if (move.remove) move.object.removeFromParent();
        movers.splice(index, 1);
      }
    }
  }

  function updateEffects(dt) {
    for (let index = effects.length - 1; index >= 0; index -= 1) {
      const effect = effects[index];
      effect.age += dt;
      const progress = clamp(effect.age / effect.duration, 0, 1);
      if (effect.kind === "water") {
        effect.bits.forEach((bit) => {
          if (effect.age < bit.delay) return;
          bit.object.visible = true;
          bit.velocity.y -= dt * 0.72;
          bit.object.position.addScaledVector(bit.velocity, dt);
          bit.object.scale.multiplyScalar(1 - dt * 0.9);
        });
        const splash = clamp((effect.age - 0.33) / 0.48, 0, 1);
        effect.rippleMaterial.opacity = Math.sin(splash * Math.PI) * 0.72;
        effect.ripple.scale.setScalar(0.2 + splash * 3.2);
        effect.materials[0].opacity = 0.92 * (1 - progress ** 3);
      } else if (effect.kind === "mist") {
        effect.bits.forEach((bit) => {
          bit.object.position.addScaledVector(bit.velocity, dt);
          bit.object.scale.multiplyScalar(1 + dt * 0.42);
        });
        effect.materials[0].opacity = 0.48 * Math.sin((1 - progress) * Math.PI / 2);
      } else {
        effect.bits.forEach((bit) => {
          bit.velocity.y -= dt * 1.8;
          bit.object.position.addScaledVector(bit.velocity, dt);
          bit.object.scale.multiplyScalar(1 - dt * 0.45);
        });
      }
      if (effect.age >= effect.duration) {
        effect.root.removeFromParent();
        effect.geometries?.forEach((geometry) => geometry.dispose());
        effect.materials?.forEach((material) => material.dispose());
        effects.splice(index, 1);
      }
    }
  }

  function updateCustomer(dt, time) {
    if (!run.customer) return;
    if (!run.customerTween) {
      animateCharacter3D(run.customer, { time, walking: false, carrying: false, reduceMotion });
      return;
    }
    const tween = run.customerTween;
    tween.time += dt;
    const delay = tween.delay || 0;
    if (tween.time < delay) {
      animateCharacter3D(run.customer, { time, walking: false, carrying: false, reduceMotion });
      return;
    }
    const duration = reduceMotion ? 0.01 : tween.mode === "enter" ? 2.15 : 2.05;
    const t = clamp((tween.time - delay) / duration, 0, 1);
    if (tween.mode === "enter") {
      const travel = 1 - (1 - t) ** 2.15;
      const turn = clamp((t - 0.7) / 0.3, 0, 1);
      run.customer.position.x = lerp(6.2, 0.15, travel);
      run.customer.position.z = lerp(4.45, 3.32, travel);
      run.customer.rotation.y = lerp(-1.75, 0.68, turn * turn * (3 - 2 * turn));
      animateCharacter3D(run.customer, {
        time,
        walking: t < 0.94,
        carrying: false,
        reduceMotion,
        walkSpeed: 0.92,
      });
    } else {
      const turn = clamp(t / 0.18, 0, 1);
      const move = clamp((t - 0.09) / 0.91, 0, 1);
      const travel = move * move * (3 - 2 * move);
      run.customer.rotation.y = lerp(0.68, 1.39, turn * turn * (3 - 2 * turn));
      run.customer.position.x = lerp(0.15, 6.5, travel);
      run.customer.position.z = lerp(3.32, 4.45, travel);
      animateCharacter3D(run.customer, {
        time,
        walking: t > 0.08 && t < 0.98,
        carrying: true,
        reduceMotion,
        walkSpeed: 0.98,
      });
    }
    if (t >= 1) {
      if (tween.mode === "exit") {
        unregister(run.customer, { dispose: true });
        run.customer = null;
        run.customerTween = null;
        if (tween.advance === "report") showReport();
        else spawnCustomer(true);
        return;
      } else {
        run.busy = false;
      }
      run.customerTween = null;
      updateUi();
    }
  }

  function updateMoth(dt) {
    if (!run.moth) return;
    const moth = run.moth;
    moth.age += dt;
    const t = moth.age;
    moth.root.position.set(2.5 - t * 0.38, 3.8 + Math.sin(t * 2.4) * 0.7, -4.3 + Math.sin(t * 1.2) * 1.6);
    moth.root.rotation.y = Math.sin(t) * 0.7;
    const flap = Math.sin(t * 18) * 0.8;
    moth.left.rotation.y = flap;
    moth.right.rotation.y = Math.PI - flap;
    if (moth.age > 12) {
      moth.root.removeFromParent();
      run.moth = null;
    }
  }
});
