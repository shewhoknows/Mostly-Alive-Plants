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

function makeOvalLeafShape(width = 0.34, length = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-width * 0.88, length * 0.1, -width, length * 0.56, 0, length);
  shape.bezierCurveTo(width, length * 0.56, width * 0.88, length * 0.1, 0, 0);
  return shape;
}

function makeShieldLeafShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.14, 0.13, -0.6, 0.02, -0.66, 0.36);
  shape.bezierCurveTo(-0.72, 0.68, -0.32, 0.91, 0, 1.12);
  shape.bezierCurveTo(0.32, 0.91, 0.72, 0.68, 0.66, 0.36);
  shape.bezierCurveTo(0.6, 0.02, 0.14, 0.13, 0, 0);
  return shape;
}

function makeAsymmetricLeafShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.13, 0.06, -0.56, 0.16, -0.57, 0.55);
  shape.bezierCurveTo(-0.57, 0.83, -0.26, 1.01, 0, 1.08);
  shape.bezierCurveTo(0.22, 0.91, 0.38, 0.62, 0.32, 0.34);
  shape.bezierCurveTo(0.28, 0.14, 0.1, 0.03, 0, 0);
  return shape;
}

function makeSpatheShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.22, 0.08, -0.31, 0.4, -0.05, 0.72);
  shape.bezierCurveTo(0.08, 0.88, 0.2, 0.97, 0.25, 1.05);
  shape.bezierCurveTo(0.23, 0.74, 0.35, 0.39, 0.18, 0.14);
  shape.bezierCurveTo(0.12, 0.05, 0.04, 0.01, 0, 0);
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

function addPearls(root, track, colors, textures) {
  const vineMaterial = material(0x426b45, { roughness: 0.94 });
  const pearlMaterials = [
    material(colors.base, { map: textures.leafWaxy, roughness: 0.55 }),
    material(colors.light, { map: textures.leafWaxy, roughness: 0.5 }),
    material(new THREE.Color(colors.base).offsetHSL(0.02, 0.03, -0.1), { map: textures.leafWaxy, roughness: 0.58 }),
  ];
  const pearlGeometry = new THREE.IcosahedronGeometry(0.052, 1);

  const crown = new THREE.Group();
  crown.position.y = 0.64;
  root.add(crown);
  track(crown, 0);
  for (let index = 0; index < 15; index += 1) {
    const angle = index * 2.4;
    const radius = 0.04 + (index % 5) * 0.045;
    const pearl = mesh(crown, pearlGeometry, pearlMaterials[index % pearlMaterials.length], [
      Math.cos(angle) * radius,
      0.025 + (index % 3) * 0.026,
      Math.sin(angle) * radius,
    ]);
    pearl.scale.setScalar(0.82 + (index % 4) * 0.07);
  }

  for (let strandIndex = 0; strandIndex < 7; strandIndex += 1) {
    const angle = (strandIndex / 7) * TAU + 0.18;
    const reach = 0.36 + (strandIndex % 3) * 0.07;
    const drop = 0.43 + (strandIndex % 4) * 0.045;
    const strand = new THREE.Group();
    strand.position.set(Math.cos(angle) * 0.15, 0.64, Math.sin(angle) * 0.15);
    strand.rotation.y = -angle;
    root.add(strand);
    track(strand, angle);

    tube(strand, [
      [0, 0, 0],
      [reach * 0.34, 0.015, 0.018],
      [reach * 0.72, -drop * 0.4, -0.015],
      [reach, -drop, 0.012],
    ], 0.009, vineMaterial, 11, 4);

    const pearlCount = 8;
    for (let pearlIndex = 1; pearlIndex <= pearlCount; pearlIndex += 1) {
      const t = pearlIndex / pearlCount;
      const pearl = mesh(strand, pearlGeometry, pearlMaterials[(pearlIndex + strandIndex) % pearlMaterials.length], [
        reach * t,
        0.02 - drop * t * t,
        Math.sin(t * Math.PI * 3 + strandIndex) * 0.018,
      ]);
      pearl.scale.setScalar(0.84 + ((pearlIndex + strandIndex) % 3) * 0.08);
    }
  }
}

