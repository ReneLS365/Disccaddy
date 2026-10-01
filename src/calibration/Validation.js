import { createObjective, throwLoss } from "./CalibrationLoss.js";
import Physics6 from "../physics/Physics6.js";

export function validate(throws, profile, parameters) {
  if (!throws.length)
    return {
      error: null,
      trajectories: [],
      warning: "Ingen valideringskast valgt.",
    };
  const result = createObjective(
    throws,
    profile,
    Object.keys(parameters),
  )(parameters, true);
  const dataMse =
    result.flights.reduce(
      (sum, item, i) => sum + item.loss * throws[i].weight,
      0,
    ) /
    Math.max(
      1e-12,
      throws.reduce((sum, item) => sum + item.weight, 0),
    );
  return {
    error: Math.sqrt(dataMse),
    trajectories: result.flights,
    warning: null,
  };
}

export function compareBeforeAfter(t, profile, parameters) {
  const before = Physics6.simulate({
    ...t.simulatorInput,
    aeroSnapshot: profile,
  });
  const after = Physics6.simulate({
    ...t.simulatorInput,
    aeroSnapshot: profile,
    aeroPerturb: parameters,
  });
  const observedEnd =
    t.observations.at(-1)?.position || t.summary?.landingPosition;
  const metric = (flight) => ({
    trajectoryRmse: Math.sqrt(throwLoss(flight, t).mse),
    landingError: observedEnd
      ? Math.hypot(...flight.points.at(-1).p.map((v, i) => v - observedEnd[i]))
      : null,
    apexError: Number.isFinite(t.summary?.maximumHeight)
      ? Math.abs(flight.apex - t.summary.maximumHeight)
      : null,
    flightTimeError: Number.isFinite(t.summary?.flightTime)
      ? Math.abs(flight.duration - t.summary.flightTime)
      : null,
    distanceError: Number.isFinite(t.summary?.distance)
      ? Math.abs(flight.distance - t.summary.distance)
      : null,
    lateralError: observedEnd
      ? Math.abs(flight.lateral - observedEnd[0])
      : null,
  });
  return {
    throwId: t.id,
    before: metric(before),
    after: metric(after),
    trajectories: {
      observed: t.observations,
      before: before.points,
      after: after.points,
    },
  };
}
