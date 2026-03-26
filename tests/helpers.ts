import { anyApi } from "convex/server";
import { vi } from "vitest";
import { z } from "zod";

import {
  assistantText,
  defineMcpServer,
  prompt,
  promptResult,
  tool,
  userText,
} from "../src/index.js";

export const mcp = defineMcpServer({
  name: "appMcp",
  version: "0.1.0",
  tools: {
    users: {
      get: tool(anyApi.users.get, {
        kind: "query",
        title: "Get user",
        description: "Fetch a user by id",
        args: (z) => ({
          userId: z.string().describe("The user id to fetch"),
        }),
      }),
      create: tool(anyApi.users.create, {
        kind: "mutation",
        description: "Create a new user",
        args: {
          name: z.string(),
          email: z.string().email(),
        },
      }),
    },
    reports: {
      generate: tool(anyApi.reports.generate, {
        kind: "action",
        description: "Start a report job",
        args: {
          reportId: z.string().describe("The report id to generate"),
          options: z.any().optional().describe("Optional report generation options"),
        },
      }),
      preview: tool(anyApi.reports.preview, {
        kind: "action",
        description: "Preview arbitrary MCP payload input",
        args: {
          payload: z.any(),
        },
      }),
    },
  },
  prompts: {
    onboarding: prompt(
      {
        title: "Onboarding",
        description: "Create a welcome prompt for a user",
        args: (z) => ({
          name: z.string().describe("The user's display name"),
          tone: z.enum(["friendly", "formal"]).optional().describe("Prompt tone"),
        }),
      },
      async ({ name, tone }) =>
        promptResult(
          [
            assistantText(`You are helping onboard ${name}.`),
            userText(`Say hello in a ${tone ?? "friendly"} tone.`),
          ],
          "Onboarding starter prompt",
        ),
    ),
    changelog: prompt(
      {
        description: "Generate a changelog prompt",
      },
      async () => [
        userText("Summarize the latest changes."),
      ],
    ),
  },
});

export const promptsOnly = defineMcpServer({
  name: "promptsOnly",
  version: "0.1.0",
  prompts: {
    hello: prompt(
      {
        description: "Return a single assistant message",
      },
      async () => assistantText("Hello from prompts only."),
    ),
  },
});

export function makeCtx() {
  return {
    runQuery: vi.fn(async (_ref, args) => ({
      kind: "query",
      args,
    })),
    runMutation: vi.fn(async (_ref, args) => ({
      kind: "mutation",
      args,
    })),
    runAction: vi.fn(async (_ref, args) => ({
      kind: "action",
      args,
    })),
  };
}

export async function invokeHttp(
  handler: unknown,
  ctx: unknown,
  request: Request,
) {
  return await (
    handler as {
      _handler: (ctx: unknown, request: Request) => Promise<Response>;
    }
  )._handler(ctx, request);
}

export async function initialize(handler: unknown, ctx: unknown) {
  return await invokeHttp(
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
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "vitest",
            version: "1.0.0",
          },
        },
      }),
    }),
  );
}
