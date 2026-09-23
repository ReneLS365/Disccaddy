export const ROUND_SIZE = 8;
const challengeFields = [
  "model",
  "aim",
  "targetDistance",
  "targetLateral",
  "targetRadius",
  "windSpeed",
  "windFrom",
  "temperature",
  "altitude",
  "humidity",
  "spreadPower",
  "spreadAngle",
  "spreadSpin",
  "spreadWind",
  "spreadLaunch",
  "spreadAim",
];

// Release tuning is the player's choice. Targets, wind, model and spread define the challenge.
export function challengeKey(p) {
  return JSON.stringify(challengeFields.map((key) => p[key] ?? null));
}
export function discKey(p) {
  return p.discId && p.discId !== "custom"
    ? p.discId
    : "custom:" +
        JSON.stringify([
          p.discName || "",
          p.discBrand || "",
          p.speed,
          p.glide,
          p.turn,
          p.fade,
        ]);
}
export function createRound(p, variations) {
  if (!Array.isArray(variations) || variations.length !== ROUND_SIZE)
    throw new Error("En runde skal have præcis otte kast.");
  return {
    settings: structuredClone(p),
    variants: structuredClone(variations),
    throws: [],
    hits: 0,
    streak: 0,
    maxStreak: 0,
    totalMiss: 0,
    complete: false,
  };
}
export function scoreThrow(round, flight) {
  if (round.complete)
    throw new Error("Runden er afsluttet. Start en ny runde.");
  const end = flight?.points?.at(-1)?.p;
  if (!end || end.length !== 3 || !end.every(Number.isFinite))
    throw new Error("Kastet har intet gyldigt landingspunkt.");
  const p = round.settings,
    a = (((flight.p.aim ?? p.aim) - p.aim) * Math.PI) / 180;
  const x = end[0] * Math.cos(a) - end[2] * Math.sin(a);
  const z = end[0] * Math.sin(a) + end[2] * Math.cos(a);
  const miss = Math.hypot(x - p.targetLateral, -z - p.targetDistance),
    hit = miss <= p.targetRadius;
  const result = { number: round.throws.length + 1, hit, miss, x, forward: -z };
  round.throws.push(result);
  round.hits += Number(hit);
  round.streak = hit ? round.streak + 1 : 0;
  round.maxStreak = Math.max(round.maxStreak, round.streak);
  round.totalMiss += miss;
  round.complete = round.throws.length === ROUND_SIZE;
  return result;
}
export function roundRecord(round, now = new Date().toISOString()) {
  if (!round.complete)
    throw new Error("Kun færdige runder kan gemmes som rekord.");
  return {
    discId: discKey(round.settings),
    discName: round.settings.discName || "Egen disc",
    challenge: challengeKey(round.settings),
    hits: round.hits,
    averageMiss: round.totalMiss / ROUND_SIZE,
    maxStreak: round.maxStreak,
    playedAt: now,
    total: ROUND_SIZE,
  };
}
export function isBetter(candidate, current) {
  return (
    !current ||
    candidate.hits > current.hits ||
    (candidate.hits === current.hits &&
      candidate.averageMiss < current.averageMiss)
  );
}
export function findBest(records, p) {
  return (records || []).find(
    (r) => r.discId === discKey(p) && r.challenge === challengeKey(p),
  );
}
export function validateRecords(input = []) {
  if (!Array.isArray(input) || input.length > 2000)
    throw new Error("Ugyldig liste over runderekorder.");
  const result = [];
  for (const r of input) {
    if (
      !r ||
      typeof r.discId !== "string" ||
      !r.discId ||
      r.discId.length > 600 ||
      typeof r.challenge !== "string" ||
      r.challenge.length > 4000 ||
      !Number.isInteger(r.hits) ||
      r.hits < 0 ||
      r.hits > ROUND_SIZE ||
      typeof r.averageMiss !== "number" ||
      !Number.isFinite(r.averageMiss) ||
      r.averageMiss < 0 ||
      !Number.isInteger(r.maxStreak) ||
      r.maxStreak < 0 ||
      r.maxStreak > r.hits ||
      r.total !== ROUND_SIZE ||
      typeof r.playedAt !== "string" ||
      !Number.isFinite(Date.parse(r.playedAt))
    )
      throw new Error("Ugyldig runderekord i backup.");
    const record = {
      discId: r.discId,
      discName: String(r.discName || "").slice(0, 80),
      challenge: r.challenge,
      hits: r.hits,
      averageMiss: r.averageMiss,
      maxStreak: r.maxStreak,
      total: ROUND_SIZE,
      playedAt: r.playedAt,
    };
    const i = result.findIndex(
      (x) => x.discId === record.discId && x.challenge === record.challenge,
    );
    if (i < 0) result.push(record);
    else if (isBetter(record, result[i])) result[i] = record;
  }
  return result;
}
export function mergeRecords(current = [], incoming = []) {
  const result = validateRecords(current);
  for (const r of validateRecords(incoming)) {
    const i = result.findIndex(
      (x) => x.discId === r.discId && x.challenge === r.challenge,
    );
    if (i < 0) result.push(r);
    else if (isBetter(r, result[i])) result[i] = r;
  }
  return result
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    .slice(0, 2000);
}
