// Solvers are imported on demand. Playback keeps the model stored with each throw.
const loaders = {
  legacy: () => import("./LegacyFlight.js"),
  "sixdof-v5": () => import("./Physics5.js"),
  sixdof: () => import("./Physics6.js"),
};
const pending = new Map();
const engines = new Map();
export async function loadEngine(model = "sixdof") {
  if (!loaders[model]) throw new Error("Ukendt fysikmodel: " + model);
  if (!pending.has(model)) {
    const promise = loaders[model]()
      .then((module) => {
        engines.set(model, module.default);
        return module.default;
      })
      .catch((error) => {
        pending.delete(model);
        throw error;
      });
    pending.set(model, promise);
  }
  return pending.get(model);
}
export async function simulate(p) {
  const model = p.model || "sixdof";
  const engine = await loadEngine(model);
  return { ...engine.simulate(p), model };
}
const D = Math.PI / 180;
export const Flight = {
  D,
  clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
  wrap: (a) => ((a % 360) + 360) % 360,
  add: (a, b) => a.map((v, i) => v + b[i]),
  mul: (a, k) => a.map((v) => v * k),
  len: (a) => Math.hypot(...a),
  spinSign: (style) => (style === "RHBH" || style === "LHFH" ? 1 : -1),
  wind(p) {
    const a = (p.windFrom - p.aim) * D;
    return [-p.windSpeed * Math.sin(a), 0, p.windSpeed * Math.cos(a)];
  },
  sample(flight, time) {
    const model = flight.model || flight.p.model || "legacy";
    const engine = engines.get(model);
    if (!engine) throw new Error("Fysikmotoren er endnu ikke indlæst.");
    return engine.sample(flight, time);
  },
};
