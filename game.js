import * as THREE from "./vendor/three.module.min.js";
import { createCharacter3D, animateCharacter3D } from "./character-models.js";
import { createDistinctPlant3D } from "./plant-models.js";
import {
  CARES,
  CUSTOMERS,
  INVENTORY_CAPACITY,
  SAVE_VERSION,
  SLOT_DATA,
  SPECIES,
} from "./game-data.js";
import { generateSupplierLots, inventoryCoversCustomers } from "./supplier-system.js";

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const STORAGE_KEY = "mostly-alive-plants-save-v2";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  return {
    id: `plant-${Date.now().toString(36)}-${Math.floor(rng() * 1e7).toString(36)}`,
    speciesId: species.id,
    species: species.name,
    traits: [...species.traits],
    price: species.price + Math.floor(rng() * 4),
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
    rootComfort: "comfortable",
    pot: "nursery-terracotta",
    soil: "standard",
    parentId: null,
    benchStatus: null,
    held: false,
    cosmeticVariation: { hueShift: colorShift },
    recoveredToday: false,
    thirstWarned: false,
    slot: null,
  };
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
    sound: true,
    inventoryCapacity: INVENTORY_CAPACITY,
    inventory: [fern, pothos],
    customers: [],
    crateQueue: [],
    crates: 0,
    phase: "supply",
    supplierOptions: [],
    selectedLotId: null,
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
    displayGoal: null,
    mothSeen: false,
    upgrades: { growLamp: false, rainBarrel: false },
  };
}

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!value || !Array.isArray(value.inventory)) return freshState();
    const base = freshState();
    const oldVersion = Number(value.version) || 1;
    const customers = Array.isArray(value.customers) ? value.customers.map((customer, index) => {
      const species = SPECIES.find((item) => item.name === customer.speciesHint) || SPECIES[index % SPECIES.length];
      const need = customer.need || species.traits[0];
      return {
        ...customer,
        need,
        bonusTrait: customer.bonusTrait || species.traits.find((trait) => trait !== need) || species.traits[0],
        careWish: species.beneficialCare.includes(customer.careWish)
          ? customer.careWish
          : species.beneficialCare[index % species.beneficialCare.length],
      };
    }) : [];
    const migratedPhase = oldVersion >= 4 && ["supply", "preparation", "open", "report"].includes(value.phase)
      ? value.phase
      : Number(value.customerIndex) >= 3
        ? "report"
        : Number(value.crates) > 0
          ? "preparation"
          : "open";
    const occupiedSlots = new Set();
    const inventory = value.inventory.map((plant) => {
      const species = speciesForRecord(plant);
      const validSlot = Number.isInteger(plant.slot)
        && SLOT_DATA[plant.slot]
        && !occupiedSlots.has(plant.slot);
      if (validSlot) occupiedSlots.add(plant.slot);
      const colorShift = Number.isFinite(plant.colorShift) ? plant.colorShift : 0;
      return {
        priceBand: "fair",
        lifeStage: "mature",
        rootComfort: "comfortable",
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
        recoveredToday: Boolean(plant.recoveredToday),
        thirstWarned: Boolean(plant.thirstWarned),
        care: { water: false, mist: false, prune: false, ...(plant.care || {}) },
      };
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
    return {
      ...base,
      ...value,
      version: SAVE_VERSION,
      phase: migratedPhase,
      supplierOptions: Array.isArray(value.supplierOptions) ? value.supplierOptions : [],
      selectedLotId: value.selectedLotId || null,
      inventoryCapacity: Number.isFinite(value.inventoryCapacity) ? Math.max(INVENTORY_CAPACITY, value.inventoryCapacity) : INVENTORY_CAPACITY,
      dailyStockCost: Number.isFinite(value.dailyStockCost) ? value.dailyStockCost : 0,
      dailyCostOfGoods: migratedCostOfGoods,
      dailyStartingCoins: migratedStartingCoins,
      accountingEstimate: Boolean(value.accountingEstimate || hasLegacySales),
      dailyBloomStart: Number.isFinite(value.dailyBloomStart) ? value.dailyBloomStart : Number.isFinite(value.bloom) ? value.bloom : base.bloom,
      upgrades: { ...base.upgrades, ...(value.upgrades || {}) },
      customers,
      crateQueue,
      crates: crateQueue.length,
      inventory,
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

document.addEventListener("DOMContentLoaded", () => {
  const canvas = $("game-canvas");
  if (!canvas) return;

  const ui = {
    title: $("title-screen") || document.querySelector(".title-screen"),
    start: $("start-game") || document.querySelector(".primary-button"),
    loading: $("loading-progress") || $("status"),
    game: $("game-ui"),
    day: $("topbar-day"),
    coins: $("topbar-coins"),
    bloom: $("topbar-bloom"),
    taskCard: document.querySelector(".task-card"),
    taskTitle: $("task-title"),
    taskCopy: $("task-copy"),
    openShop: $("open-shop-button"),
    action: $("action-button"),
    careTray: $("care-tray"),
    care: { water: $("care-water"), mist: $("care-mist"), prune: $("care-prune") },
    customerCard: $("customer-card"),
    customerAvatar: document.querySelector(".customer-avatar"),
    customerName: $("customer-name"),
    customerRequest: $("customer-request"),
    toast: $("toast"),
    report: $("day-report"),
    reportTitle: $("report-title"),
    reportCopy: $("report-copy"),
    nextDay: $("next-day"),
    upgradeModal: $("upgrade-modal"),
    upgradeOptions: $("upgrade-options"),
    closeUpgrades: $("close-upgrades"),
    upgradeButton: $("upgrade-button"),
    arrangeButton: $("arrange-button"),
    supplierBoard: $("supplier-board"),
    supplierTitle: $("supplier-title"),
    supplierForecast: $("supplier-forecast"),
    supplierStatus: $("supplier-status"),
    supplierOptions: $("supplier-options"),
    soundButton: $("sound-button"),
    helpButton: $("help-button"),
    helpModal: $("help-modal"),
    closeHelp: $("close-help"),
    rotateLeft: $("rotate-left"),
    rotateRight: $("rotate-right"),
    orientation: $("orientation-hint"),
  };

  const state = loadState();
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
  const pointers = new Map();
  const staging = [
    new THREE.Vector3(3.15, 1.12, -2.45),
    new THREE.Vector3(3.95, 1.12, -2.45),
    new THREE.Vector3(4.75, 1.12, -2.45),
    new THREE.Vector3(3.95, 1.12, -3.35),
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
  bindUi();
  resize();
  loadShop();

  function save() {
    state.version = SAVE_VERSION;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }

  function makeDisplayGoal(rng) {
    const deliveries = state.crateQueue.map((entry) => speciesOfName(deliverySpeciesName(entry))).filter(Boolean);
    const stock = state.inventory.map(speciesOf);
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
      return state.inventory.some((plant) => plant.traits.includes(moment.trait)
        && SLOT_DATA[plant.slot]?.zone !== moment.zone);
    });
    let choice = possible[Math.floor(rng() * possible.length)];
    if (!choice) {
      const fallback = [];
      state.inventory.forEach((plant) => SLOT_DATA.forEach((slot) => {
        if (SLOT_DATA[plant.slot]?.zone === slot.zone) return;
        const trait = plant.traits[Math.floor(rng() * plant.traits.length)];
        fallback.push({ trait, zone: slot.zone, copy: `Feature something ${trait} on the ${slot.zoneLabel}.` });
      }));
      deliveries.forEach((species) => SLOT_DATA.forEach((slot) => {
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
    if (!force && state.customers?.length === 3 && Array.isArray(state.crateQueue)) {
      if (state.phase === "supply" && !state.supplierOptions?.length) {
        state.supplierOptions = generateSupplierLots({
          day: state.day,
          customers: state.customers,
          inventory: state.inventory,
          coins: state.coins,
          capacity: state.inventoryCapacity,
        });
      }
      if (!state.displayGoal && state.crateQueue.length) state.displayGoal = makeDisplayGoal(seeded(state.day * 1999 + 73));
      if (state.phase === "preparation" && state.crates === 0 && !state.displayGoal) {
        state.displayGoal = makeDisplayGoal(seeded(state.day * 1999 + 73));
      }
      return;
    }
    const rng = seeded(state.day * 9187 + 41);
    state.customers = [];
    state.crateQueue = [];
    const usedPeople = new Set();
    for (let index = 0; index < 3; index += 1) {
      const speciesPool = index === 0 ? SPECIES.filter((species) => species.dryRate >= 0.1) : SPECIES;
      const species = speciesPool[Math.floor(rng() * speciesPool.length)];
      let personIndex = (Math.floor(rng() * CUSTOMERS.length) + index) % CUSTOMERS.length;
      while (usedPeople.has(personIndex)) personIndex = (personIndex + 1) % CUSTOMERS.length;
      usedPeople.add(personIndex);
      const person = CUSTOMERS[personIndex];
      const need = species.traits[Math.floor(rng() * species.traits.length)];
      const bonusTrait = species.traits.find((trait) => trait !== need) || species.traits[0];
      const careWish = species.beneficialCare[Math.floor(rng() * species.beneficialCare.length)];
      state.customers.push({ ...person, need, bonusTrait, careWish, speciesHint: species.name });
    }
    if (state.inventory.length) {
      const stockPlant = state.inventory[Math.floor(rng() * state.inventory.length)];
      const stockSpecies = speciesOfName(stockPlant.species);
      const need = stockSpecies.traits[Math.floor(rng() * stockSpecies.traits.length)];
      state.customers[0] = {
        ...state.customers[0],
        need,
        bonusTrait: stockSpecies.traits.find((trait) => trait !== need) || need,
        careWish: stockSpecies.beneficialCare[Math.floor(rng() * stockSpecies.beneficialCare.length)],
        speciesHint: stockSpecies.name,
      };
    }
    if (state.inventoryCapacity - state.inventory.length < 3 && state.inventory.length >= 3) {
      const displayedStock = state.inventory.filter((plant) => Number.isInteger(plant.slot));
      const stockPool = displayedStock.length >= 3 ? displayedStock : state.inventory;
      const offset = Math.floor(rng() * stockPool.length);
      state.customers = state.customers.map((customer, index) => {
        const stockPlant = stockPool[(offset + index) % stockPool.length];
        const stockSpecies = speciesOfName(stockPlant.species);
        const need = stockSpecies.traits[Math.floor(rng() * stockSpecies.traits.length)];
        return {
          ...customer,
          need,
          bonusTrait: stockSpecies.traits.find((trait) => trait !== need) || need,
          careWish: stockSpecies.beneficialCare[Math.floor(rng() * stockSpecies.beneficialCare.length)],
          speciesHint: stockSpecies.name,
        };
      });
    }
    state.phase = "supply";
    state.crates = 0;
    state.selectedLotId = null;
    state.dailyStockCost = 0;
    state.dailyStartingCoins = state.coins;
    state.dailyBloomStart = state.bloom;
    state.displayGoal = null;
    state.supplierOptions = generateSupplierLots({
      day: state.day,
      customers: state.customers,
      inventory: state.inventory,
      coins: state.coins,
      capacity: state.inventoryCapacity,
    });
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
    box(world, [2.4, 0.18, 2.1], [3.9, 1.02, -3.05], woodMat);
    [[3, -3.85], [4.8, -3.85], [3, -2.25], [4.8, -2.25]].forEach(([x, z]) => box(world, [0.16, 1.05, 0.16], [x, 0.52, z], darkWood));
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
    world.add(wateringCan);

    makeSlots();
    makeCrates();
    makeGrowLamp(brass);
    makeRainBarrel(woodMat, brass);
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
      world.add(object);
      interactive.push(object);
      slotObjects.set(index, object);
    });
  }

  function makeCrates() {
    const root = new THREE.Group();
    root.position.set(4.55, 0.03, 3.15);
    const cardboard = material(0xc99863);
    const cardboardEdge = material(0x8c5f3c);
    const packingPaper = material(0xe7c985);

    for (let layer = 0; layer < 3; layer += 1) {
      const carton = new THREE.Group();
      carton.name = `carton-${layer}`;
      carton.position.set((layer % 2) * 0.18, layer * 0.65, -layer * 0.08);

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
    root.position.set(5.55, 0, -3.2);
    root.visible = Boolean(state.upgrades.growLamp);
    root.name = "grow-lamp";
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
    root.position.set(5.18, 0.03, -1.12);
    root.visible = Boolean(state.upgrades.rainBarrel);
    root.name = "rain-barrel";
    world.add(root);
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
    const actual = SLOT_DATA[slotIndex]?.lightLevel;
    if (!actual) return { level: "unplaced", label: "light undecided", color: 0xffd15d };
    if (preferred === actual) return { level: "ideal", label: `ideal ${actual} light`, color: 0x75a86e };
    if (spec.toleratedLight?.includes(actual)) return { level: "tolerable", label: `${actual} light · tolerable`, color: 0xe2bd5d };
    return { level: "poor", label: `${actual} light · poor fit`, color: 0xdf846b };
  }

  function conditionOf(plant) {
    const fit = lightFit(plant);
    if (plant.hydration < 42) return { label: "drooping", icon: "○" };
    if (fit.level === "poor") return { label: "light-stressed", icon: "◐" };
    if (plant.recoveredToday && fit.level !== "poor") return { label: "recovering", icon: "◕" };
    if (plant.hydration >= 68 && fit.level === "ideal") return { label: "thriving", icon: "●" };
    return { label: "comfortable", icon: "◐" };
  }

  function carePastTense(care) {
    return care === "water" ? "well-watered" : care === "mist" ? "misted" : "pruned";
  }

  function createPlant(plant) {
    const spec = speciesOf(plant);
    const root = createDistinctPlant3D(plant, spec, run.textures);
    root.userData.entity = { kind: "plant", id: plant.id };
    root.userData.plantId = plant.id;
    root.userData.phase = Math.abs(hash(plant.id)) % 100;
    root.userData.ringY = 0;
    root.userData.droop = clamp((48 - plant.hydration) / 40, 0, 1);
    root.updateMatrixWorld(true);
    root.userData.modelTop = new THREE.Box3().setFromObject(root).max.y;
    const home = SLOT_DATA[plant.slot];
    root.scale.setScalar(home ? scaleForSlot(root, home) : 0.78);
    interactive.push(root);
    return root;
  }

  function scaleForSlot(object, slot) {
    if (!slot?.ceilingY || !object?.userData.modelTop) return slot?.size || 0.78;
    const clearance = Math.max(0.1, slot.ceilingY - slot.y - 0.09);
    return Math.min(slot.size, clearance / object.userData.modelTop);
  }

  function hash(text) {
    let result = 0;
    for (let i = 0; i < text.length; i += 1) result = ((result << 5) - result + text.charCodeAt(i)) | 0;
    return result;
  }

  function rebuildPlants() {
    plantObjects.forEach((object) => unregister(object));
    plantObjects.clear();
    let loose = 0;
    state.inventory.forEach((plant) => {
      const object = createPlant(plant);
      if (Number.isInteger(plant.slot) && SLOT_DATA[plant.slot]) {
        const slot = SLOT_DATA[plant.slot];
        object.position.set(slot.x, slot.y, slot.z);
      } else {
        object.position.copy(staging[loose % staging.length]);
        loose += 1;
      }
      world.add(object);
      plantObjects.set(plant.id, object);
    });
    updateSlotGlow();
  }

  function unregister(object) {
    const index = interactive.indexOf(object);
    if (index >= 0) interactive.splice(index, 1);
    object.removeFromParent();
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
    const currentIndex = stages.findLastIndex((stage) => state.bloom >= stage.threshold);
    const current = stages[Math.max(0, currentIndex)];
    const next = stages[currentIndex + 1];
    return {
      name: current.name,
      copy: next ? `${next.threshold - state.bloom} Bloom to ${next.name}` : "The whole neighborhood knows your windows",
    };
  }

  function evaluateDisplayGoal(plant, slot) {
    const goal = state.displayGoal;
    if (!goal || goal.claimed || !plant?.traits.includes(goal.trait) || slot?.zone !== goal.zone) return false;
    goal.claimed = true;
    state.coins += goal.rewardCoins;
    state.bloom += goal.rewardBloom;
    return true;
  }

  function bindUi() {
    ui.start?.addEventListener("click", startGame);
    ui.action?.addEventListener("click", doAction);
    ui.openShop?.addEventListener("click", openShop);
    ui.arrangeButton?.addEventListener("click", toggleArrangement);
    CARES.forEach((care) => ui.care[care]?.addEventListener("click", () => careForPlant(care)));
    ui.nextDay?.addEventListener("click", nextDay);
    ui.upgradeButton?.addEventListener("click", () => openModal(ui.upgradeModal, true));
    ui.closeUpgrades?.addEventListener("click", () => openModal(ui.upgradeModal, false));
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
      state.supplierOptions = generateSupplierLots({
        day: state.day,
        customers: state.customers,
        inventory: state.inventory,
        coins: state.coins,
        capacity: state.inventoryCapacity,
      });
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
    if (ui.supplierTitle) ui.supplierTitle.textContent = `Day ${state.day} nursery clipboard`;
    if (ui.supplierForecast) {
      const needs = [...new Set(state.customers.map((customer) => customer.need))];
      ui.supplierForecast.textContent = `Neighborhood notes: homes are asking for ${needs.join(", ")}. You have ${state.inventory.length}/${state.inventoryCapacity} plants and ${state.coins} coins.`;
    }
    if (ui.supplierStatus) ui.supplierStatus.textContent = "Choose one delivery. Unsold plants stay in your shop for later days.";
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
      contents.textContent = supplierContents(lot);
      const badges = document.createElement("div");
      badges.className = "supplier-badges";
      const condition = document.createElement("span");
      condition.className = "supplier-badge";
      condition.textContent = lot.condition === "stressed" ? "Needs care" : lot.speciesNames?.length ? "Healthy stock" : "Current stock";
      const capacity = document.createElement("span");
      capacity.className = "supplier-badge";
      capacity.textContent = fits ? `${lot.speciesNames?.length || 0} spaces used` : "Not enough space";
      badges.append(condition, capacity);
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
    const speciesNames = [...(lot.speciesNames || [])];
    const acquisitionCosts = allocateLotCosts(speciesNames, lot.cost || 0);
    state.crateQueue = speciesNames.map((speciesName, index) => ({
      id: `${lot.id}-plant-${index}`,
      speciesId: speciesOfName(speciesName).id,
      speciesName,
      seed: state.day * 1009 + index * 131 + lot.id.length * 17,
      condition: lot.condition || "healthy",
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
    if (element === ui.upgradeModal && open) renderUpgrades();
    if (open) run.modalReturnFocus = document.activeElement;
    element.hidden = !open;
    element.classList.toggle("is-open", open);
    element.setAttribute("aria-hidden", String(!open));
    const anyModalOpen = [ui.helpModal, ui.upgradeModal, ui.report, ui.supplierBoard].some((modal) => modal && !modal.hidden);
    if (ui.game) ui.game.inert = anyModalOpen;
    if (open) {
      requestAnimationFrame(() => element.querySelector("button:not([disabled])")?.focus());
    } else if (!anyModalOpen && run.modalReturnFocus instanceof HTMLElement) {
      run.modalReturnFocus.focus();
      run.modalReturnFocus = null;
    }
  }

  function currentOpenModal() {
    return [ui.supplierBoard, ui.report, ui.upgradeModal, ui.helpModal]
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

  function renderUpgrades() {
    if (!ui.upgradeOptions) return;
    ui.upgradeOptions.replaceChildren();
    const addCard = ({ owned, title, ownedTitle, copy, ownedCopy, cost, action }) => {
      const card = document.createElement("article");
      card.className = "upgrade-card";
      const heading = document.createElement("h3");
      heading.textContent = owned ? ownedTitle : title;
      const detail = document.createElement("p");
      detail.textContent = owned ? ownedCopy : `${cost} coins · ${copy}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-primary upgrade-buy";
      button.textContent = owned ? "Already installed" : `Install · ${cost}`;
      button.disabled = owned;
      button.addEventListener("click", action);
      card.append(heading, detail, button);
      ui.upgradeOptions.append(card);
    };
    addCard({
      owned: state.upgrades.growLamp,
      title: "Secondhand grow lamp",
      ownedTitle: "Grow lamp installed",
      copy: "Automatically mists humidity-loving displayed plants each new morning.",
      ownedCopy: "Its honey-colored light handles morning mist for plants that enjoy it.",
      cost: 50,
      action: buyGrowLamp,
    });
    addCard({
      owned: state.upgrades.rainBarrel,
      title: "Little rain barrel",
      ownedTitle: "Rain barrel installed",
      copy: "Plants dry out 35% more slowly while the shop is open.",
      ownedCopy: "Collected rain keeps every pot comfortable for longer.",
      cost: 45,
      action: buyRainBarrel,
    });
  }

  function buyGrowLamp() {
    if (state.upgrades.growLamp) return;
    if (state.coins < 50) {
      sound("error");
      toast(`You need ${50 - state.coins} more coins. The lamp will wait.`);
      return;
    }
    state.coins -= 50;
    state.upgrades.growLamp = true;
    state.bloom += 4;
    const lamp = world.getObjectByName("grow-lamp");
    if (lamp) lamp.visible = true;
    save();
    sound("upgrade");
    toast("The grow lamp hums awake. Even the fern looks impressed.");
    renderUpgrades();
    updateUi();
  }

  function buyRainBarrel() {
    if (state.upgrades.rainBarrel) return;
    if (state.coins < 45) {
      sound("error");
      toast(`You need ${45 - state.coins} more coins. The clouds are patient.`);
      return;
    }
    state.coins -= 45;
    state.upgrades.rainBarrel = true;
    state.bloom += 4;
    const barrel = world.getObjectByName("rain-barrel");
    if (barrel) barrel.visible = true;
    save();
    sound("upgrade");
    toast("The rain barrel is ready. Every plant exhales at once.");
    renderUpgrades();
    updateUi();
  }

  function currentCustomer() {
    return state.customers?.[state.customerIndex] || null;
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
    const modelTop = Math.max(plantObject.userData.modelTop || 1.4, 0.8);
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0.24, 0);
    model.scale.setScalar(0.78 / modelTop);
    carry.clear();
    carry.add(model);
  }

  function spawnCustomer(enter = true) {
    if (run.customer) unregister(run.customer);
    run.customer = null;
    const person = currentCustomer();
    if (!person) {
      showReport();
      return;
    }
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
      const plant = state.inventory.find((item) => item.id === entity.id);
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
    ring.position.set(object.position.x, object.position.y + 0.025, object.position.z);
    const pulse = run.selected.kind === "customer" ? 1.15 : 1;
    ring.scale.setScalar(pulse);
  }

  function doAction() {
    if (run.busy || !run.selected) return;
    const { kind, id } = run.selected;
    if (kind === "crate") unpackCrate();
    else if (kind === "plant") {
      const plant = state.inventory.find((item) => item.id === id);
      if (!plant) return;
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
      toast(`${person.name} is hoping for something ${person.need}. Tap a plant to offer it.`);
      sound("hint");
    } else if (kind === "slot" && run.carried) {
      placePlant(run.carried, id);
    }
  }

  function beginMove(plant) {
    if (!plant) return;
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
    if (!carried || !other || !Number.isInteger(other.slot)) return;
    if (!Number.isInteger(run.moveOrigin)) {
      const destinationIndex = other.slot;
      const destination = SLOT_DATA[destinationIndex];
      const carriedObject = plantObjects.get(carried.id);
      const otherObject = plantObjects.get(other.id);
      const looseCount = state.inventory.filter((plant) => !Number.isInteger(plant.slot)
        && plant.id !== carried.id
        && plant.id !== other.id).length;
      const bench = staging[looseCount % staging.length];
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
        endScale: 0.78,
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
    });
    state.inventory.push(plant);
    state.crates -= 1;
    const object = createPlant(plant);
    const looseCount = state.inventory.filter((item) => !Number.isInteger(item.slot)).length;
    const target = staging[(looseCount - 1) % staging.length];
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
    opening.time += dt;

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
      object.scale.setScalar(0.78);
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
      object.scale.setScalar(lerp(0.46, 0.78, transferEase));
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
    object.scale.setScalar(0.78);
    run.crateAnimation = null;
    run.busy = false;
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
    toast(plant.hydration < 42
      ? `${plant.species}! Thirsty and drooping after the trip—water will perk it up.`
      : lastCarton
        ? `${plant.species}! Last carton open. Care, arrange, then use Open the shop when ready.`
        : `${plant.species}! A little rumpled, fundamentally promising.`);
    updateUi();
  }

  function firstFreeSlot(plant = null) {
    const used = new Set(state.inventory.map((plant) => plant.slot).filter(Number.isInteger));
    const object = plant ? plantObjects.get(plant.id) : null;
    if (plant && state.displayGoal && !state.displayGoal.claimed && plant.traits.includes(state.displayGoal.trait)) {
      const goalIndex = SLOT_DATA.findIndex((slot, index) => !used.has(index)
        && slot.zone === state.displayGoal.zone
        && (!object || scaleForSlot(object, slot) >= slot.size * 0.74));
      if (goalIndex >= 0) return goalIndex;
    }
    if (plant) {
      const idealIndex = SLOT_DATA.findIndex((slot, index) => !used.has(index)
        && lightFit(plant, index).level === "ideal"
        && (!object || scaleForSlot(object, slot) >= slot.size * 0.74));
      if (idealIndex >= 0) return idealIndex;
    }
    for (let index = 0; index < SLOT_DATA.length; index += 1) {
      if (used.has(index)) continue;
      const slot = SLOT_DATA[index];
      if (object && scaleForSlot(object, slot) < slot.size * 0.74) continue;
      return index;
    }
    for (let index = 0; index < SLOT_DATA.length; index += 1) if (!used.has(index)) return index;
    return null;
  }

  function placePlant(id, slotIndex) {
    const plant = state.inventory.find((item) => item.id === id);
    const target = SLOT_DATA[slotIndex];
    if (!plant || !target) return;
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

  function careForPlant(type) {
    if (run.busy || run.selected?.kind !== "plant") {
      toast("Choose a plant first.");
      return;
    }
    const plant = state.inventory.find((item) => item.id === run.selected.id);
    const object = plantObjects.get(run.selected.id);
    if (!plant || !object) return;
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
    if (firstCare && beneficial) {
      state.dailyCare += 1;
      state.bloom += 1;
    }
    let recoveryReward = false;
    if (type === "water") {
      plant.hydration = 100;
      plant.thirstWarned = false;
      if (wasDrooping && !plant.recoveredToday) {
        plant.recoveredToday = true;
        state.dailyRecoveries += 1;
        state.bloom += 1;
        recoveryReward = true;
      }
      waterPour(object);
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
    toast(messages[type]);
    updateUi();
  }

  function offerPlant(plant) {
    const person = currentCustomer();
    if (!person) return;
    if (!plant.traits.includes(person.need)) {
      sound("error");
      toast(`${person.name} likes it, but really needs something ${person.need}.`);
      updateUi();
      save();
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
    const careCount = speciesOf(plant).beneficialCare.filter((care) => plant.care[care]).length;
    const careWishMet = person.careWish === "water"
      ? plant.hydration >= 78 || plant.care.water
      : speciesOf(plant).beneficialCare.includes(person.careWish) && plant.care[person.careWish];
    const extras = [
      plant.traits.includes(person.bonusTrait),
      Boolean(careWishMet),
      conditionOf(plant).label === "thriving",
    ].filter(Boolean).length;
    const perfect = extras === 3;
    const payout = plant.price + careCount * 2 + extras * 3 + (perfect ? 3 : 0);
    state.coins += payout;
    state.bloom += 2 + extras;
    if (perfect) state.dailyPerfects += 1;
    const perfectDayBonus = perfect && state.dailyPerfects === 3;
    if (perfectDayBonus) state.bloom += 8;
    state.dailyRevenue += payout;
    state.dailyCostOfGoods += Number.isFinite(plant.acquisitionCost) ? plant.acquisitionCost : plant.wholesaleCost || 0;
    state.dailySales += 1;
    state.customerIndex += 1;
    const object = plantObjects.get(plant.id);
    const target = run.customer?.position.clone().add(new THREE.Vector3(0, 1.0, 0)) || new THREE.Vector3(0, 1, 3);
    if (object) {
      stageCustomerCarry(object);
      const index = interactive.indexOf(object);
      if (index >= 0) interactive.splice(index, 1);
      queueMover({ object, from: object.position.clone(), to: target, startScale: object.scale.x, endScale: 0.08, time: 0, duration: 0.62, arc: 1.2, remove: true });
      plantObjects.delete(plant.id);
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
      advance: state.customerIndex >= 3 ? "report" : "customer",
    };
    run.lastSaleGrade = perfect ? "perfect" : extras >= 1 ? "lovely" : "good";
    save();
    sound("sale");
    toast(`${perfect ? "Perfect" : extras ? "Lovely" : "Good"} match! ${person.name} pays ${payout} coins.${perfectDayBonus ? " Three perfect matches—+8 Bloom!" : ""}`);
    updateSlotGlow();
    updateUi(true);
    if (state.day === 1 && state.dailySales === 1 && !state.mothSeen) moonMoth();
  }

  function moonMoth() {
    state.mothSeen = true;
    state.bloom += 5;
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
    const origin = target.clone().add(new THREE.Vector3(0.78 * size, 1.65 * size, 0.28 * size));
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

  function showReport() {
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
    if (ui.reportTitle) ui.reportTitle.textContent = `Day ${String(state.day).padStart(2, "0")} — shutters down`;
    if (ui.reportCopy) {
      const grossProfit = state.dailyRevenue - state.dailyCostOfGoods;
      const tillChange = state.coins - state.dailyStartingCoins;
      const bloomEarned = Math.max(0, state.bloom - state.dailyBloomStart);
      const idealDisplays = state.inventory.filter((plant) => Number.isInteger(plant.slot) && lightFit(plant).level === "ideal").length;
      const standing = bloomStanding();
      const flourish = state.dailyCare >= 6 ? "The leaves are immaculate." : "A few leaves could use attention tomorrow.";
      const display = !state.displayGoal
        ? "No display challenge was set."
        : state.displayGoal.claimed ? "Display challenge complete." : "The display challenge can try again tomorrow.";
      const estimate = state.accountingEstimate ? " (partly estimated from the previous save)" : "";
      const stockCopy = `${state.inventory.length} plant${state.inventory.length === 1 ? "" : "s"} remain${state.inventory.length === 1 ? "s" : ""} in stock`;
      ui.reportCopy.textContent = `${state.dailySales} plants rehomed · ${state.dailyRevenue} coins revenue − ${state.dailyCostOfGoods} sold-stock cost${estimate} = ${grossProfit >= 0 ? "+" : ""}${grossProfit} gross profit · ${state.dailyStockCost} coins spent at the nursery · ${tillChange >= 0 ? "+" : ""}${tillChange} till change · +${bloomEarned} Bloom · ${stockCopy} · ${idealDisplays} in ideal light · ${state.dailyCare} helpful care moments · ${state.dailyPerfects} perfect brief${state.dailyPerfects === 1 ? "" : "s"} · ${state.dailyRecoveries} thirst rescue${state.dailyRecoveries === 1 ? "" : "s"}. Shop standing: ${standing.name} · ${standing.copy}. ${display} ${flourish}`;
    }
    sound("report");
    save();
    updateUi();
  }

  function nextDay() {
    state.day += 1;
    state.customerIndex = 0;
    state.dailySales = 0;
    state.dailyRevenue = 0;
    state.dailyStockCost = 0;
    state.dailyCostOfGoods = 0;
    state.accountingEstimate = false;
    state.dailyCare = 0;
    state.dailyPerfects = 0;
    state.dailyRecoveries = 0;
    state.customers = [];
    state.crateQueue = [];
    state.displayGoal = null;
    state.inventory.forEach((plant) => {
      const morningMist = Boolean(state.upgrades.growLamp
        && Number.isInteger(plant.slot)
        && speciesOf(plant).beneficialCare.includes("mist"));
      plant.care = { water: false, mist: morningMist, prune: false };
      plant.recoveredToday = false;
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
    toast(state.upgrades.growLamp ? "Morning. The grow lamp handled the misting shift; the nursery clipboard is ready." : "Morning. Check the neighborhood notes before booking today’s delivery.");
    updateUi();
  }

  function updateUi(saleMessage = false) {
    if (ui.day) ui.day.textContent = String(state.day).padStart(2, "0");
    if (ui.coins) ui.coins.textContent = String(state.coins);
    if (ui.bloom) ui.bloom.textContent = String(state.bloom);
    if (ui.bloom) {
      const standing = bloomStanding();
      ui.bloom.title = `${standing.name} · ${standing.copy}`;
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
      if (ui.customerRequest) ui.customerRequest.textContent = `“${person.line}” ${person.need} required · ${person.bonusTrait} + ${carePastTense(person.careWish)} + thriving bonus.`;
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
    if (ui.openShop) {
      const readyToOpen = state.phase === "preparation" && state.crates === 0 && !run.crateAnimation;
      ui.openShop.hidden = !readyToOpen;
      ui.openShop.disabled = !readyToOpen || !inventoryCoversCustomers(state.inventory, state.customers.slice(state.customerIndex));
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
      copy = person ? `Find a ${person.need} plant, care for it, then make the match.` : "Wrapping the last pot for its new home.";
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
        const careCount = spec.beneficialCare.filter((care) => plant.care[care]).length;
        const condition = conditionOf(plant);
        const fit = lightFit(plant);
        const helpfulCare = spec.beneficialCare.join(" · ");
        const goalFit = state.displayGoal && !state.displayGoal.claimed && plant.traits.includes(state.displayGoal.trait)
          ? ` Display fit: ${SLOT_DATA.find((slot) => slot.zone === state.displayGoal.zone)?.zoneLabel || state.displayGoal.zone}.`
          : "";
        title = plant.species;
        copy = `${plant.traits.join(" · ")} · ${condition.icon} ${condition.label} · soil ${Math.round(plant.hydration)}% · ${fit.label} · likes ${helpfulCare} · ${careCount}/${spec.beneficialCare.length} helpful care.${goalFit}`;
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
          action = `Offer to ${person.name}`;
          disabled = false;
        }
      }
    } else if (selected?.kind === "customer" && person) {
      action = `What does ${person.name} need?`;
      disabled = false;
    } else if (selected?.kind === "slot") {
      action = run.carried ? "Place in this light" : "An empty display spot";
      disabled = !run.carried;
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
    if (ui.careTray) {
      const showCare = Boolean(plant && state.phase !== "supply" && state.phase !== "report");
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
    const viewHeight = 13.2 * portraitBoost / run.zoom;
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
      if (modal === ui.helpModal) openModal(ui.helpModal, false);
      return;
    }
    if (modal) return;
    if (!run.started || event.target instanceof HTMLInputElement) return;
    if (event.key === "1") careForPlant("water");
    if (event.key === "2") careForPlant("mist");
    if (event.key === "3") careForPlant("prune");
    if (event.key.toLowerCase() === "q") {
      event.preventDefault();
      cycleKeyboardSelection(event.shiftKey ? -1 : 1);
    }
    if (event.key.toLowerCase() === "e") doAction();
    if (event.key === "ArrowLeft") rotateView(-1);
    if (event.key === "ArrowRight") rotateView(1);
  }

  function cycleKeyboardSelection(direction) {
    const candidates = interactive.filter((object) => object.visible && object.parent && object.userData.entity);
    if (!candidates.length) return;
    run.keyboardIndex = (run.keyboardIndex + direction + candidates.length) % candidates.length;
    const object = candidates[run.keyboardIndex];
    const entity = object.userData.entity;
    selectEntity(entity, object);
    const plant = entity.kind === "plant" ? state.inventory.find((item) => item.id === entity.id) : null;
    toast(plant ? `Selected ${plant.species}. Press E to act.` : `Selected ${entity.kind}. Press E to act.`, 1700);
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
      const targetDroop = clamp((48 - plant.hydration) / 40, 0, 1);
      object.userData.droop = lerp(object.userData.droop || 0, targetDroop, 1 - Math.exp(-dt * 3.3));
      const droop = object.userData.droop;
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
      });
    });
    if (!reduceMotion && run.selectionRing?.visible) run.selectionRing.material.opacity = 0.65 + Math.sin(time * 4) * 0.18;
    updateCartonOpening(dt);
    updateMovers(dt);
    updateEffects(dt);
    updateCustomer(dt, time);
    updateMoth(dt);
    updateSelectionRing();
    renderer.render(scene, camera);
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
        const before = plant.hydration;
        plant.hydration = clamp(plant.hydration - speciesOf(plant).dryRate * barrelMultiplier * dt, 8, 100);
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
        unregister(run.customer);
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