function addCoinLeaf(root, track, colors, textures) {
  const stemMaterial = material(0x56815a, { roughness: 0.9 });
  const coinMaterials = [
    material(colors.base, { map: textures.leafWaxy, roughness: 0.58 }),
    material(colors.light, { map: textures.leafWaxy, roughness: 0.54 }),
  ];
  const veinMaterial = material(0x8db77e, { roughness: 0.82 });
  const coinGeometry = new THREE.SphereGeometry(1, 12, 7);

  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * TAU + 0.25;
    const height = 0.38 + (index % 4) * 0.12;
    const reach = 0.18 + (index % 3) * 0.075;
    const stem = new THREE.Group();
    stem.position.set(Math.cos(angle) * 0.055, 0.625, Math.sin(angle) * 0.055);
    stem.rotation.y = -angle;
    stem.rotation.z = (index % 2 ? 1 : -1) * 0.035;
    root.add(stem);
    track(stem, angle);

    tube(stem, [[0, 0, 0], [reach * 0.24, height * 0.5, 0], [reach, height, 0]], 0.012, stemMaterial, 7, 4);
    const coin = mesh(stem, coinGeometry, coinMaterials[index % 2], [reach, height, 0]);
    const size = 0.155 + (index % 3) * 0.018;
    coin.scale.set(size, size * (0.94 + (index % 2) * 0.06), 0.027);
    coin.rotation.z = index % 2 ? 0.13 : -0.1;
    mesh(stem, new THREE.SphereGeometry(0.025, 7, 4), veinMaterial, [reach, height, 0.029]);
  }
}

function addRubberTree(root, track, colors, textures) {
  const woodMaterial = material(0x6f5740, { roughness: 0.96 });
  const stemMaterial = material(0x567248, { roughness: 0.9 });
  const leafMaterials = [
    material(colors.base, { map: textures.leafWaxy, roughness: 0.35 }),
    material(colors.light, { map: textures.leafWaxy, roughness: 0.4 }),
  ];
  const veinMaterial = material(0xb1be84, { roughness: 0.78 });
  const leafGeometry = new THREE.ShapeGeometry(makeOvalLeafShape(0.43, 1), 10);

  cylinder(root, 0.052, 0.095, 1.08, 1.165, woodMaterial, 9);
  cylinder(root, 0.038, 0.052, 0.25, 1.83, stemMaterial, 8);

  const branches = [
    { angle: 0.1, y: 0.97, reach: 0.34, lift: 0.16, size: 0.5 },
    { angle: 2.45, y: 1.08, reach: 0.3, lift: 0.2, size: 0.46 },
    { angle: 4.25, y: 1.2, reach: 0.38, lift: 0.17, size: 0.52 },
    { angle: 1.25, y: 1.38, reach: 0.31, lift: 0.19, size: 0.47 },
    { angle: 3.34, y: 1.49, reach: 0.34, lift: 0.18, size: 0.49 },
    { angle: 5.45, y: 1.6, reach: 0.29, lift: 0.2, size: 0.44 },
    { angle: 0.75, y: 1.74, reach: 0.08, lift: 0.12, size: 0.46 },
  ];

  branches.forEach((branch, index) => {
    const directionX = Math.cos(branch.angle);
    const directionZ = Math.sin(branch.angle);
    const end = [directionX * branch.reach, branch.y + branch.lift, directionZ * branch.reach];
    tube(root, [[0, branch.y, 0], [directionX * branch.reach * 0.45, branch.y + branch.lift * 0.42, directionZ * branch.reach * 0.45], end], 0.019, stemMaterial, 6, 5);

    const leafNode = new THREE.Group();
    leafNode.position.fromArray(end);
    leafNode.rotation.order = "YXZ";
    leafNode.rotation.y = -branch.angle;
    leafNode.rotation.z = (index % 2 ? 0.18 : -0.12);
    root.add(leafNode);
    track(leafNode, branch.angle);

    const leaf = mesh(leafNode, leafGeometry, leafMaterials[index % 2]);
    leaf.scale.set(branch.size, branch.size * 1.04, 1);
    mesh(leafNode, new THREE.CylinderGeometry(0.008, 0.011, 0.82, 5), veinMaterial, [0, branch.size * 0.43, 0.012]).scale.y = branch.size;
  });
}

