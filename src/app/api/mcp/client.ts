import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

function getMCPServerConfig() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isDevelopment) {
    // Development: Use tsx for fast iteration
    return {
      command: 'npx',
      args: ['tsx', 'src/app/api/mcp/mcp-server.ts'],
      description: 'Development mode with tsx (no compilation needed)'
    };
  } else if (isProduction) {
    // Production: Use compiled JavaScript for best performance
    return {
      command: 'node',
      args: ['dist/mcp-server.js'],
      description: 'Production mode with compiled JavaScript'
    };
  } else {
    // Fallback: Use tsx
    return {
      command: 'npx',
      args: ['tsx', 'src/app/api/mcp/mcp-server.ts'],
      description: 'Fallback mode with tsx'
    };
  }
}

export default async function createMCPClient(): Promise<Client> {
  // Start the MCP server process
  // const serverProcess = spawn('node', ['mcp-server.js'], {
  //   stdio: ['pipe', 'pipe', 'pipe']
  // });

  const mcpConfig = getMCPServerConfig();
  console.log(`Starting MCP server with command: ${mcpConfig.command} - ${mcpConfig.description}`);
  // McpClient uses node's spawn 'child_process' internally... 🤯 !!
  const transport = new StdioClientTransport({
    command: mcpConfig.command,
    args: mcpConfig.args,
  });

  // Create and connect the client
  const client = new Client({
    name: 'job-track-mcp-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  return client;
}