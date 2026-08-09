import * as THREE from "./vendor/three.module.min.js";

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

function hash(value = "plant") {
  let result = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    result ^= text.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function material(color, options = {}) {
  const surfaceColor = new THREE.Color(color);
  if (options.map) surfaceColor.lerp(new THREE.Color(0xffffff), 0.76);
  return new THREE.MeshStandardMaterial({
    color: surfaceColor,
    map: options.map || null,
    roughness: options.roughness ?? 0.78,
    metalness: options.metalness ?? 0,
    side: options.side ?? THREE.DoubleSide,
    flatShading: options.flatShading ?? false,
  });
}

function mesh(parent, geometry, surface, position = null) {
  const object = new THREE.Mesh(geometry, surface);
  if (position) object.position.fromArray(position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function tube(parent, points, radius, surface, tubularSegments = 12, radialSegments = 5) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return mesh(parent, new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false), surface);
}

function cylinder(parent, radiusTop, radiusBottom, height, y, surface, segments = 12) {
  return mesh(parent, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), surface, [0, y, 0]);
}

function pointCone(parent, geometry, surface, position, direction) {
  const object = mesh(parent, geometry, surface, position);
  object.quaternion.setFromUnitVectors(UP, direction.clone().normalize());
  return object;
}

function ellipseHole(x, y, radiusX, radiusY, rotation = 0) {
  const path = new THREE.Path();
  path.absellipse(x, y, radiusX, radiusY, 0, TAU, false, rotation);
  return path;
}

function makeLanceShape(width = 0.25, length = 1, fullness = 0.62) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-width * 0.5, length * 0.08, -width, length * 0.32, -width * fullness, length * 0.63);
  shape.bezierCurveTo(-width * 0.42, length * 0.83, -width * 0.13, length * 0.97, 0, length);
  shape.bezierCurveTo(width * 0.13, length * 0.97, width * 0.42, length * 0.83, width * fullness, length * 0.63);
  shape.bezierCurveTo(width, length * 0.32, width * 0.5, length * 0.08, 0, 0);
  return shape;
}

function makeHeartShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.06, 0.08, -0.18, 0.02, -0.32, 0.09);
  shape.bezierCurveTo(-0.61, 0.23, -0.52, 0.57, -0.27, 0.76);
  shape.bezierCurveTo(-0.14, 0.86, -0.05, 0.94, 0, 1);
  shape.bezierCurveTo(0.05, 0.94, 0.14, 0.86, 0.27, 0.76);
  shape.bezierCurveTo(0.52, 0.57, 0.61, 0.23, 0.32, 0.09);
  shape.bezierCurveTo(0.18, 0.02, 0.06, 0.08, 0, 0);
  return shape;
}

function makeCalatheaShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.16, 0.04, -0.43, 0.24, -0.44, 0.52);
  shape.bezierCurveTo(-0.45, 0.76, -0.2, 0.94, 0, 1);
  shape.bezierCurveTo(0.2, 0.94, 0.45, 0.76, 0.44, 0.52);
  shape.bezierCurveTo(0.43, 0.24, 0.16, 0.04, 0, 0);
  return shape;
}

function makeSucculentShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.1, 0.02, -0.25, 0.22, -0.24, 0.49);
  shape.bezierCurveTo(-0.23, 0.72, -0.08, 0.94, 0, 1);
  shape.bezierCurveTo(0.08, 0.94, 0.23, 0.72, 0.24, 0.49);
  shape.bezierCurveTo(0.25, 0.22, 0.1, 0.02, 0, 0);
  return shape;
}

function makeMonsteraShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-0.12, 0.1);
  shape.lineTo(-0.35, 0.05);
  shape.lineTo(-0.27, 0.2);
  shape.lineTo(-0.55, 0.18);
  shape.lineTo(-0.38, 0.34);
  shape.lineTo(-0.66, 0.4);
  shape.lineTo(-0.41, 0.5);
  shape.lineTo(-0.64, 0.65);
  shape.lineTo(-0.34, 0.67);
  shape.lineTo(-0.46, 0.86);
  shape.lineTo(-0.18, 0.78);
  shape.lineTo(0, 1);
  shape.lineTo(0.18, 0.78);
  shape.lineTo(0.46, 0.86);
  shape.lineTo(0.34, 0.67);
  shape.lineTo(0.64, 0.65);
  shape.lineTo(0.41, 0.5);
  shape.lineTo(0.66, 0.4);
  shape.lineTo(0.38, 0.34);
  shape.lineTo(0.55, 0.18);
  shape.lineTo(0.27, 0.2);
  shape.lineTo(0.35, 0.05);
  shape.lineTo(0.12, 0.1);
  shape.lineTo(0, 0);
  shape.holes.push(ellipseHole(-0.18, 0.46, 0.055, 0.15, -0.25));
  shape.holes.push(ellipseHole(0.2, 0.5, 0.06, 0.17, 0.22));
  shape.holes.push(ellipseHole(-0.08, 0.72, 0.045, 0.12, -0.15));
  shape.holes.push(ellipseHole(0.09, 0.77, 0.04, 0.1, 0.12));
  return shape;
}

function makeSnakeBladeShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.12, 0);
  shape.bezierCurveTo(-0.17, 0.2, -0.09, 0.36, -0.16, 0.54);
  shape.bezierCurveTo(-0.2, 0.72, -0.09, 0.88, 0, 1);
  shape.bezierCurveTo(0.08, 0.88, 0.19, 0.72, 0.14, 0.54);
  shape.bezierCurveTo(0.08, 0.36, 0.17, 0.2, 0.12, 0);
  shape.lineTo(-0.12, 0);
  return shape;
}

function addPot(root, plant) {
  const palette = [0xc87555, 0xb96f55, 0xd49a6a, 0x6f8c82, 0xa76c64];
  const potColor = palette[hash(plant?.id || plant?.species) % palette.length];
  const clay = material(potColor, { roughness: 0.9 });
  const rim = material(new THREE.Color(potColor).offsetHSL(0, -0.02, 0.08), { roughness: 0.86 });
  const soil = material(0x443328, { roughness: 1 });
  const saucer = material(new THREE.Color(potColor).offsetHSL(0, 0, -0.08), { roughness: 0.94 });

  cylinder(root, 0.43, 0.45, 0.08, 0.04, saucer, 14);
  cylinder(root, 0.34, 0.29, 0.5, 0.3, clay, 12);
  cylinder(root, 0.39, 0.36, 0.13, 0.55, rim, 12);
  cylinder(root, 0.325, 0.325, 0.035, 0.622, soil, 18);
}

function addFern(root, track, colors, textures) {
  const stemMaterial = material(0x537247, { roughness: 0.92 });
  const frondMaterials = [
    material(colors.base, { map: textures.leafFern, roughness: 0.9 }),
    material(colors.light, { map: textures.leafFern, roughness: 0.9 }),
  ];
  const leafletGeometry = new THREE.ShapeGeometry(makeLanceShape(0.2, 1, 0.78), 7);

  for (let frondIndex = 0; frondIndex < 9; frondIndex += 1) {
    const angle = (frondIndex / 9) * TAU + 0.22;
    const length = 0.77 + (frondIndex % 3) * 0.1;
    const bend = 0.22 + (frondIndex % 2) * 0.07;
    const frond = new THREE.Group();
    frond.position.set(Math.cos(angle) * 0.055, 0.625, Math.sin(angle) * 0.055);
    frond.rotation.order = "YXZ";
    frond.rotation.y = -angle;
    frond.rotation.z = -0.1 + (frondIndex % 3) * 0.045;
    root.add(frond);
    track(frond, angle);

    tube(frond, [[0, 0, 0], [bend * 0.16, length * 0.36, 0], [bend * 0.54, length * 0.72, 0], [bend, length, 0]], 0.014, stemMaterial, 10, 5);

    const pairs = 7;
    for (let pair = 1; pair <= pairs; pair += 1) {
      const t = pair / (pairs + 1);
      const x = bend * t * t;
      const y = length * t;
      const bladeLength = (0.17 + Math.sin(t * Math.PI) * 0.15) * (0.92 + (frondIndex % 2) * 0.08);
      for (const side of [-1, 1]) {
        const leaflet = mesh(frond, leafletGeometry, frondMaterials[(pair + frondIndex) % 2]);
        leaflet.position.set(x + side * 0.015, y, side * 0.006);
        leaflet.rotation.z = side * (1.16 + t * 0.18);
        leaflet.rotation.x = side * 0.08;
        leaflet.scale.set(bladeLength, bladeLength, 1);
      }
    }

    const tip = mesh(frond, leafletGeometry, frondMaterials[frondIndex % 2]);
    tip.position.set(bend, length, 0);
    tip.rotation.z = -0.08;
    tip.scale.set(0.19, 0.19, 1);
  }
}

