import { Lab } from "./Lab.js";
import { Release } from "./Release.js";
import { Catalog } from "./Catalog.js";
import { validateRecords, mergeRecords } from "../game/Round.js";
export const BagData = (() => {
  "use strict";
  const KEY = "disc-flight-lab.v2",
    SCHEMA = "disc-flight-lab";
  const presets = [
    {
      id: "demo:putter",
      name: "Putter",
      brand: "Eksempel",
      speed: 1,
      glide: 1,
      turn: 0,
      fade: 2,
      color: "#f4b7d2",
    },
    {
      id: "demo:midrange",
      name: "Midrange",
      brand: "Eksempel",
      speed: 4,
      glide: 3,
      turn: 0,
      fade: 3,
      color: "#78dbe0",
    },
    {
      id: "demo:driver",
      name: "Wraith",
      brand: "Innova",
      speed: 12,
      glide: 5,
      turn: -1,
      fade: 3,
      color: "#c4f275",
    },
    {
      id: "demo:understable",
      name: "Roadrunner",
      brand: "Innova",
      speed: 9,
      glide: 6,
      turn: -4,
      fade: 1,
      color: "#ffba76",
    },
  ].map((d, i) => ({
    ...d,
    aeroFamily:
      i === 0 ? "genericPutter" : i === 1 ? "genericMid" : "genericDriver",
  }));
  const profileDefault = {
    name: "Min profil",
    hand: "R",
    bhPower: 27,
    fhPower: 24,
    bhRpm: 600,
    fhRpm: 500,
    height: 1.5,
    launch: 8,
    nose: 0,
    notes: "",
    level: "custom",
  };
  const settingDefault = {
    ...Lab.defaults,
    discId: "demo:driver",
    speed: 12,
    glide: 5,
    turn: -1,
    fade: 3,
    weight: 175,
    power: 27,
    powerPct: 100,
    maxPower: 27,
    method: "BH",
    hand: "R",
    bhRpm: 600,
    fhRpm: 500,
    hyzer: 0,
    nose: 0,
    launch: 8,
    height: 1.5,
    rpm: 600,
    style: "RHBH",
    windSpeed: 0,
    windFrom: 0,
    aim: 0,
  };
  const bounds = {
    speed: [1, 15],
    glide: [0, 7],
    turn: [-5, 2],
    fade: [-2, 6],
    weight: [100, 200],
    power: [0.5, 50],
    hyzer: [-80, 80],
    nose: [-15, 15],
    launch: [0, 25],
    height: [0.5, 2.5],
    rpm: [100, 1800],
    windSpeed: [0, 15],
    windFrom: [0, 359],
    aim: [0, 359],
  };
  const id = () =>
    globalThis.crypto?.randomUUID?.() ||
    "disc-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2);
  const text = (v, max = 100) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  function num(v, key) {
    const [a, b] = bounds[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < a || v > b)
      throw new Error("Ugyldig værdi for " + key + ".");
    return v;
  }
  function disc(d) {
    if (!d || typeof d !== "object" || !text(d.name, 80))
      throw new Error("En disc mangler et navn.");
    const out = {
      id: text(d.id, 100) || id(),
      name: text(d.name, 80),
      brand: text(d.brand, 60),
      plastic: text(d.plastic, 60),
      notes: text(d.notes, 500),
      color: /^#[\da-f]{6}$/i.test(d.color) ? d.color : "#c4f275",
      favorite: !!d.favorite,
    };
    if (out.id.startsWith("demo:")) out.id = id();
    for (const k of ["speed", "glide", "turn", "fade"]) out[k] = num(d[k], k);
    out.aeroFamily = ["genericPutter", "genericMid", "genericDriver"].includes(
      d.aeroFamily,
    )
      ? d.aeroFamily
      : "";
    if (d.aeroConfig) out.aeroConfig = Lab.config(d.aeroConfig);
    out.weight = d.weight == null ? null : num(d.weight, "weight");
    out.imageId = text(d.imageId, 100);
    out.imageUrl = "";
    if (d.imageUrl) {
      try {
        const u = new URL(d.imageUrl);
        if (
          !["https:", "http:"].includes(u.protocol) ||
          u.username ||
          u.password
        )
          throw new Error();
        out.imageUrl = u.href.slice(0, 2000);
      } catch {
        throw new Error("Brug en gyldig http- eller https-billedadresse.");
      }
    }
    return out;
  }
  function profile(p = {}) {
    if (!p || typeof p !== "object") throw new Error("Ugyldig profil.");
    const o = { ...profileDefault, ...p };
    if (o.bhPower < 5 || o.fhPower < 5)
      throw new Error("Maksimal release skal være mindst 5 m/s.");
    return {
      name: text(o.name, 60) || "Min profil",
      hand: o.hand === "L" ? "L" : "R",
      bhPower: num(o.bhPower, "power"),
      fhPower: num(o.fhPower, "power"),
      bhRpm: num(o.bhRpm, "rpm"),
      fhRpm: num(o.fhRpm, "rpm"),
      height: num(o.height, "height"),
      launch: num(o.launch, "launch"),
      nose: num(o.nose, "nose"),
      notes: text(o.notes, 1000),
      level: ["beginner", "casual", "advanced", "expert"].includes(o.level)
        ? o.level
        : "custom",
    };
  }
  function settings(p = {}) {
    if (!p || typeof p !== "object")
      throw new Error("Ugyldige kastindstillinger.");
    const s = { ...settingDefault, ...p },
      out = {
        discId: text(s.discId, 100) || "custom",
        method: Release.method(s),
        hand: s.hand || "R",
        maxPower: s.maxPower,
        powerPct: s.powerPct,
        bhRpm: num(s.bhRpm, "rpm"),
        fhRpm: num(s.fhRpm, "rpm"),
      };
    if (
      !["BH", "FH"].includes(out.method) ||
      !["R", "L"].includes(out.hand) ||
      typeof out.powerPct !== "number" ||
      !Number.isFinite(out.powerPct) ||
      out.powerPct < 10 ||
      out.powerPct > 100 ||
      typeof out.maxPower !== "number" ||
      !Number.isFinite(out.maxPower) ||
      out.maxPower < 5 ||
      out.maxPower > 50
    )
      throw new Error("Ugyldig procent, hånd eller maksimum.");
    for (const k of Object.keys(bounds))
      if (k !== "power") out[k] = num(s[k], k);
    return Release.resolve({
      ...out,
      ...Lab.validate(s),
      discName: text(s.discName, 80),
      discBrand: text(s.discBrand, 60),
      discColor: /^#[0-9a-f]{6}$/i.test(s.discColor) ? s.discColor : "#c4f275",
    });
  }
  function empty() {
    return {
      schema: SCHEMA,
      version: 6,
      profile: { ...profileDefault },
      bag: [],
      catalog: [],
      settings: { ...settingDefault },
      comparisons: [],
      rounds: [],
      commonWind: true,
    };
  }
  function validate(value) {
    if (
      !value ||
      value.schema !== SCHEMA ||
      ![2, 4, 5, 6].includes(value.version)
    )
      throw new Error(
        "Vælg en Disc Flight Lab-backup (version 2, 4, 5 eller 6).",
      );
    if (!Array.isArray(value.bag) || value.bag.length > 200)
      throw new Error("En bag må højst indeholde 200 discs.");
    const bag = value.bag.map(disc),
      ids = new Set(bag.map((d) => d.id));
    if (ids.size !== bag.length)
      throw new Error("Backup indeholder gentagne disc-id’er.");
    const p = profile(value.profile);
    let input = { ...value.settings };
    if (value.version === 2) {
      const old = { ...settingDefault, ...value.settings },
        method = old.style?.endsWith("FH") ? "FH" : "BH",
        key = method === "BH" ? "bhPower" : "fhPower";
      if (!["RHBH", "RHFH", "LHBH", "LHFH"].includes(old.style))
        throw new Error("Ugyldig gammel kastetype.");
      p.hand = old.style[0];
      num(old.power, "power");
      p[key] = Math.max(p[key], old.power);
      input = {
        ...old,
        method,
        hand: p.hand,
        maxPower: p[key],
        powerPct: (old.power / p[key]) * 100,
        bhRpm: p.bhRpm,
        fhRpm: p.fhRpm,
      };
      input[method === "BH" ? "bhRpm" : "fhRpm"] = old.rpm;
    }
    if (value.version < 6) {
      if (input.model !== "legacy")
        input.model = input.aeroPreset === "custom" ? "sixdof-v5" : "sixdof";
      if (input.model === "sixdof")
        input.aeroPreset =
          {
            ratings: "auto",
            documentMid: "genericMid",
            documentDriver: "genericDriver",
          }[input.aeroPreset] ||
          input.aeroPreset ||
          "auto";
    }
    const selected =
      bag.find((d) => d.id === input.discId) ||
      presets.find((d) => d.id === input.discId);
    const current = settings({
        ...input,
        discName: input.discName || selected?.name || "",
        discBrand: input.discBrand || selected?.brand || "",
        aeroFamily: input.aeroFamily || selected?.aeroFamily || "",
      }),
      comparisons = [];
    if (
      value.comparisons !== undefined &&
      (!Array.isArray(value.comparisons) || value.comparisons.length > 3)
    )
      throw new Error("Højst tre gemte kast.");
    for (const c of value.comparisons || []) {
      if (!c || !c.disc) throw new Error("Ufuldstændigt gemt kast.");
      const cp = profile(c.profile),
        cs = settings({
          ...c.settings,
          discName: c.settings.discName || c.disc.name,
          discBrand: c.settings.discBrand || c.disc.brand,
          model:
            value.version < 5
              ? "legacy"
              : value.version === 5 && c.settings.model !== "legacy"
                ? "sixdof-v5"
                : c.settings.model,
        });
      comparisons.push({
        id: text(c.id, 100) || id(),
        disc: disc(c.disc),
        profile: cp,
        settings: cs,
        savedAt: text(c.savedAt, 40),
      });
    }
    return {
      schema: SCHEMA,
      version: 6,
      profile: p,
      bag,
      catalog: Catalog.validate(value.catalog || []),
      settings: Release.resolve(current, p),
      comparisons,
      rounds: validateRecords(value.rounds),
      commonWind: value.commonWind !== false,
    };
  }
  function merge(current, incoming) {
    const bag = current.bag.map((d) => ({ ...d })),
      remapped = new Map();
    let added = 0;
    for (const d of incoming.bag) {
      const found = bag.find((x) => x.id === d.id);
      if (found && JSON.stringify(found) === JSON.stringify(d)) continue;
      const newId = found ? id() : d.id;
      remapped.set(d.id, newId);
      bag.push({ ...d, id: newId });
      added++;
    }
    if (bag.length > 200)
      throw new Error("Der er ikke plads til alle discs. Maksimum er 200.");
    const catalog = Catalog.merge(
      current.catalog || [],
      incoming.catalog || [],
    );
    if (catalog.length > 20000)
      throw new Error("Backup indeholder for mange katalogmodeller.");
    return {
      data: {
        ...current,
        bag,
        catalog,
        rounds: mergeRecords(
          current.rounds,
          (incoming.rounds || []).map((r) => ({
            ...r,
            discId: remapped.get(r.discId) || r.discId,
          })),
        ),
      },
      added,
    };
  }
  const category = (d) =>
    d.speed <= 3
      ? "putter"
      : d.speed <= 5
        ? "midrange"
        : d.speed <= 9
          ? "fairway"
          : "distance";
  const categoryLabel = {
    putter: "Putter",
    midrange: "Midrange",
    fairway: "Fairway",
    distance: "Distance",
  };
  return {
    KEY,
    SCHEMA,
    presets,
    profileDefault,
    settingDefault,
    bounds,
    id,
    disc,
    profile,
    settings,
    empty,
    validate,
    merge,
    category,
    categoryLabel,
  };
})();
