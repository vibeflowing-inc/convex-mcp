export { bearerAuth } from "./auth.js";
export { defineMcpServer, tool } from "./server.js";
export {
  assistantText,
  prompt,
  promptMessage,
  promptResult,
  textContent,
  userText,
} from "./prompts.js";
export { convexValidatorToJsonSchema, convexValidatorToZod } from "./schema.js";
export { toCallToolResult, toErrorToolResult } from "./result.js";
export type {
  AddMcpHttpRoutesOptions,
  BearerAuthConfig,
  ConvexFunctionKind,
  DefineMcpServerOptions,
  McpHttpRouter,
  McpHttpCtx,
  McpHttpOptions,
  NormalizedPromptDefinition,
  NormalizedToolDefinition,
  PromptArgsBuilder,
  PromptArgsInput,
  PromptArgsOutput,
  PromptArgsSchema,
  PromptArgsShape,
  PromptContent,
  PromptHandler,
  PromptOptions,
  PromptResponse,
  PromptRole,
  PromptTree,
  RawPromptDefinition,
  RawToolDefinition,
  ToolReference,
  ToolOptions,
} from "./types.js";
