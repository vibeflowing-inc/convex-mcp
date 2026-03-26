import type { BearerAuthConfig, McpHttpOptions } from "./types.js";

function unauthorizedResponse() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "www-authenticate": "Bearer",
    },
  });
}

export function bearerAuth(options: {
  env: string;
  optional?: boolean;
}): BearerAuthConfig {
  return {
    type: "bearer",
    env: options.env,
    optional: options.optional ?? false,
  };
}

export function enforceAuth(
  options: McpHttpOptions | undefined,
  request: Request,
): Response | null {
  const auth = options?.auth;
  if (!auth) {
    return null;
  }

  const expected = process.env[auth.env];
  if (!expected) {
    if (auth.optional) {
      return null;
    }
    return new Response(`Missing required auth env "${auth.env}"`, {
      status: 500,
    });
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return unauthorizedResponse();
  }

  const token = header.slice("Bearer ".length);
  if (token !== expected) {
    return unauthorizedResponse();
  }

  return null;
}
