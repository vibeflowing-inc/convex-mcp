import { anyApi } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { defineMcpServer, tool } from "../src/index.js";
import { invokeHttp } from "./helpers.js";

function rpc(handler: unknown, ctx: unknown, body: unknown) {
  return invokeHttp(
    handler,
    ctx,
    new Request("https://example.com/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function callTool(name: string, args: unknown, id: number = 1) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

function ctxReturning(value: unknown) {
  return {
    runQuery: vi.fn(async () => value),
    runMutation: vi.fn(async () => value),
    runAction: vi.fn(async () => value),
  };
}

const server = defineMcpServer({
  name: "integrity",
  version: "0.0.0",
  tools: {
    deposit: tool(anyApi.ledger.deposit, {
      kind: "mutation",
      args: { cents: z.number() },
    }),
    transfer: tool(anyApi.ledger.transfer, {
      kind: "mutation",
      args: z
        .object({ from: z.string(), to: z.string(), memo: z.string().optional() })
        .strict()
        .refine((t) => t.from !== t.to, "from and to must differ"),
    }),
    normalize: tool(anyApi.ledger.normalize, {
      kind: "mutation",
      args: (z) =>
        z
          .object({ owner: z.string() })
          .transform((args) => ({ owner: args.owner.trim().toLowerCase() })),
    }),
  },
  resourceTemplates: {
    files: { byPath: { ref: anyApi.files.byPath, kind: "query", uriTemplate: "files://{path}" } },
  },
});

describe("committed mutations are never reported as failures", () => {
  it("serializes int64 (bigint) results instead of returning isError", async () => {
    const ctx = ctxReturning({ balance: 150n });
    const body = await (await rpc(server.mcpHttp(), ctx, callTool("deposit", { cents: 50 }))).json();
    expect(body.result.isError).toBeUndefined();
    expect(body.result.structuredContent).toEqual({ balance: "150" });
    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
  });

  it("serializes bytes as base64 and non-finite numbers as strings", async () => {
    const ctx = ctxReturning({ avatar: new Uint8Array([1, 2, 3]).buffer, ratio: Infinity, bad: NaN });
    const body = await (await rpc(server.mcpHttp(), ctx, callTool("deposit", { cents: 1 }))).json();
    expect(body.result.structuredContent).toEqual({ avatar: "AQID", ratio: "Infinity", bad: "NaN" });
  });

  it("always emits a text content block, even for undefined results", async () => {
    const ctx = ctxReturning(undefined);
    const body = await (await rpc(server.mcpHttp(), ctx, callTool("deposit", { cents: 1 }))).json();
    expect(typeof body.result.content[0].text).toBe("string");
  });
});

describe("full argument schemas are enforced", () => {
  it("applies object-level refinements", async () => {
    const ctx = ctxReturning(null);
    const body = await (await rpc(server.mcpHttp(), ctx, callTool("transfer", { from: "a", to: "a" }))).json();
    expect(body.error.code).toBe(-32602);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it("applies .strict()", async () => {
    const ctx = ctxReturning(null);
    const body = await (
      await rpc(server.mcpHttp(), ctx, callTool("transfer", { from: "a", to: "b", meno: "typo" }))
    ).json();
    expect(body.error.code).toBe(-32602);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it("supports a z.object(...).transform(...) args schema", async () => {
    const ctx = ctxReturning(null);
    await rpc(server.mcpHttp(), ctx, callTool("normalize", { owner: "  Alice " }));
    expect(ctx.runMutation).toHaveBeenCalledWith(anyApi.ledger.normalize, { owner: "alice" });
    const list = await (
      await rpc(server.mcpHttp(), ctx, { jsonrpc: "2.0", id: 2, method: "tools/list" })
    ).json();
    const normalize = list.result.tools.find((t: { name: string }) => t.name === "normalize");
    expect(normalize.inputSchema.properties.owner).toEqual({ type: "string" });
  });

  it("rejects args schemas that are not object-based with a clear error", () => {
    expect(() =>
      defineMcpServer({
        name: "x",
        version: "0",
        tools: { t: tool(anyApi.x.y, { kind: "query", args: (z) => z.string() as never }) },
      }),
    ).toThrow(/must be a Zod object shape/);
  });
});

describe("one bad message cannot sink a batch", () => {
  it("returns a JSON-RPC error for an oversized resource URI", async () => {
    const ctx = ctxReturning("x");
    const res = await rpc(server.mcpHttp(), ctx, {
      jsonrpc: "2.0",
      id: 7,
      method: "resources/read",
      params: { uri: "files://" + "a".repeat(1_000_001) },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).error.code).toBe(-32602);
  });

  it("keeps responses for messages that already ran", async () => {
    const ctx = ctxReturning({ ok: true });
    const res = await rpc(server.mcpHttp(), ctx, [
      callTool("deposit", { cents: 5 }, 1),
      { jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri: "files://" + "a".repeat(1_000_001) } },
    ]);
    const body = await res.json();
    expect(body.map((m: { id: number }) => m.id)).toEqual([1, 2]);
    expect(body[0].result.structuredContent).toEqual({ ok: true });
    expect(body[1].error.code).toBe(-32602);
  });
});
