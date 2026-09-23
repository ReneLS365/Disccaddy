import AeroProfiles from "../data/AeroProfiles.json" with { type: "json" };
import AeroGeometries from "../data/AeroGeometries.json" with { type: "json" };
/* Aerodynamic data adapter. SI units; alpha tables in degrees, angles inside the
   solver in radians. Forces use q*S; ALL moments use q*S*D about the centre of mass.
   lambda = omega*R/U (signed). Static CFD does not measure lambda dependence.
   New trajectories never infer aerodynamic values from commercial flight ratings. */
function createAero(profiles, geometries) {
  "use strict";
  const rad = Math.PI / 180,
    clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fold = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const names = {
    auto: "Automatisk · tilgængelige data",
    "ss-cd1": "Firebird · CFD",
    "ss-cd5": "Roadrunner · CFD",
    "ss-dd2": "Wraith · CFD",
    "ss-fd2": "TeeBird · delvis CFD",
    genericPutter: "Putter · geometrisk estimat",
    genericMid: "Midrange · geometrisk estimat",
    genericDriver: "Driver · geometrisk estimat",
    hummel: "Hummel · referencefrisbee",
    customTable: "Importeret koefficientprofil",
    custom: "Egne lineære koefficienter",
    ratings: "Tidligere V5-profil",
    documentMid: "Tidligere dokumentprofil",
    documentDriver: "Tidligere dokumentprofil",
  };
  const geometry = (name) => {
    const key = fold(name);
    return (
      [...geometries]
        .sort((a, b) => b.model.length - a.model.length)
        .find(
          (g) =>
            key === fold(g.model) ||
            (key.startsWith(fold(g.model)) &&
              /^(bla|gron|glow|2018|star|champion|k1|k3|halo)/.test(
                key.slice(fold(g.model).length),
              )),
        ) || null
    );
  };
  function bracket(a, v) {
    if (v <= a[0]) return [0, 0, 0];
    if (v >= a.at(-1)) return [a.length - 1, a.length - 1, 0];
    let l = 0,
      h = a.length - 1;
    while (h - l > 1) {
      let m = (l + h) >> 1;
      if (a[m] > v) h = m;
      else l = m;
    }
    return [l, h, (v - a[l]) / (a[h] - a[l])];
  }
  function interpolate(a, values, x) {
    const [l, h, t] = bracket(a, x);
    return values[l] + t * (values[h] - values[l]);
  }
  function lookup(profile, field, alpha, lambda = 0) {
    const values = profile[field];
    if (!values) return 0;
    if (!Array.isArray(values[0]))
      return interpolate(profile.alpha, values, alpha);
    const [l, h, t] = bracket(profile.lambda, lambda),
      a = interpolate(profile.alpha, values[l], alpha),
      b = interpolate(profile.alpha, values[h], alpha);
    return a + t * (b - a);
  }
  const clean = (s) => (typeof s === "string" ? s.trim().slice(0, 300) : "");
  function table(v) {
    if (!v || typeof v !== "object" || v.schema !== "disc-aero-1")
      throw new Error(
        "Koefficientfilen skal have formatet disc-aero-1. Eksportér en profil som skabelon.",
      );
    function num(k, lo, hi) {
      const n = v[k];
      if (typeof n !== "number" || !Number.isFinite(n) || n < lo || n > hi)
        throw new Error("Ugyldig profilværdi: " + k);
      return n;
    }
    const o = {
      schema: "disc-aero-1",
      id: "imported",
      name: clean(v.name) || "Importeret profil",
      source: clean(v.source),
      basis: "Brugerimport",
      revision: clean(v.revision) || "egen",
      diameter: num("diameter", 0.15, 0.3),
      Jax: num("Jax", 0.0005, 0.04),
      Jtrans: num("Jtrans", 0.00025, 0.03),
    };
    if (o.Jax > 2.01 * o.Jtrans)
      throw new Error(
        "Inertimomenterne skal opfylde Jax ≤ 2 × Jtrans. J angives i m² (I/masse).",
      );
    if (
      !Array.isArray(v.alpha) ||
      v.alpha.length < 3 ||
      v.alpha.length > 181 ||
      !v.alpha.every(
        (x, i) =>
          Number.isFinite(x) &&
          x >= -90 &&
          x <= 90 &&
          (!i || x > v.alpha[i - 1]),
      )
    )
      throw new Error(
        "Angrebsvinkler skal stige strengt fra −90 til 90°. Mindst tre punkter.",
      );
    o.alpha = [...v.alpha];
    o.domain = [o.alpha[0], o.alpha.at(-1)];
    if (v.domain !== undefined) {
      if (
        !Array.isArray(v.domain) ||
        v.domain.length !== 2 ||
        !v.domain.every(Number.isFinite) ||
        v.domain[0] < o.domain[0] ||
        v.domain[1] > o.domain[1] ||
        v.domain[0] >= v.domain[1]
      )
        throw new Error("Ugyldigt primært vinkelområde.");
      o.domain = [...v.domain];
    }
    if (v.lambda !== undefined) {
      if (
        !Array.isArray(v.lambda) ||
        !v.lambda.length ||
        v.lambda.length > 31 ||
        !v.lambda.every(
          (x, i) =>
            Number.isFinite(x) &&
            Math.abs(x) <= 100 &&
            (!i || x > v.lambda[i - 1]),
        )
      )
        throw new Error("Ugyldig akse for spin/fart-forhold.");
      o.lambda = [...v.lambda];
    }
    for (const [k, lo, hi] of [
      ["CL", -4, 4],
      ["CD", 0, 4],
      ["CM", -0.5, 0.5],
      ["CRoll", -0.5, 0.5],
      ["CSpin", -0.5, 0.5],
    ]) {
      if (v[k] === undefined && ["CRoll", "CSpin"].includes(k)) continue;
      const values = v[k],
        rows = o.lambda ? values : [values];
      if (
        !Array.isArray(values) ||
        !Array.isArray(rows) ||
        rows.length !== (o.lambda?.length || 1) ||
        !rows.every(
          (row) =>
            Array.isArray(row) &&
            row.length === o.alpha.length &&
            row.every(
              (x) =>
                typeof x === "number" &&
                Number.isFinite(x) &&
                x >= lo &&
                x <= hi,
            ),
        )
      )
        throw new Error("Ugyldig tabel: " + k);
      if (
        k === "CSpin" &&
        o.lambda &&
        rows.some((row, i) => row.some((x) => x * o.lambda[i] > 1e-12))
      )
        throw new Error("Spinmomentet må ikke tilføre rotationsenergi.");
      if (
        k === "CSpin" &&
        o.lambda &&
        (!o.lambda.includes(0) ||
          o.lambda[0] > 0 ||
          o.lambda.at(-1) < 0 ||
          o.lambda.some(
            (x, i) => x === 0 && rows[i].some((c) => Math.abs(c) > 1e-12),
          ))
      )
        throw new Error(
          "CSpin kræver et nulpunkt på lambda-aksen med nul moment ved nul spin.",
        );
      if (k === "CSpin" && !o.lambda && values.some((x) => Math.abs(x) > 1e-12))
        throw new Error("Et spinmoment kræver en signeret lambda-akse.");
      o[k] = structuredClone(values);
    }
    return o;
  }
  function generic(kind, g) {
    const mid = kind === "genericMid",
      driver = kind === "genericDriver",
      hummel = kind === "hummel",
      dia =
        g?.diameter ||
        (hummel
          ? 2 * Math.sqrt(0.057 / Math.PI)
          : mid
            ? 0.217
            : driver
              ? 0.211
              : 0.212),
      r = dia / 2;
    const c = hummel
      ? {
          l0: 0.3331,
          la: 1.9124,
          d0: 0.1769,
          da: 0.685,
          m0: -0.0821,
          ma: 0.4338,
          a0: -0.3331 / 1.9124,
        }
      : {
          l0: driver ? 0.15 : 0.22,
          la: driver ? 2.6 : 2.1,
          d0: driver ? 0.06 : 0.1,
          da: driver ? 1.6 : 2.1,
          m0: driver ? -0.04 : -0.025,
          ma: driver ? 0.4 : 0.25,
          a0: 0,
        };
    const alpha = Array.from({ length: 37 }, (_, i) => -90 + i * 5),
      CL = [],
      CD = [],
      CM = [];
    for (const deg of alpha) {
      const a = deg * rad,
        t = clamp((Math.abs(deg) - 20) / 50, 0, 1),
        s = t * t * (3 - 2 * t);
      CL.push((1 - s) * (c.l0 + c.la * a) + s * 0.85 * Math.sin(2 * a));
      CD.push(
        (1 - s) * (c.d0 + c.da * (a - c.a0) ** 2) +
          s * (0.05 + 1.5 * Math.sin(a) ** 2),
      );
      CM.push((1 - s) * (c.m0 + c.ma * a));
    }
    const Jax = hummel ? 0.002352 / 0.175 : 0.7 * r * r,
      Jtrans = hummel
        ? 0.001219 / 0.175
        : Jax / 2 + (g?.height || 0.018) ** 2 / 12;
    return {
      id: kind,
      name: names[kind],
      basis: hummel ? "Frisbee-reference" : "Geometrisk estimat",
      diameter: dia,
      Jax,
      Jtrans,
      alpha,
      CL,
      CD,
      CM,
      domain: [-10, 20],
      revision: "dfl6-1",
      source: hummel
        ? "https://research.engineering.ucdavis.edu/biosport/sample-page/test-page-1/frisbee-flight-simulation-and-throw-biomechanics/"
        : "Brugerens 6-DOF-dokument: generiske startkoefficienter",
      note: hummel
        ? "Koefficientfit for en frisbee. Ikke golfdiscdata."
        : "Generisk aerodynamik. Geometrien bestemmer basisfamilie og inertiestimat; modelnavnet er ikke en målt aeroprofil.",
    };
  }
  function resolve(p) {
    if (p.aeroSnapshot) return structuredClone(p.aeroSnapshot);
    const g = geometry(p.discName),
      selected = p.aeroPreset || "auto",
      matches = {
        firebird: "ss-cd1",
        roadrunner: "ss-cd5",
        wraith: "ss-dd2",
        teebird: "ss-fd2",
      };
    let key = selected,
      matched = false;
    if (key === "auto") {
      const k = fold(g?.model || p.discName);
      key = !p.discBrand || /innova/i.test(p.discBrand) ? matches[k] : null;
      matched = !!key;
      if (!key) {
        const rim = g?.rim;
        key = ["genericPutter", "genericMid", "genericDriver"].includes(
          p.aeroFamily,
        )
          ? p.aeroFamily
          : rim === undefined
            ? "genericDriver"
            : rim <= 0.012001
              ? "genericPutter"
              : rim <= 0.016001
                ? "genericMid"
                : "genericDriver";
      }
    }
    if (key === "ratings") key = "genericDriver";
    if (key === "documentMid") key = "genericMid";
    if (key === "documentDriver") key = "genericDriver";
    let t;
    if (key === "customTable") {
      if (!p.customTable)
        throw new Error("Importér en koefficientprofil først.");
      t = table(p.customTable);
    } else if (profiles[key]) t = structuredClone(profiles[key]);
    else if (key === "custom") {
      const c = p.customAero;
      if (!c) throw new Error("Egne koefficienter mangler.");
      t = generic("genericDriver", g);
      t.id = "custom";
      t.name = "Egne lineære koefficienter";
      t.basis = "Egen justering";
      t.diameter = c.diameter;
      t.Jax = c.Iax / (p.weight / 1000);
      t.Jtrans = c.Itrans / (p.weight / 1000);
      for (let i = 0; i < t.alpha.length; i++) {
        const a = t.alpha[i] * rad;
        t.CL[i] = c.CL0 + c.CLa * a;
        t.CD[i] = c.CD0 + c.CDa * (a - c.alpha0) ** 2;
        t.CM[i] = c.CM0 + c.CMa * a;
      }
    } else t = generic(key in names ? key : "genericDriver", g);
    t.geometry = g ? structuredClone(g) : null;
    t.match = matched;
    t.explicit = selected !== "auto";
    t.quality = profiles[key]
      ? key === "ss-fd2"
        ? "Delvis CFD"
        : "CFD-reference"
      : key === "hummel"
        ? "Frisbee-reference"
        : key === "customTable"
          ? "Brugerimport"
          : "Estimat";
    if (profiles[key] && !matched && selected === "auto") t.quality = "Estimat";
    if (!g && selected === "auto" && !matched)
      t.note =
        "Ingen præcis geometri fundet. " +
        names[key] +
        " er valgt. Kontrollér basisprofilen; størrelsen er et estimat.";
    return t;
  }
  function exported(p) {
    const t = resolve(p);
    return {
      schema: "disc-aero-1",
      name: t.name,
      source: t.source,
      revision: t.revision,
      diameter: t.diameter,
      Jax: t.Jax,
      Jtrans: t.Jtrans,
      alpha: t.alpha,
      domain: t.domain,
      CL: t.CL,
      CD: t.CD,
      CM: t.CM,
      ...(t.lambda ? { lambda: t.lambda } : {}),
      ...(t.CRoll ? { CRoll: t.CRoll } : {}),
      ...(t.CSpin ? { CSpin: t.CSpin } : {}),
      convention:
        "F=q*S*C; M=q*S*D*C; S=pi*D²/4; alpha_deg; lambda=omega*R/U signed; J=I/m [m²]. CRoll about forward axis; CSpin about top normal. All moments about centre of mass.",
    };
  }
  function snapshot(v) {
    if (v == null) return null;
    const out = table({ ...v, schema: "disc-aero-1" }),
      known = profiles[v.id],
      same =
        known &&
        ["diameter", "Jax", "Jtrans", "alpha", "CL", "CD", "CM"].every(
          (k) => JSON.stringify(known[k]) === JSON.stringify(out[k]),
        ) &&
        !out.lambda &&
        !out.CRoll &&
        !out.CSpin;
    const domain =
      Array.isArray(v.domain) &&
      v.domain.length === 2 &&
      v.domain.every(Number.isFinite) &&
      v.domain[0] >= out.alpha[0] &&
      v.domain[1] <= out.alpha.at(-1) &&
      v.domain[0] < v.domain[1]
        ? v.domain
        : out.domain;
    const genericProfile = [
      "genericPutter",
      "genericMid",
      "genericDriver",
      "hummel",
    ].includes(v.id);
    return {
      ...out,
      id: clean(v.id) || "imported",
      name: clean(v.name) || out.name,
      basis: same ? known.basis : "Brugerimport",
      quality: same
        ? v.id === "ss-fd2"
          ? "Delvis CFD"
          : "CFD-reference"
        : genericProfile
          ? "Estimat"
          : "Brugerimport",
      note: same ? known.note : clean(v.note),
      geometry: v.geometry ? geometry(v.geometry.model) : null,
      domain: same ? known.domain : domain,
    };
  }
  return {
    names,
    profiles,
    geometry,
    resolve,
    table,
    snapshot,
    exported,
    lookup,
    fold,
  };
}

export const Aero = createAero(AeroProfiles, AeroGeometries);
