import { createObjective } from "./CalibrationLoss.js";
import { PARAMETER_BOUNDS } from "./ParameterBounds.js";

export function trajectoryMetrics(flight) {
  return {
    distance: flight.distance,
    landing: flight.points.at(-1).p,
    apex: flight.apex,
    lateral: flight.lateral,
    flightTime: flight.duration,
  };
}

export function sensitivityAnalysis(throws, profile, parameters, names) {
  const result = {};
  for (const name of names) {
    const delta = Math.max(
      Math.abs(parameters[name]) * 0.01,
      (PARAMETER_BOUNDS[name].upper - PARAMETER_BOUNDS[name].lower) * 0.002,
    );
    const plus = {
      ...parameters,
      [name]: Math.min(PARAMETER_BOUNDS[name].upper, parameters[name] + delta),
    };
    const minus = {
      ...parameters,
      [name]: Math.max(PARAMETER_BOUNDS[name].lower, parameters[name] - delta),
    };
    const a = createObjective(throws, profile, names)(plus, true),
      b = createObjective(throws, profile, names)(minus, true);
    const metrics = (detail) =>
      detail.flights.map((f) => trajectoryMetrics(f.flight));
    const am = metrics(a),
      bm = metrics(b),
      denom = Math.max(1e-12, plus[name] - minus[name]);
    const avg = (fn) =>
      am.length
        ? am.reduce((s, v, i) => s + fn(v, bm[i]), 0) / am.length / denom
        : 0;
    result[name] = {
      lossGradient: (a.value - b.value) / denom,
      distance: avg((x, y) => Math.abs(x.distance - y.distance)),
      apex: avg((x, y) => Math.abs(x.apex - y.apex)),
      lateral: avg((x, y) => Math.abs(x.lateral - y.lateral)),
      landing: avg((x, y) =>
        Math.hypot(...x.landing.map((v, j) => v - y.landing[j])),
      ),
    };
  }
  return result;
}
