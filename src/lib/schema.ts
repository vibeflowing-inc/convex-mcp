import { z } from "zod";

import type {
  ConvexValidatorJson,
  ToolArgsBuilder,
  ToolArgsInput,
} from "./types.js";

function asJsonSchemaType(value: string | number | boolean | null) {
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "null";
  }
}

function recordValueSchema(
  validator: Extract<ConvexValidatorJson, { type: "record" }>,
) {
  return validator.value ?? validator.values ?? { type: "any" };
}

function objectFields(
  validator: Extract<ConvexValidatorJson, { type: "object" }>,
) {
  return Object.entries(validator.value);
}

export function convexValidatorToJsonSchema(
  validator: ConvexValidatorJson,
): Record<string, unknown> {
  switch (validator.type) {
    case "string":
      return { type: "string" };
    case "id":
      return validator.tableName
        ? {
            type: "string",
            description: `Convex document id for table "${validator.tableName}"`,
          }
        : { type: "string" };
    case "number":
    case "float64":
      return { type: "number" };
    case "int64":
      return {
        type: "string",
        description: "Convex int64 encoded as a base-10 string",
      };
    case "boolean":
      return { type: "boolean" };
    case "null":
      return { type: "null" };
    case "bytes":
      return {
        type: "string",
        contentEncoding: "base64",
      };
    case "literal":
      return {
        type: asJsonSchemaType(validator.value),
        const: validator.value,
      };
    case "array":
      return {
        type: "array",
        items: convexValidatorToJsonSchema(validator.value),
      };
    case "union":
      return {
        anyOf: validator.value.map(convexValidatorToJsonSchema),
      };
    case "record":
      return {
        type: "object",
        additionalProperties: convexValidatorToJsonSchema(
          recordValueSchema(validator),
        ),
      };
    case "object": {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [field, definition] of objectFields(validator)) {
        properties[field] = convexValidatorToJsonSchema(definition.fieldType);
        if (!definition.optional) {
          required.push(field);
        }
      }

      return {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      };
    }
    case "any":
      return {};
  }
}

export function convexValidatorToZod(
  validator: ConvexValidatorJson,
): z.ZodTypeAny {
  switch (validator.type) {
    case "string":
    case "id":
      return z.string();
    case "number":
    case "float64":
      return z.number();
    case "int64":
      return z
        .string()
        .regex(/^-?\d+$/)
        .describe("Convex int64 encoded as a base-10 string");
    case "boolean":
      return z.boolean();
    case "null":
      return z.null();
    case "bytes":
      return z.string().describe("Base64 encoded binary data");
    case "literal":
      return z.literal(validator.value);
    case "array":
      return z.array(convexValidatorToZod(validator.value));
    case "union": {
      const members = validator.value.map(convexValidatorToZod);
      if (members.length === 1) {
        return members[0];
      }
      const [head, second, ...rest] = members;
      return z.union([head, second, ...rest]);
    }
    case "record":
      return z.record(z.string(), convexValidatorToZod(recordValueSchema(validator)));
    case "object": {
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [field, definition] of objectFields(validator)) {
        let fieldSchema = convexValidatorToZod(definition.fieldType);
        if (definition.optional) {
          fieldSchema = fieldSchema.optional();
        }
        shape[field] = fieldSchema;
      }
      return z.object(shape);
    }
    case "any":
      return z.any();
  }
}

export function convexArgsToZodShape(
  validator: ConvexValidatorJson,
): Record<string, z.ZodTypeAny> {
  if (validator.type !== "object") {
    throw new Error("Convex MCP tool args must be an object validator.");
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [field, definition] of objectFields(validator)) {
    let fieldSchema = convexValidatorToZod(definition.fieldType);
    if (definition.optional) {
      fieldSchema = fieldSchema.optional();
    }
    shape[field] = fieldSchema;
  }
  return shape;
}

export function convexArgsToZodObject(
  validator: ConvexValidatorJson,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  return z.object(convexArgsToZodShape(validator));
}

type ArgsObjectSchema = z.ZodObject<Record<string, z.ZodTypeAny>>;

/**
 * Accepts a raw shape, a ZodObject (including object-level refinements,
 * `.strict()`, `.passthrough()`, ...) or a ZodObject piped into a transform.
 * Returns the full schema to validate with, plus the underlying object schema
 * used to describe the arguments.
 */
function resolveArgsSchema(
  schema: Record<string, z.ZodTypeAny> | z.ZodTypeAny,
): { full: z.ZodTypeAny; object: ArgsObjectSchema } {
  if (schema instanceof z.ZodObject) {
    return { full: schema, object: schema as ArgsObjectSchema };
  }
  if (schema instanceof z.ZodPipe && schema.in instanceof z.ZodObject) {
    return { full: schema, object: schema.in as ArgsObjectSchema };
  }
  if (schema instanceof z.ZodType) {
    throw new Error(
      "MCP args must be a Zod object shape, a z.object(...), or a z.object(...) piped into a transform.",
    );
  }
  const object = z.object(schema);
  return { full: object, object };
}

function createArgsBuilder(
  inferred: z.ZodObject<Record<string, z.ZodTypeAny>>,
) {
  return Object.assign(inferred, z, {
    inferred,
    shape: inferred.shape,
  }) as ToolArgsBuilder;
}

function dropSchemaKeyword(schema: Record<string, unknown>) {
  const { $schema: _schema, ...rest } = schema;
  return rest;
}

export function normalizeToolArgs(
  validator: ConvexValidatorJson,
  override?: ToolArgsInput,
) {
  const inferred = convexArgsToZodObject(validator);
  const next =
    typeof override === "function"
      ? override(createArgsBuilder(inferred))
      : (override ?? inferred);
  const { full, object } = resolveArgsSchema(next);

  return {
    inputSchema: full,
    inputShape: object.shape,
    inputSchemaJson: dropSchemaKeyword(
      z.toJSONSchema(object) as Record<string, unknown>,
    ),
  };
}

export function parseValidatorJson(serialized: string): ConvexValidatorJson {
  return JSON.parse(serialized) as ConvexValidatorJson;
}
