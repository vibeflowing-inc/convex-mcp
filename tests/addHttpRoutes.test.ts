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
});
