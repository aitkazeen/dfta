/**
 * Этап 4 роадмапа (§9): "подбор весов" — то, что осталось для честного
 * закрытия прогнозного движка. Walk-forward grid-search по весам индикаторов
 * и порогу flat, метрика — ЧЕСТНАЯ направленная точность (directional
 * precision), не общий hit rate (общий легко раздуть, предсказывая 'flat').
 *
 * Ничего не пишет в конфиг и не трогает calibration-data.ts — только печатает
 * таблицу лучших конфигураций, чтобы решение о весах принимал человек.
 * Финальную калибровку под выбранный конфиг делает forecast:backtest.
 *
 * Как читать метрики (на каждый горизонт):
 *  - coverage           — доля дней, где модель взяла направление (не 'flat')
 *  - dirPrecision       — среди этих дней доля, где направление совпало с фактом
 *  - baseline (no-skill)— max(доля факт-up, доля факт-down) среди направленных
 *                         дней: точность тупой модели "всегда предсказывай
 *                         более частое направление". Обгонять надо ЕЁ, не 33%.
 *  - edge               — dirPrecision − baseline. >0 = есть реальный сигнал.
 *
 * Мёртвая зона факта (flatBand = mult*atr14*sqrt(гориз.)) — это ОПРЕДЕЛЕНИЕ
 * "флэта", часть продукта, а не метрика: её не оптимизируем, а фиксируем и
 * гоняем поиск при нескольких значениях, чтобы видеть чувствительность.
 *
 * Запуск: npm run forecast:tune   (из server/)
 */

import { PrismaClient } from "@prisma/client";
import { computeIndicators } from "../src/modules/indicators/compute.js";
import {
  computeTechnicalScore,
  type ScoreWeightsOverride,
} from "../src/modules/forecast/compute.js";
import { forecastConfig } from "../src/modules/forecast/config.js";
import type { IndicatorSnapshot } from "../src/modules/forecast/types.js";

const HORIZONS = { "24h": 1, "7d": 7 } as const;
const TECH_WEIGHT = forecastConfig.merge.technicalWeight; // news=0 в истории → blended = tech*0.6
const FLAT_BAND_MULTS = [0.5, 1.0]; // значения мёртвой зоны для проверки чувствительности

const db = new PrismaClient();

// Один предпосчитанный день истории: снимок индикаторов + close сейчас +
// close через горизонт + atr для мёртвой зоны. Configs гоняем по этим
// сэмплам в памяти, без обращения к БД на каждую конфигурацию.
type Day = {
  indicators: IndicatorSnapshot;
  close: number;
  atr14: number;
  futureClose: Record<keyof typeof HORIZONS, number | null>;
};

async function loadDays(pairId: string): Promise<Day[]> {
  const candles = await db.candle.findMany({
    where: { pairId, timeframe: "1d" },
    orderBy: { ts: "asc" },
  });
  if (candles.length < 30) return [];

  const closes = candles.map((c) => Number(c.close));
  const points = computeIndicators(
    candles.map((c) => ({
      ts: c.ts,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    })),
  );
  const byTs = new Map<number, IndicatorSnapshot>();
  for (const p of points) {
    const snap = byTs.get(p.ts.getTime()) ?? {};
    (snap as Record<string, number>)[p.name] = p.value;
    byTs.set(p.ts.getTime(), snap);
  }

  const days: Day[] = [];
  for (let i = 0; i < candles.length; i++) {
    const indicators = byTs.get(candles[i].ts.getTime()) ?? {};
    if (indicators.atr14 === undefined) continue; // тот же guard, что в проде
    days.push({
      indicators,
      close: closes[i],
      atr14: indicators.atr14,
      futureClose: {
        "24h": i + 1 < closes.length ? closes[i + 1] : null,
        "7d": i + 7 < closes.length ? closes[i + 7] : null,
      },
    });
  }
  return days;
}

