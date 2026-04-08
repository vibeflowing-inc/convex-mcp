# Convex MCP

> Try Convex MCP instantly in the cloud - works out of the box with [VibeFlow](https://app.vibeflow.ai).

[![npm package](https://img.shields.io/npm/v/@vibeflowai/convex-mcp.svg)](https://npmjs.com/package/@vibeflowai/convex-mcp)
[![Stars](https://img.shields.io/github/stars/vibeflowing-inc/convex-mcp?style=social&cacheSeconds=0)](https://github.com/vibeflowing-inc/convex-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Join Discord](https://img.shields.io/badge/Join%20Discord-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/Ctm2A2uEaq)

Build a stateless MCP endpoint on top of [Convex](https://convex.dev).

This package provides a simple wrapper to automatically translate your Convex backend functions into a standard MCP server, allowing any AI agent (like Claude, Cursor, etc.) to discover and interact with them.

## Testing inside VibeFlow

You can easily test your Convex MCP server inside VibeFlow:

![Testing Convex MCP in VibeFlow](./assets/demo.gif)

## Install

```bash
npm install @vibeflowai/convex-mcp
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
import { defineMcpServer, tool, prompt, resource, promptResult, assistantText, userText } from "@vibeflowai/convex-mcp";

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
import { bearerAuth } from "@vibeflowai/convex-mcp";

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

## Authors & Contributors

Built by the **VibeFlow** team.

For custom work or enterprise needs, reach out to Alessia & Elia directly:
📩 founders@vibeflow.ai

[![Follow Alessia](https://img.shields.io/twitter/follow/alessiapacca?style=social)](https://x.com/alessiapacca) [![Follow Elia](https://img.shields.io/twitter/follow/eliasaquand?style=social)](https://x.com/eliasaquand)

- 🌐 **Website:** [vibeflow.ai](https://vibeflow.ai)
- 🚀 **App:** [app.vibeflow.ai](https://app.vibeflow.ai)

## License

[MIT](LICENSE)
