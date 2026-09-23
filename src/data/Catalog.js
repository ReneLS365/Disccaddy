import seed from "./catalog-seed.json" with { type: "json" };
import embedded from "./catalog-embedded.json" with { type: "json" };
export const Catalog = (() => {
  "use strict";
  const snapshotDate = "2026-09-14";
  const fold = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("da")
      .replace(/ø/g, "o")
      .replace(/æ/g, "ae")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const key = (d) => fold(d.brand) + "|" + fold(d.name);
  function validate(list) {
    if (!Array.isArray(list) || list.length > 20000)
      throw new Error(
        "Kataloget skal være en liste med højst 20.000 modeller.",
      );
    const seen = new Set();
    return list
      .map((d, index) => {
        const bad = () => {
          throw new Error(
            "Katalog: ugyldig disc på række " + (index + 1) + ".",
          );
        };
        if (
          !d ||
          typeof d.name !== "string" ||
          !d.name.trim() ||
          typeof d.brand !== "string" ||
          !d.brand.trim()
        )
          bad();
        const f = d.flight_numbers;
        if (!f || typeof f !== "object") bad();
        for (const [k, a, b] of [
          ["speed", 1, 15],
          ["glide", 0, 7],
          ["turn", -5, 2],
          ["fade", -2, 6],
        ])
          if (
            f[k] !== null &&
            (typeof f[k] !== "number" ||
              !Number.isFinite(f[k]) ||
              f[k] < a ||
              f[k] > b)
          )
            bad();
        const out = {
          id:
            typeof d.id === "string"
              ? d.id.slice(0, 100)
              : fold(d.brand + " " + d.name).replace(/ /g, "-"),
          name: d.name.trim().slice(0, 80),
          brand: d.brand.trim().slice(0, 60),
          flight_numbers: {
            speed: f.speed,
            glide: f.glide,
            turn: f.turn,
            fade: f.fade,
          },
          plastics: [],
        };
        if (Array.isArray(d.plastics))
          out.plastics = [
            ...new Set(
              d.plastics
                .filter((p) => typeof p === "string" && p.trim())
                .map((p) => p.trim().slice(0, 60)),
            ),
          ].slice(0, 30);
        if (
          typeof d.source === "string" &&
          d.source.trim() &&
          d.source.length < 600
        ) {
          try {
            const url = new URL(d.source);
            if (url.protocol === "https:") out.source = url.href;
          } catch (error) {
            console.warn("Ugyldig katalogkilde blev udeladt.", error);
          }
        }
        if (typeof d.chartUrl === "string" && d.chartUrl.startsWith("https://"))
          out.chartUrl = d.chartUrl.slice(0, 2000);
        if (seen.has(key(out))) return null;
        seen.add(key(out));
        return out;
      })
      .filter(Boolean);
  }
  function merge(...lists) {
    const map = new Map();
    for (const list of lists) for (const d of list) map.set(key(d), d);
    return [...map.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name, "da") ||
        a.brand.localeCompare(b.brand, "da"),
    );
  }
  function search(list, query = "", brand = "all", type = "all") {
    const terms = fold(query).split(/\s+/).filter(Boolean),
      joined = terms.join("");
    return list.filter((d) => {
      if (brand !== "all" && d.brand !== brand) return false;
      const category =
        d.flight_numbers.speed <= 3
          ? "putter"
          : d.flight_numbers.speed <= 5
            ? "midrange"
            : d.flight_numbers.speed <= 9
              ? "fairway"
              : "distance";
      if (type !== "all" && category !== type) return false;
      const hay = fold(d.name + " " + d.brand + " " + d.plastics.join(" "));
      return (
        terms.every((t) => hay.includes(t)) ||
        (!!joined && hay.replace(/ /g, "").includes(joined))
      );
    });
  }
  function fromAPI(rows) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 40000)
      throw new Error("Katalogsvaret er ikke en gyldig liste.");
    const ids = new Map();
    const normalized = rows.map((d) => {
      if (!d || typeof d.id !== "string" || !d.id)
        throw new Error("Kataloget mangler disc-id.");
      const f = {};
      for (const k of ["speed", "glide", "turn", "fade"]) {
        const v = d[k];
        if (v == null || v === "") f[k] = null;
        else if (
          typeof v === "number" ||
          (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()))
        )
          f[k] = Number(v);
        else throw new Error("Ugyldige flight numbers.");
      }
      const out = {
        id: d.id,
        name: d.name,
        brand: d.brand,
        flight_numbers: f,
        plastics: [],
        source: d.link,
        chartUrl: d.pic,
      };
      const sig = JSON.stringify(out);
      if (ids.has(d.id) && ids.get(d.id) !== sig)
        throw new Error("Kataloget indeholder modstridende disc-id.");
      ids.set(d.id, sig);
      return out;
    });
    return validate(normalized);
  }
  return {
    seed,
    embedded,
    snapshotDate,
    fold,
    key,
    validate,
    merge,
    search,
    fromAPI,
  };
})();
