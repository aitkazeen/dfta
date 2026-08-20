import { describe, expect, it } from "vitest";
import { clusterDuplicates, type DedupCandidate } from "./dedup.js";

// 2026-08-20T12:00:00Z как якорь — конкретное значение не важно, важны
// только смещения между статьями относительно newsConfig.deduplicated.period (4ч).
const BASE = new Date("2026-08-20T12:00:00Z").getTime();
const minutesAfter = (m: number) => new Date(BASE + m * 60 * 1000);

function article(
  externalId: string,
  title: string,
  publishedAt: Date,
  source = "nbk-rss",
): DedupCandidate {
  return { externalId, title, publishedAt, source };
}

describe("clusterDuplicates", () => {
  it("статья без дублей маппится сама на себя", () => {
    const result = clusterDuplicates([
      article("a1", "НБ РК повысил базовую ставку", minutesAfter(0)),
    ]);

    expect(result.get("a1")).toBe("a1");
  });

  it("пустой вход — пустая карта", () => {
    expect(clusterDuplicates([]).size).toBe(0);
  });

  it("парафраз одной новости в пределах окна — кластеризуются", () => {
    // jaccard = 8/9 ≈ 0.889, выше порога 0.8 (проверено вручную)
    const result = clusterDuplicates([
      article(
        "a1",
        "НБ РК повысил базовую ставку до 16 процентов",
        minutesAfter(0),
        "marketaux",
      ),
      article(
        "a2",
        "НБ РК повысил базовую ставку до 16 процентов годовых",
        minutesAfter(10),
        "nbk-rss",
      ),
    ]);

    expect(result.get("a1")).toBe(result.get("a2"));
  });

  it("непохожие статьи в одном окне — не кластеризуются", () => {
    const result = clusterDuplicates([
      article("a1", "НБ РК повысил базовую ставку до 16 процентов", minutesAfter(0)),
      article("a2", "Минфин обсудил проект бюджета на следующий год", minutesAfter(5)),
    ]);

    expect(result.get("a1")).toBe("a1");
    expect(result.get("a2")).toBe("a2");
    expect(result.get("a1")).not.toBe(result.get("a2"));
  });

  it("похожие заголовки за пределами временного окна — не кластеризуются", () => {
    // Тот же парафраз, что и в кластеризующемся тесте выше, но с разрывом
    // за пределами newsConfig.deduplicated.period (4ч) — publishedAt важен
    // не меньше похожести текста.
    const result = clusterDuplicates([
      article("a1", "НБ РК повысил базовую ставку до 16 процентов", minutesAfter(0)),
      article(
        "a2",
        "НБ РК повысил базовую ставку до 16 процентов годовых",
        minutesAfter(5 * 60),
      ),
    ]);

    expect(result.get("a1")).toBe("a1");
    expect(result.get("a2")).toBe("a2");
  });

  it("канонической выбирается статья с более высоким sourceWeight, даже если она опубликована позже", () => {
    const result = clusterDuplicates([
      article(
        "a1",
        "НБ РК повысил базовую ставку до 16 процентов",
        minutesAfter(0),
        "marketaux", // sourceWeight 0.7
      ),
      article(
        "a2",
        "НБ РК повысил базовую ставку до 16 процентов годовых",
        minutesAfter(10),
        "nbk-rss", // sourceWeight 1.0 — весит выше, хотя вышла позже
      ),
    ]);

    expect(result.get("a1")).toBe("a2");
    expect(result.get("a2")).toBe("a2");
  });

  it("при равном sourceWeight канонической выбирается более ранняя статья", () => {
    const result = clusterDuplicates([
      article(
        "a1",
        "НБ РК повысил базовую ставку до 16 процентов",
        minutesAfter(10),
        "unknown-source-x", // не в newsConfig.sourceWeight — обе получают дефолт 0.5
      ),
      article(
        "a2",
        "НБ РК повысил базовую ставку до 16 процентов годовых",
        minutesAfter(0),
        "unknown-source-y",
      ),
    ]);

    expect(result.get("a1")).toBe("a2");
    expect(result.get("a2")).toBe("a2");
  });

  it("транзитивность: A~B и B~C кластеризуют A и C, даже если сами A и C ниже порога", () => {
    // jaccard(A,B) ≈ 0.818, jaccard(B,C) ≈ 0.818 — оба выше порога 0.8.
    // jaccard(A,C) ≈ 0.667 — ниже порога, при прямом сравнении не сцепились бы.
    const A = "alpha beta charlie delta echo foxtrot golf hotel india sierra";
    const B = "alpha beta charlie delta echo foxtrot golf hotel india juliet";
    const C = "beta charlie delta echo foxtrot golf hotel india juliet kilo";

    const result = clusterDuplicates([
      article("a", A, minutesAfter(0)),
      article("b", B, minutesAfter(5)),
      article("c", C, minutesAfter(10)),
    ]);

    const rootA = result.get("a");
    const rootB = result.get("b");
    const rootC = result.get("c");

    expect(rootA).toBe(rootB);
    expect(rootB).toBe(rootC);
  });
});
