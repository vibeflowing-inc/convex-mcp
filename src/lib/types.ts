import type {
  Annotations,
  BlobResourceContents,
  ContentBlock,
  GetPromptResult,
  PromptArgument,
  PromptMessage,
  ReadResourceResult,
  Role,
  TextResourceContents,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { UriTemplate } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import type { FunctionReference, GenericActionCtx, HttpRouter } from "convex/server";
import type { z } from "zod";

export type ConvexFunctionKind = "query" | "mutation" | "action";
export type ConvexReadKind = Exclude<ConvexFunctionKind, "mutation">;

export type ConvexValidatorJson =
  | {
      type:
        | "string"
        | "number"
        | "float64"
        | "boolean"
        | "null"
        | "any"
        | "bytes";
    }
  | {
      type: "id";
      tableName?: string;
    }
  | {
      type: "int64";
    }
  | {
      type: "literal";
      value: string | number | boolean | null;
    }
  | {
      type: "array";
      value: ConvexValidatorJson;
    }
  | {
      type: "union";
      value: ConvexValidatorJson[];
    }
  | {
      type: "record";
      keys?: ConvexValidatorJson;
      key?: ConvexValidatorJson;
      values?: ConvexValidatorJson;
      value?: ConvexValidatorJson;
    }
  | {
      type: "object";
      value: Record<
        string,
        {
          fieldType: ConvexValidatorJson;
          optional: boolean;
        }
      >;
    };

export type ToolReference = FunctionReference<any, any>;

export interface ToolOptions {
  kind: ConvexFunctionKind;
  title?: string;
  description?: string;
  annotations?: ToolAnnotations;
  args: ToolArgsInput;
}

export interface RawToolDefinition {
  ref: ToolReference;
  kind: ConvexFunctionKind;
  title?: string;
  description?: string;
  annotations?: ToolAnnotations;
  args: ToolOptions["args"];
}

export interface ToolTree {
  [key: string]: RawToolDefinition | ToolTree;
}

export type ToolArgsShape = Record<string, z.ZodTypeAny>;
export type ToolArgsSchema = z.ZodObject<ToolArgsShape>;
export type ToolArgsBuilder = ToolArgsSchema &
  typeof import("zod")["z"] & {
    inferred: ToolArgsSchema;
    shape: ToolArgsShape;
  };
export type ToolArgsInput =
  | ToolArgsShape
  | ToolArgsSchema
  | ((builder: ToolArgsBuilder) => ToolArgsShape | ToolArgsSchema);

type ArgsSchemaFromInput<TArgs extends ToolArgsInput> =
  TArgs extends (...args: never[]) => infer R
    ? R extends ToolArgsSchema
      ? R
      : R extends ToolArgsShape
        ? z.ZodObject<R>
        : ToolArgsSchema
    : TArgs extends ToolArgsSchema
      ? TArgs
      : TArgs extends ToolArgsShape
        ? z.ZodObject<TArgs>
        : ToolArgsSchema;

export type PromptArgsInput = ToolArgsInput;
export type PromptArgsShape = ToolArgsShape;
export type PromptArgsSchema = ToolArgsSchema;
export type PromptArgsBuilder = ToolArgsBuilder;
export type PromptArgsOutput<TArgs extends PromptArgsInput | undefined> =
  TArgs extends PromptArgsInput
    ? z.output<ArgsSchemaFromInput<TArgs>>
    : Record<string, never>;
export type PromptResponse =
  | GetPromptResult
  | PromptMessage
  | PromptMessage[];
export type PromptHandler<TArgs extends PromptArgsInput | undefined = undefined> = (
  args: PromptArgsOutput<TArgs>,
) => PromptResponse | Promise<PromptResponse>;

export interface PromptOptions<
  TArgs extends PromptArgsInput | undefined = undefined,
> {
  title?: string;
  description?: string;
  args?: TArgs;
}

export interface RawPromptDefinition {
  title?: string;
  description?: string;
  args?: PromptArgsInput;
  handler: PromptHandler<any>;
}

export interface PromptTree {
  [key: string]: RawPromptDefinition | PromptTree;
}

export type ResourceReference = FunctionReference<any, any>;
export type ResourceParamsInput = ToolArgsInput;
export type ResourceParamsShape = ToolArgsShape;
export type ResourceParamsSchema = ToolArgsSchema;
export type ResourceParamsBuilder = ToolArgsBuilder;
export type ResourceParamsOutput<TParams extends ResourceParamsInput | undefined> =
  TParams extends ResourceParamsInput
    ? z.output<ArgsSchemaFromInput<TParams>>
    : Record<string, never>;

export interface ResourceOptions {
  kind: ConvexReadKind;
  uri: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Annotations;
  size?: number;
}

export interface RawResourceDefinition {
  ref: ResourceReference;
  kind: ConvexReadKind;
  uri: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Annotations;
  size?: number;
}

export interface ResourceTree {
  [key: string]: RawResourceDefinition | ResourceTree;
}

export interface ResourceTemplateOptions<
  TParams extends ResourceParamsInput | undefined = undefined,
> {
  kind: ConvexReadKind;
  uriTemplate: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Annotations;
  params?: TParams;
}

export interface RawResourceTemplateDefinition {
  ref: ResourceReference;
  kind: ConvexReadKind;
  uriTemplate: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Annotations;
  params?: ResourceParamsInput;
}

export interface ResourceTemplateTree {
  [key: string]: RawResourceTemplateDefinition | ResourceTemplateTree;
}

export interface RawTextResourceContent {
  type: "text";
  text: string;
  uri?: string;
  mimeType?: string;
  _meta?: Record<string, unknown>;
}

export interface RawBlobResourceContent {
  type: "blob";
  blob: string;
  uri?: string;
  mimeType?: string;
  _meta?: Record<string, unknown>;
}

export interface RawJsonResourceContent {
  type: "json";
  value: unknown;
  uri?: string;
  mimeType?: string;
  _meta?: Record<string, unknown>;
}

export type ResourceContentInput =
  | RawTextResourceContent
  | RawBlobResourceContent
  | RawJsonResourceContent;

export interface RawResourceResult {
  contents: ResourceContentInput[];
}

export type ResourceResponse =
  | ReadResourceResult
  | RawResourceResult
  | ResourceContentInput
  | ResourceContentInput[]
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];