function addSpoonflower(root, track, colors, textures) {
  const stemMaterial = material(0x4f754d, { roughness: 0.91 });
  const leafMaterials = [
    material(colors.base, { map: textures.leafWaxy, roughness: 0.52 }),
    material(colors.light, { map: textures.leafWaxy, roughness: 0.58 }),
  ];
  const spatheMaterial = material(0xf8f2dc, { roughness: 0.68 });
  const spadixMaterial = material(0xe7d071, { roughness: 0.78 });
  const leafGeometry = new THREE.ShapeGeometry(makeLanceShape(0.34, 1, 0.75), 10);
  const spatheGeometry = new THREE.ShapeGeometry(makeSpatheShape(), 10);

  for (let index = 0; index < 11; index += 1) {
    const angle = (index / 11) * TAU + 0.2;
    const length = 0.72 + (index % 4) * 0.09;
    const leafNode = new THREE.Group();
    leafNode.position.set(Math.cos(angle) * 0.075, 0.625, Math.sin(angle) * 0.075);
    leafNode.rotation.order = "YXZ";
    leafNode.rotation.y = -angle;
    leafNode.rotation.z = -(0.2 + (index % 3) * 0.09);
    root.add(leafNode);
    track(leafNode, angle);
    const leaf = mesh(leafNode, leafGeometry, leafMaterials[index % 2]);
    leaf.scale.set(0.82 + (index % 2) * 0.08, length, 1);
  }

  for (let index = 0; index < 3; index += 1) {
    const angle = index * (TAU / 3) + 0.7;
    const height = 0.82 + index * 0.12;
    const lean = 0.1 + index * 0.035;
    const flower = new THREE.Group();
    flower.position.set(Math.cos(angle) * 0.035, 0.625, Math.sin(angle) * 0.035);
    flower.rotation.y = -angle;
    root.add(flower);
    track(flower, angle);
    tube(flower, [[0, 0, 0], [lean * 0.25, height * 0.5, 0], [lean, height, 0]], 0.013, stemMaterial, 8, 5);

    const bloom = new THREE.Group();
    bloom.position.set(lean, height, 0);
    bloom.rotation.z = index % 2 ? -0.16 : 0.1;
    bloom.scale.setScalar(0.32 + index * 0.025);
    flower.add(bloom);
    mesh(bloom, spatheGeometry, spatheMaterial);
    cylinder(bloom, 0.035, 0.045, 0.58, 0.43, spadixMaterial, 7).position.z = 0.035;
  }
}

