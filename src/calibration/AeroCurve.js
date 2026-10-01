const finite = (v, name) => {
  if (!Number.isFinite(v))
    throw new Error(`${name} skal være et endeligt tal.`);
  return v;
};

/** Continuous, allocation-free piecewise-linear coefficient curve. */
export class AeroCurve {
  constructor(axis, values, { minimum = -Infinity, maximum = Infinity } = {}) {
    if (
      !Array.isArray(axis) ||
      axis.length < 2 ||
      axis.length !== values?.length
    )
      throw new Error("En aerokurve kræver mindst to matchende punkter.");
    this.axis = axis.map((v, i) => {
      finite(v, "Kurveakse");
      if (i && v <= axis[i - 1])
        throw new Error("Kurveaksen skal være strengt stigende.");
      return v;
    });
    this.values = values.map((v) =>
      Math.max(minimum, Math.min(maximum, finite(v, "Koefficient"))),
    );
    this.minimum = minimum;
    this.maximum = maximum;
  }

  at(x) {
    finite(x, "Kurveinput");
    const a = this.axis;
    if (x <= a[0]) return this.values[0];
    if (x >= a.at(-1)) return this.values.at(-1);
    let lo = 0,
      hi = a.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (a[m] > x) hi = m;
      else lo = m;
    }
    const u = (x - a[lo]) / (a[hi] - a[lo]);
    return this.values[lo] + u * (this.values[hi] - this.values[lo]);
  }

  toJSON() {
    return {
      kind: "piecewise-linear",
      axis: [...this.axis],
      values: [...this.values],
    };
  }
}
