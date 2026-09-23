import { test } from "node:test";
import assert from "node:assert/strict";
import regression from "./fixtures/v6-regression.json" with { type: "json" };
import { loadEngine, simulate, Flight } from "../src/physics/engines.js";
import Physics6 from "../src/physics/Physics6.js";
import { BagData } from "../src/data/BagData.js";

function near(actual, expected, label) {
  assert.ok(
    Number.isFinite(actual) &&
      Math.abs(actual - expected) <= 1e-7 * Math.max(1, Math.abs(expected)),
    `${label}: ${actual} != ${expected}`,
  );
}
for (const scenario of regression.scenarios) {
  test(`Original v6: ${scenario.name}`, async () => {
    const f = await simulate(scenario.p),
      expected = scenario.expected;
    for (const key of ["duration", "distance", "lateral", "apex"])
      near(f[key], expected[key], key);
    assert.equal(f.points.length, expected.pointCount);
    for (const point of expected.points) {
      for (const [key, value] of Object.entries(point)) {
        if (key === "index") continue;
        const actual = f.points[point.index][key];
        if (Array.isArray(value))
          value.forEach((v, i) => near(actual[i], v, key + "[" + i + "]"));
        else if (typeof value === "number") near(actual, value, key);
        else assert.equal(actual, value);
      }
    }
  });
}

// A drag-only, zero-lift table isolates wind drift from turn/fade and lift changes.
const neutral = {
  schema: "disc-aero-1",
  name: "Vindtest",
  diameter: 0.211,
  Jax: 0.0075,
  Jtrans: 0.0038,
  alpha: [-90, 0, 90],
  CL: [0, 0, 0],
  CD: [0.1, 0.1, 0.1],
  CM: [0, 0, 0],
};
const p = {
  ...BagData.settingDefault,
  discName: "Vindtest",
  aeroPreset: "customTable",
  customTable: neutral,
  aim: 0,
  launch: 8,
  nose: 0,
  hyzer: 0,
  windSpeed: 0,
  power: 23,
};
const calm = Physics6.simulate(p);
for (const [name, bearing, expected] of [
  ["nord", 0, [0, 0, 3]],
  ["øst", 90, [-3, 0, 0]],
  ["syd", 180, [0, 0, -3]],
  ["vest", 270, [3, 0, 0]],
]) {
  test(`Vind FRA ${name}: vektor og lateral/fremad forskydning`, async () => {
    for (const model of ["legacy", "sixdof-v5", "sixdof"]) {
      const engine = await loadEngine(model);
      for (const aim of [0, 83]) {
        const setting = {
          ...p,
          aim,
          windSpeed: 3,
          windFrom: (bearing + aim) % 360,
        };
        engine
          .wind(setting)
          .forEach((value, i) => near(value, expected[i], model + " vindakse"));
        Flight.wind(setting).forEach((value, i) =>
          near(value, expected[i], "UI-vindakse"),
        );
      }
    }
    const f = Physics6.simulate({ ...p, windSpeed: 3, windFrom: bearing });
    if (bearing === 0) {
      assert.ok(f.forward < calm.forward);
      near(f.lateral, 0, "Ingen sidevind");
    }
    if (bearing === 180) {
      assert.ok(f.forward > calm.forward);
      near(f.lateral, 0, "Ingen sidevind");
    }
    if (bearing === 90) assert.ok(f.lateral < calm.lateral);
    if (bearing === 270) assert.ok(f.lateral > calm.lateral);
    if (bearing === 90 || bearing === 270) {
      const mirror = Physics6.simulate({
        ...p,
        windSpeed: 3,
        windFrom: (360 - bearing) % 360,
      });
      near(f.lateral, -mirror.lateral, "Spejlet sidevind");
      near(f.forward, mirror.forward, "Samme fremadkast");
    }
  });
}
test("De seks udfasede V6-koefficienter er fjernet", () => {
  const c = Physics6.coefficients(p);
  for (const key of ["CL0", "CLa", "CD0", "CDa", "CM0", "CMa"])
    assert.ok(!Object.hasOwn(c, key));
});
test("Legacy bevarer sin historiske +3°-kalibrering", async () => {
  const engine = await loadEngine("legacy");
  near(
    engine.normalFor({ ...p, launch: 0, nose: 0, hyzer: 0 })[2],
    Math.sin((3 * Math.PI) / 180),
    "Legacy pitch",
  );
});