function addPalm(root, track, colors, textures) {
  const stalkMaterial = material(0x6d8a54, { roughness: 0.92 });
  const frondMaterials = [
    material(colors.base, { map: textures.leafFern, roughness: 0.82 }),
    material(colors.light, { map: textures.leafFern, roughness: 0.86 }),
  ];
  const leafletGeometry = new THREE.ShapeGeometry(makeLanceShape(0.1, 1, 0.8), 6);

  for (let frondIndex = 0; frondIndex < 8; frondIndex += 1) {
    const angle = (frondIndex / 8) * TAU + 0.12;
    const reach = 0.4 + (frondIndex % 3) * 0.1;
    const height = 0.76 + (frondIndex % 4) * 0.1;
    const frond = new THREE.Group();
    frond.position.set(Math.cos(angle) * 0.04, 0.625, Math.sin(angle) * 0.04);
    frond.rotation.y = -angle;
    frond.rotation.z = (frondIndex % 2 ? 1 : -1) * 0.045;
    root.add(frond);
    track(frond, angle);

    tube(frond, [[0, 0, 0], [0.06, height * 0.47, 0], [reach * 0.48, height * 0.88, 0], [reach, height, 0]], 0.014, stalkMaterial, 11, 5);
    for (let pair = 1; pair <= 7; pair += 1) {
      const t = 0.2 + pair * 0.09;
      const x = reach * t * t;
      const y = height * (1.18 * t - 0.18 * t * t);
      const leafletLength = 0.24 + Math.sin(t * Math.PI) * 0.09;
      for (const side of [-1, 1]) {
        const leaflet = mesh(frond, leafletGeometry, frondMaterials[(pair + frondIndex) % 2], [x, y, side * 0.012]);
        leaflet.rotation.x = side * (1.08 + t * 0.18);
        leaflet.rotation.z = -0.2 - t * 0.16;
        leaflet.scale.set(leafletLength * 0.88, leafletLength, 1);
      }
    }
    const tip = mesh(frond, leafletGeometry, frondMaterials[frondIndex % 2], [reach, height, 0]);
    tip.rotation.z = -1.28;
    tip.scale.set(0.24, 0.28, 1);
  }
}

function addGem(root, track, colors, textures) {
  const stemMaterial = material(0x4a7451, { roughness: 0.8 });
  const leafletMaterials = [
    material(colors.base, { map: textures.leafWaxy, roughness: 0.38 }),
    material(colors.light, { map: textures.leafWaxy, roughness: 0.42 }),
  ];
  const leafletGeometry = new THREE.ShapeGeometry(makeOvalLeafShape(0.32, 1), 8);

  for (let stemIndex = 0; stemIndex < 7; stemIndex += 1) {
    const angle = (stemIndex / 7) * TAU + 0.34;
    const reach = 0.16 + (stemIndex % 3) * 0.09;
    const height = 0.72 + (stemIndex % 4) * 0.12;
    const stem = new THREE.Group();
    stem.position.set(Math.cos(angle) * 0.055, 0.625, Math.sin(angle) * 0.055);
    stem.rotation.y = -angle;
    root.add(stem);
    track(stem, angle);

    tube(stem, [[0, 0, 0], [0.025, height * 0.4, 0], [reach * 0.42, height * 0.77, 0], [reach, height, 0]], 0.022, stemMaterial, 10, 6);
    for (let pair = 1; pair <= 5; pair += 1) {
      const t = 0.18 + pair * 0.13;
      const x = reach * t * t;
      const y = height * (1.13 * t - 0.13 * t * t);
      for (const side of [-1, 1]) {
        const leaflet = mesh(stem, leafletGeometry, leafletMaterials[(pair + stemIndex) % 2], [x, y, side * 0.018]);
        leaflet.rotation.x = side * 1.08;
        leaflet.rotation.z = -0.12 - t * 0.13;
        const size = 0.19 + pair * 0.009;
        leaflet.scale.set(size, size * 1.05, 1);
      }
    }
    const tip = mesh(stem, leafletGeometry, leafletMaterials[stemIndex % 2], [reach, height, 0]);
    tip.rotation.z = -0.38;
    tip.scale.set(0.2, 0.23, 1);
  }
}

