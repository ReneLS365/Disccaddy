import { Flight } from "../physics/engines.js";
import { palette } from "./theme.js";
export function drawFallback({
  $,
  flights,
  settings,
  active,
  lastPoint,
  playhead,
  sceneVector,
  compareColors,
  phaseColors,
}) {
  const colors = palette();
  const canvas = $("fallback"),
    r = $("stage").getBoundingClientRect(),
    w = r.width,
    h = r.height;
  if (w < 1 || h < 1) return;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const pw = Math.round(w * dpr),
    ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);
  if (!flights.length) return;
  const xs = [
      -7,
      7,
      settings.targetLateral - settings.targetRadius,
      settings.targetLateral + settings.targetRadius,
    ],
    zs = [
      -10,
      3,
      -settings.targetDistance - settings.targetRadius,
      -settings.targetDistance + settings.targetRadius,
    ];
  for (const f of flights)
    for (const p of f.points) {
      const v = sceneVector(f, p.p);
      xs.push(v[0]);
      zs.push(v[2]);
    }
  const xmin = Math.min(...xs),
    xmax = Math.max(...xs),
    zmin = Math.min(...zs),
    zmax = Math.max(...zs);
  const top = 20,
    bottom = 25;
  const availH = Math.max(48, h - top - bottom),
    scale = Math.max(
      0.04,
      Math.min(
        (w - 54) / Math.max(12, xmax - xmin),
        availH / Math.max(12, zmax - zmin),
      ) * 0.85,
    );
  const cx = (xmin + xmax) / 2,
    cz = (zmin + zmax) / 2,
    cy = top + availH / 2;
  const project = (p) => [
    w / 2 + (p[0] - cx) * scale,
    cy + (p[2] - cz) * scale,
  ];
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.grid;
  ctx.beginPath();
  const gridSize = scale < 1 ? 25 : 10;
  for (
    let x = Math.floor(xmin / gridSize) * gridSize - gridSize;
    x <= xmax + gridSize;
    x += gridSize
  ) {
    const a = project([x, 0, zmin - 20]),
      b = project([x, 0, zmax + 20]);
    ctx.moveTo(...a);
    ctx.lineTo(...b);
  }
  for (
    let z = Math.floor(zmin / gridSize) * gridSize - gridSize;
    z <= zmax + gridSize;
    z += gridSize
  ) {
    const a = project([xmin - 20, 0, z]),
      b = project([xmax + 20, 0, z]);
    ctx.moveTo(...a);
    ctx.lineTo(...b);
  }
  ctx.stroke();
  const target = project([settings.targetLateral, 0, -settings.targetDistance]);
  ctx.beginPath();
  ctx.arc(...target, settings.targetRadius * scale, 0, Math.PI * 2);
  ctx.strokeStyle = colors.lime;
  ctx.stroke();
  ctx.fillStyle = colors.lime;
  ctx.font = "10px system-ui";
  ctx.fillText("Mål", target[0] + 5, target[1] - 5);
  const tee = project([0, 0, 0]);
  ctx.fillStyle = colors.muted;
  ctx.fillRect(tee[0] - 3, tee[1] - 3, 6, 6);
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("TEE", tee[0], tee[1] + 17);
  flights.forEach((f, i) => {
    ctx.beginPath();
    f.points.forEach((p, k) => {
      const xy = project(sceneVector(f, p.p));
      if (k === 0) ctx.moveTo(...xy);
      else ctx.lineTo(...xy);
    });
    ctx.strokeStyle =
      flights.length > 1
        ? [colors.cyan, colors.lime, colors.amber][i % 3]
        : colors.trace;
    ctx.lineWidth = i === active ? 2 : 1.6;
    ctx.globalAlpha = i === active ? 0.6 : 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    const end = project(sceneVector(f, f.points.at(-1).p));
    ctx.beginPath();
    ctx.arc(...end, 4, 0, Math.PI * 2);
    ctx.stroke();
  });
  const f = flights[active],
    point = lastPoint || Flight.sample(f, playhead);
  for (let i = 1; i <= point.index && i < f.points.length; i++) {
    ctx.beginPath();
    ctx.moveTo(...project(sceneVector(f, f.points[i - 1].p)));
    ctx.lineTo(...project(sceneVector(f, f.points[i].p)));
    ctx.strokeStyle =
      flights.length > 1
        ? [colors.cyan, colors.lime, colors.amber][active % 3]
        : { Turn: colors.cyan, Glide: colors.lime, Fade: colors.amber }[
            f.points[i].phase
          ];
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  const xy = project(sceneVector(f, point.p));
  ctx.beginPath();
  ctx.arc(...xy, 5, 0, Math.PI * 2);
  ctx.fillStyle = f.p.discColor || colors.lime;
  ctx.fill();
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 1;
  ctx.stroke();
  const wind = sceneVector(f, Flight.wind(f.p));
  if (f.p.windSpeed > 0.01) {
    const a = [w - 33, 34],
      mag = Math.hypot(wind[0], wind[2]),
      u = [wind[0] / mag, wind[2] / mag],
      b = [a[0] + u[0] * 22, a[1] + u[1] * 22];
    ctx.strokeStyle = colors.amber;
    ctx.fillStyle = colors.amber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a[0] - u[0] * 12, a[1] - u[1] * 12);
    ctx.lineTo(...b);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(...b);
    ctx.lineTo(b[0] - u[0] * 7 - u[1] * 4, b[1] - u[1] * 7 + u[0] * 4);
    ctx.lineTo(b[0] - u[0] * 7 + u[1] * 4, b[1] - u[1] * 7 - u[0] * 4);
    ctx.closePath();
    ctx.fill();
  }
}
