import type { Direction } from "./types";

type ResolveOutcomeInput = {
  direction: Direction;
  originalClose: number;
  targetLow: number;
  targetHigh: number;
  actualClose: number;
  // Полуширина "мёртвой зоны" в АБСОЛЮТНЫХ единицах цены (не процент):
  // факт считается 'flat', если |actualClose - originalClose| <= flatBand.
  // Считается вызывающим как flatBandAtrMult * atr14 * sqrt(horizonDays)
  // (см. forecastConfig.decision.flatBandAtrMult) — волатильностно- и
  // горизонт-относительная зона шума, а не фиксированный процент. Это чинит
  // провал бакета [0,0.1) на 7д, где фиксированные 0.1% делали факт
  // 'flat' практически недостижимым.
  flatBand: number;
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
    flatBand,
  } = input;

  const move = actualClose - originalClose;
  const actualDirection: Direction =
    move > flatBand ? "up" : move < -flatBand ? "down" : "flat";

  const targetMid = (targetLow + targetHigh) / 2;

  return {
    wasCorrect: actualDirection === direction,
    absError: Math.abs(actualClose - targetMid),
  };
}
