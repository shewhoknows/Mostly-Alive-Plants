import * as THREE from "./vendor/three.module.min.js";

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const STORAGE_KEY = "mostly-alive-plants-save-v2";
const SAVE_VERSION = 3;
const CARES = ["water", "mist", "prune"];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const SPECIES = [
  { name: "Button Fern", traits: ["lush", "shade-loving"], price: 18, shape: "fern", color: 0x5e945a, dryRate: 0.24 },
  { name: "Velvet Pothos", traits: ["trailing", "easygoing"], price: 20, shape: "vine", color: 0x567a45, dryRate: 0.14 },
  { name: "Pinstripe Calathea", traits: ["dramatic", "patterned"], price: 24, shape: "fan", color: 0x386549, dryRate: 0.22 },
  { name: "Pocket Succulent", traits: ["sunny", "sturdy"], price: 16, shape: "succulent", color: 0x83a984, dryRate: 0.06 },
  { name: "Little Monstera", traits: ["bold", "lush"], price: 26, shape: "broad", color: 0x3d8050, dryRate: 0.17 },
  { name: "Snake Plant", traits: ["upright", "easygoing"], price: 22, shape: "spear", color: 0x718b3c, dryRate: 0.07 },
  { name: "Moon Cactus", traits: ["strange", "sunny"], price: 28, shape: "cactus", color: 0x4f8c67, dryRate: 0.045 },
];

const CUSTOMERS = [
  { name: "Mina", color: 0xe39a7b, asset: "assets/characters/mina.png", line: "My windowsill needs a little courage." },
  { name: "Basil", color: 0x7189a6, asset: "assets/characters/basil.png", line: "I promised myself I could keep one alive." },
  { name: "Jo", color: 0xd3a64b, asset: "assets/characters/jo.png", line: "My bookshelf is looking emotionally vacant." },
  { name: "Nori", color: 0x8f74a8, asset: "assets/characters/nori.png", line: "I want a roommate who enjoys silence." },
  { name: "Pip", color: 0x6d9a78, asset: "assets/characters/pip.png", line: "Something peculiar, but polite, please." },
  { name: "Sol", color: 0xc9785e, asset: "assets/characters/sol.png", line: "The sunniest corner of my flat is lonely." },
];