function addShield(root, track, colors, textures) {
  const stemMaterial = material(0x4b704e, { roughness: 0.9 });
  const leafMaterials = [
    material(colors.base, { map: textures.leafVelvet, roughness: 0.62 }),
    material(colors.light, { map: textures.leafVelvet, roughness: 0.66 }),
  ];
  const veinMaterial = material(0x9db780, { roughness: 0.82 });
  const leafGeometry = new THREE.ShapeGeometry(makeShieldLeafShape(), 12);

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * TAU + 0.4;
    const stemHeight = 0.42 + (index % 3) * 0.13;
    const lean = 0.12 + (index % 2) * 0.08;
    const leafSize = 0.48 + (index % 3) * 0.055;
    const leafNode = new THREE.Group();
    leafNode.position.set(Math.cos(angle) * 0.055, 0.625, Math.sin(angle) * 0.055);
    leafNode.rotation.order = "YXZ";
    leafNode.rotation.y = -angle;
    leafNode.rotation.z = (index % 2 ? 1 : -1) * 0.04;
    root.add(leafNode);
    track(leafNode, angle);

    tube(leafNode, [[0, 0, 0], [lean * 0.2, stemHeight * 0.46, 0], [lean, stemHeight, 0]], 0.022, stemMaterial, 8, 6);
    const holder = new THREE.Group();
    holder.position.set(lean, stemHeight, 0);
    holder.rotation.z = -0.2 + (index % 2) * 0.1;
    holder.scale.set(leafSize, leafSize, 1);
    leafNode.add(holder);
    mesh(holder, leafGeometry, leafMaterials[index % 2]);
    mesh(holder, new THREE.CylinderGeometry(0.009, 0.014, 0.95, 5), veinMaterial, [0, 0.47, 0.014]);
  }
}

function addCane(root, track, colors, textures) {
  const caneMaterial = material(0x87664f, { roughness: 0.92 });
  const nodeMaterial = material(0xb48c68, { roughness: 0.88 });
  const petioleMaterial = material(0x76594b, { roughness: 0.9 });
  const leafMaterials = [
    material(colors.base, { map: textures.leafPinstripe, roughness: 0.56 }),
    material(colors.light, { map: textures.leafPinstripe, roughness: 0.6 }),
  ];
  const spotMaterial = material(0xe7d8c0, { roughness: 0.72 });
  const veinMaterial = material(0xbfa98b, { roughness: 0.76 });
  const leafGeometry = new THREE.ShapeGeometry(makeAsymmetricLeafShape(), 12);
  const spotGeometry = new THREE.CircleGeometry(0.04, 7);
  const spotPositions = [[-0.18, 0.25], [0.12, 0.36], [-0.32, 0.48], [0.08, 0.61], [-0.22, 0.76], [0.04, 0.86]];

  for (let caneIndex = 0; caneIndex < 3; caneIndex += 1) {
    const caneAngle = caneIndex * (TAU / 3) + 0.18;
    const x = Math.cos(caneAngle) * 0.075;
    const z = Math.sin(caneAngle) * 0.075;
    const caneHeight = 0.86 + caneIndex * 0.15;
    const cane = mesh(root, new THREE.CylinderGeometry(0.026, 0.04, caneHeight, 7), caneMaterial, [x, 0.625 + caneHeight / 2, z]);
    cane.rotation.z = (caneIndex - 1) * 0.035;

    for (let level = 0; level < 3; level += 1) {
      const y = 0.86 + level * (caneHeight * 0.28);
      mesh(root, new THREE.CylinderGeometry(0.043, 0.043, 0.018, 8), nodeMaterial, [x, y, z]);
      const leafAngle = caneAngle + level * 2.25 + caneIndex * 0.42;
      const reach = 0.16 + ((level + caneIndex) % 2) * 0.07;
      const leafNode = new THREE.Group();
      leafNode.position.set(x, y, z);
      leafNode.rotation.order = "YXZ";
      leafNode.rotation.y = -leafAngle;
      leafNode.rotation.z = level % 2 ? -0.1 : 0.08;
      root.add(leafNode);
      track(leafNode, leafAngle);

      tube(leafNode, [[0, 0, 0], [reach, 0.07, 0]], 0.011, petioleMaterial, 4, 4);
      const holder = new THREE.Group();
      holder.position.set(reach, 0.07, 0);
      holder.rotation.z = level % 2 ? -0.16 : 0.12;
      const leafSize = 0.36 + ((level + caneIndex) % 3) * 0.045;
      holder.scale.set(leafSize, leafSize, 1);
      leafNode.add(holder);
      mesh(holder, leafGeometry, leafMaterials[(level + caneIndex) % 2]);
      mesh(holder, new THREE.CylinderGeometry(0.009, 0.012, 0.88, 5), veinMaterial, [0, 0.44, 0.014]);
      spotPositions.forEach(([spotX, spotY], spotIndex) => {
        const spot = mesh(holder, spotGeometry, spotMaterial, [spotX, spotY, 0.018]);
        spot.scale.setScalar(0.68 + ((spotIndex + level) % 3) * 0.13);
      });
    }
  }
}