function addVine(root, track, colors, textures) {
  const vineMaterial = material(0x496942, { roughness: 0.94 });
  const leafMaterials = [
    material(colors.base, { map: textures.leafVelvet, roughness: 0.84 }),
    material(colors.light, { map: textures.leafVelvet, roughness: 0.84 }),
  ];
  const heartGeometry = new THREE.ShapeGeometry(makeHeartShape(), 10);

  for (let vineIndex = 0; vineIndex < 4; vineIndex += 1) {
    const angle = vineIndex * (TAU / 4) + 0.32;
    const vine = new THREE.Group();
    vine.position.set(Math.cos(angle) * 0.18, 0.635, Math.sin(angle) * 0.18);
    vine.rotation.y = -angle;
    root.add(vine);
    track(vine, angle);

    const reach = 0.6 + (vineIndex % 2) * 0.11;
    const endY = -0.34 - (vineIndex % 3) * 0.08;
    const points = [[0, 0, 0], [0.08, 0.17, 0], [reach * 0.5, 0.09, 0.015], [reach * 0.82, -0.14, -0.01], [reach, endY, 0.02]];
    tube(vine, points, 0.013, vineMaterial, 14, 5);

    for (let leafIndex = 0; leafIndex < 5; leafIndex += 1) {
      const t = 0.14 + leafIndex * 0.2;
      const x = reach * (0.1 + t * 0.9);
      const y = 0.16 - Math.max(0, t - 0.28) * (0.66 + vineIndex * 0.025);
      const leaf = mesh(vine, heartGeometry, leafMaterials[(leafIndex + vineIndex) % 2]);
      leaf.position.set(x, y, (leafIndex % 2 ? 1 : -1) * 0.016);
      leaf.rotation.z = (leafIndex % 2 ? -0.52 : 0.58) + t * 0.3;
      leaf.rotation.x = leafIndex % 2 ? 0.09 : -0.09;
      const leafScale = 0.24 + (leafIndex % 2) * 0.035;
      leaf.scale.set(leafScale, leafScale, 1);
    }
  }

  for (let shootIndex = 0; shootIndex < 3; shootIndex += 1) {
    const angle = shootIndex * (TAU / 3) + 0.7;
    const shoot = new THREE.Group();
    shoot.position.set(Math.cos(angle) * 0.09, 0.635, Math.sin(angle) * 0.09);
    shoot.rotation.y = -angle;
    shoot.rotation.z = (shootIndex - 1) * 0.18;
    root.add(shoot);
    track(shoot, angle);
    const height = 0.43 + shootIndex * 0.08;
    tube(shoot, [[0, 0, 0], [0.05, height * 0.56, 0], [0.13, height, 0]], 0.015, vineMaterial, 8, 5);
    const leaf = mesh(shoot, heartGeometry, leafMaterials[shootIndex % 2], [0.13, height, 0]);
    leaf.rotation.z = -0.24;
    leaf.scale.setScalar(0.3 + shootIndex * 0.025);
  }
}