type Config = {
  label: string;
  weights: ScoreWeightsOverride;
  flatThreshold: number;
  signFlip: 1 | -1; // -1 проверяет гипотезу разворота (mean reversion) на управляемых парах
};

type Metrics = {
  coverage: number;
  dirPrecision: number;
  baseline: number;
  edge: number;
  n: number;
};

function evaluate(
  days: Day[],
  cfg: Config,
  horizon: keyof typeof HORIZONS,
  flatBandMult: number,
): Metrics {
  const horizonDays = HORIZONS[horizon];
  let directional = 0;
  let dirCorrect = 0;
  let actualUp = 0;
  let actualDown = 0;
  let total = 0;

  for (const d of days) {
    const future = d.futureClose[horizon];
    if (future === null) continue;
    total++;

    const tech = computeTechnicalScore(d.indicators, d.close, cfg.weights);
    const blended = tech * TECH_WEIGHT * cfg.signFlip;
    const predicted =
      blended > cfg.flatThreshold
        ? "up"
        : blended < -cfg.flatThreshold
          ? "down"
          : "flat";

    const flatBand = flatBandMult * d.atr14 * Math.sqrt(horizonDays);
    const move = future - d.close;
    const actual = move > flatBand ? "up" : move < -flatBand ? "down" : "flat";

    if (actual === "up") actualUp++;
    else if (actual === "down") actualDown++;

    if (predicted !== "flat") {
      directional++;
      if (predicted === actual) dirCorrect++;
    }
  }

  const dirActualTotal = actualUp + actualDown;
  const baseline =
    dirActualTotal === 0 ? 0 : Math.max(actualUp, actualDown) / dirActualTotal;
  const dirPrecision = directional === 0 ? 0 : dirCorrect / directional;
  return {
    coverage: total === 0 ? 0 : directional / total,
    dirPrecision,
    baseline,
    edge: dirPrecision - baseline,
    n: directional,
  };
}

function buildConfigs(): Config[] {
  const catMixes: { label: string; trend: number; momentum: number }[] = [
    { label: "trend-only", trend: 1, momentum: 0 },
    { label: "trend-heavy", trend: 0.7, momentum: 0.3 },
    { label: "balanced", trend: 0.5, momentum: 0.5 },
    { label: "mom-heavy", trend: 0.3, momentum: 0.7 },
    { label: "mom-only", trend: 0, momentum: 1 },
  ];
  const signalMixes: {
    label: string;
    rsi14: number;
    stoch_k: number;
    macd: number;
  }[] = [
    { label: "rsm", rsi14: 1, stoch_k: 1, macd: 1 },
    { label: "rsi", rsi14: 1, stoch_k: 0, macd: 0 },
    { label: "stoch", rsi14: 0, stoch_k: 1, macd: 0 },
    { label: "macd", rsi14: 0, stoch_k: 0, macd: 1 },
    { label: "rsi+stoch", rsi14: 1, stoch_k: 1, macd: 0 },
  ];
  const thresholds = [0.0, 0.05, 0.1, 0.15];
  const flips: (1 | -1)[] = [1, -1];

  const configs: Config[] = [];
  for (const cat of catMixes) {
    // momentum-состав не влияет, если momentum=0 — не плодим дубли
    const sigs = cat.momentum === 0 ? [signalMixes[0]] : signalMixes;
    for (const sig of sigs) {
      for (const th of thresholds) {
        for (const flip of flips) {
          configs.push({
            label: `${cat.label}/${cat.momentum === 0 ? "—" : sig.label}/th${th}/${flip === -1 ? "INV" : "dir"}`,
            weights: {
              categoryWeight: { trend: cat.trend, momentum: cat.momentum },
              signalWeight: {
                rsi14: sig.rsi14,
                stoch_k: sig.stoch_k,
                macd: sig.macd,
              },
            },
            flatThreshold: th,
            signFlip: flip,
          });
        }
      }
    }
  }
  return configs;
}

