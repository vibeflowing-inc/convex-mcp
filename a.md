Title : Add CORS and OPTIONS preflight support for MCP HTTP routes

Description :
The current MCP HTTP route accepts only POST requests and does not return CORS headers, so browser-based clients cannot call the endpoint due to failed preflight (OPTIONS) checks. This limits adoption in web apps, playgrounds, and in-browser AI tools.

Feature request:
- Add configurable CORS support in addHttpRoutes/mcpHttp options.
- Handle OPTIONS requests with status 204 and proper Access-Control-Allow-* headers.
- Include CORS headers on POST responses (success and error responses).
- Allow safe defaults plus explicit configuration for origins, headers, and methods.