function addCalathea(root, track, colors, textures) {
  const stemMaterial = material(0x4c6745, { roughness: 0.92 });
  const leafMaterial = material(colors.base, { map: textures.leafPinstripe, roughness: 0.82 });
  const reverseMaterial = material(new THREE.Color(colors.base).offsetHSL(-0.04, 0.08, -0.12), { map: textures.leafPinstripe, roughness: 0.84 });
  const stripeMaterial = material(0xe7a9b7, { roughness: 0.8 });
  const veinMaterial = material(0xf0c3ca, { roughness: 0.82 });
  const leafGeometry = new THREE.ShapeGeometry(makeCalatheaShape(), 12);
  const stripeGeometry = new THREE.CylinderGeometry(0.006, 0.009, 0.27, 4);

  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * TAU + 0.15;
    const stemHeight = 0.43 + (index % 3) * 0.11;
    const leafLength = 0.72 + (index % 2) * 0.1;
    const lean = 0.08 + (index % 3) * 0.045;
    const leafNode = new THREE.Group();
    leafNode.position.set(Math.cos(angle) * 0.075, 0.625, Math.sin(angle) * 0.075);
    leafNode.rotation.order = "YXZ";
    leafNode.rotation.y = -angle;
    leafNode.rotation.z = (index % 2 ? 1 : -1) * 0.08;
    root.add(leafNode);
    track(leafNode, angle);

    tube(leafNode, [[0, 0, 0], [lean * 0.25, stemHeight * 0.45, 0], [lean, stemHeight, 0]], 0.018, stemMaterial, 8, 5);
    const holder = new THREE.Group();
    holder.position.set(lean, stemHeight, 0);
    holder.rotation.z = -lean * 0.45;
    holder.scale.set(leafLength, leafLength, 1);
    leafNode.add(holder);

    const leaf = mesh(holder, leafGeometry, index % 2 ? leafMaterial : reverseMaterial);
    leaf.position.z = 0;
    mesh(holder, new THREE.CylinderGeometry(0.009, 0.014, 0.9, 5), veinMaterial, [0, 0.45, 0.012]);

    if (!textures.leafPinstripe) {
      for (let stripe = 0; stripe < 4; stripe += 1) {
        const y = 0.24 + stripe * 0.15;
        const widthAtY = 0.18 + Math.sin(y * Math.PI) * 0.1;
        for (const side of [-1, 1]) {
          const mark = mesh(holder, stripeGeometry, stripeMaterial, [side * widthAtY * 0.52, y, 0.014]);
          mark.rotation.z = side * (0.72 - stripe * 0.045);
          mark.scale.y = 0.72 + stripe * 0.09;
        }
      }
    }
  }
}

function addSucculent(root, track, colors, textures) {
  const waxMaterials = [
    material(colors.base, { map: textures.leafWaxy, roughness: 0.46 }),
    material(colors.light, { map: textures.leafWaxy, roughness: 0.42 }),
    material(new THREE.Color(colors.base).offsetHSL(-0.02, -0.04, -0.09), { map: textures.leafWaxy, roughness: 0.5 }),
  ];
  const shape = makeSucculentShape();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.022,
    bevelThickness: 0.016,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -0.0275);

  const layers = [
    { count: 10, radius: 0.08, length: 0.54, tilt: 1.08 },
    { count: 8, radius: 0.055, length: 0.5, tilt: 0.66 },
    { count: 6, radius: 0.025, length: 0.58, tilt: 0.24 },
  ];

  layers.forEach((layer, layerIndex) => {
    for (let index = 0; index < layer.count; index += 1) {
      const angle = (index / layer.count) * TAU + layerIndex * 0.42;
      const leafNode = new THREE.Group();
      leafNode.position.set(Math.cos(angle) * layer.radius, 0.64 + layerIndex * 0.015, Math.sin(angle) * layer.radius);
      leafNode.rotation.order = "YXZ";
      leafNode.rotation.y = -angle;
      leafNode.rotation.x = layer.tilt;
      leafNode.rotation.z = Math.sin(index * 1.9) * 0.035;
      root.add(leafNode);
      track(leafNode, angle);

      const leaf = mesh(leafNode, geometry, waxMaterials[(index + layerIndex) % waxMaterials.length]);
      leaf.scale.set(layer.length * 0.92, layer.length, 1);
    }
  });
}

