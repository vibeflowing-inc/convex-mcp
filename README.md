# Convex MCP

Build a stateless MCP endpoint on top of [Convex](https://convex.dev).

## Install

```bash
npm install @vibeflow/convex-mcp
```

## Features

- **Tools** – Expose Convex functions as MCP tools
- **Prompts** – Define MCP prompts with Zod args
- **Resources** – Serve static and templated MCP resources

## Quick Start

Define your MCP server:

```ts
// convex/mcp.ts
import { api, internal } from "./_generated/api";
import { defineMcpServer, tool, prompt, resource, promptResult, assistantText, userText } from "@vibeflow/convex-mcp";

export const mcp = defineMcpServer({
  name: "my-app",
  version: "0.1.0",
  tools: {
    users: {
      get: tool(api.users.get, {
        kind: "query",
        description: "Fetch a user by id",
        args: (z) => ({ userId: z.string() }),
      }),
    },
  },
  prompts: {
    onboarding: prompt(
      { args: (z) => ({ name: z.string() }) },
      async ({ name }) => promptResult([assistantText(`Welcome ${name}!`)])
    ),
  },
  resources: {
    config: resource(api.resources.config, {
      kind: "query",
      uri: "config://app",
      mimeType: "application/json",
    }),
  },
});
```

Mount it:

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { mcp } from "./mcp";

const http = httpRouter();
mcp.addHttpRoutes(http);

export default http;
```

## Auth

```ts
import { bearerAuth } from "@vibeflow/convex-mcp";

mcp.addHttpRoutes(http, {
  auth: bearerAuth({ env: "MCP_AUTH_TOKEN" }),
});
```

## API Reference

| Function | Description |
|----------|-------------|
| `defineMcpServer(...)` | Create an MCP server with tools, prompts, and resources |
| `tool(ref, opts)` | Register a Convex function as an MCP tool |
| `prompt(opts, handler)` | Register an MCP prompt |
| `resource(ref, opts)` | Register a fixed MCP resource |
| `resourceTemplate(ref, opts)` | Register a templated MCP resource |
| `bearerAuth(opts)` | Add Bearer token auth |

## License

[MIT](LICENSE)
