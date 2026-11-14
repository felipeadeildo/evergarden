import { describe, expect, it } from "vitest";

import { newId } from "./id";

describe("newId", () => {
  it("returns 10 characters from 0-9a-z", () => {
    for (let i = 0; i < 1000; i++) expect(newId()).toMatch(/^[0-9a-z]{10}$/);
  });

  it("does not repeat across many calls", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newId()));
    expect(ids.size).toBe(10_000);
  });
});
