import { UriTemplate } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";

import { normalizeToolArgs } from "./schema.js";
import type {
  ConvexReadKind,
  DefineMcpServerOptions,
  McpHttpCtx,
  NormalizedResourceDefinition,
  NormalizedResourceTemplateDefinition,
  RawBlobResourceContent,
  RawJsonResourceContent,
  RawResourceDefinition,
  RawResourceResult,
  RawResourceTemplateDefinition,
  RawTextResourceContent,
  ResourceOptions,
  ResourceReference,
  ResourceTemplateOptions,
} from "./types.js";

const EMPTY_OBJECT_VALIDATOR = {
  type: "object",
  value: {},
} as const;

function assertReadKind(
  kind: ConvexReadKind | undefined,
  label: "Resource" | "Resource template",
  name: string,
): ConvexReadKind {
  if (!kind) {
    throw new Error(
      `${label} "${name}" uses an api/internal function reference, so you must provide "kind".`,
    );
  }

  return kind;
}

function templateValidator(uriTemplate: UriTemplate) {
  return {
    type: "object",
    value: Object.fromEntries(
      uriTemplate.variableNames.map((name) => [
        name,
        {
          fieldType: { type: "string" as const },
          optional: false,
        },
      ]),
    ),
  } as const;
}

function isRawResourceDefinition(value: unknown): value is RawResourceDefinition {
  return !!value && typeof value === "object" && "ref" in value && "uri" in value;
}

function isRawResourceTemplateDefinition(
  value: unknown,
): value is RawResourceTemplateDefinition {
  return !!value && typeof value === "object" && "ref" in value &&
    "uriTemplate" in value;
}

export function normalizeResource(
  name: string,
  definition: RawResourceDefinition,
): NormalizedResourceDefinition {
  const path = name.split(".").filter(Boolean);

  if (path.length === 0) {
    throw new Error(`Resource name "${name}" must be a dot-delimited path.`);
  }

  if (!definition.uri) {
    throw new Error(`Resource "${name}" must define a non-empty "uri".`);
  }

  return {
    name,
    kind: assertReadKind(definition.kind, "Resource", name),
    ref: definition.ref,
    uri: definition.uri,
    title: definition.title,
    description: definition.description,
    mimeType: definition.mimeType,
    annotations: definition.annotations,
    size: definition.size,
  };
}

export function normalizeResourceTemplate(
  name: string,
  definition: RawResourceTemplateDefinition,
): NormalizedResourceTemplateDefinition {
  const path = name.split(".").filter(Boolean);

  if (path.length === 0) {
    throw new Error(
      `Resource template name "${name}" must be a dot-delimited path.`,
    );
  }

  const matcher = new UriTemplate(definition.uriTemplate);
  const { inputSchema, inputShape } = normalizeToolArgs(
    templateValidator(matcher),
    definition.params,
  );

  return {
    name,
    kind: assertReadKind(definition.kind, "Resource template", name),
    ref: definition.ref,
    uriTemplate: definition.uriTemplate,
    matcher,
    title: definition.title,
    description: definition.description,
    mimeType: definition.mimeType,
    annotations: definition.annotations,
    inputSchema,
    inputShape,
  };
}

export function flattenResources(
  resources: DefineMcpServerOptions["resources"] = {},
  prefix: string[] = [],
): Array<[string, RawResourceDefinition]> {
  const flattened: Array<[string, RawResourceDefinition]> = [];

  for (const [key, value] of Object.entries(resources)) {
    const nextPrefix = [...prefix, ...key.split(".").filter(Boolean)];
    if (isRawResourceDefinition(value)) {
      flattened.push([nextPrefix.join("."), value]);
      continue;
    }
    flattened.push(...flattenResources(value, nextPrefix));
  }

  return flattened;
}

export function flattenResourceTemplates(
  resources: DefineMcpServerOptions["resourceTemplates"] = {},
  prefix: string[] = [],
): Array<[string, RawResourceTemplateDefinition]> {
  const flattened: Array<[string, RawResourceTemplateDefinition]> = [];

  for (const [key, value] of Object.entries(resources)) {
    const nextPrefix = [...prefix, ...key.split(".").filter(Boolean)];
    if (isRawResourceTemplateDefinition(value)) {
      flattened.push([nextPrefix.join("."), value]);
      continue;
    }
    flattened.push(...flattenResourceTemplates(value, nextPrefix));
  }

  return flattened;
}

export async function invokeResource(
  ctx: McpHttpCtx,
  resource:
    | NormalizedResourceDefinition
    | NormalizedResourceTemplateDefinition,
  args: Record<string, unknown>,
) {
  switch (resource.kind) {
    case "query":
      return await (ctx.runQuery as any)(resource.ref, args);
    case "action":
      return await (ctx.runAction as any)(resource.ref, args);
  }
}

export function findResourceByUri(
  resources: Map<string, NormalizedResourceDefinition>,
  resourceTemplates: Map<string, NormalizedResourceTemplateDefinition>,
  uri: string,
):
  | {
      kind: "resource";
      definition: NormalizedResourceDefinition;
      params: Record<string, never>;
    }
  | {
      kind: "template";
      definition: NormalizedResourceTemplateDefinition;
      params: Record<string, string | string[]>;
    }
  | null {
  for (const resource of resources.values()) {
    if (resource.uri === uri) {
      return {
        kind: "resource",
        definition: resource,
        params: {},
      };
    }
  }

  for (const resourceTemplate of resourceTemplates.values()) {
    const params = resourceTemplate.matcher.match(uri);
    if (params) {
      return {
        kind: "template",
        definition: resourceTemplate,
        params,
      };
    }
  }

  return null;
}

export function resource(
  ref: ResourceReference,
  options: ResourceOptions,
): RawResourceDefinition {
  return {
    ref,
    kind: options.kind,
    uri: options.uri,
    title: options.title,
    description: options.description,
    mimeType: options.mimeType,
    annotations: options.annotations,
    size: options.size,
  };
}

export function resourceTemplate<
  TParams extends ResourceTemplateOptions["params"] = undefined,
>(
  ref: ResourceReference,
  options: ResourceTemplateOptions<TParams>,
): RawResourceTemplateDefinition {
  return {
    ref,
    kind: options.kind,
    uriTemplate: options.uriTemplate,
    title: options.title,
    description: options.description,
    mimeType: options.mimeType,
    annotations: options.annotations,
    params: options.params,
  };
}

export function textResource(
  text: string,
  options: Omit<RawTextResourceContent, "type" | "text"> = {},
): RawTextResourceContent {
  return {
    type: "text",
    text,
    ...options,
  };
}

export function jsonResource(
  value: unknown,
  options: Omit<RawJsonResourceContent, "type" | "value"> = {},
): RawJsonResourceContent {
  return {
    type: "json",
    value,
    ...options,
  };
}

export function blobResource(
  blob: string,
  mimeType: string,
  options: Omit<RawBlobResourceContent, "type" | "blob" | "mimeType"> = {},
): RawBlobResourceContent {
  return {
    type: "blob",
    blob,
    mimeType,
    ...options,
  };
}

export function resourceResult(
  ...contents: Array<
    RawTextResourceContent | RawJsonResourceContent | RawBlobResourceContent
  >
): RawResourceResult {
  return {
    contents,
  };
}
