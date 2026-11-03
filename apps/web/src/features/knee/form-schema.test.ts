import { describe, expect, it } from "vitest";
import { readKneeTestForm } from "./form-schema";

const legs = { L: [], R: [] };
const base = {
  testDate: "2026-11-08",
  angleDeg: 90,
  strapNote: null,
  quadWarmup: legs,
  quad: { L: [300, 310, null], R: [400, null, 410] },
  ham: legs,
  flexionActive: null,
  flexionPassive: null,
  extension: -2,
  kneeGirth: { L: null, R: null },
  thighGirth: { L: null, R: null },
  walkingAsymmetry: null,
  walkingSpeed: null,
  steps: null,
  effusionGrade: 1,
  aclRsi: null,
  hops: { single: legs, triple: legs, crossover: legs, timed6m: legs },
  notes: null,
};

function form(entry: unknown) {
  const fd = new FormData();
  fd.set("entry", typeof entry === "string" ? entry : JSON.stringify(entry));
  return fd;
}

describe("readKneeTestForm", () => {
  it("reads a valid entry", () => {
    expect(readKneeTestForm(form(base)).quad.R).toEqual([400, null, 410]);
  });

  it("rejects bad JSON, a fourth trial and an out-of-range angle", () => {
    expect(() => readKneeTestForm(form("{"))).toThrow();
    expect(() =>
      readKneeTestForm(form({ ...base, quad: { L: [1, 2, 3, 4], R: [] } })),
    ).toThrow();
    expect(() => readKneeTestForm(form({ ...base, angleDeg: 150 }))).toThrow();
  });
});
