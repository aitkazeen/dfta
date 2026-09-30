/**
 * Многоклассовая (multinomial) логистическая регрессия с L2, обучаемая
 * батч-градиентным спуском. Написана вручную (~сотня строк), без внешней ML-
 * зависимости — это сознательный выбор, а не лень:
 *
 *   Почему логрег, а НЕ градиентный бустинг (roadmap §10, CLAUDE.md 08-26).
 *   Независимых наблюдений мало: ~731 дневная свеча × 3 пары, а горизонт 7д
 *   даёт СИЛЬНО пересекающиеся окна (сосед. дни делят 6/7 будущего) → по сути
 *   пара сотен независимых точек. Бустинг на такой выборке переобучится и
 *   покажет фиктивный edge на train, который развалится на held-out тесте.
 *   Линейная модель с L2 — правильный класс сложности: если направленного
 *   сигнала в фичах нет, честный логрег это ЧЕСТНО покажет (out-of-sample
 *   precision не обгонит наивный baseline), а не спрячет за подгонкой.
 *
 * Фичи стандартизуются (z-score) по train-статистике, сохранённой в модели —
 * инференс обязан применять те же mean/std. Bias L2 не штрафуется.
 */

export type LabeledRow = { x: number[]; y: number };

export type LogRegModel = {
  classes: number;
  dim: number;
  mean: number[]; // длина dim, по train
  std: number[]; // длина dim, по train (нули заменены на 1)
  weights: number[][]; // [classes][dim+1], индекс 0 — bias
};

export type FitOptions = {
  lambda?: number; // сила L2 (не на bias)
  lr?: number; // learning rate
  iterations?: number;
};

function standardizeStats(rows: LabeledRow[], dim: number) {
  const mean = new Array(dim).fill(0);
  const std = new Array(dim).fill(0);
  for (const r of rows) for (let j = 0; j < dim; j++) mean[j] += r.x[j];
  for (let j = 0; j < dim; j++) mean[j] /= rows.length;
  for (const r of rows)
    for (let j = 0; j < dim; j++) std[j] += (r.x[j] - mean[j]) ** 2;
  for (let j = 0; j < dim; j++) {
    std[j] = Math.sqrt(std[j] / rows.length);
    if (!(std[j] > 0)) std[j] = 1; // константная фича — не делим на 0
  }
  return { mean, std };
}

// Стандартизует x и добавляет bias-единицу в начало → вектор длины dim+1.
function featurize(x: number[], mean: number[], std: number[]): number[] {
  const f = new Array(x.length + 1);
  f[0] = 1;
  for (let j = 0; j < x.length; j++) f[j + 1] = (x[j] - mean[j]) / std[j];
  return f;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function fitMultinomial(
  rows: LabeledRow[],
  opts: FitOptions = {},
): LogRegModel {
  const lambda = opts.lambda ?? 1.0;
  const lr = opts.lr ?? 0.5;
  const iterations = opts.iterations ?? 500;
  if (rows.length === 0) throw new Error("fitMultinomial: no rows");

  const dim = rows[0].x.length;
  const classes = Math.max(...rows.map((r) => r.y)) + 1;
  const { mean, std } = standardizeStats(rows, dim);
  const feats = rows.map((r) => featurize(r.x, mean, std)); // [N][dim+1]

  // weights[k] длины dim+1, нулевая инициализация (детерминированно).
  const weights: number[][] = Array.from({ length: classes }, () =>
    new Array(dim + 1).fill(0),
  );

  const n = rows.length;
  for (let iter = 0; iter < iterations; iter++) {
    const grad: number[][] = Array.from({ length: classes }, () =>
      new Array(dim + 1).fill(0),
    );
    for (let i = 0; i < n; i++) {
      const logits = weights.map((wk) => dot(wk, feats[i]));
      const p = softmax(logits);
      for (let k = 0; k < classes; k++) {
        const err = p[k] - (rows[i].y === k ? 1 : 0);
        const fi = feats[i];
        for (let j = 0; j < dim + 1; j++) grad[k][j] += (err * fi[j]) / n;
      }
    }
    for (let k = 0; k < classes; k++) {
      for (let j = 1; j < dim + 1; j++)
        grad[k][j] += (lambda * weights[k][j]) / n; // L2, кроме bias
      for (let j = 0; j < dim + 1; j++) weights[k][j] -= lr * grad[k][j];
    }
  }

  return { classes, dim, mean, std, weights };
}

export function predictProba(model: LogRegModel, x: number[]): number[] {
  const f = featurize(x, model.mean, model.std);
  return softmax(model.weights.map((wk) => dot(wk, f)));
}

export function predictClass(model: LogRegModel, x: number[]): number {
  const p = predictProba(model, x);
  let best = 0;
  for (let k = 1; k < p.length; k++) if (p[k] > p[best]) best = k;
  return best;
}
