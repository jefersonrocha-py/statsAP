import { describe, expect, it } from "vitest";
import { formatDuration, secondsBetween } from "@lib/incidentFormat";

describe("formatDuration", () => {
  it.each([
    [-5, "0 s"],
    [45, "45 s"],
    [600, "10 min"],
    [3_900, "1 h 05 min"],
    [7_200, "2 h"],
    [90_000, "1 d 1 h"],
    [172_800, "2 d"],
  ])("%i segundos → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe("secondsBetween", () => {
  it("nunca devolve negativo", () => {
    const later = new Date("2026-10-08T12:00:00Z");
    const earlier = new Date("2026-10-08T11:59:00Z");
    expect(secondsBetween(earlier, later)).toBe(60);
    expect(secondsBetween(later, earlier)).toBe(0);
  });
});
