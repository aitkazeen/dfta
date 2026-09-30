import { describe, it, expect } from "vitest";
import {
  fitMultinomial,
  predictClass,
  predictProba,
  type LabeledRow,
} from "./logreg";

// Детерминированный ГПСЧ, чтобы тест не мигал.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Три линейно разделимых гауссовых кластера в 2D — модель обязана их выучить.
function makeSeparable(rng: () => number): LabeledRow[] {
  const centers = [
    [3, 0],
    [-3, 3],
    [-3, -3],
  ];
  const rows: LabeledRow[] = [];
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < 100; i++)
      rows.push({
        x: [centers[k][0] + (rng() - 0.5), centers[k][1] + (rng() - 0.5)],
        y: k,
      });
  return rows;
}

describe("fitMultinomial", () => {
  it("learns linearly separable 3-class data (train accuracy > 0.95)", () => {
    const rows = makeSeparable(mulberry32(42));
    const model = fitMultinomial(rows, {
      iterations: 400,
      lr: 0.5,
      lambda: 0.01,
    });
    const correct = rows.filter((r) => predictClass(model, r.x) === r.y).length;
    expect(correct / rows.length).toBeGreaterThan(0.95);
  });

  it("returns a valid probability simplex (sums to 1, all >= 0)", () => {
    const rows = makeSeparable(mulberry32(7));
    const model = fitMultinomial(rows, { iterations: 100 });
    const p = predictProba(model, [3, 0]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    for (const x of p) expect(x).toBeGreaterThanOrEqual(0);
    expect(p[0]).toBeGreaterThan(p[1]); // near class-0 center
  });

  it("strong L2 shrinks non-bias weights toward zero", () => {
    const rows = makeSeparable(mulberry32(1));
    const weak = fitMultinomial(rows, { iterations: 300, lambda: 0.001 });
    const strong = fitMultinomial(rows, { iterations: 300, lambda: 1000 });
    const norm = (m: number[][]) =>
      m.reduce((s, wk) => s + wk.slice(1).reduce((a, b) => a + b * b, 0), 0);
    expect(norm(strong.weights)).toBeLessThan(norm(weak.weights));
  });

  it("standardization handles a constant feature without NaN", () => {
    const rows: LabeledRow[] = [
      { x: [1, 5], y: 0 },
      { x: [2, 5], y: 1 },
      { x: [3, 5], y: 1 },
    ];
    const model = fitMultinomial(rows, { iterations: 50 });
    const p = predictProba(model, [2, 5]);
    expect(p.every((x) => Number.isFinite(x))).toBe(true);
  });
});
