import type { Direction } from "./types";

type ResolveOutcomeInput = {
  direction: Direction;
  originalClose: number;
  targetLow: number;
  targetHigh: number;
  actualClose: number;
  // Минимальное % изменение цены, которое считается направленным движением,
  // а не шумом — та же логика, что и flatThreshold у technicalScore
  // (см. RulesForecastEngine.predict): deadZonePct = flatThreshold * maxMovePct,
  // выведено из тех же чисел конфига, не отдельный произвольный порог.
  deadZonePct: number;
};

export function resolveForecastOutcome(input: ResolveOutcomeInput): {
  wasCorrect: boolean;
  absError: number;
} {
  const {
    direction,
    originalClose,
    targetLow,
    targetHigh,
    actualClose,
    deadZonePct,
  } = input;

  const pctChange = (actualClose - originalClose) / originalClose;
  const actualDirection: Direction =
    pctChange > deadZonePct ? "up" : pctChange < -deadZonePct ? "down" : "flat";

  const targetMid = (targetLow + targetHigh) / 2;

  return {
    wasCorrect: actualDirection === direction,
    absError: Math.abs(actualClose - targetMid),
  };
}
