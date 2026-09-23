import { Lab } from "../data/Lab.js";
import {
  createRound,
  scoreThrow,
  roundRecord,
  mergeRecords,
  findBest,
  isBetter,
  ROUND_SIZE,
} from "../game/Round.js";

export function mountRound({
  readSettings,
  calculate,
  getRecords,
  saveRecords,
  showFlight,
  toast,
}) {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toFixed(1).replace(".", ",");
  let round = null,
    busy = false,
    running = false,
    generation = 0;
  const error = (message) => {
    $("roundError").textContent = message;
    $("roundError").hidden = !message;
  };
  function render() {
    $("roundGrid").replaceChildren();
    for (let i = 0; i < ROUND_SIZE; i++) {
      const t = round?.throws[i],
        cell = document.createElement("div");
      cell.className =
        "round-cell " + (t ? (t.hit ? "hit" : "miss") : "pending");
      const title = document.createElement("strong"),
        value = document.createElement("span");
      title.textContent = t
        ? `${i + 1} · ${t.hit ? "Ramt" : "Forbi"}`
        : `Kast ${i + 1}`;
      value.textContent = t ? `${fmt(t.miss)} m` : "—";
      cell.append(title, value);
      $("roundGrid").append(cell);
    }
    const count = round?.throws.length || 0;
    $("roundStreak").textContent = `${round?.streak || 0} i træk`;
    $("roundScore").textContent = round
      ? `${round.hits} / ${count} ramt${count ? " · gennemsnit " + fmt(round.totalMiss / count) + " m fra centrum" : ""}${round.complete ? " · Runde slut" : ""}`
      : "Klar til en runde.";
    $("roundThrow").textContent = round?.complete
      ? "Runde afsluttet"
      : `Kast ${count + 1} / 8`;
    $("roundThrow").disabled = busy || running || !round || round.complete;
    $("startRound").disabled = busy || running || (!!round && !round.complete);
    $("startRound").textContent = round?.complete ? "Ny runde" : "Start runde";
  }
  function best(p) {
    const r = findBest(getRecords(), p);
    $("roundBest").textContent = r
      ? `Bedst med denne disc og målopsætning: ${r.hits} / 8 · ${fmt(r.averageMiss)} m fra centrum.`
      : "Ingen rekord med denne disc og målopsætning endnu.";
  }
  $("startRound").onclick = () => {
    try {
      const p = readSettings();
      round = createRound(p, Lab.variations(p, ROUND_SIZE));
      generation++;
      error("");
      best(p);
      $("roundTarget").textContent =
        `${p.discName || "Egen disc"} · mål ${fmt(p.targetDistance)} m frem / ${fmt(p.targetLateral)} m til højre · radius ${fmt(p.targetRadius)} m.`;
      render();
      $("roundThrow").focus();
    } catch (e) {
      error(e.message);
    }
  };
  $("roundThrow").onclick = async () => {
    if (busy || running || !round || round.complete) return;
    const token = generation,
      current = round;
    running = true;
    error("");
    render();
    try {
      const result = await calculate(
        [current.variants[current.throws.length]],
        `Runde · kast ${current.throws.length + 1} / 8…`,
      );
      if (token !== generation) return;
      if (result[0].error) throw new Error(result[0].error);
      scoreThrow(current, result[0].flight);
      showFlight(result[0].flight);
      render();
      if (current.complete) {
        const record = roundRecord(current),
          previous = findBest(getRecords(), current.settings);
        if (isBetter(record, previous)) {
          const saved = await saveRecords(mergeRecords(getRecords(), [record]));
          if (token !== generation) return;
          if (saved)
            toast(
              `Ny rekord: ${record.hits} / 8 ramt · ${fmt(record.averageMiss)} m fra centrum.`,
            );
          else
            error(
              "Rekorden findes kun i denne session. Eksportér en backup før du lukker appen.",
            );
        }
        if (token === generation) best(current.settings);
      }
    } catch (e) {
      if (token === generation)
        error(
          e.name === "AbortError"
            ? "Kast afbrudt. Prøv kastet igen."
            : e.message,
        );
    } finally {
      running = false;
      render();
    }
  };
  render();
  return {
    setBusy(value) {
      busy = value;
      render();
    },
    invalidate() {
      generation++;
      if (round && !round.complete)
        error("Indstillinger ændret. Start en ny runde.");
      round = null;
      $("roundTarget").textContent = "";
      $("roundBest").textContent = "";
      render();
    },
  };
}
