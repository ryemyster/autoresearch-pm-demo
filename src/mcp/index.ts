// MCP server entry point — wires the server to stdio transport.
// Run: node dist/mcp/index.js
// Or register with Claude Code: claude mcp add autoresearch-demo -- node dist/mcp/index.js

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { assertApiKey } from "../shared/config.js";

assertApiKey();

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
