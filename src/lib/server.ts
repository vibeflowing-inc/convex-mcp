import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { httpActionGeneric } from "convex/server";

import { enforceAuth } from "./auth.js";
import { handleMessage } from "./protocol.js";
import { flattenPrompts, normalizePrompt } from "./prompts.js";
import {
  flattenResources,
  flattenResourceTemplates,
  normalizeResource,
  normalizeResourceTemplate,
  resource,
  resourceTemplate,
} from "./resources.js";
import { errorResponse, JSON_HEADERS } from "./rpc.js";
import { flattenTools, normalizeTool, tool } from "./tools.js";
import type {
  AddMcpHttpRoutesOptions,
  DefineMcpServerOptions,
  McpHttpCtx,
  McpHttpOptions,
  McpHttpRouter,
} from "./types.js";

export { tool };
export { resource, resourceTemplate };

/**
 * Never let one message throw out of the HTTP action: in a batch that would
 * discard the responses of earlier messages whose mutations already committed.
 */
async function safeHandleMessage(
  ...args: Parameters<typeof handleMessage>
): Promise<Response | null> {
  try {
    return await handleMessage(...args);
  } catch (error) {
    const [, , , , , , protocolVersion, message] = args;
    const rawId = (message as { id?: unknown } | null)?.id;
    const id =
      typeof rawId === "string" || typeof rawId === "number" ? rawId : null;
    return errorResponse(
      id,
      -32603,
      error instanceof Error ? error.message : String(error),
      protocolVersion,
    );
  }
}

export function defineMcpServer(options: DefineMcpServerOptions) {
  const normalizedTools = new Map(
    flattenTools(options.tools ?? {}).map(([name, definition]) => [
      name,
      normalizeTool(name, definition),
    ]),
  );
  const normalizedPrompts = new Map(
    flattenPrompts(options.prompts ?? {}).map(([name, definition]) => [
      name,
      normalizePrompt(name, definition),
    ]),
  );
  const normalizedResources = new Map(
    flattenResources(options.resources ?? {}).map(([name, definition]) => [
      name,
      normalizeResource(name, definition),
    ]),
  );
  const normalizedResourceTemplates = new Map(
    flattenResourceTemplates(options.resourceTemplates ?? {}).map(
      ([name, definition]) => [
        name,
        normalizeResourceTemplate(name, definition),
      ],
    ),
  );

  const serverInfo = {
    name: options.name,
    version: options.version,
  };

  function mcpHttp(httpOptions?: McpHttpOptions) {
    return httpActionGeneric(async (ctx: McpHttpCtx, request: Request) => {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            allow: "POST",
          },
        });
      }

      const authFailure = enforceAuth(httpOptions, request);
      if (authFailure) {
        return authFailure;
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errorResponse(
          null,
          -32700,
          "Parse error",
          LATEST_PROTOCOL_VERSION,
          400,
        );
      }

      const protocolVersion =
        request.headers.get("mcp-protocol-version") ?? LATEST_PROTOCOL_VERSION;

      if (Array.isArray(body)) {
        const responses = [];
        for (const message of body) {
          const response = await safeHandleMessage(
            ctx,
            normalizedTools,
            normalizedPrompts,
            normalizedResources,
            normalizedResourceTemplates,
            serverInfo,
            protocolVersion,
            message,
          );
          if (response) {
            responses.push(JSON.parse(await response.text()));
          }
        }
        if (responses.length === 0) {
          return new Response(null, { status: 202 });
        }
        return new Response(JSON.stringify(responses), {
          status: 200,
          headers: {
            ...JSON_HEADERS,
            "mcp-protocol-version": protocolVersion,
          },
        });
      }

      const response = await safeHandleMessage(
        ctx,
        normalizedTools,
        normalizedPrompts,
        normalizedResources,
        normalizedResourceTemplates,
        serverInfo,
        protocolVersion,
        body,
      );

      return response ?? new Response(null, { status: 202 });
    });
  }

  function addHttpRoutes(
    http: McpHttpRouter,
    routeOptions: AddMcpHttpRoutesOptions = {},
  ) {
    http.route({
      path: routeOptions.path ?? "/mcp",
      method: "POST",
      handler: mcpHttp({
        auth: routeOptions.auth,
      }),
    });

    return http;
  }

  return {
    name: options.name,
    version: options.version,
    tools: normalizedTools,
    prompts: normalizedPrompts,
    resources: normalizedResources,
    resourceTemplates: normalizedResourceTemplates,
    mcpHttp,
    addHttpRoutes,
  };
}
