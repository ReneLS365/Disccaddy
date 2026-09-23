export const Release = (() => {
  const styles = {
    R: { BH: "RHBH", FH: "RHFH" },
    L: { BH: "LHBH", FH: "LHFH" },
  };
  const method = (s) =>
    s.method || ((s.style || "RHBH").endsWith("FH") ? "FH" : "BH");
  const speed = (pct, max) => (pct * max) / 100;
  function resolve(s, p) {
    const m = method(s),
      hand = p?.hand || s.hand || "R",
      max = p ? p[m === "BH" ? "bhPower" : "fhPower"] : s.maxPower;
    return {
      ...s,
      method: m,
      hand,
      maxPower: max,
      power: speed(s.powerPct, max),
      style: styles[hand][m],
    };
  }
  return { styles, method, speed, resolve };
})();
