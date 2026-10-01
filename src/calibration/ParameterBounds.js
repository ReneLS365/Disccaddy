export const PARAMETER_BOUNDS = Object.freeze({
  liftScale: {
    lower: 0.35,
    upper: 2.2,
    prior: 1,
    regularization: 0.03,
    group: "lift",
  },
  dragScale: {
    lower: 0.35,
    upper: 3,
    prior: 1,
    regularization: 0.04,
    group: "drag",
  },
  momentOffset: {
    lower: -0.12,
    upper: 0.12,
    prior: 0,
    regularization: 1.5,
    group: "pitchMoment",
  },
  rateDampingScale: {
    lower: 0.2,
    upper: 3,
    prior: 1,
    regularization: 0.08,
    group: "rollMoment",
  },
  spinDragScale: {
    lower: 0.1,
    upper: 5,
    prior: 1,
    regularization: 0.05,
    group: "spinDamping",
  },
});

export function clampParameters(
  parameters,
  names = Object.keys(PARAMETER_BOUNDS),
) {
  const out = {};
  for (const name of names) {
    const b = PARAMETER_BOUNDS[name],
      v = Number(parameters[name]);
    out[name] = Math.max(
      b.lower,
      Math.min(b.upper, Number.isFinite(v) ? v : b.prior),
    );
  }
  return out;
}

export function regularization(parameters, names = Object.keys(parameters)) {
  return names.reduce((sum, name) => {
    const b = PARAMETER_BOUNDS[name];
    if (!b) return sum;
    const span = b.upper - b.lower;
    return sum + b.regularization * ((parameters[name] - b.prior) / span) ** 2;
  }, 0);
}
