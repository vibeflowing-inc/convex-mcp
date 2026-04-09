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

import { invokeTool } from "../src/lib/tools.js";
import { vi } from "vitest";

describe("invokeTool runtime validation", () => {
  it("returns VALIDATION_ERROR when args are invalid", async () => {
    const mockTool = {
      name: "test.tool",
      kind: "query",
      ref: "fake.ref",
      inputShape: {
        jobId: z.string(),
      },
    };

    const mockCtx = {
      runQuery: vi.fn(),
    };

    const result = await invokeTool(
      mockCtx as any,
      mockTool as any,
      {} // ❌ missing required field
    );

    expect(result).toHaveProperty("error");
    expect(result.error.type).toBe("VALIDATION_ERROR");
  });

  it("executes tool when args are valid", async () => {
    const mockTool = {
      name: "test.tool",
      kind: "query",
      ref: "fake.ref",
      inputShape: {
        jobId: z.string(),
      },
    };

    const mockCtx = {
      runQuery: vi.fn().mockResolvedValue({ success: true }),
    };

    const result = await invokeTool(
      mockCtx as any,
      mockTool as any,
      { jobId: "123" } // ✅ valid
    );

    expect(mockCtx.runQuery).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
