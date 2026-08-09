import * as THREE from "./vendor/three.module.min.js";

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;

const PRESETS = [
  { name: "mina", skin: 0xb96f55, hair: 0x38231f, style: "bob", outfit: "dress", height: 0.98, accent: 0xf2c27b },
  { name: "basil", skin: 0xd69a72, hair: 0x5a3828, style: "beanie", outfit: "apron", height: 0.97, accent: 0xd6e0bc },
  { name: "jo", skin: 0x8f5946, hair: 0x211c1b, style: "curls", outfit: "jacket", height: 0.97, accent: 0xf1d079, glasses: true },
  { name: "nori", skin: 0xe0ad8d, hair: 0x2e2526, style: "bun", outfit: "coat", height: 0.95, accent: 0xcdb7dc, glasses: true },
  { name: "pip", skin: 0xc78361, hair: 0x8a5737, style: "tuft", outfit: "overalls", height: 0.945, accent: 0xe7dfbd },
  { name: "sol", skin: 0x9d624a, hair: 0x4b2921, style: "ponytail", outfit: "cardigan", height: 0.99, accent: 0xf0b36e, earrings: true },
];

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || "customer");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function readColor(value, fallback) {
  try {
    return new THREE.Color(value ?? fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

function shifted(color, hue = 0, saturation = 0, lightness = 0) {
  const result = color.clone();
  result.offsetHSL(hue, saturation, lightness);
  return result;
}

function standard(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0,
    flatShading: true,
    ...extras,
  });
}

function addMesh(parent, geometry, material, name, position = null, rotation = null, scale = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  if (position) mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.characterPart = name;
  parent.add(mesh);
  return mesh;
}

function addBox(parent, size, position, material, name, rotation = null) {
  return addMesh(parent, new THREE.BoxGeometry(...size), material, name, position, rotation);
}

function addCylinder(parent, radii, height, position, material, name, sides = 8, rotation = null) {
  return addMesh(
    parent,
    new THREE.CylinderGeometry(radii[0], radii[1], height, sides),
    material,
    name,
    position,
    rotation,
  );
}

function addSphere(parent, radius, position, material, name, scale = null, detail = 1) {
  const geometry = detail > 0
    ? new THREE.SphereGeometry(radius, 12, 8)
    : new THREE.IcosahedronGeometry(radius, 1);
  return addMesh(parent, geometry, material, name, position, null, scale);
}

function buildArm(parent, side, materials) {
  const label = side < 0 ? "left" : "right";
  const shoulder = new THREE.Group();
  shoulder.name = `${label}-shoulder-pivot`;
  shoulder.position.set(side * 0.385, 0.83, 0);
  shoulder.rotation.z = -side * 0.08;
  parent.add(shoulder);

  addCylinder(shoulder, [0.122, 0.135], 0.31, [0, -0.145, 0], materials.outfit, `${label}-sleeve`, 8);
  addCylinder(shoulder, [0.09, 0.105], 0.25, [0, -0.415, 0], materials.skin, `${label}-upper-arm`, 8);

  const elbow = new THREE.Group();
  elbow.name = `${label}-elbow-pivot`;
  elbow.position.y = -0.525;
  shoulder.add(elbow);
  addSphere(elbow, 0.098, [0, 0, 0], materials.skin, `${label}-elbow`, [1, 0.92, 1], 0);
  addCylinder(elbow, [0.075, 0.09], 0.4, [0, -0.2, 0], materials.skin, `${label}-forearm`, 8);
  const hand = addSphere(elbow, 0.105, [0, -0.435, 0], materials.skin, `${label}-hand`, [0.86, 1.05, 0.78], 0);

  return { shoulder, elbow, hand };
}

function buildLeg(parent, side, materials, trouserMaterial) {
  const label = side < 0 ? "left" : "right";
  const hip = new THREE.Group();
  hip.name = `${label}-hip-pivot`;
  hip.position.set(side * 0.18, 1.09, 0);
  parent.add(hip);

  addCylinder(hip, [0.135, 0.15], 0.48, [0, -0.235, 0], trouserMaterial, `${label}-upper-leg`, 8);
  const knee = new THREE.Group();
  knee.name = `${label}-knee-pivot`;
  knee.position.y = -0.46;
  hip.add(knee);
  addSphere(knee, 0.13, [0, 0, 0], trouserMaterial, `${label}-knee`, [0.94, 0.88, 0.94], 0);
  addCylinder(knee, [0.1, 0.12], 0.43, [0, -0.22, 0], trouserMaterial, `${label}-lower-leg`, 8);
  const shoe = addMesh(
    knee,
    new THREE.BoxGeometry(0.25, 0.16, 0.39),
    materials.shoe,
    `${label}-shoe`,
    [0, -0.49, 0.075],
  );
  shoe.geometry.translate(0, 0, 0.035);

  return { hip, knee, shoe };
}

function buildFace(head, materials, preset, rng) {
  addSphere(head, 0.043, [-0.12, 0.055, 0.303], materials.eyeWhite, "left-eye-white", [1.12, 0.95, 0.46], 0);
  addSphere(head, 0.043, [0.12, 0.055, 0.303], materials.eyeWhite, "right-eye-white", [1.12, 0.95, 0.46], 0);
  addSphere(head, 0.022, [-0.12, 0.054, 0.329], materials.eye, "left-eye", [0.85, 1, 0.45], 0);
  addSphere(head, 0.022, [0.12, 0.054, 0.329], materials.eye, "right-eye", [0.85, 1, 0.45], 0);
  addBox(head, [0.1, 0.018, 0.018], [-0.12, 0.132, 0.311], materials.hair, "left-eyebrow", [0, 0, -0.06]);
  addBox(head, [0.1, 0.018, 0.018], [0.12, 0.132, 0.311], materials.hair, "right-eyebrow", [0, 0, 0.06]);
  addMesh(
    head,
    new THREE.ConeGeometry(0.045, 0.105, 6),
    materials.skinShade,
    "nose",
    [0, -0.015, 0.345],
    [Math.PI / 2, 0, 0],
  );
  addBox(head, [0.11, 0.024, 0.018], [0, -0.135, 0.318], materials.mouth, "smile", [0, 0, rng() * 0.08 - 0.04]);
  addSphere(head, 0.04, [-0.2, -0.075, 0.282], materials.cheek, "left-cheek", [1.15, 0.65, 0.32], 0);
  addSphere(head, 0.04, [0.2, -0.075, 0.282], materials.cheek, "right-cheek", [1.15, 0.65, 0.32], 0);

  if (preset.glasses) {
    [-1, 1].forEach((side) => {
      addMesh(
        head,
        new THREE.TorusGeometry(0.093, 0.012, 5, 12),
        materials.glasses,
        side < 0 ? "left-glasses-lens" : "right-glasses-lens",
        [side * 0.115, 0.055, 0.344],
        null,
        [1.08, 0.82, 1],
      );
    });
    addBox(head, [0.07, 0.014, 0.014], [0, 0.058, 0.345], materials.glasses, "glasses-bridge");
  }

  if (preset.earrings) {
    [-1, 1].forEach((side) => {
      addSphere(head, 0.034, [side * 0.335, -0.07, 0.015], materials.metal, side < 0 ? "left-earring" : "right-earring", null, 0);
    });
  }
}

function addHair(head, materials, preset) {
  const cap = addMesh(
    head,
    new THREE.SphereGeometry(0.344, 12, 6, 0, TAU, 0, Math.PI * 0.56),
    materials.hair,
    "hair-cap",
    [0, 0.045, -0.012],
    null,
    [1.02, 1.03, 1.02],
  );
  cap.renderOrder = 1;

  if (preset.style === "bob") {
    addSphere(head, 0.27, [0, -0.03, -0.19], materials.hair, "bob-back", [1.25, 1.15, 0.72], 0);
    addSphere(head, 0.105, [-0.29, -0.11, 0], materials.hair, "left-bob-lock", [0.74, 1.5, 0.7], 0);
    addSphere(head, 0.105, [0.29, -0.11, 0], materials.hair, "right-bob-lock", [0.74, 1.5, 0.7], 0);
  } else if (preset.style === "beanie") {
    addMesh(
      head,
      new THREE.SphereGeometry(0.355, 12, 6, 0, TAU, 0, Math.PI * 0.5),
      materials.accent,
      "beanie-crown",
      [0, 0.105, -0.01],
      null,
      [1.04, 0.88, 1.04],
    );
    addCylinder(head, [0.36, 0.36], 0.085, [0, 0.1, 0], materials.accentDark, "beanie-band", 12);
    addSphere(head, 0.065, [0, 0.405, -0.01], materials.accent, "beanie-pom", null, 0);
  } else if (preset.style === "curls") {
    const curls = [
      [-0.28, 0.18, 0], [-0.19, 0.3, -0.04], [0, 0.34, -0.05], [0.19, 0.3, -0.04], [0.28, 0.18, 0],
      [-0.31, 0.02, -0.04], [0.31, 0.02, -0.04], [-0.22, -0.1, -0.13], [0.22, -0.1, -0.13],
    ];
    curls.forEach((position, index) => addSphere(head, 0.115, position, materials.hair, `curl-${index + 1}`, null, 0));
  } else if (preset.style === "bun") {
    addSphere(head, 0.15, [0.02, 0.35, -0.1], materials.hair, "hair-bun", [1, 1.08, 0.95], 0);
    addCylinder(head, [0.045, 0.055], 0.37, [-0.13, 0.14, 0.27], materials.hair, "side-fringe", 6, [0, 0, -0.74]);
  } else if (preset.style === "tuft") {
    [-0.12, 0, 0.12].forEach((x, index) => {
      addMesh(
        head,
        new THREE.ConeGeometry(0.085, 0.3 - index * 0.025, 5),
        materials.hair,
        `hair-tuft-${index + 1}`,
        [x, 0.33 + (index === 1 ? 0.045 : 0), 0.02 - index * 0.025],
        [0, 0, (index - 1) * -0.35],
      );
    });
  } else {
    addSphere(head, 0.14, [-0.12, -0.03, -0.34], materials.hair, "ponytail-top", [0.85, 1.2, 0.8], 0);
    addSphere(head, 0.13, [-0.16, -0.24, -0.37], materials.hair, "ponytail-tip", [0.72, 1.35, 0.72], 0);
  }
}

function addOutfitDetails(motion, upperBody, materials, preset) {
  if (preset.outfit === "dress") {
    addCylinder(motion, [0.29, 0.42], 0.62, [0, 1.19, 0], materials.outfit, "dress-skirt", 10);
    addMesh(
      upperBody,
      new THREE.TorusGeometry(0.175, 0.035, 6, 16),
      materials.accent,
      "neck-scarf",
      [0, 0.89, 0],
      [Math.PI / 2, 0, 0],
      [1.25, 1, 1],
    );
  } else if (preset.outfit === "apron") {
    addBox(upperBody, [0.43, 0.55, 0.045], [0, 0.43, 0.305], materials.accent, "apron-bib");
    addBox(upperBody, [0.49, 0.08, 0.055], [0, 0.16, 0.315], materials.accentDark, "apron-pocket");
    addBox(upperBody, [0.055, 0.55, 0.035], [-0.19, 0.64, 0.302], materials.accentDark, "left-apron-strap", [0, 0, -0.13]);
    addBox(upperBody, [0.055, 0.55, 0.035], [0.19, 0.64, 0.302], materials.accentDark, "right-apron-strap", [0, 0, 0.13]);
  } else if (preset.outfit === "jacket") {
    addBox(upperBody, [0.16, 0.72, 0.065], [-0.14, 0.48, 0.3], materials.outfitDark, "left-jacket-panel", [0, 0, -0.04]);
    addBox(upperBody, [0.16, 0.72, 0.065], [0.14, 0.48, 0.3], materials.outfitDark, "right-jacket-panel", [0, 0, 0.04]);
    addBox(upperBody, [0.08, 0.3, 0.04], [-0.08, 0.7, 0.344], materials.accent, "left-lapel", [0, 0, 0.38]);
    addBox(upperBody, [0.08, 0.3, 0.04], [0.08, 0.7, 0.344], materials.accent, "right-lapel", [0, 0, -0.38]);
  } else if (preset.outfit === "coat") {
    addCylinder(motion, [0.3, 0.38], 0.87, [0, 1.29, 0], materials.outfitDark, "long-coat", 10);
    [-0.12, 0.12].forEach((x, index) => addSphere(motion, 0.035, [x, 1.52, 0.35], materials.metal, `coat-button-${index + 1}`, null, 0));
  } else if (preset.outfit === "overalls") {
    addBox(upperBody, [0.39, 0.42, 0.055], [0, 0.4, 0.31], materials.accent, "overall-bib");
    addBox(upperBody, [0.075, 0.5, 0.045], [-0.17, 0.69, 0.302], materials.accentDark, "left-overall-strap", [0, 0, -0.14]);
    addBox(upperBody, [0.075, 0.5, 0.045], [0.17, 0.69, 0.302], materials.accentDark, "right-overall-strap", [0, 0, 0.14]);
    addBox(upperBody, [0.2, 0.1, 0.035], [0, 0.32, 0.35], materials.outfitDark, "overall-pocket");
  } else {
    [-0.15, 0, 0.15].forEach((y, index) => addSphere(upperBody, 0.03, [0, 0.46 + y, 0.335], materials.accent, `cardigan-button-${index + 1}`, null, 0));
    addBox(upperBody, [0.055, 0.64, 0.045], [0, 0.5, 0.31], materials.outfitDark, "cardigan-opening");
  }
}

function buildCarriedPlant(parent, materials, rng) {
  const plant = new THREE.Group();
  plant.name = "carried-potted-plant";
  plant.position.set(0, 1.08, 0.56);
  plant.visible = false;
  parent.add(plant);

  addCylinder(plant, [0.205, 0.16], 0.3, [0, 0.17, 0], materials.pot, "carried-pot", 9);
  addCylinder(plant, [0.22, 0.22], 0.075, [0, 0.34, 0], materials.potLight, "carried-pot-rim", 9);
  addCylinder(plant, [0.17, 0.17], 0.035, [0, 0.382, 0], materials.soil, "carried-pot-soil", 12);
  addCylinder(plant, [0.018, 0.025], 0.42, [0, 0.57, 0], materials.stem, "carried-plant-stem", 6);

  const leafGeometry = new THREE.SphereGeometry(0.16, 8, 5);
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * TAU + rng() * 0.18;
    const radius = index < 2 ? 0.11 : 0.2;
    const leaf = addMesh(
      plant,
      leafGeometry,
      index % 2 ? materials.leafLight : materials.leaf,
      `carried-leaf-${index + 1}`,
      [Math.cos(angle) * radius, 0.55 + (index % 3) * 0.11, Math.sin(angle) * radius],
      [Math.sin(angle) * 0.45, angle, Math.cos(angle) * 0.48],
      [0.74, 1.35, 0.38],
    );
    leaf.userData.baseRotation = leaf.rotation.clone();
  }

  return plant;
}

