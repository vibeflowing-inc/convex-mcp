# Changelog

## Unreleased

### Fixed

- Tool calls whose Convex function returned an `int64` (bigint) were reported as errors after the mutation had already committed, so clients that retry on error applied the mutation again. Results are now serialized outside the error path.
- `bytes` results no longer serialize as `{}`, and `NaN` / `Infinity` no longer become `null`. Bigints are sent as base-10 strings and bytes as base64.
- Object-level `.refine()`, `.superRefine()` and `.strict()` on tool, prompt and resource-template args were silently dropped. The full schema is now used for validation.
- Args schemas built as `z.object(...).transform(...)` are supported instead of crashing with an opaque `TypeError`.
- An oversized resource URI, or any other unexpected error in one message, no longer fails the whole HTTP request and discards the responses of earlier messages in a batch.

## 0.1.0 (2026-03-31)

Initial release.

- MCP tool registration from Convex function refs
- Prompt definitions with Zod args
- Static resources and resource templates
- Bearer token auth
- Streamable HTTP transport
