import { getFunctionName } from "convex/server";
import { describe, expect, it } from "vitest";

import { bearerAuth } from "../src/index.js";
import { initialize, invokeHttp, makeCtx, mcp, promptsOnly } from "./helpers.js";

describe("mcpHttp", () => {
  it("handles initialize and tools/list", async () => {
    const ctx = makeCtx();
    const handler = mcp.mcpHttp();

    const init = await initialize(handler, ctx);
    expect(init.status).toBe(200);
    const initBody = await init.json();
    expect(initBody.result.capabilities.prompts.listChanged).toBe(true);
    expect(initBody.result.capabilities.resources.listChanged).toBe(true);
    expect(initBody.result.capabilities.tools.listChanged).toBe(true);

    const listResponse = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "mcp-protocol-version": "2025-06-18",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      }),
    );

    expect(listResponse.status).toBe(200);
    const body = await listResponse.json();
    expect(body.result.tools).toHaveLength(4);
    expect(body.result.tools[0].name).toBe("users.get");
    expect(body.result.tools[0].inputSchema.type).toBe("object");
    expect(body.result.tools[0].inputSchema.properties.userId.description).toBe(
      "The user id to fetch",
    );

    const reportsTool = body.result.tools.find(
      (tool: { name: string }) => tool.name === "reports.generate",
    );
    expect(reportsTool.inputSchema.properties.options.description).toBe(
      "Optional report generation options",
    );

    const previewTool = body.result.tools.find(
      (tool: { name: string }) => tool.name === "reports.preview",
    );
    expect(previewTool.inputSchema.properties.payload).toEqual({});
  });

  it("handles prompts/list and prompts/get", async () => {
    const ctx = makeCtx();
    const handler = mcp.mcpHttp();

    const listResponse = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 20,
          method: "prompts/list",
          params: {},
        }),
      }),
    );

    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.result.prompts).toHaveLength(2);
    const onboardingPrompt = listBody.result.prompts.find(
      (entry: { name: string }) => entry.name === "onboarding",
    );
    expect(onboardingPrompt.arguments).toEqual([
      {
        name: "name",
        description: "The user's display name",
        required: true,
      },
      {
        name: "tone",
        description: "Prompt tone",
        required: false,
      },
    ]);

    const getResponse = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 21,
          method: "prompts/get",
          params: {
            name: "onboarding",
            arguments: {
              name: "Ada",
              tone: "formal",
            },
          },
        }),
      }),
    );

    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.result.description).toBe("Onboarding starter prompt");
    expect(getBody.result.messages).toEqual([
      {
        role: "assistant",
        content: {
          type: "text",
          text: "You are helping onboard Ada.",
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: "Say hello in a formal tone.",
        },
      },
    ]);
  });

  it("dispatches query, mutation, and action tool calls", async () => {
    const ctx = makeCtx();
    const handler = mcp.mcpHttp();

    const queryResponse = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "users.get",
            arguments: {
              userId: "u1",
            },
          },
        }),
      }),
    );

    const mutationResponse = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "users.create",
            arguments: {
              name: "Ada",
              email: "ada@example.com",
            },
          },
        }),
      }),
    );

    const actionResponse = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "reports.generate",
            arguments: {
              reportId: "r1",
              options: {
                include: ["summary"],
              },
            },
          },
        }),
      }),
    );

    expect((await queryResponse.json()).result.structuredContent.kind).toBe("query");
    expect((await mutationResponse.json()).result.structuredContent.kind).toBe(
      "mutation",
    );
    expect((await actionResponse.json()).result.structuredContent.kind).toBe("action");
    expect(getFunctionName(ctx.runQuery.mock.calls[0][0])).toBe("users:get");
    expect(getFunctionName(ctx.runMutation.mock.calls[0][0])).toBe("users:create");
    expect(getFunctionName(ctx.runAction.mock.calls[0][0])).toBe(
      "reports:generate",
    );
  });

  it("accepts arbitrary values for z.any() inputs", async () => {
    const ctx = makeCtx();
    const handler = mcp.mcpHttp();

    const response = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "reports.preview",
            arguments: {
              payload: {
                nested: ["anything", 1, true],
              },
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(getFunctionName(ctx.runAction.mock.calls[0][0])).toBe(
      "reports:preview",
    );
    expect(ctx.runAction.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        payload: {
          nested: ["anything", 1, true],
        },
      }),
    );
  });

  it("supports prompts without args and validates prompt params", async () => {
    const ctx = makeCtx();
    const handler = mcp.mcpHttp();

    const noArgsResponse = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 22,
          method: "prompts/get",
          params: {
            name: "changelog",
          },
        }),
      }),
    );

    expect(noArgsResponse.status).toBe(200);
    expect((await noArgsResponse.json()).result.messages).toEqual([
      {
        role: "user",
        content: {
          type: "text",
          text: "Summarize the latest changes.",
        },
      },
    ]);

    const invalidResponse = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 23,
          method: "prompts/get",
          params: {
            name: "onboarding",
          },
        }),
      }),
    );

    expect(invalidResponse.status).toBe(200);
    expect((await invalidResponse.json()).error.message).toMatch(
      /invalid params for prompt "onboarding"/i,
    );
  });

  it("supports prompt-only servers and single-message prompt responses", async () => {
    const ctx = makeCtx();
    const handler = promptsOnly.mcpHttp();

    const init = await initialize(handler, ctx);
    expect(init.status).toBe(200);
    const initBody = await init.json();
    expect(initBody.result.capabilities.prompts.listChanged).toBe(true);
    expect(initBody.result.capabilities.tools).toBeUndefined();

    const response = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 24,
          method: "prompts/get",
          params: {
            name: "hello",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).result.messages).toEqual([
      {
        role: "assistant",
        content: {
          type: "text",
          text: "Hello from prompts only.",
        },
      },
    ]);
  });

  it("returns 401 before execution when bearer auth is configured and wrong", async () => {
    const original = process.env.MCP_AUTH_TOKEN;
    process.env.MCP_AUTH_TOKEN = "secret";

    try {
      const ctx = makeCtx();
      const handler = mcp.mcpHttp({
        auth: bearerAuth({
          env: "MCP_AUTH_TOKEN",
          optional: true,
        }),
      });

      const response = await invokeHttp(
        handler,
        ctx,
        new Request("https://example.com/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer wrong",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list",
            params: {},
          }),
        }),
      );

      expect(response.status).toBe(401);
      expect(ctx.runQuery).not.toHaveBeenCalled();
    } finally {
      if (original === undefined) {
        delete process.env.MCP_AUTH_TOKEN;
      } else {
        process.env.MCP_AUTH_TOKEN = original;
      }
    }
  });

  it("allows unauthenticated requests when the env is unset and auth is optional", async () => {
    delete process.env.MCP_AUTH_TOKEN;

    const ctx = makeCtx();
    const handler = mcp.mcpHttp({
      auth: bearerAuth({
        env: "MCP_AUTH_TOKEN",
        optional: true,
      }),
    });

    const response = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("handles CORS preflight when enabled", async () => {
    const ctx = makeCtx();
    const handler = mcp.mcpHttp({
      cors: true,
    });

    const response = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
          "access-control-request-method": "POST",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "content-type",
    );
  });

  it("adds CORS headers to successful POST responses", async () => {
    const ctx = makeCtx();
    const handler = mcp.mcpHttp({
      cors: {
        origin: ["https://app.example.com"],
        allowHeaders: ["content-type", "authorization"],
        allowMethods: ["POST", "OPTIONS"],
        exposeHeaders: ["mcp-protocol-version"],
        maxAgeSeconds: 600,
      },
    });

    const response = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "POST",
        headers: {
          origin: "https://app.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://app.example.com",
    );
    expect(response.headers.get("vary")).toBe("origin");
    expect(response.headers.get("access-control-max-age")).toBe("600");
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "mcp-protocol-version",
    );
  });

  it("adds CORS headers to auth failures", async () => {
    const original = process.env.MCP_AUTH_TOKEN;
    process.env.MCP_AUTH_TOKEN = "secret";

    try {
      const ctx = makeCtx();
      const handler = mcp.mcpHttp({
        auth: bearerAuth({ env: "MCP_AUTH_TOKEN" }),
        cors: {
          origin: "https://app.example.com",
        },
      });

      const response = await invokeHttp(
        handler,
        ctx,
        new Request("https://example.com/mcp", {
          method: "POST",
          headers: {
            origin: "https://app.example.com",
            "content-type": "application/json",
            authorization: "Bearer wrong",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list",
            params: {},
          }),
        }),
      );

      expect(response.status).toBe(401);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://app.example.com",
      );
    } finally {
      if (original === undefined) {
        delete process.env.MCP_AUTH_TOKEN;
      } else {
        process.env.MCP_AUTH_TOKEN = original;
      }
    }
  });

  it("rejects non-POST requests", async () => {
    const ctx = makeCtx();
    const handler = mcp.mcpHttp();
    const response = await invokeHttp(
      handler,
      ctx,
      new Request("https://example.com/mcp", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(405);
  });
});
