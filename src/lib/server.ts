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
  McpCorsConfig,
  DefineMcpServerOptions,
  McpHttpCtx,
  McpHttpOptions,
  McpHttpRouter,
} from "./types.js";

export { tool };
export { resource, resourceTemplate };

const DEFAULT_CORS_ALLOW_HEADERS = [
  "content-type",
  "authorization",
  "mcp-protocol-version",
];
const DEFAULT_CORS_ALLOW_METHODS = ["POST", "OPTIONS"];
const DEFAULT_CORS_EXPOSE_HEADERS = ["mcp-protocol-version"];

function normalizeCorsConfig(
  cors: McpHttpOptions["cors"],
): McpCorsConfig | null {
  if (!cors) {
    return null;
  }

  if (cors === true) {
    return {
      origin: "*",
    };
  }

  return cors;
}

function resolveOriginHeader(
  cors: McpCorsConfig,
  request: Request,
): { value: string; varyOrigin: boolean } | null {
  const configuredOrigin = cors.origin ?? "*";

  if (configuredOrigin === "*") {
    return {
      value: "*",
      varyOrigin: false,
    };
  }

  if (typeof configuredOrigin === "string") {
    return {
      value: configuredOrigin,
      varyOrigin: false,
    };
  }

  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) {
    return null;
  }

  if (!configuredOrigin.includes(requestOrigin)) {
    return null;
  }

  return {
    value: requestOrigin,
    varyOrigin: true,
  };
}

function getCorsHeaders(
  cors: McpHttpOptions["cors"],
  request: Request,
): Headers | null {
  const normalizedCors = normalizeCorsConfig(cors);
  if (!normalizedCors) {
    return null;
  }

  const origin = resolveOriginHeader(normalizedCors, request);
  if (!origin) {
    return null;
  }

  const headers = new Headers();
  headers.set("access-control-allow-origin", origin.value);
  headers.set(
    "access-control-allow-methods",
    (normalizedCors.allowMethods ?? DEFAULT_CORS_ALLOW_METHODS).join(", "),
  );
  headers.set(
    "access-control-allow-headers",
    (normalizedCors.allowHeaders ?? DEFAULT_CORS_ALLOW_HEADERS).join(", "),
  );
  headers.set(
    "access-control-expose-headers",
    (normalizedCors.exposeHeaders ?? DEFAULT_CORS_EXPOSE_HEADERS).join(", "),
  );

  if (normalizedCors.maxAgeSeconds !== undefined) {
    headers.set("access-control-max-age", String(normalizedCors.maxAgeSeconds));
  }

  if (normalizedCors.allowCredentials) {
    headers.set("access-control-allow-credentials", "true");
  }

  if (origin.varyOrigin) {
    headers.set("vary", "origin");
  }

  return headers;
}

function withCorsHeaders(response: Response, corsHeaders: Headers | null): Response {
  if (!corsHeaders) {
    return response;
  }

  const headers = new Headers(response.headers);
  corsHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
      const corsHeaders = getCorsHeaders(httpOptions?.cors, request);

      if (request.method === "OPTIONS") {
        if (!httpOptions?.cors) {
          return new Response("Method Not Allowed", {
            status: 405,
            headers: {
              allow: "POST",
            },
          });
        }

        return withCorsHeaders(
          new Response(null, {
            status: 204,
            headers: {
              allow: "POST, OPTIONS",
            },
          }),
          corsHeaders,
        );
      }

      if (request.method !== "POST") {
        return withCorsHeaders(
          new Response("Method Not Allowed", {
            status: 405,
            headers: {
              allow: "POST",
            },
          }),
          corsHeaders,
        );
      }

      const authFailure = enforceAuth(httpOptions, request);
      if (authFailure) {
        return withCorsHeaders(authFailure, corsHeaders);
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return withCorsHeaders(
          errorResponse(
            null,
            -32700,
            "Parse error",
            LATEST_PROTOCOL_VERSION,
            400,
          ),
          corsHeaders,
        );
      }

      const protocolVersion =
        request.headers.get("mcp-protocol-version") ?? LATEST_PROTOCOL_VERSION;

      if (Array.isArray(body)) {
        const responses = [];
        for (const message of body) {
          const response = await handleMessage(
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
          return withCorsHeaders(new Response(null, { status: 202 }), corsHeaders);
        }
        return withCorsHeaders(
          new Response(JSON.stringify(responses), {
            status: 200,
            headers: {
              ...JSON_HEADERS,
              "mcp-protocol-version": protocolVersion,
            },
          }),
          corsHeaders,
        );
      }

      const response = await handleMessage(
        ctx,
        normalizedTools,
        normalizedPrompts,
        normalizedResources,
        normalizedResourceTemplates,
        serverInfo,
        protocolVersion,
        body,
      );

      return withCorsHeaders(response ?? new Response(null, { status: 202 }), corsHeaders);
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
        cors: routeOptions.cors,
      }),
    });

    if (routeOptions.cors) {
      http.route({
        path: routeOptions.path ?? "/mcp",
        method: "OPTIONS",
        handler: mcpHttp({
          auth: routeOptions.auth,
          cors: routeOptions.cors,
        }),
      });
    }

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
