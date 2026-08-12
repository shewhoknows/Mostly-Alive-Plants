import assert from "node:assert/strict";

import * as THREE from "./vendor/three.module.min.js";
import { SPECIES } from "./game-data.js";
import { createDistinctPlant3D } from "./plant-models.js";
import { availableSpeciesForWeek } from "./progression-system.js";

const EXPECTED_LATER_SPECIES = new Map([
  ["birds-nest-fern", 6],
  ["ponytail-palm", 6],
  ["silver-inch-plant", 7],
  ["braided-money-tree", 8],
  ["flamingo-flower", 9],
  ["staghorn-fern", 10],
]);

const speciesById = new Map(SPECIES.map((species) => [species.id, species]));
const laterSpecies = [...EXPECTED_LATER_SPECIES].map(([id, unlockWeek]) => {
  const species = speciesById.get(id);
  assert.ok(species, `${id} must be present in the plant catalog.`);
  assert.equal(species.unlockWeek, unlockWeek, `${id} must unlock in Week ${unlockWeek}.`);
  assert.notEqual(species.special, true, `${id} must use the standard nursery pool.`);
  assert.ok(species.price > species.wholesaleCost, `${id} needs a positive retail margin.`);
  assert.ok(species.price <= 37, `${id} must fit the current customer budget ceiling.`);
  assert.ok(species.dryRate > 0 && species.dryRate < 0.3, `${id} needs a balanced dry rate.`);
  assert.ok(["shade", "indirect", "sun"].includes(species.preferredLight));
  assert.ok(["dry", "average", "high"].includes(species.preferredHumidity));
  assert.ok(Array.isArray(species.traits) && species.traits.length >= 2);
  assert.ok(Array.isArray(species.beneficialCare) && species.beneficialCare.includes("water"));
  return species;
});

assert.equal(new Set(laterSpecies.map((species) => species.shape)).size, laterSpecies.length);
assert.equal(availableSpeciesForWeek(5).some((species) => EXPECTED_LATER_SPECIES.has(species.id)), false);
for (let week = 6; week <= 10; week += 1) {
  const availableIds = new Set(availableSpeciesForWeek(week).map((species) => species.id));
  EXPECTED_LATER_SPECIES.forEach((unlockWeek, id) => {
    assert.equal(
      availableIds.has(id),
      unlockWeek <= week,
      `${id} has the wrong availability in Week ${week}.`,
    );
  });
}

const silhouetteSignatures = new Set();
laterSpecies.forEach((species) => {
  const root = createDistinctPlant3D({ id: `qa-${species.id}`, speciesId: species.id }, species, {});
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const dimensions = size.toArray();
  assert.equal(dimensions.every(Number.isFinite), true, `${species.id} must have finite model bounds.`);
  assert.ok(size.x >= 0.8 && size.x <= 2.1, `${species.id} has an unsafe model width.`);
  assert.ok(size.y >= 0.8 && size.y <= 2.2, `${species.id} has an unsafe model height.`);
  assert.ok(size.z >= 0.8 && size.z <= 2.1, `${species.id} has an unsafe model depth.`);
  assert.ok(root.userData.leaves.length >= 6, `${species.id} needs animated foliage pivots.`);
  root.userData.leaves.forEach((leaf) => {
    assert.ok(leaf.userData.basePosition?.isVector3, `${species.id} has an invalid foliage position.`);
    assert.ok(leaf.userData.baseEuler?.isEuler, `${species.id} has an invalid foliage rotation.`);
    assert.ok(leaf.userData.baseScale?.isVector3, `${species.id} has an invalid foliage scale.`);
  });
  silhouetteSignatures.add(dimensions.map((value) => value.toFixed(2)).join("x"));
});
assert.equal(silhouetteSignatures.size, laterSpecies.length, "Each new plant needs a distinct model silhouette.");

console.log("later plant catalog and 3D model QA passed");