export interface NormalizedToolDefinition {
  name: string;
  kind: ConvexFunctionKind;
  title?: string;
  description?: string;
  annotations?: ToolAnnotations;
  ref: ToolReference;
  inputShape: Record<string, z.ZodTypeAny>;
  inputSchemaJson: Record<string, unknown>;
}

export interface NormalizedPromptDefinition {
  name: string;
  title?: string;
  description?: string;
  arguments?: PromptArgument[];
  inputShape: Record<string, z.ZodTypeAny>;
  handler: PromptHandler<any>;
}

export interface NormalizedResourceDefinition {
  name: string;
  kind: ConvexReadKind;
  ref: ResourceReference;
  uri: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Annotations;
  size?: number;
}

export interface NormalizedResourceTemplateDefinition {
  name: string;
  kind: ConvexReadKind;
  ref: ResourceReference;
  uriTemplate: string;
  matcher: UriTemplate;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Annotations;
  inputShape: Record<string, z.ZodTypeAny>;
}

export interface DefineMcpServerOptions {
  name: string;
  version: string;
  tools?: ToolTree;
  prompts?: PromptTree;
  resources?: ResourceTree;
  resourceTemplates?: ResourceTemplateTree;
}

export interface BearerAuthConfig {
  type: "bearer";
  env: string;
  optional: boolean;
}

export interface McpCorsConfig {
  origin?: "*" | string | string[];
  allowHeaders?: string[];
  allowMethods?: string[];
  exposeHeaders?: string[];
  maxAgeSeconds?: number;
  allowCredentials?: boolean;
}

export interface McpHttpOptions {
  auth?: BearerAuthConfig;
  cors?: boolean | McpCorsConfig;
}

export interface AddMcpHttpRoutesOptions extends McpHttpOptions {
  path?: string;
}

export type McpHttpCtx = Pick<
  GenericActionCtx<any>,
  "runAction" | "runMutation" | "runQuery"
>;

export type McpHttpRouter = Pick<HttpRouter, "route">;

export type PromptRole = Role;
export type PromptContent = ContentBlock;
export type ResourceAnnotations = Annotations;
export type ResourceTextContents = TextResourceContents;
export type ResourceBlobContents = BlobResourceContents;
