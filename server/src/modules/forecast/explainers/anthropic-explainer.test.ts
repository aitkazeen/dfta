import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicExplainer } from "./anthropic-explainer.js";
import type { ExplainInput } from "../types.js";

const input: ExplainInput = {
  base: "USD",
  quote: "KZT",
  direction: "up",
  technicalScore: 0.42,
  close: 512.3,
  targetLow: 508,
  targetHigh: 516,
  indicators: { ema20: 510, rsi14: 63.2 },
};

function anthropicResponse(text: string) {
  return {
    ok: true,
    json: async () => ({ content: [{ type: "text", text }] }),
  };
}

describe("AnthropicExplainer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("парсит валидный JSON-ответ модели", async () => {
    const body = JSON.stringify({
      explanation: "Пара вероятно продолжит рост.",
      drivers: [{ category: "technical", text: "RSI выше 60" }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(anthropicResponse(body)));

    const explainer = new AnthropicExplainer("test-key");
    const result = await explainer.explain(input);

    expect(result).toEqual({
      explanation: "Пара вероятно продолжит рост.",
      drivers: [{ category: "technical", text: "RSI выше 60" }],
    });
  });

  it("снимает markdown-фенсы вокруг JSON", async () => {
    const body =
      "```json\n" +
      JSON.stringify({ explanation: "Текст.", drivers: [] }) +
      "\n```";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(anthropicResponse(body)));

    const explainer = new AnthropicExplainer("test-key");
    const result = await explainer.explain(input);

    expect(result).toEqual({ explanation: "Текст.", drivers: [] });
  });

  it("невалидную category подменяет на technical, не отбрасывает драйвер", async () => {
    const body = JSON.stringify({
      explanation: "Текст.",
      drivers: [{ category: "made-up", text: "что-то" }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(anthropicResponse(body)));

    const explainer = new AnthropicExplainer("test-key");
    const result = await explainer.explain(input);

    expect(result?.drivers).toEqual([
      { category: "technical", text: "что-то" },
    ]);
  });

  it("обрезает drivers до 3 элементов", async () => {
    const body = JSON.stringify({
      explanation: "Текст.",
      drivers: [1, 2, 3, 4].map((i) => ({
        category: "technical",
        text: `driver ${i}`,
      })),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(anthropicResponse(body)));

    const explainer = new AnthropicExplainer("test-key");
    const result = await explainer.explain(input);

    expect(result?.drivers).toHaveLength(3);
  });

  it("битый JSON в ответе — возвращает null, не бросает", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(anthropicResponse("не json вообще")),
    );

    const explainer = new AnthropicExplainer("test-key");
    const result = await explainer.explain(input);

    expect(result).toBeNull();
  });

  it("сетевая ошибка после ретрая — возвращает null, не бросает", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const explainer = new AnthropicExplainer("test-key");
    await expect(explainer.explain(input)).resolves.toBeNull();
  });

  it("HTTP-ошибка от API — возвращает null, не бросает", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    const explainer = new AnthropicExplainer("test-key");
    await expect(explainer.explain(input)).resolves.toBeNull();
  });
});
