import { Aero } from "../physics/Aero.js";
import { Release } from "./Release.js";
export const Lab = (() => {
  const defaults = {
    model: "sixdof",
    aeroPreset: "auto",
    aeroFamily: "",
    diameter: 0,
    inertiaFactor: 0.7,
    inertiaScale: 1,
    wobble: 0,
    temperature: 15,
    altitude: 0,
    humidity: 0,
    targetDistance: 80,
    targetLateral: 0,
    targetRadius: 5,
    spreadPower: 3,
    spreadAngle: 2,
    spreadSpin: 8,
    spreadWind: 0.5,
    spreadLaunch: 1,
    spreadAim: 1,
    spreadAero: 100,
    liftScale: 1,
    dragScale: 1,
    momentOffset: 0,
    spinDragScale: 1,
    rateDampingScale: 1,
    customAero: null,
    customTable: null,
    aeroSnapshot: null,
  };
  const bounds = {
    diameter: [0, 0.3],
    inertiaFactor: [0.5, 1],
    inertiaScale: [0.5, 1.5],
    wobble: [0, 12],
    temperature: [-15, 45],
    altitude: [0, 4000],
    humidity: [0, 100],
    targetDistance: [5, 250],
    targetLateral: [-100, 100],
    targetRadius: [1, 30],
    spreadPower: [0, 15],
    spreadAngle: [0, 10],
    spreadSpin: [0, 30],
    spreadWind: [0, 5],
    spreadLaunch: [0, 5],
    spreadAim: [0, 10],
    spreadAero: [0, 200],
    liftScale: [0.5, 1.5],
    dragScale: [0.5, 1.8],
    momentOffset: [-0.06, 0.06],
    spinDragScale: [0, 3],
    rateDampingScale: [0, 3],
  };
  const coeffBounds = {
    CL0: [-0.5, 1],
    CLa: [0.1, 5],
    CD0: [0.01, 0.6],
    CDa: [0, 5],
    CM0: [-0.15, 0.15],
    CMa: [-0.2, 1],
    CMq: [-0.1, 0],
    CRp: [-0.1, 0],
    CRr: [-0.005, 0.005],
    Cspin: [-0.0002, 0],
    alpha0: [-0.35, 0.35],
    diameter: [0.15, 0.3],
    Iax: [0.0002, 0.005],
    Itrans: [0.0001, 0.003],
  };
  function custom(value) {
    if (value == null) return null;
    if (typeof value !== "object" || Array.isArray(value))
      throw new Error("Ugyldigt koefficientsæt.");
    const out = {};
    for (const [k, [a, b]] of Object.entries(coeffBounds)) {
      const v = value[k];
      if (typeof v !== "number" || !Number.isFinite(v) || v < a || v > b)
        throw new Error("Ugyldig koefficient: " + k);
      out[k] = v;
    }
    if (out.Iax > 2.01 * out.Itrans)
      throw new Error("Inertimomenterne skal opfylde Iax ≤ 2 × Itrans.");
    return out;
  }
  function validate(value = {}) {
    const p = { ...defaults, ...value },
      o = {};
    for (const [k, [lo, hi]] of Object.entries(bounds)) {
      if (
        typeof p[k] !== "number" ||
        !Number.isFinite(p[k]) ||
        p[k] < lo ||
        p[k] > hi
      )
        throw new Error("Ugyldig værdi: " + k);
      o[k] = p[k];
    }
    if (p.diameter !== 0 && p.diameter < 0.15)
      throw new Error("Diameter: vælg auto (0) eller 0,15–0,30 m.");
    if (
      !["sixdof", "sixdof-v5", "legacy"].includes(p.model) ||
      !Object.hasOwn(Aero.names, p.aeroPreset)
    )
      throw new Error("Ukendt fysikmodel.");
    o.model = p.model;
    o.aeroPreset = p.aeroPreset;
    o.aeroFamily = ["genericPutter", "genericMid", "genericDriver"].includes(
      p.aeroFamily,
    )
      ? p.aeroFamily
      : "";
    o.customAero = custom(p.customAero);
    o.customTable = p.customTable == null ? null : Aero.table(p.customTable);
    o.aeroSnapshot = Aero.snapshot(p.aeroSnapshot);
    if (o.aeroPreset === "custom" && !o.customAero)
      throw new Error("Egne koefficienter mangler.");
    if (o.aeroPreset === "customTable" && !o.customTable && !o.aeroSnapshot)
      throw new Error("Importér en koefficientprofil først.");
    return o;
  }
  const configKeys = [
    "aeroPreset",
    "aeroFamily",
    "diameter",
    "inertiaScale",
    "liftScale",
    "dragScale",
    "momentOffset",
    "spinDragScale",
    "rateDampingScale",
    "customAero",
    "customTable",
  ];
  function config(v = {}) {
    const p = validate({ ...v, model: "sixdof", aeroSnapshot: null });
    return Object.fromEntries(configKeys.map((k) => [k, p[k]]));
  }
  function signature(p) {
    const keys = [
      "weight",
      "power",
      "hyzer",
      "nose",
      "launch",
      "height",
      "rpm",
      "style",
      "windSpeed",
      "windFrom",
      "aim",
      "wobble",
      "temperature",
      "altitude",
      "humidity",
      "targetDistance",
      "targetLateral",
      "targetRadius",
      "spreadPower",
      "spreadAngle",
      "spreadSpin",
      "spreadWind",
      "spreadLaunch",
      "spreadAim",
      "spreadAero",
    ];
    const model = p.model || "sixdof",
      core = keys.map((k) => p[k] ?? defaults[k] ?? null);
    if (model === "sixdof")
      return JSON.stringify([
        model,
        core,
        Aero.exported(p),
        p.diameter || 0,
        p.inertiaScale ?? 1,
        p.liftScale ?? 1,
        p.dragScale ?? 1,
        p.momentOffset ?? 0,
        p.spinDragScale ?? 1,
        p.rateDampingScale ?? 1,
        p.aeroPerturb || null,
      ]);
    return JSON.stringify([
      model,
      core,
      ...[
        "speed",
        "glide",
        "turn",
        "fade",
        "aeroPreset",
        "diameter",
        "inertiaFactor",
        "customAero",
      ].map((k) => p[k] ?? defaults[k] ?? null),
    ]);
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function halton(i, b) {
    let f = 1,
      n = 0;
    for (; i > 0; i = Math.floor(i / b)) {
      f /= b;
      n += f * (i % b);
    }
    return n;
  }
  const offsets = (i) =>
    [2, 3, 5, 7, 11, 13, 17, 19, 23].map(
      (b) => (2 * halton(1 + Math.floor(i / 2), b) - 1) * (i % 2 ? -1 : 1),
    );
  function variations(p, count = 32) {
    return Array.from({ length: count }, (_, i) => {
      const u = offsets(i),
        powerPct = clamp(p.powerPct + u[0] * p.spreadPower, 10, 100),
        a = (p.windFrom * Math.PI) / 180,
        wx = p.windSpeed * Math.sin(a) + u[6] * p.spreadWind,
        wz = p.windSpeed * Math.cos(a) + u[7] * p.spreadWind;
      return {
        ...p,
        powerPct,
        power: Release.speed(powerPct, p.maxPower),
        hyzer: clamp(p.hyzer + u[1] * p.spreadAngle, -80, 80),
        nose: clamp(p.nose + u[2] * p.spreadAngle, -15, 15),
        rpm: clamp(p.rpm * (1 + (u[3] * p.spreadSpin) / 100), 100, 1800),
        launch: clamp(p.launch + u[4] * p.spreadLaunch, 0, 25),
        aim: (p.aim + u[5] * p.spreadAim + 360) % 360,
        windSpeed: clamp(Math.hypot(wx, wz), 0, 15),
        windFrom: ((Math.atan2(wx, wz) * 180) / Math.PI + 360) % 360,
        scenarioKind: "release",
      };
    });
  }
  function modelVariations(p, count = 16) {
    if (p.model !== "sixdof") return [];
    return Array.from({ length: count }, (_, i) => {
      const u = offsets(i),
        s = p.spreadAero / 100;
      return {
        ...p,
        scenarioKind: "model",
        aeroPerturb: {
          liftScale: 1 + u[0] * 0.15 * s,
          dragScale: 1 + u[1] * 0.2 * s,
          momentOffset: u[2] * 0.015 * s,
          spinScale: 1 + u[3] * 0.3 * s,
          dampingScale: 1 + u[4] * 0.5 * s,
        },
      };
    });
  }
  return {
    defaults,
    bounds,
    coeffBounds,
    validate,
    custom,
    config,
    configKeys,
    signature,
    variations,
    modelVariations,
  };
})();
