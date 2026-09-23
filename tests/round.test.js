import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRound,
  scoreThrow,
  roundRecord,
  isBetter,
  findBest,
  mergeRecords,
  validateRecords,
} from "../src/game/Round.js";
import { BagData } from "../src/data/BagData.js";
import { Lab } from "../src/data/Lab.js";
const p = {
  ...BagData.settingDefault,
  discId: "my-disc",
  discName: "Testdisc",
  targetDistance: 80,
  targetLateral: 0,
  targetRadius: 5,
};
const makeRound = () => createRound(p, Lab.variations(p, 8));
const flight = (x, forward = 80, aim = 0) => ({
  p: { aim },
  points: [{ p: [x, 0, -forward] }],
});

test("Importkonflikt: rekorden følger discens nye id", () => {
  const disc = BagData.disc({
    id: p.discId,
    name: "Original",
    speed: 9,
    glide: 5,
    turn: -1,
    fade: 2,
  });
  const imported = { ...disc, name: "Anden disc" },
    round = makeRound();
  for (let i = 0; i < 8; i++) scoreThrow(round, flight(0));
  const incoming = {
    ...BagData.empty(),
    bag: [imported],
    rounds: [roundRecord(round)],
  };
  const result = BagData.merge({ ...BagData.empty(), bag: [disc] }, incoming);
  const newDisc = result.data.bag.find((d) => d.name === "Anden disc");
  assert.notEqual(newDisc.id, disc.id);
  assert.equal(result.data.rounds[0].discId, newDisc.id);
});
test("Målgrænse, gennemsnit og streak: et miss nulstiller straks", () => {
  const round = makeRound();
  [0, 3, 5, 8, 1, 2, 3, 4].forEach((x) => scoreThrow(round, flight(x)));
  assert.equal(round.hits, 7);
  assert.equal(round.streak, 4);
  assert.equal(round.maxStreak, 4);
  assert.equal(roundRecord(round).averageMiss, 26 / 8);
  assert.throws(() => scoreThrow(round, flight(0)), /afsluttet/);
});
test("Ændret sigteretning roteres tilbage til rundens faste mål", () => {
  const round = makeRound();
  const a = (10 * Math.PI) / 180;
  const result = scoreThrow(
    round,
    flight(-80 * Math.sin(a), 80 * Math.cos(a), 10),
  );
  assert.ok(result.miss < 1e-10);
  assert.equal(result.hit, true);
});
test("Rekord: flest træffere, derefter mindste gennemsnit", () => {
  assert.ok(isBetter({ hits: 7, averageMiss: 5 }, { hits: 6, averageMiss: 1 }));
  assert.ok(isBetter({ hits: 7, averageMiss: 4 }, { hits: 7, averageMiss: 5 }));
  assert.ok(
    !isBetter({ hits: 6, averageMiss: 0 }, { hits: 7, averageMiss: 10 }),
  );
  assert.ok(
    !isBetter({ hits: 7, averageMiss: 4 }, { hits: 7, averageMiss: 4 }),
  );
});
test("Ufuldstændige runder og ugyldige landinger skaber ingen rekord", () => {
  const round = makeRound();
  assert.throws(() => roundRecord(round), /færdige/);
  assert.throws(() => scoreThrow(round, flight(NaN)), /landingspunkt/);
  assert.equal(round.throws.length, 0);
});
test("Rekorder holdes adskilt pr. disc og målopsætning og bevares i backup", () => {
  const round = makeRound();
  for (let i = 0; i < 8; i++) scoreThrow(round, flight(i));
  const record = roundRecord(round),
    data = { ...BagData.empty(), rounds: [record] };
  const restored = BagData.validate(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(findBest(restored.rounds, p), record);
  assert.equal(findBest(restored.rounds, { ...p, discId: "other" }), undefined);
  assert.equal(
    findBest(restored.rounds, { ...p, targetRadius: 10 }),
    undefined,
  );
  assert.equal(mergeRecords([record], [{ ...record, hits: 8 }])[0].hits, 8);
  assert.deepEqual(BagData.validate(BagData.empty()).rounds, []);
  assert.throws(() => validateRecords([{ ...record, hits: 9 }]), /Ugyldig/);
});
