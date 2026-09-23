import { Lab } from "../data/Lab.js";
import { simulate, loadEngine } from "./engines.js";
export const FlightJobs = (() => {
  let worker = null,
    job = null,
    sequence = 0,
    unavailable = false;
  const cache = new Map(),
    cancelError = () =>
      Object.assign(new Error("Beregning afbrudt."), { name: "AbortError" });
  function cancel() {
    sequence++;
    if (worker) {
      worker.terminate();
      worker = null;
    }
    if (job) {
      clearTimeout(job.timer);
      job.reject(cancelError());
      job = null;
    }
  }
  function ensure() {
    if (worker) return worker;
    if (unavailable || typeof Worker === "undefined") return null;
    try {
      worker = new Worker(new URL("./flight.worker.js", import.meta.url), {
        type: "module",
      });
      return worker;
    } catch (error) {
      console.warn(
        "Worker kunne ikke startes. Beregner på hovedtråden.",
        error,
      );
      unavailable = true;
      return null;
    }
  }
  async function fallback(items, id, onProgress) {
    const result = [];
    for (let i = 0; i < items.length; i++) {
      await new Promise((r) => setTimeout(r, 0));
      if (id !== sequence) throw cancelError();
      try {
        result.push({ flight: await simulate(items[i]) });
      } catch (e) {
        result.push({ error: e.message });
      }
      onProgress((i + 1) / items.length);
    }
    return result;
  }
  async function batch(items, onProgress = () => {}) {
    cancel();
    const id = sequence;
    await Promise.all(
      [...new Set(items.map((p) => p.model || "sixdof"))].map(loadEngine),
    );
    if (id !== sequence) throw cancelError();
    const keys = items.map(Lab.signature),
      out = new Array(items.length),
      missing = [],
      indices = [];
    items.forEach((p, i) => {
      if (cache.has(keys[i]))
        out[i] = {
          flight: {
            ...structuredClone(cache.get(keys[i])),
            p: structuredClone(p),
          },
        };
      else {
        indices.push(i);
        missing.push(p);
      }
    });
    if (missing.length) {
      let result;
      const w = ensure();
      if (w) {
        try {
          result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              if (id !== sequence) return;
              if (worker) worker.terminate();
              worker = null;
              job = null;
              reject(
                new Error(
                  "Beregningen oversteg 45 sekunder. Prøv færre eller enklere variationer.",
                ),
              );
            }, 45000);
            job = { reject, timer };
            w.onmessage = ({ data }) => {
              if (data.id !== id || id !== sequence) return;
              if (data.out) {
                clearTimeout(timer);
                job = null;
                resolve(data.out);
              } else onProgress(data.progress);
            };
            w.onerror = (event) => {
              event.preventDefault?.();
              console.error("Worker-fejl.", event.message);
              unavailable = true;
              if (worker) worker.terminate();
              worker = null;
              clearTimeout(timer);
              job = null;
              reject(new Error("Baggrundsberegning er ikke tilgængelig."));
            };
            w.postMessage({ id, items: missing });
          });
        } catch (e) {
          if (id !== sequence || e.name === "AbortError") throw cancelError();
          if (!unavailable) throw e;
          result = await fallback(missing, id, onProgress);
        }
      } else result = await fallback(missing, id, onProgress);
      if (id !== sequence) throw cancelError();
      indices.forEach((i, j) => {
        out[i] = result[j];
        if (result[j].flight) {
          cache.set(keys[i], structuredClone(result[j].flight));
          while (cache.size > 48) cache.delete(cache.keys().next().value);
        }
      });
    }
    return out;
  }
  return { batch, cancel };
})();
