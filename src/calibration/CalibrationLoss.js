import Physics6 from "../physics/Physics6.js";
import { regularization } from "./ParameterBounds.js";

const sq = (a) => a.reduce((s, v) => s + v * v, 0);
const sub = (a, b) => a.map((v, i) => v - b[i]);
function rotationError(a, b) {
  return (
    2 * Math.acos(Math.min(1, Math.abs(a.reduce((s, v, i) => s + v * b[i], 0))))
  );
}

export function throwLoss(flight, observed, weights = {}) {
  const w = {
    position: 1,
    velocity: 0.15,
    orientation: 0.6,
    spin: 0.002,
    landing: 2,
    summary: 1,
    ...weights,
  };
  let total = 0,
    terms = 0;
  for (const o of observed.observations) {
    const s = Physics6.sample(flight, o.timestamp);
    total += w.position * sq(sub(s.p, o.position));
    terms += w.position * 3;
    if (o.velocity) {
      total += w.velocity * sq(sub(s.v, o.velocity));
      terms += w.velocity * 3;
    }
    if (o.orientation && s.q) {
      total += w.orientation * rotationError(s.q, o.orientation) ** 2;
      terms += w.orientation;
    }
    if (Number.isFinite(o.spinRate) && Number.isFinite(s.spin)) {
      total += w.spin * (s.spin - o.spinRate) ** 2;
      terms += w.spin;
    }
  }
  const end = flight.points.at(-1),
    last = observed.observations.at(-1);
  if (last && last.position[1] <= 0.25) {
    total += w.landing * sq(sub(end.p, last.position));
    terms += w.landing * 3;
  }
  const summary = observed.summary;
  if (summary) {
    for (const [key, actual] of [
      ["distance", flight.distance],
      ["maximumHeight", flight.apex],
      ["flightTime", flight.duration],
    ])
      if (Number.isFinite(summary[key])) {
        total += w.summary * (actual - summary[key]) ** 2;
        terms += w.summary;
      }
    if (summary.landingPosition) {
      total += w.landing * sq(sub(end.p, summary.landingPosition));
      terms += w.landing * 3;
    }
  }
  return { mse: terms ? total / terms : 1e12, total, terms };
}

export function createObjective(throws, baselineProfile, parameterNames) {
  let evaluations = 0;
  const evaluate = (parameters, details = false) => {
    evaluations++;
    let weighted = 0,
      weight = 0;
    const flights = [];
    try {
      for (const t of throws) {
        const p = {
          ...t.simulatorInput,
          model: "sixdof",
          aeroSnapshot: baselineProfile,
          aeroPerturb: parameters,
        };
        // Calibration deliberately calls the authoritative solver with its normal
        // numerical configuration. A cheaper, subtly different trajectory would
        // otherwise be fitted instead of the trajectory users validate in the lab.
        const flight = Physics6.simulate(p);
        const loss = throwLoss(flight, t);
        if (!Number.isFinite(loss.mse))
          return details ? { value: 1e12, flights: [] } : 1e12;
        weighted += loss.mse * t.weight;
        weight += t.weight;
        flights.push({ throwId: t.id, flight, loss: loss.mse });
      }
      const value =
        weighted / Math.max(weight, 1e-12) +
        regularization(parameters, parameterNames);
      return details ? { value, flights } : value;
    } catch {
      return details ? { value: 1e12, flights: [] } : 1e12;
    }
  };
  evaluate.evaluations = () => evaluations;
  return evaluate;
}
