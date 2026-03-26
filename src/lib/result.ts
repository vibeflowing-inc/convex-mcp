import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function formatStructuredValue(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function toCallToolResult(value: unknown): CallToolResult {
  if (typeof value === "string") {
    return {
      content: [{ type: "text", text: value }],
    };
  }

  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return {
      content: [{ type: "text", text: formatStructuredValue(value) }],
      structuredContent: value as Record<string, unknown>,
    };
  }

  return {
    content: [{ type: "text", text: formatStructuredValue(value) }],
    structuredContent: { result: value },
  };
}

export function toErrorToolResult(error: unknown): CallToolResult {
  const message =
    error instanceof Error ? error.message : "Unknown MCP tool error";

  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