const SLOT_DATA = [
  { x: -4.55, y: 1.12, z: -4.08, size: 0.75, ceilingY: 2.37, zone: "lowerShelf", zoneLabel: "lower shelf" },
  { x: -2.95, y: 1.12, z: -4.08, size: 0.75, ceilingY: 2.37, zone: "lowerShelf", zoneLabel: "lower shelf" },
  { x: -4.55, y: 2.55, z: -4.08, size: 0.68, zone: "upperShelf", zoneLabel: "upper shelf" },
  { x: -2.95, y: 2.55, z: -4.08, size: 0.68, zone: "upperShelf", zoneLabel: "upper shelf" },
  { x: 1.2, y: 0.06, z: -3.85, size: 0.9, zone: "window", zoneLabel: "sunny window" },
  { x: -1.3, y: 0.06, z: -2.85, size: 0.9, zone: "floor", zoneLabel: "open floor" },
  { x: -3.7, y: 0.06, z: 0.2, size: 0.9, zone: "floor", zoneLabel: "open floor" },
  { x: 1.05, y: 1.4, z: 1.15, size: 0.72, zone: "counter", zoneLabel: "front counter" },
];

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function plantRecord(speciesName, seed = Math.random() * 99999) {
  const species = SPECIES.find((item) => item.name === speciesName) || SPECIES[0];
  const rng = seeded(Math.floor(seed));
  return {
    id: `plant-${Date.now().toString(36)}-${Math.floor(rng() * 1e7).toString(36)}`,
    species: species.name,
    traits: [...species.traits],
    price: species.price + Math.floor(rng() * 4),
    colorShift: rng() * 0.12 - 0.06,
    care: { water: false, mist: false, prune: false },
    hydration: Math.round(64 + rng() * 27),
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
    coins: 28,
    bloom: 8,
    sound: true,
    inventory: [fern, pothos],
    customers: [],
    crateQueue: [],
    crates: 3,
    customerIndex: 0,
    dailySales: 0,
    dailyRevenue: 0,
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
    const customers = Array.isArray(value.customers) ? value.customers.map((customer, index) => {
      const species = SPECIES.find((item) => item.name === customer.speciesHint) || SPECIES[index % SPECIES.length];
      const need = customer.need || species.traits[0];
      return {
        ...customer,
        need,
        bonusTrait: customer.bonusTrait || species.traits.find((trait) => trait !== need) || species.traits[0],
        careWish: customer.careWish || CARES[index % CARES.length],
      };
    }) : [];
    return {
      ...base,
      ...value,
      version: SAVE_VERSION,
      upgrades: { ...base.upgrades, ...(value.upgrades || {}) },
      customers,
      crateQueue: Array.isArray(value.crateQueue) ? value.crateQueue : [],
      inventory: value.inventory.map((plant) => ({
        ...plant,
        hydration: clamp(Number.isFinite(plant.hydration) ? plant.hydration : 78, 8, 100),
        recoveredToday: Boolean(plant.recoveredToday),
        thirstWarned: Boolean(plant.thirstWarned),
        care: { water: false, mist: false, prune: false, ...(plant.care || {}) },
      })),
    };
  } catch {
    return freshState();
  }
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
    new THREE.Vector3(3.45, 1.08, -3.45),
    new THREE.Vector3(4.35, 1.08, -3.45),
    new THREE.Vector3(3.45, 1.08, -2.65),
    new THREE.Vector3(4.35, 1.08, -2.65),
  ];

  const run = {
    ready: false,
    started: false,
    busy: false,
    selected: null,
    carried: null,
    crate: null,
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
    const occupied = new Set(state.inventory.map((plant) => plant.slot).filter(Number.isInteger));
    const freeZones = new Set(SLOT_DATA.filter((slot, index) => !occupied.has(index)).map((slot) => slot.zone));
    const deliveries = state.crateQueue.map((name) => SPECIES.find((species) => species.name === name)).filter(Boolean);
    const moments = [
      { trait: "trailing", zone: "upperShelf", copy: "Let something trailing cascade from the upper shelf." },
      { trait: "sunny", zone: "window", copy: "Make a sunny-window moment." },
      { trait: "upright", zone: "floor", copy: "Give an upright plant room on the floor." },
      { trait: "lush", zone: "lowerShelf", copy: "Build a lush little shelf vignette." },
      { trait: "strange", zone: "counter", copy: "Feature something strange at the front counter." },
    ];
    const possible = moments.filter((moment) => freeZones.has(moment.zone) && deliveries.some((species) => species.traits.includes(moment.trait)));
    let choice = possible[Math.floor(rng() * possible.length)];
    if (!choice) {
      const slot = SLOT_DATA.find((item, index) => !occupied.has(index));
      const species = deliveries[0];
      if (!slot || !species) return null;
      const trait = species.traits[Math.floor(rng() * species.traits.length)];
      choice = { trait, zone: slot.zone, copy: `Feature something ${trait} on the ${slot.zoneLabel}.` };
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
      if (!state.displayGoal && state.crateQueue.length) state.displayGoal = makeDisplayGoal(seeded(state.day * 1999 + 73));
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
      const careWish = CARES[Math.floor(rng() * CARES.length)];
      state.customers.push({ ...person, need, bonusTrait, careWish, speciesHint: species.name });
      state.crateQueue.push(species.name);
    }
    state.crates = 3;
    state.displayGoal = makeDisplayGoal(rng);
    save();
  }

  async function loadShop() {
    const files = {
      floor: "assets/textures/terracotta-floor.png",
      wood: "assets/textures/painted-oak.png",
      wall: "assets/textures/botanical-plaster.png",
    };
    CUSTOMERS.forEach((customer) => { files[`customer-${customer.name.toLowerCase()}`] = customer.asset; });
    const loader = new THREE.TextureLoader();
    const textures = {};
    const total = Object.keys(files).length;
    let done = 0;
    updateLoading(0, total);
    await Promise.all(Object.entries(files).map(async ([key, url]) => {
      try {
        textures[key] = await loader.loadAsync(url);
        textures[key].colorSpace = THREE.SRGBColorSpace;
        textures[key].wrapS = textures[key].wrapT = key.startsWith("customer-") ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
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
    makeCrates(woodMat, darkWood);
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

  function makeCrates(woodMat, darkWood) {
    const root = new THREE.Group();
    root.position.set(4.55, 0.03, 3.15);
    for (let layer = 0; layer < 3; layer += 1) {
      const crate = new THREE.Group();
      crate.name = `crate-${layer}`;
      crate.position.set((layer % 2) * 0.18, layer * 0.65, -layer * 0.08);
      box(crate, [1.1, 0.58, 0.85], [0, 0.3, 0], woodMat);
      box(crate, [1.18, 0.11, 0.93], [0, 0.1, 0], darkWood);
      box(crate, [1.18, 0.11, 0.93], [0, 0.5, 0], darkWood);
      box(crate, [0.12, 0.56, 0.93], [-0.43, 0.3, 0], darkWood);
      box(crate, [0.12, 0.56, 0.93], [0.43, 0.3, 0], darkWood);
      root.add(crate);
    }
    root.userData.entity = { kind: "crate", id: "deliveries" };
    root.userData.ringY = 0;
    world.add(root);
    interactive.push(root);
    run.crate = root;
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

  function conditionOf(plant) {
    if (plant.hydration >= 68) return { label: "thriving", icon: "●" };
    if (plant.hydration >= 42) return { label: "comfortable", icon: "◐" };
    return { label: "drooping", icon: "○" };
  }

  function carePastTense(care) {
    return care === "water" ? "watered" : care === "mist" ? "misted" : "pruned";
  }

  function createPlant(plant) {
    const spec = speciesOf(plant);
    const root = new THREE.Group();
    const green = new THREE.Color(spec.color).offsetHSL(plant.colorShift || 0, 0, 0);
    const leafMat = material(green, { roughness: 0.86 });
    const leafLight = material(green.clone().offsetHSL(0.02, -0.05, 0.12));
    const stemMat = material(0x456b3f);
    const potColors = [0xc77d5d, 0xd19a73, 0x9b705d, 0x729084];
    const potColor = potColors[Math.abs(hash(plant.id)) % potColors.length];
    cylinder(root, 0.39, 0.31, 0.57, [0, 0.31, 0], material(potColor), 9);
    cylinder(root, 0.43, 0.4, 0.12, [0, 0.57, 0], material(new THREE.Color(potColor).offsetHSL(0, 0, 0.06)), 9);
    cylinder(root, 0.34, 0.34, 0.04, [0, 0.64, 0], material(0x4b382b), 12);
    const leaves = [];

    const leaf = (x, y, z, sx, sy, sz, rz = 0, mat = leafMat) => {
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.34, 7, 5), mat);
      node.position.set(x, y, z);
      node.scale.set(sx, sy, sz);
      node.rotation.z = rz;
      node.castShadow = true;
      node.userData.baseRotation = rz;
      root.add(node);
      leaves.push(node);
      return node;
    };

    if (spec.shape === "spear") {
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const node = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.45 + (i % 3) * 0.18, 5), i % 2 ? leafLight : leafMat);
        node.position.set(Math.cos(angle) * 0.2, 1.25 + (i % 3) * 0.08, Math.sin(angle) * 0.2);
        node.rotation.z = Math.cos(angle) * 0.12;
        node.userData.baseRotation = node.rotation.z;
        node.castShadow = true;
        root.add(node);
        leaves.push(node);
      }
    } else if (spec.shape === "succulent") {
      for (let layer = 0; layer < 3; layer += 1) {
        const count = 8 - layer * 2;
        for (let i = 0; i < count; i += 1) {
          const angle = (i / count) * Math.PI * 2 + layer;
          const node = leaf(Math.cos(angle) * (0.28 - layer * 0.07), 0.78 + layer * 0.23, Math.sin(angle) * (0.28 - layer * 0.07), 0.38, 0.9, 0.32, angle + Math.PI / 2, layer % 2 ? leafLight : leafMat);
          node.rotation.y = -angle;
        }
      }
    } else if (spec.shape === "cactus") {
      cylinder(root, 0.23, 0.28, 1.38, [0, 1.28, 0], leafMat, 9);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.24, 9, 6), leafMat);
      crown.position.y = 1.96;
      crown.castShadow = true;
      root.add(crown);
      for (let i = 0; i < 7; i += 1) leaf(Math.cos(i) * 0.17, 2.15, Math.sin(i) * 0.17, 0.28, 0.35, 0.28, 0, material(i % 2 ? 0xf2b75d : 0xe47d7a));
    } else {
      const count = spec.shape === "fern" ? 11 : spec.shape === "broad" ? 7 : 8;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + 0.4;
        const radius = spec.shape === "fan" ? 0.28 : 0.38;
        const height = 1.08 + (i % 3) * 0.24;
        const stem = cylinder(root, 0.025, 0.035, height - 0.55, [Math.cos(angle) * radius * 0.35, (height + 0.55) / 2, Math.sin(angle) * radius * 0.35], stemMat, 5);
        stem.rotation.z = Math.cos(angle) * 0.24;
        const wide = spec.shape === "broad" ? 1.4 : spec.shape === "fern" ? 0.75 : 1;
        const node = leaf(Math.cos(angle) * radius, height, Math.sin(angle) * radius, 0.75 * wide, 1.1, 0.28, -Math.cos(angle) * 0.45, i % 2 ? leafLight : leafMat);
        node.rotation.y = -angle;
        if (spec.shape === "vine" && i > 4) {
          node.position.y -= (i - 4) * 0.18;
          node.position.x += Math.cos(angle) * (i - 4) * 0.12;
        }
      }
    }
    leaves.forEach((node, index) => {
      node.userData.basePosition = node.position.clone();
      node.userData.baseEuler = node.rotation.clone();
      node.userData.baseScale = node.scale.clone();
      node.userData.radialAngle = Math.abs(node.position.x) + Math.abs(node.position.z) > 0.02
        ? Math.atan2(node.position.z, node.position.x)
        : (index / Math.max(leaves.length, 1)) * Math.PI * 2;
    });
    root.userData.entity = { kind: "plant", id: plant.id };
    root.userData.plantId = plant.id;
    root.userData.leaves = leaves;
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
    run.crate.visible = state.crates > 0;
    run.crate.children.forEach((child, index) => { child.visible = index < state.crates; });
  }

  function updateSlotGlow() {
    const occupied = new Set(state.inventory.map((plant) => plant.slot).filter(Number.isInteger));
    const carriedPlant = state.inventory.find((plant) => plant.id === run.carried);
    slotObjects.forEach((slot, index) => {
      const available = !occupied.has(index);
      const goalMatch = available && carriedPlant && !state.displayGoal?.claimed
        && carriedPlant.traits.includes(state.displayGoal?.trait)
        && SLOT_DATA[index].zone === state.displayGoal?.zone;
      slot.visible = available;
      slot.material.opacity = run.carried && available ? (goalMatch ? 0.96 : 0.72) : 0.12;
      slot.material.color.set(goalMatch ? 0xff8e6e : run.carried ? 0xffd15d : 0xd7be75);
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
    ensureAudio();
    sound("open");
    spawnCustomer(false);
    updateUi();
    resize();
    const hello = state.day === 1 ? "Day one. The plants are nervous too." : `Day ${state.day}. Fresh leaves, fresh chances.`;
    const challenge = state.displayGoal && !state.displayGoal.claimed ? ` Today’s display: ${state.displayGoal.copy}` : "";
    toast(`${hello}${challenge}`, challenge ? 4800 : 3100);
  }

  function openModal(element, open) {
    if (!element) return;
    if (element === ui.upgradeModal && open) renderUpgrades();
    if (open) run.modalReturnFocus = document.activeElement;
    element.hidden = !open;
    element.classList.toggle("is-open", open);
    element.setAttribute("aria-hidden", String(!open));
    const anyModalOpen = [ui.helpModal, ui.upgradeModal, ui.report].some((modal) => modal && !modal.hidden);
    if (ui.game) ui.game.inert = anyModalOpen;
    if (open) {
      requestAnimationFrame(() => element.querySelector("button:not([disabled])")?.focus());
    } else if (!anyModalOpen && run.modalReturnFocus instanceof HTMLElement) {
      run.modalReturnFocus.focus();
      run.modalReturnFocus = null;
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
      copy: "Automatically mists displayed plants each new morning.",
      ownedCopy: "Its honey-colored light mists every displayed plant overnight.",
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
    const root = new THREE.Group();
    const texture = run.textures[`customer-${person.name.toLowerCase()}`];
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 24),
      new THREE.MeshBasicMaterial({ color: 0x27372c, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 0.42, 1);
    shadow.position.y = 0.018;
    root.add(shadow);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      color: texture ? 0xffffff : person.color,
      transparent: true,
      alphaTest: texture ? 0.055 : 0,
      depthWrite: true,
      toneMapped: false,
    }));
    sprite.center.set(0.5, 0);
    sprite.position.y = 0.025;
    sprite.scale.set(1.58, 2.82, 1);
    sprite.renderOrder = 2;
    root.add(sprite);
    root.userData.entity = { kind: "customer", id: state.customerIndex };
    root.userData.phase = Math.random() * 6;
    root.userData.ringY = 0;
    root.userData.sprite = sprite;
    interactive.push(root);
    return root;
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
    object.position.set(enter && !reduceMotion ? 6.2 : 0.15, 0, 3.32);
    object.rotation.y = -0.08;
    world.add(object);
    run.customer = object;
    run.customerTween = enter && !reduceMotion ? { mode: "enter", time: 0 } : null;
    run.busy = false;
    updateUi();
  }

  function selectEntity(entity, object) {
    run.selected = { ...entity, object };
    document.body.dataset.selection = entity.kind;
    if (entity.kind === "plant") {
      const plant = state.inventory.find((item) => item.id === entity.id);
      run.carried = plant && !Number.isInteger(plant.slot) ? plant.id : null;
      sound("pluck");
    } else if (entity.kind !== "slot") {
      run.carried = null;
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
      if (!Number.isInteger(plant.slot)) {
        const slot = firstFreeSlot(plant);
        if (slot === null) toast("Every display is full. A good problem, briefly.");
        else placePlant(plant.id, slot);
      } else offerPlant(plant);
    } else if (kind === "customer") {
      const person = currentCustomer();
      toast(`${person.name} is hoping for something ${person.need}. Tap a plant to offer it.`);
      sound("hint");
    } else if (kind === "slot" && run.carried) {
      placePlant(run.carried, id);
    }
  }

  function unpackCrate() {
    if (state.crates <= 0 || !state.crateQueue.length) {
      toast("Only packing straw. It smells oddly optimistic.");
      return;
    }
    const speciesName = state.crateQueue.shift();
    const plant = plantRecord(speciesName, state.day * 100 + state.crates * 17);
    if (state.crates === 3) plant.hydration = 36 + (state.day % 7);
    state.inventory.push(plant);
    state.crates -= 1;
    const object = createPlant(plant);
    object.position.copy(staging[state.inventory.filter((item) => !Number.isInteger(item.slot)).length - 1] || staging[0]);
    object.scale.setScalar(0.05);
    world.add(object);
    plantObjects.set(plant.id, object);
    movers.push({ object, from: object.position.clone(), to: object.position.clone(), startScale: 0.05, endScale: 0.78, time: 0, duration: 0.55, arc: 0.25 });
    burst(object.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 0xe9c47c, 16);
    run.selected = { kind: "plant", id: plant.id, object };
    run.carried = plant.id;
    updateCrates();
    updateSelectionRing();
    updateSlotGlow();
    save();
    sound("crate");
    toast(plant.hydration < 42
      ? `${plant.species}! Thirsty and drooping after the trip—water will perk it up.`
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
      movers.push({
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
    const goalWon = evaluateDisplayGoal(plant, target);
    save();
    sound(goalWon ? "upgrade" : "place");
    toast(goalWon
      ? `Display vignette complete! +${state.displayGoal.rewardCoins} coins and +${state.displayGoal.rewardBloom} Bloom.`
      : `${plant.species} has found its light.`);
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
    const canRewater = type === "water" && plant.hydration < 78;
    if (plant.care[type] && !canRewater) {
      toast(type === "water" ? "No swamp ambitions today." : `Already ${type === "mist" ? "misty" : "tidy"} enough.`);
      sound("error");
      return;
    }
    const firstCare = !plant.care[type];
    const wasDrooping = plant.hydration < 42;
    plant.care[type] = true;
    if (firstCare) {
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
    if (!reduceMotion) movers.push({ object, from: object.position.clone(), to: object.position.clone(), startScale: object.scale.x, endScale: object.scale.x, time: 0, duration: 0.42, arc: 0.16 });
    save();
    sound(type);
    const messages = {
      water: recoveryReward
        ? `${plant.species} lifts every leaf. Thirst rescue! +1 Bloom.`
        : `${plant.species} drinks with surprising urgency.`,
      mist: `${plant.species} is now experiencing weather.`,
      prune: `One tiny haircut. Considerable confidence.`,
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
    run.busy = true;
    const careCount = CARES.filter((care) => plant.care[care]).length;
    const extras = [
      plant.traits.includes(person.bonusTrait),
      Boolean(plant.care[person.careWish]),
      plant.hydration >= 68,
    ].filter(Boolean).length;
    const perfect = extras === 3;
    const payout = plant.price + careCount * 2 + extras * 3 + (perfect ? 3 : 0) + (state.upgrades.growLamp ? 2 : 0);
    state.coins += payout;
    state.bloom += 2 + extras;
    if (perfect) state.dailyPerfects += 1;
    const perfectDayBonus = perfect && state.dailyPerfects === 3;
    if (perfectDayBonus) state.bloom += 8;
    state.dailyRevenue += payout;
    state.dailySales += 1;
    state.customerIndex += 1;
    const object = plantObjects.get(plant.id);
    const target = run.customer?.position.clone().add(new THREE.Vector3(0, 1.0, 0)) || new THREE.Vector3(0, 1, 3);
    if (object) {
      const index = interactive.indexOf(object);
      if (index >= 0) interactive.splice(index, 1);
      movers.push({ object, from: object.position.clone(), to: target, startScale: object.scale.x, endScale: 0.08, time: 0, duration: 0.62, arc: 1.2, remove: true });
      plantObjects.delete(plant.id);
    }
    state.inventory = state.inventory.filter((item) => item.id !== plant.id);
    run.selected = null;
    run.carried = null;
    if (run.selectionRing) run.selectionRing.visible = false;
    document.body.dataset.selection = "none";
    if (run.customer) run.customer.userData.entity = null;
    run.customerTween = { mode: "exit", time: 0 };
    run.lastSaleGrade = perfect ? "perfect" : extras >= 1 ? "lovely" : "good";
    save();
    sound("sale");
    toast(`${perfect ? "Perfect" : extras ? "Lovely" : "Good"} match! ${person.name} pays ${payout} coins.${perfectDayBonus ? " Three perfect matches—+8 Bloom!" : ""}`);
    updateSlotGlow();
    updateUi(true);
    if (state.day === 1 && state.dailySales === 1 && !state.mothSeen) moonMoth();
    const delay = reduceMotion ? 180 : 850;
    setTimeout(() => {
      if (state.customerIndex >= 3) showReport();
      else spawnCustomer(true);
    }, delay);
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
      const flourish = state.dailyCare >= 6 ? "The leaves are immaculate." : "A few leaves could use attention tomorrow.";
      const display = state.displayGoal?.claimed ? "Display challenge complete." : "The display challenge can try again tomorrow.";
      ui.reportCopy.textContent = `${state.dailySales} plants rehomed · ${state.dailyRevenue} coins earned · ${state.dailyCare} care moments · ${state.dailyPerfects} perfect brief${state.dailyPerfects === 1 ? "" : "s"} · ${state.dailyRecoveries} thirst rescue${state.dailyRecoveries === 1 ? "" : "s"}. ${display} ${flourish}`;
    }
    sound("report");
    save();
  }

  function nextDay() {
    state.day += 1;
    state.customerIndex = 0;
    state.dailySales = 0;
    state.dailyRevenue = 0;
    state.dailyCare = 0;
    state.dailyPerfects = 0;
    state.dailyRecoveries = 0;
    state.customers = [];
    state.crateQueue = [];
    state.displayGoal = null;
    state.inventory.forEach((plant) => {
      plant.care = { water: false, mist: Boolean(state.upgrades.growLamp && Number.isInteger(plant.slot)), prune: false };
      plant.recoveredToday = false;
      plant.thirstWarned = plant.hydration <= 34;
    });
    if (state.upgrades.growLamp) state.bloom += state.inventory.filter((plant) => Number.isInteger(plant.slot)).length;
    setupDay(true);
    run.busy = false;
    run.selected = null;
    run.carried = null;
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
    spawnCustomer(true);
    save();
    sound("open");
    toast(state.upgrades.growLamp ? "Morning. The grow lamp handled the misting shift." : "Morning delivery! Three mysterious crates, naturally.");
    updateUi();
  }

  function updateUi(saleMessage = false) {
    if (ui.day) ui.day.textContent = String(state.day).padStart(2, "0");
    if (ui.coins) ui.coins.textContent = String(state.coins);
    if (ui.bloom) ui.bloom.textContent = String(state.bloom);
    if (ui.soundButton) {
      ui.soundButton.setAttribute("aria-pressed", String(state.sound));
      ui.soundButton.dataset.sound = state.sound ? "on" : "off";
      ui.soundButton.title = state.sound ? "Mute sound" : "Turn sound on";
    }
    const person = currentCustomer();
    if (ui.customerCard) {
      ui.customerCard.hidden = !person || saleMessage;
      ui.customerCard.classList.toggle("is-waiting", Boolean(person && !saleMessage));
    }
    if (person && !saleMessage) {
      if (ui.customerName) ui.customerName.textContent = person.name;
      if (ui.customerRequest) ui.customerRequest.textContent = `“${person.line}” ${person.need} required · ${person.bonusTrait} + ${carePastTense(person.careWish)} + thriving bonus.`;
      if (ui.customerAvatar) {
        const profile = CUSTOMERS.find((customer) => customer.name === person.name);
        ui.customerAvatar.style.backgroundImage = profile?.asset ? `url("${profile.asset}")` : "";
        ui.customerAvatar.style.setProperty("--customer-color", `#${person.color.toString(16).padStart(6, "0")}`);
      }
    }

    let action = "Select something";
    let disabled = true;
    let title = state.crates ? "Rescue the delivery" : person ? `A plant for ${person.name}` : "Tidy the leaves";
    let copy = state.crates
      ? `${state.crates} crate${state.crates === 1 ? "" : "s"} arrived with suspicious air holes. Tap one to unpack it.`
      : person ? `Find a ${person.need} plant, care for it, then make the match.` : "The shop is quiet for a minute.";
    if (state.displayGoal) copy += ` ${goalSummary()}.`;
    const selected = run.selected;
    if (selected?.kind === "crate") {
      action = state.crates ? `Unpack crate · ${state.crates} left` : "All crates unpacked";
      disabled = state.crates <= 0;
    } else if (selected?.kind === "plant") {
      const plant = state.inventory.find((item) => item.id === selected.id);
      if (plant) {
        const careCount = CARES.filter((care) => plant.care[care]).length;
        const condition = conditionOf(plant);
        const goalFit = state.displayGoal && !state.displayGoal.claimed && plant.traits.includes(state.displayGoal.trait)
          ? ` Display fit: ${SLOT_DATA.find((slot) => slot.zone === state.displayGoal.zone)?.zoneLabel || state.displayGoal.zone}.`
          : "";
        title = plant.species;
        copy = `${plant.traits.join(" · ")} · ${condition.icon} ${condition.label} soil ${Math.round(plant.hydration)}% · ${careCount}/3 care.${goalFit}`;
        action = Number.isInteger(plant.slot) && person ? `Offer to ${person.name}` : "Place on display";
        disabled = run.busy || (Number.isInteger(plant.slot) && !person);
      }
    } else if (selected?.kind === "customer" && person) {
      action = `What does ${person.name} need?`;
      disabled = false;
    } else if (selected?.kind === "slot") {
      action = "An empty display spot";
    }
    if (saleMessage) {
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
      ui.careTray.hidden = !plant;
      ui.careTray.classList.toggle("is-visible", Boolean(plant));
    }
    CARES.forEach((care) => {
      if (!ui.care[care]) return;
      const done = care === "water"
        ? Boolean(plant?.care.water && plant.hydration >= 78)
        : Boolean(plant?.care[care]);
      const needed = care === "water"
        ? Boolean(plant && (!plant.care.water || plant.hydration < 78))
        : Boolean(plant && !plant.care[care]);
      ui.care[care].disabled = !plant || run.busy;
      ui.care[care].classList.toggle("is-done", done);
      ui.care[care].dataset.needed = String(needed);
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
      run.selected = null;
      run.carried = null;
      if (run.selectionRing) run.selectionRing.visible = false;
      document.body.dataset.selection = "none";
      updateSlotGlow();
      updateUi();
      return;
    }
    if (entity.kind === "slot" && run.carried) {
      placePlant(run.carried, entity.id);
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
    if (event.key === "Escape") {
      openModal(ui.upgradeModal, false);
      openModal(ui.helpModal, false);
      return;
    }
    if (!ui.helpModal?.hidden || !ui.upgradeModal?.hidden || !ui.report?.hidden) return;
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
    if (!reduceMotion) {
      if (run.customer && !run.customerTween) {
        run.customer.position.y = Math.sin(time * 1.6 + run.customer.userData.phase) * 0.025;
        if (run.customer.userData.sprite) run.customer.userData.sprite.material.rotation = Math.sin(time * 1.3 + run.customer.userData.phase) * 0.006;
      }
      if (run.selectionRing?.visible) run.selectionRing.material.opacity = 0.65 + Math.sin(time * 4) * 0.18;
    }
    updateMovers(dt);
    updateEffects(dt);
    updateCustomer(dt);
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

  function updateCustomer(dt) {
    if (!run.customer || !run.customerTween) return;
    const tween = run.customerTween;
    tween.time += dt;
    const duration = tween.mode === "enter" ? 0.75 : 0.65;
    const t = clamp(tween.time / duration, 0, 1);
    if (tween.mode === "enter") run.customer.position.x = lerp(6.2, 0.15, 1 - (1 - t) ** 3);
    else run.customer.position.x = lerp(0.15, 6.5, t * t);
    if (run.customer.userData.sprite) run.customer.userData.sprite.material.rotation = Math.sin(t * Math.PI * 7) * 0.018;
    if (t >= 1) {
      if (tween.mode === "exit") {
        unregister(run.customer);
        run.customer = null;
      }
      run.customerTween = null;
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
