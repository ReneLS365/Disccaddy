import { test } from "node:test";
import assert from "node:assert/strict";
import Physics6 from "../src/physics/Physics6.js";
import { AeroCurve } from "../src/calibration/AeroCurve.js";
import {
  PARAMETER_BOUNDS,
  clampParameters,
} from "../src/calibration/ParameterBounds.js";
import {
  normalizeThrow,
  observability,
} from "../src/calibration/CalibrationDataset.js";
import { throwLoss } from "../src/calibration/CalibrationLoss.js";
import { BoundedHybridOptimizer } from "../src/calibration/CalibrationOptimizer.js";
import {
  materializeAeroProfile,
  exportProfile,
  importProfile,
} from "../src/calibration/AeroProfile.js";
import { calibrateDisc } from "../src/calibration/CalibrationPipeline.js";
import { sensitivityAnalysis } from "../src/calibration/SensitivityAnalysis.js";
import { BagData } from "../src/data/BagData.js";
import { Aero } from "../src/physics/Aero.js";

test("aerokurver interpolerer kontinuert og afviser ugyldige akser", () => {
  const c = new AeroCurve([-10, 0, 10], [-1, 0, 2], {
    minimum: -1,
    maximum: 1,
  });
  assert.equal(c.at(-5), -0.5);
  assert.equal(c.at(5), 0.5);
  assert.equal(c.at(20), 1);
  assert.throws(() => new AeroCurve([0, 0], [1, 2]));
});

test("centrale bounds klemmer alle fysiske parametre", () => {
  const p = clampParameters(
    { liftScale: 99, dragScale: -1, momentOffset: Infinity },
    ["liftScale", "dragScale", "momentOffset"],
  );
  assert.equal(p.liftScale, PARAMETER_BOUNDS.liftScale.upper);
  assert.equal(p.dragScale, PARAMETER_BOUNDS.dragScale.lower);
  assert.equal(p.momentOffset, 0);
});

const setting = {
  ...BagData.settingDefault,
  model: "sixdof",
  discName: "Synthetic",
  aeroPreset: "genericMid",
  power: 19,
  launch: 8,
  nose: 1,
  hyzer: 8,
  rpm: 850,
  windSpeed: 0,
};
const baseline = Aero.resolve(setting);
function observed(
  id,
  p,
  split = "training",
  perturb = { liftScale: 1.15, dragScale: 1.2 },
) {
  const flight = Physics6.simulate({
    ...p,
    aeroSnapshot: baseline,
    aeroPerturb: perturb,
  });
  return normalizeThrow({
    id,
    discId: "synthetic",
    split,
    simulatorInput: p,
    observations: flight.points
      .filter((_, i) => i % 20 === 0 || i === flight.points.length - 1)
      .map((x) => ({ timestamp: x.t, position: x.p })),
  });
}

test("loss er nulnær for samme deterministiske trajectory og simulation er deterministisk", () => {
  const flight = Physics6.simulate({ ...setting, aeroSnapshot: baseline }),
    flight2 = Physics6.simulate({ ...setting, aeroSnapshot: baseline });
  assert.deepEqual(flight.points, flight2.points);
  const t = normalizeThrow({
    id: "same",
    discId: "x",
    simulatorInput: setting,
    observations: flight.points.map((x) => ({
      timestamp: x.t,
      position: x.p,
      velocity: x.v,
      orientation: x.q,
      spinRate: x.spin,
    })),
  });
  assert.ok(throwLoss(flight, t).mse < 1e-15);
});

test("bounded hybrid optimizer konvergerer reproducerbart", async () => {
  const objective = (p) =>
    (p.liftScale - 1.37) ** 2 + (p.dragScale - 0.83) ** 2;
  objective.evaluations = () => 1;
  const optimizer = new BoundedHybridOptimizer(),
    a = await optimizer.optimize({
      objective,
      parameterNames: ["liftScale", "dragScale"],
      seed: 42,
      generations: 30,
    }),
    b = await optimizer.optimize({
      objective,
      parameterNames: ["liftScale", "dragScale"],
      seed: 42,
      generations: 30,
    });
  assert.deepEqual(a.parameters, b.parameters);
  assert.ok(Math.abs(a.parameters.liftScale - 1.37) < 0.04);
  assert.ok(Math.abs(a.parameters.dragScale - 0.83) < 0.04);
});

test("profiler serialiseres, valideres og bevarer partial-calibration kilder", () => {
  const snapshot = materializeAeroProfile(baseline, {
    liftScale: 1.1,
    dragScale: 1.2,
    momentOffset: 0,
    rateDampingScale: 1,
    spinDragScale: 1,
  });
  assert.equal(snapshot.schema, "disc-aero-1");
  const profile = {
    version: 1,
    discId: "x",
    physical: { massKg: 0.175 },
    aero: {
      snapshot,
      sources: { liftScale: "calibrated", spinDragScale: "baseline" },
    },
    calibration: { datasetIds: ["a"], createdAt: new Date(0).toISOString() },
  };
  assert.deepEqual(
    importProfile(exportProfile(profile)).aero.sources,
    profile.aero.sources,
  );
  assert.throws(() => importProfile('{"schema":"other"}'));
  const unsafe = JSON.parse(exportProfile(profile));
  unsafe.aero.parameters = { "<img src=x onerror=alert(1)>": 1 };
  assert.throws(() => importProfile(unsafe), /ukendte parametre/);
});

test("multi-throw staged calibration, validation, uncertainty og sensitivity", async () => {
  const throws = [
    observed("a", setting),
    observed("b", { ...setting, power: 22, hyzer: -4 }),
    observed("c", { ...setting, power: 20, nose: -2 }, "validation"),
  ];
  assert.equal(observability(throws).pitchMoment, "unobservable");
  const exactOptimizer = {
    async optimize(problem) {
      const parameters = {
        ...problem.initial,
        liftScale: 1.15,
        dragScale: 1.2,
      };
      return {
        parameters,
        loss: problem.objective(parameters),
        evaluations: 1,
      };
    },
  };
  const result = await calibrateDisc({
    discId: "synthetic",
    throws,
    baselineProfile: baseline,
    physical: {
      massKg: 0.175,
      diameterM: baseline.diameter,
      areaM2: 0.035,
      inertia: { Ixx: 0.0007, Iyy: 0.0007, Izz: 0.0014 },
    },
    optimizer: exactOptimizer,
  });
  assert.ok(result.profile.calibration.trainingError < 0.02);
  assert.ok(result.profile.calibration.validationError < 0.02);
  assert.equal(result.profile.aero.sources.momentOffset, "baseline");
  assert.equal(
    result.profile.calibration.parameterConstraint.momentOffset,
    "unobservable",
  );
  assert.equal(result.comparisons.length, 3);
  const sensitivity = sensitivityAnalysis(
    throws.slice(0, 2),
    baseline,
    result.profile.aero.parameters,
    ["liftScale", "dragScale"],
  );
  assert.ok(Number.isFinite(sensitivity.dragScale.distance));
});