/**
 * Create a self-contained, low-poly customer model.
 * The root sits on y=0 and the visible figure is approximately 2.55-2.70 units tall.
 */
export function createCharacter3D(person = {}, seed = 0) {
  person = person || {};
  const normalizedName = String(person.name || "customer").trim().toLowerCase();
  const colorKey = typeof person.color === "number" ? person.color : String(person.color || "");
  const hash = hashText(`${normalizedName}|${colorKey}|${seed}`);
  const rng = seededRandom(hash);
  const namedPreset = PRESETS.find((item) => item.name === normalizedName);
  const preset = { ...(namedPreset || PRESETS[hash % PRESETS.length]) };
  const outfitColor = readColor(person.color, 0x7189a6);
  const skinColor = readColor(preset.skin, 0xc78361);
  const hairColor = readColor(preset.hair, 0x3c2925);
  const accentColor = readColor(preset.accent, 0xe7d5a8);
  const trouserColor = shifted(outfitColor, 0.01, -0.08, -0.21);

  const materials = {
    skin: standard(skinColor),
    skinShade: standard(shifted(skinColor, 0, 0.01, -0.06)),
    cheek: standard(shifted(skinColor, -0.01, 0.12, 0.06)),
    hair: standard(hairColor),
    outfit: standard(outfitColor),
    outfitDark: standard(shifted(outfitColor, 0, -0.03, -0.15)),
    accent: standard(accentColor),
    accentDark: standard(shifted(accentColor, 0, -0.04, -0.13)),
    trousers: standard(trouserColor),
    shoe: standard(shifted(hairColor, 0, -0.12, -0.11)),
    eyeWhite: standard(0xf8f1dc),
    eye: standard(0x202a27),
    mouth: standard(0x743f3e),
    glasses: standard(0x374542, { metalness: 0.16, roughness: 0.52 }),
    metal: standard(0xd6b55c, { metalness: 0.45, roughness: 0.42 }),
    pot: standard(shifted(outfitColor, 0.05, -0.05, 0.08)),
    potLight: standard(shifted(outfitColor, 0.05, -0.04, 0.17)),
    soil: standard(0x4c3428),
    stem: standard(0x3f7149),
    leaf: standard(0x4e8654),
    leafLight: standard(0x78a967),
  };

  const root = new THREE.Group();
  root.name = `customer-3d-${normalizedName || "customer"}`;

  const shadow = addMesh(
    root,
    new THREE.CircleGeometry(0.56, 24),
    new THREE.MeshBasicMaterial({ color: 0x26362c, transparent: true, opacity: 0.2, depthWrite: false }),
    "contact-shadow",
    [0, 0.012, 0],
    [-Math.PI / 2, 0, 0],
    [1, 0.56, 1],
  );
  shadow.castShadow = false;
  shadow.receiveShadow = false;
  shadow.renderOrder = -1;

  const model = new THREE.Group();
  model.name = "character-scale";
  const heightJitter = (rng() - 0.5) * 0.012;
  const heightScale = clamp(preset.height + heightJitter, 0.94, 1);
  model.scale.setScalar(heightScale);
  root.add(model);

  const motion = new THREE.Group();
  motion.name = "character-motion";
  model.add(motion);

  addCylinder(motion, [0.295, 0.31], 0.23, [0, 1.12, 0], materials.outfitDark, "pelvis", 9);

  const upperBody = new THREE.Group();
  upperBody.name = "upper-body-pivot";
  upperBody.position.y = 1.08;
  motion.add(upperBody);
  addCylinder(upperBody, [0.37, 0.3], 0.84, [0, 0.48, 0], materials.outfit, "torso", 10);
  addCylinder(upperBody, [0.09, 0.105], 0.16, [0, 0.99, 0], materials.skin, "neck", 8);

  const leftArm = buildArm(upperBody, -1, materials);
  const rightArm = buildArm(upperBody, 1, materials);
  const leftLeg = buildLeg(motion, -1, materials, materials.trousers);
  const rightLeg = buildLeg(motion, 1, materials, materials.trousers);

  const head = new THREE.Group();
  head.name = "head-pivot";
  head.position.set(0, 1.205, 0);
  upperBody.add(head);
  addSphere(head, 0.33, [0, 0, 0], materials.skin, "head", [1, 1, 0.95]);
  addSphere(head, 0.085, [-0.325, -0.015, 0], materials.skinShade, "left-ear", [0.55, 1, 0.72], 0);
  addSphere(head, 0.085, [0.325, -0.015, 0], materials.skinShade, "right-ear", [0.55, 1, 0.72], 0);
  buildFace(head, materials, preset, rng);
  addHair(head, materials, preset);
  addOutfitDetails(motion, upperBody, materials, preset);

  const carriedPlant = buildCarriedPlant(motion, materials, rng);
  const raycastMeshes = [];
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = child === shadow ? false : true;
    child.receiveShadow = child === shadow ? false : true;
    child.userData.characterName = person.name || "Customer";
    raycastMeshes.push(child);
  });

  root.updateMatrixWorld(true);
  root.userData.phase = (hash % 1000) / 1000 * TAU;
  root.userData.characterHeight = new THREE.Box3().setFromObject(model).max.y;
  root.userData.animation = {
    walkBlend: 0,
    carryBlend: 0,
    lastTime: null,
  };
  root.userData.rig = {
    model,
    body: motion,
    torso: upperBody,
    head,
    leftShoulder: leftArm.shoulder,
    rightShoulder: rightArm.shoulder,
    leftElbow: leftArm.elbow,
    rightElbow: rightArm.elbow,
    leftHand: leftArm.hand,
    rightHand: rightArm.hand,
    leftHip: leftLeg.hip,
    rightHip: rightLeg.hip,
    leftKnee: leftLeg.knee,
    rightKnee: rightLeg.knee,
    leftFoot: leftLeg.shoe,
    rightFoot: rightLeg.shoe,
    carriedPlant,
    contactShadow: shadow,
    raycastMeshes,
  };

  return root;
}

