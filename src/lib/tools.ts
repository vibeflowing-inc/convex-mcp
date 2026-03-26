import { normalizeToolArgs } from "./schema.js";
import type {
  ConvexFunctionKind,
  DefineMcpServerOptions,
  McpHttpCtx,
  NormalizedToolDefinition,
  RawToolDefinition,
  ToolOptions,
  ToolReference,
} from "./types.js";

const EMPTY_OBJECT_VALIDATOR = {
  type: "object",
  value: {},
} as const;

function normalizeAnnotations(
  kind: ConvexFunctionKind,
  annotations: RawToolDefinition["annotations"],
) {
  if (kind !== "query" || annotations?.readOnlyHint !== undefined) {
    return annotations;
  }
  return {
    ...annotations,
    readOnlyHint: true,
  };
}

export function normalizeTool(
  name: string,
  definition: RawToolDefinition,
): NormalizedToolDefinition {
  const path = name.split(".").filter(Boolean);

  if (path.length === 0) {
    throw new Error(`Tool name "${name}" must be a dot-delimited path.`);
  }

  if (!definition.kind) {
    throw new Error(
      `Tool "${name}" uses an api/internal function reference, so you must provide "kind" in tool(..., { kind: ... }).`,
    );
  }

  if (definition.args === undefined) {
    throw new Error(
      `Tool "${name}" uses an api/internal function reference, so you must provide "args" in tool(..., { args: ... }).`,
    );
  }

  const { inputShape, inputSchemaJson } = normalizeToolArgs(
    EMPTY_OBJECT_VALIDATOR,
    definition.args,
  );

  return {
    name,
    kind: definition.kind,
    ref: definition.ref,
    title: definition.title,
    description: definition.description,
    annotations: normalizeAnnotations(definition.kind, definition.annotations),
    inputShape,
    inputSchemaJson,
  };
}

function isRawToolDefinition(value: unknown): value is RawToolDefinition {
  return !!value && typeof value === "object" && "ref" in value;
}

export function flattenTools(
  tools: DefineMcpServerOptions["tools"] = {},
  prefix: string[] = [],
): Array<[string, RawToolDefinition]> {
  const flattened: Array<[string, RawToolDefinition]> = [];

  for (const [key, value] of Object.entries(tools)) {
    const nextPrefix = [...prefix, ...key.split(".").filter(Boolean)];
    if (isRawToolDefinition(value)) {
      flattened.push([nextPrefix.join("."), value]);
      continue;
    }
    flattened.push(...flattenTools(value, nextPrefix));
  }

  return flattened;
}

export async function invokeTool(
  ctx: McpHttpCtx,
  tool: NormalizedToolDefinition,
  args: Record<string, unknown>,
) {
  switch (tool.kind) {
    case "query":
      return await (ctx.runQuery as any)(tool.ref, args);
    case "mutation":
      return await (ctx.runMutation as any)(tool.ref, args);
    case "action":
      return await (ctx.runAction as any)(tool.ref, args);
  }
}

export function tool(
  ref: ToolReference,
  options: ToolOptions,
): RawToolDefinition {
  return {
    ref,
    kind: options.kind,
    title: options.title,
    description: options.description,
    annotations: options.annotations,
    args: options.args,
  };
}
