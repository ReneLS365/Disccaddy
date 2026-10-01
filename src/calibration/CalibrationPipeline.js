import {
  normalizeThrow,
  observability,
  datasetCoverage,
} from "./CalibrationDataset.js";
import { createObjective } from "./CalibrationLoss.js";
import { BoundedHybridOptimizer } from "./CalibrationOptimizer.js";
import { materializeAeroProfile } from "./AeroProfile.js";
import { sensitivityAnalysis } from "./SensitivityAnalysis.js";
import { estimateUncertainty } from "./UncertaintyEstimator.js";
import { validate, compareBeforeAfter } from "./Validation.js";

const stageGroups = [
  ["liftScale", "dragScale"],
  ["momentOffset"],
  ["rateDampingScale"],
  ["spinDragScale"],
];
export async function calibrateDisc({
  discId,
  throws,
  baselineProfile,
  physical,
  seed = 1,
  optimizer = new BoundedHybridOptimizer(),
  onProgress = () => {},
}) {
  const data = throws.map(normalizeThrow),
    training = data.filter((t) => t.split === "training"),
    validationThrows = data.filter((t) => t.split === "validation");
  if (training.length < 2)
    throw new Error("Mindst to træningskast kræves til en disc-kalibrering.");
  const observable = observability(training),
    activeStages = stageGroups.filter(
      ([name]) =>
        !["unobservable"].includes(
          observable[
            {
              liftScale: "lift",
              dragScale: "drag",
              momentOffset: "pitchMoment",
              rateDampingScale: "rollMoment",
              spinDragScale: "spinDamping",
            }[name]
          ],
        ),
    );
  let parameters = {
      liftScale: 1,
      dragScale: 1,
      momentOffset: 0,
      rateDampingScale: 1,
      spinDragScale: 1,
    },
    evaluations = 0;
  for (let i = 0; i < activeStages.length; i++) {
    const names = activeStages.slice(0, i + 1).flat(),
      objective = createObjective(training, baselineProfile, names);
    const result = await optimizer.optimize({
      objective,
      parameterNames: names,
      initial: parameters,
      seed: seed + i,
      generations: 8,
      onProgress: (p) =>
        onProgress((i + p) / (activeStages.length + 1), `Trin ${i + 1}`),
    });
    Object.assign(parameters, result.parameters);
    evaluations += result.evaluations || 0;
  }
  const names = activeStages.flat(),
    objective = createObjective(training, baselineProfile, names),
    joint = await optimizer.optimize({
      objective,
      parameterNames: names,
      initial: parameters,
      seed: seed + 99,
      generations: 12,
      onProgress: (p) =>
        onProgress(
          (activeStages.length + p) / (activeStages.length + 1),
          "Fælles finjustering",
        ),
    });
  Object.assign(parameters, joint.parameters);
  evaluations += joint.evaluations || 0;
  const detail = objective(parameters, true),
    validation = validate(validationThrows, baselineProfile, parameters),
    sensitivity = sensitivityAnalysis(
      training,
      baselineProfile,
      parameters,
      names,
    ),
    estimated = estimateUncertainty(
      training,
      baselineProfile,
      parameters,
      names,
      detail.value,
    ),
    coverage = datasetCoverage(data);
  const trainingMse =
    detail.flights.reduce(
      (sum, item, i) => sum + item.loss * training[i].weight,
      0,
    ) / training.reduce((sum, item) => sum + item.weight, 0);
  for (const [key, state] of Object.entries(observable))
    if (state === "unobservable")
      estimated.constraint[
        {
          lift: "liftScale",
          drag: "dragScale",
          pitchMoment: "momentOffset",
          rollMoment: "rateDampingScale",
          spinDamping: "spinDragScale",
        }[key]
      ] = state;
  const aero = materializeAeroProfile(baselineProfile, parameters),
    now = new Date().toISOString();
  const profile = {
    version: 1,
    modelVersion: "piecewise-linear-1",
    solverVersion: "sixdof-v6",
    algorithmVersion: "bounded-de-staged-1",
    discId,
    physical: structuredClone(physical),
    aero: {
      snapshot: aero,
      parameters,
      sources: Object.fromEntries(
        Object.keys(parameters).map((k) => [
          k,
          names.includes(k) ? "calibrated" : "baseline",
        ]),
      ),
    },
    calibration: {
      datasetIds: data.map((t) => t.id),
      createdAt: now,
      sampleCount: data.reduce((n, t) => n + t.observations.length, 0),
      throwCount: data.length,
      trainingError: Math.sqrt(trainingMse),
      validationError: validation.error,
      confidence: Object.values(estimated.constraint).every(
        (v) => v === "well constrained",
      )
        ? "high"
        : Object.values(estimated.constraint).some((v) => v !== "unobservable")
          ? "medium"
          : "low",
      parameterUncertainty: estimated.uncertainty,
      parameterConstraint: estimated.constraint,
      coverage,
      sensitivity,
      evaluations,
      overfitting:
        validation.error != null &&
        validation.error > Math.sqrt(trainingMse) * 1.5,
    },
  };
  return {
    profile,
    training: detail,
    validation,
    comparisons: data.map((t) =>
      compareBeforeAfter(t, baselineProfile, parameters),
    ),
  };
}