function addBonsai(root, track, colors, textures) {
  const woodMaterial = material(0x6c5038, { roughness: 1, flatShading: true });
  const barkLight = material(0x987253, { roughness: 0.96, flatShading: true });
  const foliageMaterials = [
    material(colors.base, { map: textures.leafVelvet, roughness: 0.82, flatShading: true }),
    material(colors.light, { map: textures.leafVelvet, roughness: 0.78, flatShading: true }),
  ];

  cylinder(root, 0.065, 0.13, 0.5, 0.875, woodMaterial, 7).rotation.z = -0.08;
  tube(root, [[0, 0.64, 0], [-0.17, 0.66, 0.04], [-0.29, 0.63, 0.12]], 0.037, barkLight, 5, 5);
  tube(root, [[0.01, 0.65, 0], [0.16, 0.67, -0.06], [0.27, 0.64, -0.13]], 0.034, barkLight, 5, 5);

  const branches = [
    { start: [0, 1.02, 0], end: [-0.4, 1.22, 0.03], size: 0.25 },
    { start: [-0.02, 1.08, 0], end: [0.36, 1.34, -0.03], size: 0.27 },
    { start: [0, 1.11, 0], end: [-0.13, 1.48, 0.02], size: 0.25 },
    { start: [0, 1.08, 0], end: [0.14, 1.45, 0.12], size: 0.23 },
    { start: [-0.02, 1.03, 0], end: [0.01, 1.32, -0.28], size: 0.24 },
  ];
  const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);

  branches.forEach((branch, index) => {
    const middle = [
      (branch.start[0] + branch.end[0]) * 0.5 + (index % 2 ? 0.05 : -0.04),
      (branch.start[1] + branch.end[1]) * 0.5,
      (branch.start[2] + branch.end[2]) * 0.5,
    ];
    tube(root, [branch.start, middle, branch.end], 0.027 - index * 0.0015, woodMaterial, 6, 5);
    const angle = Math.atan2(branch.end[2], branch.end[0]);
    const canopy = new THREE.Group();
    canopy.position.fromArray(branch.end);
    canopy.rotation.y = -angle;
    root.add(canopy);
    track(canopy, angle);

    for (let puff = 0; puff < 5; puff += 1) {
      const puffAngle = (puff / 5) * TAU + index * 0.47;
      const cloud = mesh(canopy, cloudGeometry, foliageMaterials[(puff + index) % 2], [
        Math.cos(puffAngle) * branch.size * 0.6,
        (puff % 2) * branch.size * 0.16,
        Math.sin(puffAngle) * branch.size * 0.42,
      ]);
      cloud.scale.set(branch.size * 0.82, branch.size * 0.48, branch.size * 0.66);
    }
  });
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
    case "pearls":
      addPearls(root, track, colors, maps);
      break;
    case "coin":
      addCoinLeaf(root, track, colors, maps);
      break;
    case "tree":
      addRubberTree(root, track, colors, maps);
      break;
    case "flower":
      addSpoonflower(root, track, colors, maps);
      break;
    case "palm":
      addPalm(root, track, colors, maps);
      break;
    case "gem":
      addGem(root, track, colors, maps);
      break;
    case "shield":
      addShield(root, track, colors, maps);
      break;
    case "cane":
      addCane(root, track, colors, maps);
      break;
    case "bonsai":
      addBonsai(root, track, colors, maps);
      break;
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
