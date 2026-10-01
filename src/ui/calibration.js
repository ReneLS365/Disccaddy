import { Aero } from "../physics/Aero.js";
import { calibrateDisc } from "../calibration/CalibrationPipeline.js";
import {
  normalizeThrow,
  datasetCoverage,
  observability,
} from "../calibration/CalibrationDataset.js";
import { exportProfile, importProfile } from "../calibration/AeroProfile.js";

const fmt = (v, digits = 2) => (v == null ? "—" : Number(v).toFixed(digits));
export function mountCalibration({
  getSettings,
  getFlights,
  applyProfile,
  toast,
}) {
  const $ = (id) => document.getElementById(id);
  let result = null;
  const metric = (label, value, note = "") =>
    `<article><small>${label}</small><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</article>`;
  function parse() {
    const value = JSON.parse($("calibrationData").value);
    if (!Array.isArray(value))
      throw new Error("Datasættet skal være en JSON-liste.");
    return value.map(normalizeThrow);
  }
  function inspect() {
    try {
      const data = parse(),
        c = datasetCoverage(data),
        o = observability(data);
      $("coverageMetrics").innerHTML =
        metric("Kast", data.length) +
        metric("Coverage", c.rating) +
        metric(
          "Fart",
          c.speedMs
            ? `${fmt(c.speedMs[0], 1)}–${fmt(c.speedMs[1], 1)} m/s`
            : "—",
        ) +
        metric(
          "Spin",
          c.spinRadS
            ? `${fmt(c.spinRadS[0], 0)}–${fmt(c.spinRadS[1], 0)} rad/s`
            : "—",
        ) +
        Object.entries(o)
          .map(([k, v]) => metric(k, v))
          .join("");
    } catch (e) {
      $("coverageMetrics").textContent = e.message;
    }
  }
  $("calibrationData").addEventListener("change", inspect);
  $("calibrationExample").onclick = () => {
    const settings = getSettings(),
      flights = getFlights();
    const source = flights.length ? flights.slice(0, 2) : [];
    $("calibrationData").value = JSON.stringify(
      source.map((f, i) => ({
        id: `kast-${i + 1}`,
        discId: settings.discName,
        split: i ? "validation" : "training",
        simulatorInput: f.p,
        observations: f.points
          .filter((_, j) => j % 12 === 0)
          .map((p) => ({
            timestamp: p.t,
            position: p.p,
            velocity: p.v,
            orientation: p.q,
            spinRate: p.spin,
          })),
      })),
      null,
      2,
    );
    inspect();
    toast(
      source.length < 2
        ? "Kør og sammenlign mindst to kast først."
        : "Syntetisk skabelon oprettet. Målinger skal erstatte disse data.",
    );
  };
  $("runCalibration").onclick = async () => {
    try {
      const throws = parse();
      if (throws.filter((t) => t.split === "training").length < 2)
        throw new Error("Vælg mindst to training-kast.");
      const settings = getSettings(),
        baseline = Aero.resolve(settings),
        progress = $("calibrationProgress");
      progress.hidden = false;
      $("runCalibration").disabled = true;
      result = await calibrateDisc({
        discId: settings.discName || "disc",
        throws,
        baselineProfile: baseline,
        physical: {
          massKg: settings.weight / 1000,
          diameterM: baseline.diameter,
          areaM2: (Math.PI * baseline.diameter ** 2) / 4,
          inertia: {
            Ixx: (baseline.Jtrans * settings.weight) / 1000,
            Iyy: (baseline.Jtrans * settings.weight) / 1000,
            Izz: (baseline.Jax * settings.weight) / 1000,
          },
        },
        onProgress: (p, stage) => {
          progress.value = p;
          $("calibrationMessage").textContent = stage;
        },
      });
      localStorage.setItem(
        `dfl-calibration:${result.profile.discId}`,
        exportProfile(result.profile),
      );
      await applyProfile(result.profile);
      render();
      toast("Kalibreringsprofil gemt lokalt.");
    } catch (e) {
      $("calibrationMessage").textContent = e.message;
      toast(e.message);
    } finally {
      $("runCalibration").disabled = false;
      $("calibrationProgress").hidden = true;
    }
  };
  function render() {
    const c = result.profile.calibration;
    $("calibrationStatus").textContent = c.confidence + " confidence";
    $("calibrationMetrics").innerHTML =
      metric("Training RMSE", `${fmt(c.trainingError)} m`) +
      metric(
        "Validation RMSE",
        c.validationError == null
          ? "Ikke tilgængelig"
          : `${fmt(c.validationError)} m`,
        c.overfitting ? "Mulig overfitting" : "",
      ) +
      metric("Kast / samples", `${c.throwCount} / ${c.sampleCount}`) +
      metric("Coverage", c.coverage.rating) +
      Object.entries(result.profile.aero.parameters)
        .map(([k, v]) =>
          metric(
            k,
            fmt(v, 4),
            `± ${fmt(c.parameterUncertainty[k], 4)} · ${c.parameterConstraint[k]}`,
          ),
        )
        .join("");
    $("exportCalibration").disabled = false;
    draw(result.comparisons[0]);
  }
  function draw(comparison) {
    const canvas = $("calibrationChart"),
      ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!comparison) return;
    const sets = [
        [
          comparison.trajectories.observed.map((p) => ({ p: p.position })),
          "#fff",
        ],
        [comparison.trajectories.before, "#ffba76"],
        [comparison.trajectories.after, "#70dfef"],
      ],
      pts = sets.flatMap(([x]) => x);
    const xs = pts.map((p) => -p.p[2]),
      ys = pts.map((p) => p.p[1]),
      maxX = Math.max(1, ...xs),
      maxY = Math.max(1, ...ys);
    sets.forEach(([set, color]) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      set.forEach((p, i) => {
        const x = 20 + (-p.p[2] / maxX) * (canvas.width - 40),
          y = canvas.height - 20 - (p.p[1] / maxY) * (canvas.height - 40);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
  }
  $("exportCalibration").onclick = () => {
    const blob = new Blob([exportProfile(result.profile)], {
        type: "application/json",
      }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.profile.discId}-aero-profile.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $("importCalibration").onchange = async (e) => {
    try {
      const profile = importProfile(await e.target.files[0].text());
      localStorage.setItem(
        `dfl-calibration:${profile.discId}`,
        exportProfile(profile),
      );
      await applyProfile(profile);
      result = { profile, comparisons: [] };
      render();
      toast("Profil importeret og valideret.");
    } catch (error) {
      toast(error.message);
    }
    e.target.value = "";
  };
}
