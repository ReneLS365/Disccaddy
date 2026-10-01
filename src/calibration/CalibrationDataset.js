const vec = (value, length, name) => {
  if (
    !Array.isArray(value) ||
    value.length !== length ||
    !value.every(Number.isFinite)
  )
    throw new Error(`${name} skal indeholde ${length} endelige tal.`);
  return [...value];
};

export function normalizeThrow(value) {
  if (!value || typeof value !== "object") throw new Error("Ugyldigt kast.");
  const observations = (value.observations || [])
    .map((o, i) => ({
      timestamp: Number(o.timestamp),
      position: vec(o.position || [o.x, o.y, o.z], 3, `Position ${i}`),
      ...(o.velocity ? { velocity: vec(o.velocity, 3, `Hastighed ${i}`) } : {}),
      ...(o.orientation
        ? { orientation: vec(o.orientation, 4, `Orientering ${i}`) }
        : {}),
      ...(Number.isFinite(o.spinRate) ? { spinRate: o.spinRate } : {}),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!observations.length && !value.summary)
    throw new Error("Kastet mangler observationer eller resumémål.");
  if (
    observations.some(
      (o, i) =>
        o.timestamp < 0 || (i && o.timestamp <= observations[i - 1].timestamp),
    )
  )
    throw new Error("Observationstider skal være unikke og stigende.");
  return {
    id: String(value.id || crypto.randomUUID()),
    discId: String(value.discId || ""),
    simulatorInput: structuredClone(value.simulatorInput || {}),
    initialState: value.initialState
      ? {
          position: vec(value.initialState.position, 3, "Startposition"),
          velocity: vec(value.initialState.velocity, 3, "Starthastighed"),
          orientation: vec(
            value.initialState.orientation,
            4,
            "Startorientering",
          ),
          angularVelocity: vec(
            value.initialState.angularVelocity,
            3,
            "Rotationshastighed",
          ),
        }
      : null,
    environment: value.environment
      ? {
          airDensity: Number(value.environment.airDensity),
          wind: vec(value.environment.wind, 3, "Vind"),
          gravity: vec(value.environment.gravity, 3, "Tyngdeacceleration"),
        }
      : null,
    observations,
    summary: value.summary ? structuredClone(value.summary) : null,
    split: value.split === "validation" ? "validation" : "training",
    weight: Math.max(
      0.05,
      Math.min(
        1,
        Number(value.weight) || qualityWeight(observations, value.summary),
      ),
    ),
  };
}

export function qualityLevel(t) {
  if (
    t.observations?.some(
      (o) => o.orientation || o.velocity || Number.isFinite(o.spinRate),
    )
  )
    return "C";
  if (t.observations?.length >= 3) return "B";
  return "A";
}
function qualityWeight(obs, summary) {
  return obs?.length >= 3
    ? obs.some((o) => o.velocity || o.orientation)
      ? 1
      : 0.8
    : summary
      ? 0.35
      : 0.2;
}

export function observability(throws) {
  const levels = throws.map(qualityLevel),
    count = throws.length;
  return {
    lift: count >= 2 ? "partially constrained" : "poorly constrained",
    drag: count >= 2 ? "partially constrained" : "poorly constrained",
    pitchMoment:
      levels.includes("C") && count >= 3 ? "well constrained" : "unobservable",
    rollMoment:
      throws.some((t) => t.observations.some((o) => o.orientation)) &&
      count >= 3
        ? "partially constrained"
        : "unobservable",
    spinDamping: throws.some(
      (t) =>
        t.observations.filter((o) => Number.isFinite(o.spinRate)).length >= 2,
    )
      ? "partially constrained"
      : "unobservable",
  };
}

export function datasetCoverage(throws) {
  const vals = (fn) => throws.map(fn).filter(Number.isFinite),
    range = (a) => (a.length ? [Math.min(...a), Math.max(...a)] : null);
  return {
    speedMs: range(vals((t) => t.simulatorInput.power)),
    noseDeg: range(vals((t) => t.simulatorInput.nose)),
    hyzerDeg: range(vals((t) => t.simulatorInput.hyzer)),
    spinRadS: range(
      vals((t) =>
        Number.isFinite(t.simulatorInput.rpm)
          ? (t.simulatorInput.rpm * 2 * Math.PI) / 60
          : NaN,
      ),
    ),
    rating:
      throws.length >= 6 &&
      new Set(throws.map((t) => Math.round(t.simulatorInput.power || 0)))
        .size >= 3
        ? "High"
        : throws.length >= 3
          ? "Medium"
          : "Low",
  };
}
