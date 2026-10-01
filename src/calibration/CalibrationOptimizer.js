import { PARAMETER_BOUNDS, clampParameters } from "./ParameterBounds.js";

function random(seed) {
  let x = seed >>> 0 || 1;
  return () => (x = (Math.imul(1664525, x) + 1013904223) >>> 0) / 4294967296;
}
export class BoundedHybridOptimizer {
  async optimize({
    objective,
    parameterNames,
    initial = {},
    seed = 1,
    generations = 12,
    populationSize = 0,
    onProgress = () => {},
  }) {
    const rand = random(seed),
      n = parameterNames.length,
      size = Math.max(populationSize || n * 6, 12);
    const make = () =>
      Object.fromEntries(
        parameterNames.map((k) => {
          const b = PARAMETER_BOUNDS[k];
          return [k, b.lower + rand() * (b.upper - b.lower)];
        }),
      );
    let population = [
      clampParameters(
        {
          ...Object.fromEntries(
            parameterNames.map((k) => [k, PARAMETER_BOUNDS[k].prior]),
          ),
          ...initial,
        },
        parameterNames,
      ),
      ...Array.from({ length: size - 1 }, make),
    ];
    let scores = population.map(objective);
    for (let g = 0; g < generations; g++) {
      for (let i = 0; i < size; i++) {
        const pool = [...Array(size).keys()].filter((j) => j !== i);
        const take = () => pool.splice(Math.floor(rand() * pool.length), 1)[0];
        const [a, b, c] = [take(), take(), take()],
          trial = {};
        const forced = Math.floor(rand() * n);
        parameterNames.forEach((k, j) => {
          const bound = PARAMETER_BOUNDS[k];
          const v =
            population[a][k] + 0.72 * (population[b][k] - population[c][k]);
          trial[k] =
            rand() < 0.82 || j === forced
              ? Math.max(bound.lower, Math.min(bound.upper, v))
              : population[i][k];
        });
        const score = objective(trial);
        if (score < scores[i]) {
          population[i] = trial;
          scores[i] = score;
        }
      }
      onProgress((g + 1) / (generations + 2));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    let best = scores.indexOf(Math.min(...scores)),
      parameters = population[best],
      value = scores[best];
    for (let pass = 0; pass < 2; pass++)
      for (const k of parameterNames) {
        const b = PARAMETER_BOUNDS[k],
          step = (b.upper - b.lower) * (pass ? 0.015 : 0.05);
        for (const sign of [-1, 1]) {
          const trial = {
              ...parameters,
              [k]: Math.max(
                b.lower,
                Math.min(b.upper, parameters[k] + sign * step),
              ),
            },
            score = objective(trial);
          if (score < value) {
            parameters = trial;
            value = score;
          }
        }
      }
    onProgress(1);
    return { parameters, loss: value, evaluations: objective.evaluations?.() };
  }
}
