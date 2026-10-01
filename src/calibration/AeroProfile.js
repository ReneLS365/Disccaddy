import { Aero } from "../physics/Aero.js";

export const PROFILE_SCHEMA = "disc-flight-lab-aero-profile";
const sources = ["baseline", "calibrated", "measured"];

export function materializeAeroProfile(baseline, parameters) {
  const out = structuredClone(baseline);
  out.CL = out.CL.map((v) => v * parameters.liftScale);
  out.CD = out.CD.map((v) => Math.max(0, v * parameters.dragScale));
  out.CM = out.CM.map((v) => v + parameters.momentOffset);
  out.rollDamping = (out.rollDamping ?? -1.3) * parameters.rateDampingScale;
  out.spinDrag = (out.spinDrag ?? 0.00265) * parameters.spinDragScale;
  out.id = `calibrated-${Date.now()}`;
  out.name = `${baseline.name} · kalibreret`;
  out.basis = "Individuel kastkalibrering";
  out.quality = "Kalibreret";
  return out;
}

export function exportProfile(profile) {
  return JSON.stringify(
    { schema: PROFILE_SCHEMA, schemaVersion: 1, ...profile },
    null,
    2,
  );
}
export function importProfile(text) {
  let value;
  try {
    value = typeof text === "string" ? JSON.parse(text) : structuredClone(text);
  } catch {
    throw new Error("Filen indeholder ikke gyldig JSON.");
  }
  if (value?.schema !== PROFILE_SCHEMA || value.schemaVersion !== 1)
    throw new Error("Ukendt eller inkompatibelt kalibreringsformat.");
  if (!value.discId || !value.physical || !value.aero || !value.calibration)
    throw new Error("Kalibreringsprofilen mangler obligatoriske felter.");
  value.aero.snapshot = Aero.snapshot(value.aero.snapshot);
  for (const group of Object.values(value.aero.sources || {}))
    if (!sources.includes(group)) throw new Error("Ugyldig parameterkilde.");
  return value;
}