function addMonstera(root, track, colors, textures) {
  const stemMaterial = material(0x477347, { roughness: 0.9 });
  const leafMaterials = [
    material(colors.base, { map: textures.leafVelvet, roughness: 0.75 }),
    material(colors.light, { map: textures.leafVelvet, roughness: 0.78 }),
  ];
  const veinMaterial = material(0x8eb077, { roughness: 0.86 });
  const leafGeometry = new THREE.ShapeGeometry(makeMonsteraShape(), 4);

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * TAU + 0.36;
    const stemHeight = 0.48 + (index % 3) * 0.13;
    const leafScale = 0.57 + (index % 2) * 0.09;
    const lean = 0.13 + (index % 3) * 0.055;
    const leafNode = new THREE.Group();
    leafNode.position.set(Math.cos(angle) * 0.065, 0.625, Math.sin(angle) * 0.065);
    leafNode.rotation.order = "YXZ";
    leafNode.rotation.y = -angle;
    leafNode.rotation.z = (index % 2 ? 0.07 : -0.04);
    root.add(leafNode);
    track(leafNode, angle);

    tube(leafNode, [[0, 0, 0], [lean * 0.22, stemHeight * 0.42, 0], [lean, stemHeight, 0]], 0.022, stemMaterial, 9, 6);
    const holder = new THREE.Group();
    holder.position.set(lean, stemHeight, 0);
    holder.rotation.z = -0.08 + (index % 2) * 0.12;
    holder.scale.set(leafScale, leafScale * 1.08, 1);
    leafNode.add(holder);

    mesh(holder, leafGeometry, leafMaterials[index % 2]);
    mesh(holder, new THREE.CylinderGeometry(0.011, 0.016, 0.86, 5), veinMaterial, [0, 0.43, 0.012]);
    for (const side of [-1, 1]) {
      for (let vein = 0; vein < 3; vein += 1) {
        const branch = mesh(holder, new THREE.CylinderGeometry(0.005, 0.007, 0.28 - vein * 0.035, 4), veinMaterial);
        branch.position.set(side * (0.08 + vein * 0.045), 0.27 + vein * 0.18, 0.013);
        branch.rotation.z = side * (0.78 - vein * 0.08);
      }
    }
  }
}

function addSnakePlant(root, track, colors, textures) {
  const edgeMaterial = material(0xd7c84d, { roughness: 0.65 });
  const leafMaterials = [
    material(colors.base, { map: textures.leafWaxy, roughness: 0.58 }),
    material(new THREE.Color(colors.base).offsetHSL(0.01, 0.05, -0.1), { map: textures.leafWaxy, roughness: 0.6 }),
  ];
  const markingMaterial = material(0x385d3f, { roughness: 0.7 });
  const bladeGeometry = new THREE.ShapeGeometry(makeSnakeBladeShape(), 10);

  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * TAU + 0.18;
    const height = 0.93 + (index % 4) * 0.15;
    const width = 0.9 + (index % 3) * 0.07;
    const bladeNode = new THREE.Group();
    bladeNode.position.set(Math.cos(angle) * (0.06 + (index % 2) * 0.045), 0.625, Math.sin(angle) * (0.06 + (index % 2) * 0.045));
    bladeNode.rotation.order = "YXZ";
    bladeNode.rotation.y = -angle;
    bladeNode.rotation.z = Math.cos(angle * 2) * 0.065;
    bladeNode.scale.set(width, height, 1);
    root.add(bladeNode);
    track(bladeNode, angle);

    const edge = mesh(bladeNode, bladeGeometry, edgeMaterial);
    edge.position.z = 0;
    const front = mesh(bladeNode, bladeGeometry, leafMaterials[index % 2]);
    front.position.set(0, 0.016, 0.006);
    front.scale.set(0.77, 0.965, 1);
    const back = mesh(bladeNode, bladeGeometry, leafMaterials[index % 2]);
    back.position.set(0, 0.016, -0.006);
    back.scale.set(0.77, 0.965, 1);

    if (!textures.leafWaxy) {
      for (let markIndex = 0; markIndex < 3; markIndex += 1) {
        const mark = mesh(bladeNode, new THREE.CylinderGeometry(0.004, 0.006, 0.16, 3), markingMaterial);
        mark.position.set((markIndex % 2 ? -1 : 1) * 0.02, 0.28 + markIndex * 0.2, 0.012);
        mark.rotation.z = (markIndex % 2 ? -1 : 1) * 1.18;
      }
    }
  }
}

