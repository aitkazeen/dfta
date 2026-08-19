import { describe, expect, it, vi } from "vitest";
import { CachingExplainer } from "./caching-explainer.js";
import type { ExplainInput, ExplainResult } from "../types.js";

const input: ExplainInput = {
  base: "USD",
  quote: "KZT",
  direction: "up",
  technicalScore: 0.42,
  close: 512.3456789,
  targetLow: 508,
  targetHigh: 516,
  indicators: { ema20: 510, rsi14: 63.2 },
};

const result: ExplainResult = {
  explanation: "Тестовое объяснение.",
  drivers: [{ category: "technical", text: "RSI выше 60" }],
};

describe("CachingExplainer", () => {
  it("промах кэша — зовёт inner и сохраняет результат", async () => {
    const inner = { explain: vi.fn().mockResolvedValueOnce(result) };
    const redis = { get: vi.fn().mockResolvedValueOnce(null), set: vi.fn() };

    const explainer = new CachingExplainer(inner, redis);
    const got = await explainer.explain(input);

    expect(got).toEqual(result);
    expect(inner.explain).toHaveBeenCalledOnce();
    expect(redis.set).toHaveBeenCalledOnce();
    const [key, value, mode, ttl] = redis.set.mock.calls[0];
    expect(key).toMatch(/^llm:explain:v1:[a-f0-9]{64}$/);
    expect(JSON.parse(value)).toEqual(result);
    expect(mode).toBe("EX");
    expect(ttl).toBeGreaterThan(0);
  });

  it("попадание в кэш — не зовёт inner", async () => {
    const inner = { explain: vi.fn() };
    const redis = {
      get: vi.fn().mockResolvedValueOnce(JSON.stringify(result)),
      set: vi.fn(),
    };

    const explainer = new CachingExplainer(inner, redis);
    const got = await explainer.explain(input);

    expect(got).toEqual(result);
    expect(inner.explain).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("inner вернул null — не кэширует", async () => {
    const inner = { explain: vi.fn().mockResolvedValueOnce(null) };
    const redis = { get: vi.fn().mockResolvedValueOnce(null), set: vi.fn() };

    const explainer = new CachingExplainer(inner, redis);
    const got = await explainer.explain(input);

    expect(got).toBeNull();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("одинаковый вход по смыслу (шум последнего знака float) даёт один и тот же ключ", async () => {
    const inner = { explain: vi.fn().mockResolvedValue(result) };
    const redis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const explainer = new CachingExplainer(inner, redis);

    await explainer.explain(input);
    await explainer.explain({ ...input, close: 512.34567890001 });

    const [keyA] = redis.set.mock.calls[0];
    const [keyB] = redis.set.mock.calls[1];
    expect(keyA).toBe(keyB);
  });

  it("битый JSON в кэше считается промахом, не роняет вызов", async () => {
    const inner = { explain: vi.fn().mockResolvedValueOnce(result) };
    const redis = {
      get: vi.fn().mockResolvedValueOnce("{не json"),
      set: vi.fn(),
    };

    const explainer = new CachingExplainer(inner, redis);
    const got = await explainer.explain(input);

    expect(got).toEqual(result);
    expect(inner.explain).toHaveBeenCalledOnce();
  });
});
