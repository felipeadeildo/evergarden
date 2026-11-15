import { describe, expect, it } from "vitest";

import { align, quote, relocate, sourceRange, textRange } from "./index";

const REPORT = `# AWS costs, November

EC2 was **41%** of the bill, about $3,100. Data transfer is the [second biggest](https://aws.amazon.com/pricing) line item.

Most of it left through one NAT gateway.
`;

const paragraph = { start: REPORT.indexOf("EC2"), end: REPORT.indexOf("\n\nMost") };
const rendered =
  "EC2 was 41% of the bill, about $3,100. Data transfer is the second biggest line item.";

describe("align", () => {
  it("skips markup and keeps rendered characters in order", () => {
    const source = "a **b** [c](http://x) d";
    const letters = align(source, "a b c d").filter((at) => at >= 0);
    expect(letters.map((at) => source[at]).join("")).toBe("a bcd");
  });
});

describe("sourceRange and textRange", () => {
  it("maps a selection in the page to the markdown behind it, markup included", () => {
    const from = rendered.indexOf("second biggest");
    const range = sourceRange(REPORT, paragraph, rendered, from, from + "second biggest".length);
    expect(REPORT.slice(range!.start, range!.end)).toBe("second biggest");

    const bold = rendered.indexOf("41% of");
    const withBold = sourceRange(REPORT, paragraph, rendered, bold, bold + "41% of".length);
    expect(REPORT.slice(withBold!.start, withBold!.end)).toBe("41%** of");
  });

  it("maps a markdown range back to the characters that show it", () => {
    const start = REPORT.indexOf("Data transfer");
    const shown = textRange(REPORT, paragraph, rendered, {
      start,
      end: start + "Data transfer".length,
    });
    expect(rendered.slice(shown!.from, shown!.to)).toBe("Data transfer");
  });
});

describe("relocate", () => {
  const start = REPORT.indexOf("one NAT gateway");
  const passage = quote(REPORT, start, start + "one NAT gateway".length);

  it("follows a passage that moved", () => {
    const next = `# AWS costs, November\n\nA new opening paragraph.\n\n${REPORT.split("\n\n").slice(1).join("\n\n")}`;
    const moved = relocate(passage, next);
    expect(next.slice(moved!.start, moved!.end)).toBe("one NAT gateway");
  });

  it("follows a passage the agent rewrapped", () => {
    const rewrapped = REPORT.replace("through one NAT gateway", "through one\nNAT gateway");
    const moved = relocate(passage, rewrapped);
    expect(rewrapped.slice(moved!.start, moved!.end)).toBe("one\nNAT gateway");
  });

  it("picks the copy whose surroundings match when the passage repeats", () => {
    const repeated = `One NAT gateway is cheap. ${REPORT}`.replace("One NAT", "one NAT");
    const moved = relocate(passage, repeated);
    expect(repeated.slice(moved!.start - 13, moved!.start)).toBe("left through ");
  });

  it("gives up when the passage was rewritten", () => {
    expect(relocate(passage, REPORT.replace("one NAT gateway", "two gateways"))).toBeNull();
  });
});
