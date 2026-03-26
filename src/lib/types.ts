import type {
  ContentBlock,
  GetPromptResult,
  PromptArgument,
  PromptMessage,
  Role,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { FunctionReference, GenericActionCtx, HttpRouter } from "convex/server";
import type { z } from "zod";

export type ConvexFunctionKind = "query" | "mutation" | "action";

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

type ToolArgsSchemaFromInput<TArgs extends ToolArgsInput> =
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
    ? z.output<ToolArgsSchemaFromInput<TArgs>>
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

export interface DefineMcpServerOptions {
  name: string;
  version: string;
  tools?: ToolTree;
  prompts?: PromptTree;
}

export interface BearerAuthConfig {
  type: "bearer";
  env: string;
  optional: boolean;
}

export interface McpHttpOptions {
  auth?: BearerAuthConfig;
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
