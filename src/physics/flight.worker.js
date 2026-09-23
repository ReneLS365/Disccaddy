import { simulate } from "./engines.js";

self.onmessage = async ({ data }) => {
  const out = [];
  for (let i = 0; i < data.items.length; i++) {
    try {
      out.push({ flight: await simulate(data.items[i]) });
    } catch (error) {
      out.push({ error: error.message || "Kastet kunne ikke beregnes." });
    }
    self.postMessage({ id: data.id, progress: (i + 1) / data.items.length });
  }
  self.postMessage({ id: data.id, out });
};
