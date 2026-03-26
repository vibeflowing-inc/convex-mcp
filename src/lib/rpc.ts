const JSON_RPC_VERSION = "2.0";

export const JSON_HEADERS = {
  "content-type": "application/json",
};

export function okResponse(
  id: number | string | null,
  result: unknown,
  protocolVersion: string,
) {
  return new Response(
    JSON.stringify({
      jsonrpc: JSON_RPC_VERSION,
      id,
      result,
    }),
    {
      status: 200,
      headers: {
        ...JSON_HEADERS,
        "mcp-protocol-version": protocolVersion,
      },
    },
  );
}

export function errorResponse(
  id: number | string | null,
  code: number,
  message: string,
  protocolVersion: string,
  status = 200,
) {
  return new Response(
    JSON.stringify({
      jsonrpc: JSON_RPC_VERSION,
      id,
      error: {
        code,
        message,
      },
    }),
    {
      status,
      headers: {
        ...JSON_HEADERS,
        "mcp-protocol-version": protocolVersion,
      },
    },
  );
}
