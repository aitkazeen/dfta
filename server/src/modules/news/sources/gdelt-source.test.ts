import { describe, expect, it } from "vitest";
import { buildGdeltQuery } from "./gdelt-source.js";

describe("buildGdeltQuery", () => {
  it("требует тенге/KZT И хотя бы одну иностранную валюту (AND двух OR-групп)", () => {
    const q = buildGdeltQuery({
      KZT: ["тенге", "kzt"],
      USD: ["доллар", "usd"],
      EUR: ["евро"],
    });
    // Две группы, разделённые пробелом (AND у GDELT).
    const [kztGroup, otherGroup] = q.split(") (");
    expect(kztGroup).toContain("тенге");
    expect(kztGroup).toContain("kzt");
    expect(otherGroup).toContain("доллар");
    expect(otherGroup).toContain("евро");
    // KZT не должен протечь во вторую группу.
    expect(otherGroup).not.toContain("тенге");
  });

  it("дедуплицирует повторяющиеся ключевые слова между валютами", () => {
    const q = buildGdeltQuery({ KZT: ["тенге"], CNY: ["юань", "юань"] });
    expect(q.match(/юань/g)?.length).toBe(1);
  });
});
