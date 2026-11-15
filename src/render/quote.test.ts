import { describe, expect, it } from "vitest";

import { quote } from "#/anchor";

import { quoteText } from "./quote";

function quoted(source: string, from: string, to: string) {
  const start = source.indexOf(from);
  return quoteText(quote(source, start, source.indexOf(to, start) + to.length));
}

describe("quoteText", () => {
  it("drops markup that opened before the passage and keeps code apart", () => {
    const source = "- [ ] **Workers Paid:** register `adeildo.dev` in Compute.";
    expect(quoted(source, "Workers", "Compute.")).toEqual([
      { text: "Workers Paid: register " },
      { text: "adeildo.dev", code: true },
      { text: " in Compute." },
    ]);
  });

  it("shows a link as its text", () => {
    const source = "Live at [evergarden.dev](https://evergarden.dev): agents publish.";
    expect(quoted(source, "Live", "publish.")).toEqual([
      { text: "Live at evergarden.dev: agents publish." },
    ]);
  });

  it("cuts text at the passage's edges", () => {
    expect(quoted("One **two three** four", "wo", "thr")).toEqual([{ text: "wo thr" }]);
  });

  it("drops a callout's marker and joins blocks with a space", () => {
    expect(quoted("> [!NOTE]\n> First.\n\nSecond.", ">", "Second.")).toEqual([
      { text: "First. Second." },
    ]);
  });
});
