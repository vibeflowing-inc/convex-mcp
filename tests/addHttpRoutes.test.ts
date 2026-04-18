import { describe, expect, it, vi } from "vitest";

import { mcp } from "./helpers.js";

describe("addHttpRoutes", () => {
  it("mounts POST /mcp on the supplied router", () => {
    const route = vi.fn();
    const router = mcp.addHttpRoutes(
      { route } as unknown as { route: (spec: unknown) => void },
      {},
    );

    expect(router).toEqual({ route });
    expect(route).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/mcp",
        method: "POST",
        handler: expect.anything(),
      }),
    );
  });

  it("supports a custom path", () => {
    const route = vi.fn();

    mcp.addHttpRoutes(
      { route } as unknown as { route: (spec: unknown) => void },
      { path: "/custom-mcp" },
    );

    expect(route).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/custom-mcp",
      }),
    );
  });

  it("mounts OPTIONS when CORS is enabled", () => {
    const route = vi.fn();

    mcp.addHttpRoutes(
      { route } as unknown as { route: (spec: unknown) => void },
      { cors: true },
    );

    expect(route).toHaveBeenCalledTimes(2);
    expect(route).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: "/mcp",
        method: "POST",
        handler: expect.anything(),
      }),
    );
    expect(route).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: "/mcp",
        method: "OPTIONS",
        handler: expect.anything(),
      }),
    );
  });
});
