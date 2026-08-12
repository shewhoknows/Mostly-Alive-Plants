import assert from "node:assert/strict";

import {
  SHOP_EXPANSIONS,
  expansionForId,
  expansionUnlockedForWeek,
  migrateExpansionState,
  purchaseExpansion,
  saleExpansionBonus,
  validateExpansionPurchase,
} from "./shop-expansion-system.js";

assert.equal(SHOP_EXPANSIONS.length, 6);
assert.deepEqual(SHOP_EXPANSIONS.map(({ unlockWeek }) => unlockWeek), [3, 4, 5, 6, 7, 8]);
SHOP_EXPANSIONS.forEach((expansion) => {
  assert.equal(expansion.objectName, `expansion-${expansion.id}`);
  assert.ok(expansion.category);
  assert.ok(expansion.effectLabel);
  assert.ok(expansion.cost.coins >= 120 && expansion.cost.coins <= 220);
  assert.ok(expansion.cost.bloom >= 25 && expansion.cost.bloom <= 55);
  assert.equal(expansionUnlockedForWeek(expansion.id, expansion.unlockWeek - 1), false);
  assert.equal(expansionUnlockedForWeek(expansion.id, expansion.unlockWeek), true);
  assert.equal(expansionUnlockedForWeek(expansion.id, expansion.unlockWeek + 20), true);
  assert.equal(expansionForId(expansion.id), expansion);
});
assert.equal(expansionForId("not-real"), null);
assert.equal(expansionUnlockedForWeek("not-real", 99), false);

const empty = migrateExpansionState();
assert.deepEqual(empty, { version: 1, purchased: {}, purchasedIds: [] });
assert.deepEqual(JSON.parse(JSON.stringify(empty)), empty);

const migrated = migrateExpansionState({
  version: 0,
  purchased: new Map([
    ["display-shelves", 1],
    ["checkout-bell", false],
    ["not-real", true],
  ]),
  purchasedIds: ["ceramic-sign", "display-shelves", "ceramic-sign"],
});
assert.deepEqual(migrated, {
  version: 1,
  purchased: { "display-shelves": true, "ceramic-sign": true },
  purchasedIds: ["display-shelves", "ceramic-sign"],
});
assert.deepEqual(migrateExpansionState(["scent-garden", "wrapping-station", "not-real"]), {
  version: 1,
  purchased: { "scent-garden": true, "wrapping-station": true },
  purchasedIds: ["scent-garden", "wrapping-station"],
});

const locked = validateExpansionPurchase({
  id: "display-shelves",
  week: 2,
  state: empty,
  coins: 999,
  bloom: 999,
});
assert.equal(locked.ok, false);
assert.equal(locked.code, "locked");

const unknown = validateExpansionPurchase({
  id: "missing",
  week: 99,
  state: empty,
  coins: 999,
  bloom: 999,
});
assert.equal(unknown.ok, false);
assert.equal(unknown.code, "unknown-expansion");

const insufficient = validateExpansionPurchase({
  id: "display-shelves",
  week: 3,
  state: empty,
  coins: 119,
  bloom: 24,
});
assert.equal(insufficient.ok, false);
assert.equal(insufficient.code, "insufficient-resources");
assert.match(insufficient.message, /1 coins and 1 Bloom/);

const reserved = validateExpansionPurchase({
  id: "display-shelves",
  week: 3,
  state: empty,
  coins: 140,
  bloom: 25,
  reservedCoins: 21,
});
assert.equal(reserved.ok, false);
assert.equal(reserved.code, "reserved-coins");
assert.equal(reserved.availableCoins, 119);
assert.match(reserved.message, /1 coins more/);

const reservedShortfall = validateExpansionPurchase({
  id: "checkout-bell",
  week: 5,
  state: empty,
  coins: 140,
  bloom: 35,
  reservedCoins: 30,
});
assert.equal(reservedShortfall.code, "insufficient-resources");
assert.match(reservedShortfall.message, /50 coins more/);

const purchased = purchaseExpansion({
  id: "display-shelves",
  week: 3,
  state: empty,
  coins: 150,
  bloom: 30,
  reservedCoins: 20,
});
assert.equal(purchased.ok, true);
assert.equal(purchased.code, "purchased");
assert.equal(purchased.coins, 30);
assert.equal(purchased.bloom, 5);
assert.deepEqual(purchased.state.purchased, { "display-shelves": true });
assert.deepEqual(purchased.state.purchasedIds, ["display-shelves"]);
assert.deepEqual(JSON.parse(JSON.stringify(purchased.state)), purchased.state);
assert.deepEqual(empty, { version: 1, purchased: {}, purchasedIds: [] });

const duplicate = purchaseExpansion({
  id: "display-shelves",
  week: 9,
  state: purchased.state,
  coins: 999,
  bloom: 999,
});
assert.equal(duplicate.ok, false);
assert.equal(duplicate.code, "already-purchased");
assert.equal(duplicate.coins, 999);
assert.equal(duplicate.bloom, 999);

let allState = empty;
let coins = 10_000;
let bloom = 10_000;
SHOP_EXPANSIONS.forEach((expansion) => {
  const result = purchaseExpansion({
    id: expansion.id,
    week: expansion.unlockWeek,
    state: allState,
    coins,
    bloom,
  });
  assert.equal(result.ok, true);
  allState = result.state;
  coins = result.coins;
  bloom = result.bloom;
});
assert.equal(allState.purchasedIds.length, 6);

assert.equal(saleExpansionBonus({ state: empty, priceBand: "boutique", perfect: true, basePayout: 100 }), 0);
assert.equal(saleExpansionBonus({
  state: ["checkout-bell"],
  priceBand: "quick",
  basePayout: 100,
}), 5);
assert.equal(saleExpansionBonus({
  state: ["ceramic-sign"],
  priceBand: "boutique",
  basePayout: 100,
}), 10);
assert.equal(saleExpansionBonus({
  state: ["ceramic-sign"],
  priceBand: "quick",
  basePayout: 100,
}), 0);
assert.equal(saleExpansionBonus({ state: ["wrapping-station"], basePayout: 100 }), 1);
assert.equal(saleExpansionBonus({ state: ["scent-garden"], perfect: true, basePayout: 100 }), 2);
assert.equal(saleExpansionBonus({ state: ["scent-garden"], extras: ["lovely"], basePayout: 100 }), 2);
assert.equal(saleExpansionBonus({
  state: ["scent-garden"],
  perfect: true,
  extras: { lovely: true },
  basePayout: 100,
}), 2, "Perfect and lovely must not pay twice.");
assert.equal(saleExpansionBonus({
  state: allState,
  priceBand: "boutique",
  perfect: true,
  extras: ["lovely"],
  basePayout: 100,
}), 18, "All sale bonuses must stay at 15% plus 3 coins.");
assert.equal(saleExpansionBonus({
  state: allState,
  priceBand: "boutique",
  perfect: true,
  basePayout: -500,
}), 3, "A negative payout must not create a percentage bonus.");

console.log("shop expansion QA passed");