function addCactus(root, track, colors, textures) {
  const cactusMaterial = material(colors.base, { map: textures.leafWaxy, roughness: 0.74, flatShading: true });
  const ribMaterial = material(colors.light, { map: textures.leafWaxy, roughness: 0.7 });
  const spineMaterial = material(0xf1e1b4, { roughness: 0.84 });
  const crownMaterials = [
    material(0xf05f59, { roughness: 0.64, flatShading: true }),
    material(0xff9b45, { roughness: 0.6, flatShading: true }),
  ];
  const cactus = new THREE.Group();
  cactus.position.y = 0.625;
  root.add(cactus);
  track(cactus, 0);

  const columnHeight = 1.08;
  cylinder(cactus, 0.205, 0.245, columnHeight, columnHeight / 2, cactusMaterial, 12);
  for (let rib = 0; rib < 10; rib += 1) {
    const angle = (rib / 10) * TAU;
    const radius = 0.218;
    tube(cactus, [
      [Math.cos(angle) * radius * 0.88, 0.05, Math.sin(angle) * radius * 0.88],
      [Math.cos(angle) * radius, columnHeight * 0.45, Math.sin(angle) * radius],
      [Math.cos(angle) * radius * 0.9, columnHeight - 0.04, Math.sin(angle) * radius * 0.9],
    ], 0.016, ribMaterial, 8, 4);
  }

  const spineGeometry = new THREE.ConeGeometry(0.014, 0.12, 4);
  for (let row = 0; row < 4; row += 1) {
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * TAU + row * 0.29;
      const direction = new THREE.Vector3(Math.cos(angle), 0.12 + (row % 2) * 0.08, Math.sin(angle));
      pointCone(cactus, spineGeometry, spineMaterial, [Math.cos(angle) * 0.25, 0.18 + row * 0.23, Math.sin(angle) * 0.25], direction);
    }
  }

  const crown = mesh(cactus, new THREE.DodecahedronGeometry(0.29, 1), crownMaterials[0], [0, columnHeight + 0.18, 0]);
  crown.scale.set(1.08, 0.82, 1.08);
  for (let lobe = 0; lobe < 7; lobe += 1) {
    const angle = (lobe / 7) * TAU;
    const lobeMesh = mesh(cactus, new THREE.DodecahedronGeometry(0.105, 0), crownMaterials[lobe % 2], [Math.cos(angle) * 0.22, columnHeight + 0.18, Math.sin(angle) * 0.22]);
    lobeMesh.scale.y = 1.18;
    const direction = new THREE.Vector3(Math.cos(angle), 0.45, Math.sin(angle));
    pointCone(cactus, spineGeometry, spineMaterial, [Math.cos(angle) * 0.31, columnHeight + 0.23, Math.sin(angle) * 0.31], direction);
  }
  pointCone(cactus, spineGeometry, spineMaterial, [0, columnHeight + 0.46, 0], new THREE.Vector3(0, 1, 0));
}

/**
 * Builds a local-space plant model. Game/entity metadata belongs to the caller.
 * Foliage animation pivots are exposed through root.userData.leaves.
 */
export function createDistinctPlant3D(plant, spec, textures = {}) {
  const root = new THREE.Group();
  const leaves = [];
  const maps = textures || {};
  const fallback = Number.isFinite(spec?.color) ? spec.color : 0x4f8050;
  const base = new THREE.Color(fallback);
  base.offsetHSL(Number.isFinite(plant?.colorShift) ? plant.colorShift : 0, 0, 0);
  const colors = {
    base,
    light: base.clone().offsetHSL(0.018, -0.05, 0.13),
  };
  const track = (node, radialAngle) => {
    node.userData.radialAngle = radialAngle;
    leaves.push(node);
    return node;
  };

  addPot(root, plant);

  switch (spec?.shape) {
    case "vine":
      addVine(root, track, colors, maps);
      break;
    case "fan":
      addCalathea(root, track, colors, maps);
      break;
    case "succulent":
      addSucculent(root, track, colors, maps);
      break;
    case "broad":
      addMonstera(root, track, colors, maps);
      break;
    case "spear":
      addSnakePlant(root, track, colors, maps);
      break;
    case "cactus":
      addCactus(root, track, colors, maps);
      break;
    case "fern":
    default:
      addFern(root, track, colors, maps);
      break;
  }

  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  leaves.forEach((node, index) => {
    node.userData.basePosition = node.position.clone();
    node.userData.baseEuler = node.rotation.clone();
    node.userData.baseScale = node.scale.clone();
    if (!Number.isFinite(node.userData.radialAngle)) {
      node.userData.radialAngle = Math.abs(node.position.x) + Math.abs(node.position.z) > 0.001
        ? Math.atan2(node.position.z, node.position.x)
        : (index / Math.max(1, leaves.length)) * TAU;
    }
  });
  root.userData.leaves = leaves;
  return root;
}