async function main(): Promise<void> {
  const pairs = await db.currencyPair.findMany({ where: { isActive: true } });
  const days: Day[] = [];
  for (const pair of pairs) days.push(...(await loadDays(pair.id)));
  console.log(
    `Загружено ${days.length} дней-сэмплов по ${pairs.length} парам.\n`,
  );

  // Баланс классов факта (для контекста baseline): насколько пары в принципе
  // чаще растут, чем падают, на нашем окне.
  for (const horizon of Object.keys(HORIZONS) as (keyof typeof HORIZONS)[]) {
    let up = 0,
      down = 0,
      flat = 0;
    for (const d of days) {
      const f = d.futureClose[horizon];
      if (f === null) continue;
      const band = 0.5 * d.atr14 * Math.sqrt(HORIZONS[horizon]);
      const move = f - d.close;
      if (move > band) up++;
      else if (move < -band) down++;
      else flat++;
    }
    const t = up + down + flat;
    console.log(
      `Баланс факта ${horizon} (band .5·ATR): up ${((up / t) * 100).toFixed(1)}% / down ${((down / t) * 100).toFixed(1)}% / flat ${((flat / t) * 100).toFixed(1)}%`,
    );
  }

  const configs = buildConfigs();
  // Есть ли ХОТЬ ОДИН конфиг с положительным edge — прямой ответ "есть ли сигнал".
  let globalBest = { label: "—", edge: -Infinity, horizon: "", mult: 0 };
  let bestInvEdge = -Infinity;

  for (const mult of FLAT_BAND_MULTS) {
    for (const horizon of Object.keys(HORIZONS) as (keyof typeof HORIZONS)[]) {
      const scored = configs
        .map((cfg) => ({ cfg, m: evaluate(days, cfg, horizon, mult) }))
        // отсекаем вырожденные конфиги, которые почти всегда молчат ('flat')
        .filter((r) => r.m.coverage >= 0.3)
        .sort((a, b) => b.m.edge - a.m.edge);

      for (const r of scored) {
        if (r.m.edge > globalBest.edge)
          globalBest = { label: r.cfg.label, edge: r.m.edge, horizon, mult };
        if (r.cfg.signFlip === -1 && r.m.edge > bestInvEdge)
          bestInvEdge = r.m.edge;
      }

      const pct = (x: number) => (x * 100).toFixed(1).padStart(5) + "%";
      console.log(
        `\n=== horizon ${horizon}, flatBandMult ${mult} — топ-8 по edge (из ${scored.length} конфигов с coverage≥30%) ===`,
      );
      console.log(
        "config                                   cover  dirPrec  base   edge     n",
      );
      for (const r of scored.slice(0, 8)) {
        console.log(
          `${r.cfg.label.padEnd(40)} ${pct(r.m.coverage)} ${pct(r.m.dirPrecision)} ${pct(r.m.baseline)} ${(r.m.edge * 100 >= 0 ? "+" : "") + (r.m.edge * 100).toFixed(1) + "%"}  ${r.m.n}`,
        );
      }
    }
  }

  console.log(
    `\n=== ИТОГ: лучший edge среди ВСЕХ конфигов = ${(globalBest.edge * 100 >= 0 ? "+" : "") + (globalBest.edge * 100).toFixed(1)}% (${globalBest.label}, ${globalBest.horizon}, mult ${globalBest.mult}) ===`,
  );
  console.log(
    `Лучший edge среди инвертированных (mean-reversion) конфигов = ${(bestInvEdge * 100 >= 0 ? "+" : "") + (bestInvEdge * 100).toFixed(1)}%`,
  );
  console.log(
    globalBest.edge > 0
      ? "→ Есть конфиг с положительным edge — стоит копать дальше."
      : "→ НИ ОДИН конфиг не обгоняет наивный baseline. Технический сигнал на дневных фиксингах НБ РК edge не даёт.",
  );

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
