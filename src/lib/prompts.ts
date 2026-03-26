import type {
  ContentBlock,
  GetPromptResult,
  PromptMessage,
} from "@modelcontextprotocol/sdk/types.js";

import { normalizeToolArgs } from "./schema.js";
import type {
  DefineMcpServerOptions,
  NormalizedPromptDefinition,
  PromptContent,
  PromptHandler,
  PromptOptions,
  PromptResponse,
  PromptRole,
  RawPromptDefinition,
} from "./types.js";

const EMPTY_OBJECT_VALIDATOR = {
  type: "object",
  value: {},
} as const;

function toPromptArguments(shape: Record<string, { description?: string; safeParse: (value: unknown) => { success: boolean } }>) {
  const entries = Object.entries(shape);
  if (entries.length === 0) {
    return undefined;
  }

  return entries.map(([name, schema]) => ({
    name,
    description: schema.description,
    required: !schema.safeParse(undefined).success,
  }));
}

export function normalizePrompt(
  name: string,
  definition: RawPromptDefinition,
): NormalizedPromptDefinition {
  const path = name.split(".").filter(Boolean);

  if (path.length === 0) {
    throw new Error(`Prompt name "${name}" must be a dot-delimited path.`);
  }

  const { inputShape } = normalizeToolArgs(
    EMPTY_OBJECT_VALIDATOR,
    definition.args,
  );

  return {
    name,
    title: definition.title,
    description: definition.description,
    arguments: toPromptArguments(inputShape as any),
    inputShape,
    handler: definition.handler,
  };
}

function isRawPromptDefinition(value: unknown): value is RawPromptDefinition {
  return !!value && typeof value === "object" && "handler" in value;
}

export function flattenPrompts(
  prompts: DefineMcpServerOptions["prompts"] = {},
  prefix: string[] = [],
): Array<[string, RawPromptDefinition]> {
  const flattened: Array<[string, RawPromptDefinition]> = [];

  for (const [key, value] of Object.entries(prompts)) {
    const nextPrefix = [...prefix, ...key.split(".").filter(Boolean)];
    if (isRawPromptDefinition(value)) {
      flattened.push([nextPrefix.join("."), value]);
      continue;
    }
    flattened.push(...flattenPrompts(value, nextPrefix));
  }

  return flattened;
}

export function prompt<TArgs extends PromptOptions["args"] = undefined>(
  options: PromptOptions<TArgs>,
  handler: PromptHandler<TArgs>,
): RawPromptDefinition {
  return {
    title: options.title,
    description: options.description,
    args: options.args,
    handler,
  };
}

export function promptMessage(
  role: PromptRole,
  content: PromptContent,
): PromptMessage {
  return { role, content };
}

export function textContent(text: string): Extract<ContentBlock, { type: "text" }> {
  return {
    type: "text",
    text,
  };
}

export function userText(text: string): PromptMessage {
  return promptMessage("user", textContent(text));
}

export function assistantText(text: string): PromptMessage {
  return promptMessage("assistant", textContent(text));
}

export function promptResult(
  messages: PromptMessage[],
  description?: string,
): GetPromptResult {
  return {
    description,
    messages,
  };
}

export function toPromptResult(result: PromptResponse): GetPromptResult {
  if (Array.isArray(result)) {
    return {
      messages: result,
    };
  }

  if (isPromptMessage(result)) {
    return {
      messages: [result],
    };
  }

  return result;
}

function isPromptMessage(value: PromptResponse): value is PromptMessage {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    "role" in value && "content" in value;
}
