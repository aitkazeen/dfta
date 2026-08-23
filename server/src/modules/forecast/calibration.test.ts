import { describe, it, expect } from "vitest";
import { calibrateConfidence, calibration } from "./calibration";

describe("calibrateConfidence", () => {
  it("returns the confidence of the highest breakpoint not exceeding the raw score", () => {
    const table = calibration["24h"];
    for (const bp of table) {
      expect(calibrateConfidence(bp.minScore, "24h")).toBe(bp.confidence);
    }
  });

  it("is monotonically non-decreasing as raw score rises (правило 6, CLAUDE.md)", () => {
    for (const horizon of Object.keys(calibration)) {
      const steps = Array.from({ length: 21 }, (_, i) => i / 20); // 0, 0.05, ..., 1
      let previous = -Infinity;
      for (const score of steps) {
        const confidence = calibrateConfidence(score, horizon);
        expect(confidence).toBeGreaterThanOrEqual(previous);
        previous = confidence;
      }
    }
  });

  it("falls back to the lowest breakpoint's confidence below the data range", () => {
    const table = calibration["24h"];
    expect(calibrateConfidence(-1, "24h")).toBe(table[0].confidence);
  });

  it("falls back to the 24h table for an unknown horizon", () => {
    expect(calibrateConfidence(0.5, "unknown-horizon")).toBe(
      calibrateConfidence(0.5, "24h"),
    );
  });
});
