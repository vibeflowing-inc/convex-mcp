import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { toPromptResult } from "./prompts.js";
import { toCallToolResult, toErrorToolResult } from "./result.js";
import { errorResponse, okResponse } from "./rpc.js";
import { invokeTool } from "./tools.js";
import type {
  McpHttpCtx,
  NormalizedPromptDefinition,
  NormalizedToolDefinition,
} from "./types.js";

export async function handleMessage(
  ctx: McpHttpCtx,
  tools: Map<string, NormalizedToolDefinition>,
  prompts: Map<string, NormalizedPromptDefinition>,
  serverInfo: { name: string; version: string },
  protocolVersion: string,
  message: unknown,
): Promise<Response | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return errorResponse(null, -32600, "Invalid Request", protocolVersion, 400);
  }

  const rpc = message as {
    id?: number | string | null;
    method?: string;
    params?: Record<string, unknown>;
  };

  const id = rpc.id ?? null;
  const method = rpc.method;
  if (!method) {
    return errorResponse(id, -32600, "Invalid Request", protocolVersion, 400);
  }

  switch (method) {
    case "initialize": {
      const requestedVersion =
        typeof rpc.params?.protocolVersion === "string"
          ? rpc.params.protocolVersion
          : protocolVersion;
      const negotiatedVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(
        requestedVersion,
      )
        ? requestedVersion
        : LATEST_PROTOCOL_VERSION;

      return okResponse(
        id,
        {
          protocolVersion: negotiatedVersion,
          capabilities: {
            ...(tools.size > 0
              ? {
                  tools: {
                    listChanged: true,
                  },
                }
              : {}),
            ...(prompts.size > 0
              ? {
                  prompts: {
                    listChanged: true,
                  },
                }
              : {}),
          },
          serverInfo,
        },
        negotiatedVersion,
      );
    }
    case "notifications/initialized":
      return null;
    case "tools/list":
      return okResponse(
        id,
        {
          tools: [...tools.values()].map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchemaJson,
            annotations: tool.annotations,
          })),
        },
        protocolVersion,
      );
    case "prompts/list":
      return okResponse(
        id,
        {
          prompts: [...prompts.values()].map((prompt) => ({
            name: prompt.name,
            title: prompt.title,
            description: prompt.description,
            arguments: prompt.arguments,
          })),
        },
        protocolVersion,
      );
    case "prompts/get": {
      const promptName = rpc.params?.name;
      if (typeof promptName !== "string") {
        return errorResponse(
          id,
          -32602,
          'Invalid params: "name" must be a string.',
          protocolVersion,
        );
      }

      const prompt = prompts.get(promptName);
      if (!prompt) {
        return errorResponse(
          id,
          -32602,
          `Unknown prompt "${promptName}".`,
          protocolVersion,
        );
      }

      const parsedArgs = await z
        .object(prompt.inputShape)
        .safeParseAsync(rpc.params?.arguments ?? {});

      if (!parsedArgs.success) {
        return errorResponse(
          id,
          -32602,
          `Invalid params for prompt "${promptName}": ${parsedArgs.error.message}`,
          protocolVersion,
        );
      }

      try {
        return okResponse(
          id,
          toPromptResult(await prompt.handler(parsedArgs.data)),
          protocolVersion,
        );
      } catch (error) {
        return errorResponse(
          id,
          -32603,
          error instanceof Error ? error.message : String(error),
          protocolVersion,
        );
      }
    }
    case "tools/call": {
      const toolName = rpc.params?.name;
      if (typeof toolName !== "string") {
        return errorResponse(
          id,
          -32602,
          'Invalid params: "name" must be a string.',
          protocolVersion,
        );
      }

      const tool = tools.get(toolName);
      if (!tool) {
        return errorResponse(
          id,
          -32602,
          `Unknown tool "${toolName}".`,
          protocolVersion,
        );
      }

      const parsedArgs = await z
        .object(tool.inputShape)
        .safeParseAsync(rpc.params?.arguments ?? {});

      if (!parsedArgs.success) {
        return errorResponse(
          id,
          -32602,
          `Invalid params for tool "${toolName}": ${parsedArgs.error.message}`,
          protocolVersion,
        );
      }

      try {
        const value = await invokeTool(ctx, tool, parsedArgs.data);
        return okResponse(id, toCallToolResult(value), protocolVersion);
      } catch (error) {
        return okResponse(id, toErrorToolResult(error), protocolVersion);
      }
    }
    default:
      return errorResponse(id, -32601, "Method not found", protocolVersion);
  }
}
