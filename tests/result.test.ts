import { describe, expect, it } from "vitest";

import { toCallToolResult } from "../src/index.js";

describe("toCallToolResult", () => {
  it("maps string results to text content", () => {
    expect(toCallToolResult("hello")).toEqual({
      content: [{ type: "text", text: "hello" }],
    });
  });

  it("wraps arrays in structured content", () => {
    expect(toCallToolResult([1, 2, 3])).toEqual({
      content: [{ type: "text", text: "[\n  1,\n  2,\n  3\n]" }],
      structuredContent: { result: [1, 2, 3] },
    });
  });
});