/**
 * Pose a customer. `time` is elapsed seconds; navigation remains the caller's job.
 */
export function animateCharacter3D(root, {
  time = 0,
  walking = false,
  carrying = false,
  reduceMotion = false,
  walkSpeed = 1,
} = {}) {
  const rig = root?.userData?.rig;
  if (!rig) return;

  const state = root.userData.animation || (root.userData.animation = {
    walkBlend: 0,
    carryBlend: 0,
    lastTime: null,
  });
  const now = Number.isFinite(time) ? time : 0;
  const firstFrame = !Number.isFinite(state.lastTime);
  const previous = firstFrame ? now : state.lastTime;
  const delta = clamp(now - previous, 0, 0.1);
  state.lastTime = now;

  const walkTarget = walking && !reduceMotion ? 1 : 0;
  const carryTarget = carrying ? 1 : 0;
  const walkEase = reduceMotion ? 1 : 1 - Math.exp(-delta * 10);
  const carryEase = reduceMotion ? 1 : 1 - Math.exp(-delta * 12);
  state.walkBlend = firstFrame ? walkTarget : THREE.MathUtils.lerp(state.walkBlend, walkTarget, walkEase);
  state.carryBlend = firstFrame ? carryTarget : THREE.MathUtils.lerp(state.carryBlend, carryTarget, carryEase);
  if (Math.abs(state.walkBlend - walkTarget) < 0.001) state.walkBlend = walkTarget;
  if (Math.abs(state.carryBlend - carryTarget) < 0.001) state.carryBlend = carryTarget;

  const speed = clamp(Number.isFinite(walkSpeed) ? walkSpeed : 1, 0.25, 2.5);
  const phase = root.userData.phase || 0;
  const cycle = now * 7.2 * speed + phase;
  const gait = Math.sin(cycle);
  const stride = gait * 0.62 * state.walkBlend;
  const armStride = gait * 0.5 * state.walkBlend * (1 - state.carryBlend);
  const leftKnee = Math.max(0, gait) * 0.68 * state.walkBlend;
  const rightKnee = Math.max(0, -gait) * 0.68 * state.walkBlend;
  const idle = reduceMotion ? 0 : Math.sin(now * 1.45 + phase);
  const bob = reduceMotion ? 0 : Math.abs(Math.sin(cycle)) * 0.052 * state.walkBlend + idle * 0.009 * (1 - state.walkBlend);
  const carry = state.carryBlend;

  rig.body.position.y = bob;
  rig.body.rotation.z = gait * 0.025 * state.walkBlend;
  rig.torso.rotation.x = -0.035 * state.walkBlend + carry * 0.025;
  rig.torso.rotation.z = -gait * 0.035 * state.walkBlend + idle * 0.008 * (1 - state.walkBlend);
  rig.head.rotation.y = reduceMotion ? 0 : idle * 0.018 * (1 - state.walkBlend);
  rig.head.rotation.z = -rig.torso.rotation.z * 0.46;

  rig.leftHip.rotation.x = -stride;
  rig.rightHip.rotation.x = stride;
  rig.leftHip.rotation.z = -0.018;
  rig.rightHip.rotation.z = 0.018;
  rig.leftKnee.rotation.x = leftKnee;
  rig.rightKnee.rotation.x = rightKnee;
  rig.leftFoot.rotation.x = -leftKnee * 0.18;
  rig.rightFoot.rotation.x = -rightKnee * 0.18;

  const carryShoulderX = -0.48;
  const carryElbowX = -0.92;
  rig.leftShoulder.rotation.x = THREE.MathUtils.lerp(armStride, carryShoulderX, carry);
  rig.rightShoulder.rotation.x = THREE.MathUtils.lerp(-armStride, carryShoulderX, carry);
  rig.leftShoulder.rotation.z = THREE.MathUtils.lerp(0.08, 0.37, carry);
  rig.rightShoulder.rotation.z = THREE.MathUtils.lerp(-0.08, -0.37, carry);
  rig.leftElbow.rotation.x = carryElbowX * carry;
  rig.rightElbow.rotation.x = carryElbowX * carry;
  rig.leftElbow.rotation.z = -0.08 * carry;
  rig.rightElbow.rotation.z = 0.08 * carry;

  rig.carriedPlant.visible = Boolean(carrying);
  if (rig.carriedPlant.visible) {
    rig.carriedPlant.rotation.y = reduceMotion ? 0 : Math.sin(now * 1.3 + phase) * 0.018;
    rig.carriedPlant.position.y = 1.08 + (reduceMotion ? 0 : idle * 0.008);
  }
  rig.contactShadow.scale.set(1 - bob * 0.55, 0.56 - bob * 0.18, 1);
}
