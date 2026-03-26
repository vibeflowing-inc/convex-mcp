import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineMcpServer, tool } from "../src/index.js";

describe("tool(api/internal refs)", () => {
  it("requires kind metadata for api/internal refs", () => {
    expect(() =>
      defineMcpServer({
        name: "missingKind",
        version: "0.1.0",
        tools: {
          readUser: tool(anyApi.users.get, {
            args: {
              userId: z.string(),
            },
          } as any),
        },
      }),
    ).toThrow();
  });

  it("requires args metadata for api/internal refs", () => {
    expect(() =>
      defineMcpServer({
        name: "missingArgs",
        version: "0.1.0",
        tools: {
          readUser: tool(anyApi.users.get, {
            kind: "query",
          } as any),
        },
      }),
    ).toThrow();
  });
});
