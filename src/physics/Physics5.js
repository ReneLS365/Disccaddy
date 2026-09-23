function createPhysics5() {
  "use strict";
  const D = Math.PI / 180,
    G = 9.80665,
    clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const add = (a, b) => a.map((v, i) => v + b[i]),
    mul = (a, s) => a.map((v) => v * s),
    dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0),
    len = (a) => Math.hypot(...a),
    unit = (a) => mul(a, 1 / Math.max(1e-12, len(a))),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const spinSign = (s) => (s === "RHBH" || s === "LHFH" ? 1 : -1);
  function wind(p) {
    const a = (p.windFrom - p.aim) * D;
    return [-p.windSpeed * Math.sin(a), 0, p.windSpeed * Math.cos(a)];
  }
  function density(p) {
    const t = p.temperature ?? 15,
      h = p.altitude ?? 0,
      rh = p.humidity ?? 0,
      pressure = 101325 * Math.pow(1 - (0.0065 * h) / 288.15, 5.25588),
      vap = (rh / 100) * 610.94 * Math.exp((17.625 * t) / (t + 243.04));
    return (
      (pressure - vap) / (287.05 * (t + 273.15)) +
      vap / (461.495 * (t + 273.15))
    );
  }
  const names = {
    ratings: "Flighttal · estimeret",
    documentMid: "Dokument · putter/mid (estimat)",
    documentDriver: "Dokument · driver (estimat)",
    hummel: "Frisbee · Hummel reference",
    custom: "Egne koefficienter",
  };
  function coefficients(p) {
    const kind = p.aeroPreset || "ratings",
      m = p.weight / 1000,
      blend = clamp((p.speed - 5) / 7, 0, 1),
      lerp = (a, b) => a + (b - a) * blend;
    let c = {
      CL0: lerp(0.22, 0.15),
      CLa: lerp(2.1, 2.6),
      CD0: lerp(0.1, 0.06),
      CDa: lerp(2.1, 1.6),
      CM0: lerp(-0.025, -0.04),
      CMa: lerp(0.25, 0.4),
      CMq: -0.0144,
      CRp: -0.0125,
      CRr: 0,
      Cspin: -0.0000341,
      alpha0: 0,
      diameter: p.diameter || lerp(0.217, 0.211),
      label: names[kind] || names.ratings,
    };
    if (kind === "documentMid")
      Object.assign(c, {
        CL0: 0.22,
        CLa: 2.1,
        CD0: 0.1,
        CDa: 2.1,
        CM0: -0.025,
        CMa: 0.25,
        diameter: p.diameter || 0.217,
      });
    if (kind === "documentDriver")
      Object.assign(c, {
        CL0: 0.15,
        CLa: 2.6,
        CD0: 0.06,
        CDa: 1.6,
        CM0: -0.04,
        CMa: 0.4,
        diameter: p.diameter || 0.211,
      });
    if (kind === "ratings") {
      const liftScale = 1 + 0.075 * (p.glide - 4);
      c.CL0 *= liftScale;
      c.CLa *= liftScale;
      c.CM0 =
        0.0035 * p.turn -
        0.0012 * Math.max(0, p.glide - 4) +
        0.0018 * Math.max(0, p.fade - 2) -
        0.002;
      c.CMa = 0.08 + 0.025 * p.fade;
    }
    if (kind === "hummel")
      Object.assign(c, {
        CRr: 0.00171,
        CL0: 0.3331,
        CLa: 1.9124,
        CD0: 0.1769,
        CDa: 0.685,
        CM0: -0.0821,
        CMa: 0.4338,
        alpha0: -0.3331 / 1.9124,
        diameter: 2 * Math.sqrt(0.057 / Math.PI),
      });
    if (kind === "custom") Object.assign(c, p.customAero || {});
    const r = c.diameter / 2;
    c.area = Math.PI * r * r;
    c.Iax = (p.inertiaFactor ?? 0.7) * m * r * r;
    c.Itrans = c.Iax / 2 + (m * 0.018 * 0.018) / 12;
    if (kind === "hummel") {
      c.Iax = (0.002352 * m) / 0.175;
      c.Itrans = (0.001219 * m) / 0.175;
    }
    if (kind === "custom" && p.customAero?.Iax) {
      c.Iax = p.customAero.Iax;
      c.Itrans = p.customAero.Itrans;
    }
    c.mass = m;
    c.rho = density(p);
    return c;
  }
  function normal(q) {
    const k =
        1 /
        Math.max(
          1e-20,
          q.reduce((a, v) => a + v * v, 0),
        ),
      [x, y, z, w] = q;
    return [
      2 * (x * y - z * w) * k,
      (w * w - x * x + y * y - z * z) * k,
      2 * (y * z + x * w) * k,
    ];
  }
  function initial(p, c) {
    const pitch = (p.launch + p.nose) * D,
      bank = -spinSign(p.style) * p.hyzer * D,
      n = [
        Math.sin(bank),
        Math.cos(pitch) * Math.cos(bank),
        Math.sin(pitch) * Math.cos(bank),
      ],
      q = unit([n[2], 0, -n[0], 1 + n[1]]);
    const v = [
        0,
        p.power * Math.sin(p.launch * D),
        -p.power * Math.cos(p.launch * D),
      ],
      f = unit(add(v, mul(n, -dot(v, n)))),
      right = unit(cross(f, n));
    const spin = (-spinSign(p.style) * p.rpm * 2 * Math.PI) / 60,
      omega = add(
        mul(n, spin),
        mul(right, Math.abs(spin) * Math.tan((p.wobble || 0) * D)),
      ),
      L = add(mul(omega, c.Itrans), mul(n, (c.Iax - c.Itrans) * spin));
    return [0, p.height, 0, ...v, ...q, ...L];
  }
  function stateInfo(y, c) {
    const n = normal(y.slice(6, 10)),
      L = y.slice(10, 13),
      ln = dot(L, n),
      omega = add(
        mul(L, 1 / c.Itrans),
        mul(n, ln * (1 / c.Iax - 1 / c.Itrans)),
      );
    return { n, omega, spin: ln / c.Iax };
  }
  function aero(y, p, c) {
    const { n, omega, spin } = stateInfo(y, c),
      v = add(y.slice(3, 6), mul(wind(p), -1)),
      speed = len(v),
      uv = speed > 1e-9 ? mul(v, 1 / speed) : [0, 0, -1],
      vn = dot(uv, n),
      alpha = Math.asin(clamp(-vn, -1, 1));
    let f = add(uv, mul(n, -vn));
    if (len(f) < 1e-7) {
      f = cross([1, 0, 0], n);
      if (len(f) < 1e-7) f = cross([0, 0, 1], n);
    }
    f = unit(f);
    const right = unit(cross(f, n)),
      liftDir = unit(cross(right, uv)),
      stall = smooth(20 * D, 70 * D, Math.abs(alpha));
    const CL =
      (1 - stall) * (c.CL0 + c.CLa * alpha) +
      stall * 0.85 * Math.sin(2 * alpha);
    const CD =
      (1 - stall) * (c.CD0 + c.CDa * (alpha - c.alpha0) ** 2) +
      stall * (0.05 + 1.5 * Math.sin(alpha) ** 2);
    const CM = (c.CM0 + c.CMa * alpha) * (1 - stall),
      qS = 0.5 * c.rho * speed * speed * c.area,
      pr = dot(omega, right),
      rr = dot(omega, f);
    const pitch = qS * c.diameter * (CM + c.CMq * pr),
      roll =
        qS *
        c.diameter *
        (c.CRp * rr - c.CRr * Math.sqrt(c.diameter / G) * spin),
      spinMoment = c.Cspin * spin;
    const F = add(mul(liftDir, qS * CL), mul(uv, -qS * CD)),
      tau = add(add(mul(right, pitch), mul(f, roll)), mul(n, spinMoment));
    return {
      n,
      omega,
      spin,
      alpha,
      CL,
      CD,
      CM,
      F,
      tau,
      lift: qS * CL,
      drag: qS * CD,
      pitch,
      roll,
      spinMoment,
      airspeed: speed,
      phase: CM < -0.001 ? "Turn" : CM > 0.001 ? "Fade" : "Glide",
      stall,
    };
  }
  function derivative(y, p, c, options = {}) {
    const a = aero(y, p, c),
      F = options.aero === false ? [0, 0, 0] : a.F,
      T = options.aero === false ? [0, 0, 0] : a.tau,
      [wx, wy, wz] = a.omega,
      [qx, qy, qz, qw] = y.slice(6, 10);
    return [
      y[3],
      y[4],
      y[5],
      F[0] / c.mass,
      F[1] / c.mass - (options.gravity ?? G),
      F[2] / c.mass,
      0.5 * (wx * qw + wy * qz - wz * qy),
      0.5 * (-wx * qz + wy * qw + wz * qx),
      0.5 * (wx * qy - wy * qx + wz * qw),
      -0.5 * (wx * qx + wy * qy + wz * qz),
      ...T,
    ];
  }
  const A = [
      [],
      [1 / 5],
      [3 / 40, 9 / 40],
      [44 / 45, -56 / 15, 32 / 9],
      [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
      [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
      [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
    ],
    B = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0],
    E = B.map(
      (b, i) =>
        b -
        [
          5179 / 57600,
          0,
          7571 / 16695,
          393 / 640,
          -92097 / 339200,
          187 / 2100,
          1 / 40,
        ][i],
    );
  function step(y, h, p, c, opt) {
    const k = [derivative(y, p, c, opt)];
    for (let i = 1; i < 7; i++) {
      const z = y.map(
        (v, j) => v + h * A[i].reduce((sum, a, l) => sum + a * k[l][j], 0),
      );
      k.push(derivative(z, p, c, opt));
    }
    const z = y.map(
      (v, j) => v + h * B.reduce((sum, b, i) => sum + b * k[i][j], 0),
    );
    let error = 0;
    for (let j = 0; j < 13; j++) {
      const abs = j < 6 ? 1e-7 : j < 10 ? 1e-9 : 1e-10,
        scale =
          abs +
          (opt.tolerance || 2e-6) * Math.max(Math.abs(y[j]), Math.abs(z[j]));
      error = Math.max(
        error,
        Math.abs(h * E.reduce((sum, e, i) => sum + e * k[i][j], 0)) / scale,
      );
    }
    return { y: z, error };
  }
  function simulate(p, options = {}) {
    const c = coefficients(p),
      start = initial(p, c);
    let y = start,
      t = 0,
      h = 1 / 480,
      lastOutput = -1,
      steps = 0,
      rejected = 0,
      apex = p.height,
      pathLength = 0,
      maxAbsAoA = 0,
      outsideTime = 0;
    const points = [],
      limit = options.maxTime || 35;
    function record() {
      const a = aero(y, p, c);
      points.push({
        t,
        p: y.slice(0, 3),
        v: y.slice(3, 6),
        q: unit(y.slice(6, 10)),
        n: a.n,
        omega: a.omega,
        spin: a.spin,
        phase: a.phase,
        alpha: a.alpha,
        CL: a.CL,
        CD: a.CD,
        CM: a.CM,
        lift: a.lift,
        drag: a.drag,
        pitchMoment: a.pitch,
        rollMoment: a.roll,
        spinMoment: a.spinMoment,
        airspeed: a.airspeed,
      });
      lastOutput = t;
    }
    record();
    let landed = false;
    while (t < limit) {
      if (steps + rejected > 100000)
        throw new Error(
          "Fysikberegningen kræver for mange skridt. Kontrollér koefficienter og release.",
        );
      h = Math.min(h, options.maxStep || 1 / 60, limit - t);
      const next = step(y, h, p, c, options);
      if (!next.y.every(Number.isFinite) || !Number.isFinite(next.error))
        throw new Error(
          "Ustabilt parameterområde. Vælg et standardkoefficientsæt.",
        );
      if (next.error > 1) {
        h *= Math.max(0.15, 0.9 * Math.pow(next.error, -0.2));
        rejected++;
        if (h < 1e-7) throw new Error("For stive aerodynamiske koefficienter.");
        continue;
      }
      let z = next.y,
        dt = h;
      const q = unit(z.slice(6, 10));
      z.splice(6, 4, ...q);
      if (options.stopAtGround !== false && z[1] <= 0) {
        const u = y[1] / (y[1] - z[1]);
        z = y.map((v, i) => v + (z[i] - v) * u);
        z[1] = 0;
        z.splice(6, 4, ...unit(z.slice(6, 10)));
        dt = h * u;
        landed = true;
      }
      pathLength += Math.hypot(z[0] - y[0], z[1] - y[1], z[2] - y[2]);
      y = z;
      t += dt;
      steps++;
      apex = Math.max(apex, y[1]);
      const alpha = Math.abs(aero(y, p, c).alpha);
      maxAbsAoA = Math.max(maxAbsAoA, alpha);
      if (alpha > 25 * D) outsideTime += dt;
      if (len(y.slice(3, 6)) > 300 || len(y.slice(0, 3)) > 5000)
        throw new Error("Beregningen forlod det understøttede område.");
      if (t - lastOutput >= 1 / 120 - 1e-9 || landed || t >= limit) record();
      if (landed) break;
      h *=
        next.error === 0
          ? 2
          : clamp(0.9 * Math.pow(next.error, -0.2), 0.3, 2.5);
    }
    if (!landed && options.stopAtGround !== false)
      throw new Error(
        "Ingen landing inden 35 sekunder. Justér vind eller release.",
      );
    const end = points.at(-1),
      warnings = [];
    if (outsideTime > 0.05)
      warnings.push(
        "Høj angrebsvinkel: " +
          ((100 * outsideTime) / t).toFixed(0) +
          " % af flyvetiden bruger en estimeret stallmodel.",
      );
    return {
      p: { ...p },
      points,
      duration: t,
      distance: Math.hypot(end.p[0], end.p[2]),
      forward: -end.p[2],
      lateral: end.p[0],
      apex,
      pathLength,
      landed,
      coefficients: c,
      model: "sixdof",
      diagnostics: {
        steps,
        rejected,
        maxAbsAoA,
        outsideTime,
        spinRetention: Math.abs(end.spin / points[0].spin),
        warnings,
      },
    };
  }
  function sample(flight, time) {
    const pts = flight.points;
    let lo = 0,
      hi = pts.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (pts[m].t <= time) lo = m;
      else hi = m;
    }
    const a = pts[lo],
      b = pts[hi],
      u = clamp((time - a.t) / Math.max(1e-12, b.t - a.t), 0, 1),
      mix = (x, y) => x.map((v, i) => v + (y[i] - v) * u),
      out = {
        p: mix(a.p, b.p),
        v: mix(a.v, b.v),
        n: unit(mix(a.n, b.n)),
        phase: u < 0.5 ? a.phase : b.phase,
        index: lo,
      };
    if (a.q) {
      const sign = dot(a.q, b.q) < 0 ? -1 : 1;
      out.q = unit(mix(a.q, mul(b.q, sign)));
      out.n = normal(out.q);
      for (const k of [
        "spin",
        "alpha",
        "CL",
        "CD",
        "CM",
        "lift",
        "drag",
        "pitchMoment",
        "rollMoment",
        "spinMoment",
        "airspeed",
      ])
        out[k] = a[k] + (b[k] - a[k]) * u;
      out.omega = mix(a.omega, b.omega);
    }
    return out;
  }
  return {
    simulate,
    sample,
    coefficients,
    names,
    wind,
    density,
    spinSign,
    initial,
    stateInfo,
    aero,
    derivative,
    normal,
    D,
    G,
  };
}

export const Physics5 = createPhysics5();
export default Physics5;
