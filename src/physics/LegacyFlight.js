function legacyFlightFactory() {
  "use strict";
  const D = Math.PI / 180,
    DT = 1 / 240;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const add = (a, b) => a.map((n, i) => n + b[i]);
  const mul = (a, k) => a.map((n) => n * k);
  const dot = (a, b) => a.reduce((s, n, i) => s + n * b[i], 0);
  const len = (a) => Math.hypot(...a);
  const unit = (a) => mul(a, 1 / Math.max(len(a), 1e-12));
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const smooth = (a, b, x) => {
    const u = clamp((x - a) / (b - a), 0, 1);
    return u * u * (3 - 2 * u);
  };
  const wrap = (a) => ((a % 360) + 360) % 360;
  // World: +Y up, -Z along the intended throw, +X to the thrower's right.
  // Compass bearings are clockwise from north. Wind bearing means FROM.
  function wind(p) {
    const a = (p.windFrom - p.aim) * D;
    return [-p.windSpeed * Math.sin(a), 0, p.windSpeed * Math.cos(a)];
  }
  const spinSign = (style) => (style === "RHBH" || style === "LHFH" ? 1 : -1);
  function normalFor(p) {
    const pitch = (p.launch + 3 + p.nose) * D,
      bank = -spinSign(p.style) * p.hyzer * D; // Historisk +3°-kalibrering, bevidst forskellig fra Physics5/6. Må IKKE ændres — påvirker afspilning af gamle "legacy"-kast.
    return [
      Math.sin(bank),
      Math.cos(pitch) * Math.cos(bank),
      Math.sin(pitch) * Math.cos(bank),
    ];
  }
  function forces(s, p, t) {
    const velocity = s.slice(3, 6),
      relative = add(velocity, mul(wind(p), -1));
    const speed = len(relative),
      direction = unit(relative),
      normal = unit(s.slice(6, 9));
    const horizontal = Math.hypot(relative[0], relative[2]);
    const forward =
      horizontal > 1e-8
        ? [relative[0] / horizontal, 0, relative[2] / horizontal]
        : [0, 0, -1];
    const right = [-forward[2], 0, forward[0]],
      ndv = dot(normal, direction);
    const alpha = Math.asin(clamp(-ndv, -1, 1));
    const stall = 1 - 0.65 * smooth(18 * D, 65 * D, Math.abs(alpha));
    const cl = clamp(
      (0.1 + 1.5 * alpha) * (0.72 + 0.08 * p.glide) * stall,
      -0.9,
      0.9,
    );
    const cd =
      0.025 +
      (0.065 * (14 - p.speed)) / 13 +
      0.25 * cl * cl +
      0.65 * Math.sin(alpha) ** 2;
    const q =
      (0.5 * 1.225 * speed * speed * Math.PI * 0.105 ** 2) / (p.weight / 1000);
    // Projecting the normal removes the along-velocity component of lift.
    const liftDirection = unit(add(normal, mul(direction, -ndv)));
    const cruise = 10 + 1.35 * p.speed,
      ratio = speed / cruise;
    const turn = q * 0.014 * -p.turn * smooth(1, 1.22, ratio);
    // Inverse-speed fade with a finite, zero-force limit at zero airspeed.
    const fade =
      ((0.65 * p.fade + 0.5 * Math.max(0, 1 - ratio)) *
        (1 - smooth(0.5, 1, ratio)) *
        cruise *
        speed) /
      (speed * speed + 16);
    const sign = spinSign(p.style),
      steering = sign * (turn - fade);
    const acceleration = add(
      add(mul(liftDirection, q * cl), mul(direction, -q * cd)),
      mul(right, steering),
    );
    acceleration[1] -= 9.81;
    // Reduced-order gyroscopic precession. The normal is an integrated state;
    // it does not instantly yaw or pitch to follow a changing relative wind.
    const groundForward = unit([velocity[0], 0, velocity[2]]);
    let rate = clamp(
      0.035 * steering * (600 / p.rpm) * Math.exp(0.04 * t),
      -0.85,
      0.85,
    );
    let dn = mul(
      cross(len(groundForward) > 0.5 ? groundForward : [0, 0, -1], normal),
      rate,
    );
    if (normal[1] <= Math.cos(85 * D) && dn[1] < 0) dn = [0, 0, 0];
    const phase =
      fade > Math.max(0, turn) + 0.15
        ? "Fade"
        : turn > fade + 0.15
          ? "Turn"
          : "Glide";
    return {
      derivative: [...velocity, ...acceleration, ...dn],
      normal,
      phase,
      airspeed: speed,
    };
  }
  function simulate(p, dt = DT) {
    let s = [
        0,
        p.height,
        0,
        0,
        p.power * Math.sin(p.launch * D),
        -p.power * Math.cos(p.launch * D),
        ...normalFor(p),
      ],
      t = 0;
    const points = [];
    function record() {
      const f = forces(s, p, t);
      points.push({
        t,
        p: s.slice(0, 3),
        v: s.slice(3, 6),
        n: f.normal,
        phase: f.phase,
      });
    }
    record();
    for (let k = 0; k < Math.ceil(35 / dt); k++) {
      const a = forces(s, p, t).derivative;
      const mid = s.map((x, i) => x + (a[i] * dt) / 2);
      const b = forces(mid, p, t + dt / 2).derivative;
      let next = s.map((x, i) => x + b[i] * dt),
        nextTime = t + dt;
      if (!next.every(Number.isFinite))
        throw new Error(
          "Kastet kunne ikke beregnes. Kontrollér indstillingerne.",
        );
      let n = unit(next.slice(6, 9));
      if (n[1] < Math.cos(85 * D)) {
        const h = Math.hypot(n[0], n[2]);
        n = [
          (n[0] / Math.max(h, 1e-9)) * Math.sin(85 * D),
          Math.cos(85 * D),
          (n[2] / Math.max(h, 1e-9)) * Math.sin(85 * D),
        ];
      }
      next.splice(6, 3, ...n);
      if (next[1] <= 0) {
        const fraction = s[1] / (s[1] - next[1]);
        next = s.map((x, i) => x + (next[i] - x) * fraction);
        next[1] = 0;
        nextTime = t + dt * fraction;
      }
      s = next;
      t = nextTime;
      record();
      if (s[1] <= 0) {
        const end = points.at(-1).p;
        return {
          p: { ...p },
          points,
          duration: t,
          distance: Math.hypot(end[0], end[2]),
          lateral: end[0],
          apex: Math.max(...points.map((v) => v.p[1])),
        };
      }
    }
    throw new Error(
      "Kastet oversteg modellens grænse på 35 sekunder. Prøv mindre vind eller en lavere udgangsvinkel.",
    );
  }
  function sample(flight, time) {
    const points = flight.points;
    let lo = 0,
      hi = points.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (points[m].t <= time) lo = m;
      else hi = m;
    }
    const a = points[lo],
      b = points[hi],
      u = clamp((time - a.t) / Math.max(1e-9, b.t - a.t), 0, 1);
    const mix = (x, y) => x.map((n, i) => n + (y[i] - n) * u);
    return {
      p: mix(a.p, b.p),
      v: mix(a.v, b.v),
      n: unit(mix(a.n, b.n)),
      phase: u < 0.5 ? a.phase : b.phase,
      index: lo,
    };
  }
  return {
    D,
    DT,
    clamp,
    add,
    mul,
    dot,
    len,
    unit,
    cross,
    smooth,
    wrap,
    wind,
    spinSign,
    normalFor,
    forces,
    simulate,
    sample,
  };
}

export const LegacyFlight = legacyFlightFactory();
export default LegacyFlight;
