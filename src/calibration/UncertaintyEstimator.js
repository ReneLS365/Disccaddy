import { createObjective } from "./CalibrationLoss.js";
import { PARAMETER_BOUNDS } from "./ParameterBounds.js";

export function estimateUncertainty(
  throws,
  profile,
  parameters,
  names,
  baseLoss,
) {
  const uncertainty = {},
    constraint = {};
  for (const name of names) {
    const b = PARAMETER_BOUNDS[name],
      h = Math.max(
        (b.upper - b.lower) * 0.01,
        Math.abs(parameters[name]) * 0.02,
      );
    const objective = createObjective(throws, profile, names),
      lo = { ...parameters, [name]: Math.max(b.lower, parameters[name] - h) },
      hi = { ...parameters, [name]: Math.min(b.upper, parameters[name] + h) };
    const curvature = Math.max(
      0,
      (objective(lo) + objective(hi) - 2 * baseLoss) / h ** 2,
    );
    uncertainty[name] =
      curvature > 1e-9
        ? Math.min(
            b.upper - b.lower,
            Math.sqrt(Math.max(baseLoss, 1e-9) / curvature),
          )
        : b.upper - b.lower;
    const relative = uncertainty[name] / (b.upper - b.lower);
    constraint[name] =
      relative < 0.08
        ? "well constrained"
        : relative < 0.25
          ? "partially constrained"
          : relative < 0.6
            ? "poorly constrained"
            : "unobservable";
  }
  return { uncertainty, constraint };
}
