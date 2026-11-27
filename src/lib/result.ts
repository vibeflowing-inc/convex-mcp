import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

import type {
  RawResourceResult,
  ResourceContentInput,
  ResourceResponse,
} from "./types.js";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Convex values that JSON cannot represent into JSON-safe values:
 * - int64 (bigint) -> base-10 string
 * - bytes (ArrayBuffer / typed arrays) -> base64 string
 * - NaN / Infinity / -Infinity -> their string form
 * Without this, JSON.stringify either throws (bigint) or silently loses data.
 */
export function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (value instanceof ArrayBuffer) {
    return bytesToBase64(new Uint8Array(value));
  }
  if (ArrayBuffer.isView(value)) {
    return bytesToBase64(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    );
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]),
    );
  }
  return value;
}

function formatStructuredValue(value: unknown) {
  return JSON.stringify(toJsonSafe(value), null, 2) ?? "null";
}

export function toCallToolResult(rawValue: unknown): CallToolResult {
  const value = toJsonSafe(rawValue);
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

function isResourceContentInput(value: unknown): value is ResourceContentInput {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    "type" in value &&
    (value.type === "text" || value.type === "blob" || value.type === "json");
}

function isRawResourceResult(value: unknown): value is RawResourceResult {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    "contents" in value &&
    Array.isArray(value.contents);
}

function isReadResourceResult(value: unknown): value is ReadResourceResult {
  return isRawResourceResult(value) &&
    value.contents.every((item) =>
      !!item && typeof item === "object" && "uri" in item &&
      ("text" in item || "blob" in item)
    );
}

function jsonMimeType(defaultMimeType?: string) {
  return defaultMimeType?.includes("json")
    ? defaultMimeType
    : "application/json";
}

function toReadResourceContents(
  value: ResourceContentInput,
  defaults: { uri: string; mimeType?: string },
) {
  switch (value.type) {
    case "text":
      return {
        uri: value.uri ?? defaults.uri,
        mimeType: value.mimeType ?? defaults.mimeType ?? "text/plain",
        text: value.text,
        ...(value._meta ? { _meta: value._meta } : {}),
      };
    case "blob":
      return {
        uri: value.uri ?? defaults.uri,
        mimeType: value.mimeType ?? defaults.mimeType,
        blob: value.blob,
        ...(value._meta ? { _meta: value._meta } : {}),
      };
    case "json":
      return {
        uri: value.uri ?? defaults.uri,
        mimeType: value.mimeType ?? jsonMimeType(defaults.mimeType),
        text: formatStructuredValue(value.value),
        ...(value._meta ? { _meta: value._meta } : {}),
      };
  }
}

export function toReadResourceResult(
  value: ResourceResponse,
  defaults: { uri: string; mimeType?: string },
): ReadResourceResult {
  if (isReadResourceResult(value)) {
    return value;
  }

  if (isRawResourceResult(value)) {
    return {
      contents: value.contents.map((content) =>
        isResourceContentInput(content)
          ? toReadResourceContents(content, defaults)
          : {
              uri: defaults.uri,
              mimeType: defaults.mimeType ?? "text/plain",
              text: formatStructuredValue(content),
            }
      ),
    };
  }

  if (Array.isArray(value) && value.every(isResourceContentInput)) {
    const contents = value as ResourceContentInput[];
    return {
      contents: contents.map((content) =>
        toReadResourceContents(content, defaults)
      ),
    };
  }

  if (isResourceContentInput(value)) {
    return {
      contents: [toReadResourceContents(value, defaults)],
    };
  }

  if (typeof value === "string") {
    return {
      contents: [
        {
          uri: defaults.uri,
          mimeType: defaults.mimeType ?? "text/plain",
          text: value,
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri: defaults.uri,
        mimeType: jsonMimeType(defaults.mimeType),
        text: formatStructuredValue(value),
      },
    ],
  };
}
