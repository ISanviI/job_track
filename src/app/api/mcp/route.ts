import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import createMCPClient from './client';
import { z } from 'zod';

const mcpClients = new Map<string, Client>();

const ChatRequestSchema = z.object({
  message: z.string(),
  conversationId: z.string().optional()
});
// const ChatResponseSchema = z.object({
//   response: z.string(),
//   toolsUsed: z.array(z.string()),
//   conversationId: z.string()
// });
// const MCPClientSchema = z.object({
//   command: z.string(),
//   args: z.array(z.string()),
//   description: z.string()
// })

function buildSystemPrompt(tools: any[], resources: any[] = ["No resource available."]): string {
  const toolDescriptions = tools.map(tool =>
    `${tool.name}: ${tool.description}
    Parameters: ${JSON.stringify(tool.inputSchema)}`
  ).join('\n');

  const resourceDescriptions = resources.map(resource =>
    `${resource.uri}: ${resource.description}`
  ).join('\n');

  return `You are a helpful AI assistant with access to tools and resources.

Available tools (respond with JSON when you want to use them):
${toolDescriptions}

Available resources:
${resourceDescriptions}

When you want to use tools, respond with JSON in this exact format:
{"tool_calls": [{"name": "tool1", "params": {"param1": "value1", "param2": "value2"}}, {"name": "tool2", "params": {"param1": "value1", "param2": "value2"}}]}

If you don't need to use any tools, respond normally.`;
}

async function callOllama(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3.2:latest', // or whatever model you have installed
      prompt: `${systemPrompt}\n\nUser: ${userMessage}\nAssistant:`,
      stream: false
    })
  });

  const data = await response.json();
  return data.response;
}

function parseToolCalls(response: string): Array<{name: string, params: any}> {
  const toolCalls: Array<{name: string, params: any}> = [];
  
  try {
    // Look for JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (parsed.tool_call) {
        toolCalls.push(parsed.tool_call);
      } else if (parsed.tool_calls) {
        toolCalls.push(...parsed.tool_calls);
      }
    }
  } catch (error) {
    console.warn('Failed to parse tool calls:', error);
  }
  
  return toolCalls;
}

async function processMessage(mcpClient: Client, message: string) {
  // Step 1: Discover available tools and resources
  const [toolsResult] = await Promise.all([
    mcpClient.listTools(),
  ]);

  const availableTools = toolsResult.tools || [];
  // Step 2: Build system prompt
  const systemPrompt = buildSystemPrompt(availableTools);

  // Step 3: Send to Ollama for initial processing
  const initialResponse = await callOllama(systemPrompt, message);

  // Step 4: Parse response for tool calls
  const toolCalls = parseToolCalls(initialResponse);
  const toolsUsed: string[] = [];

  // Step 5: Execute any tool calls
  let finalResponse = initialResponse;
  if (toolCalls.length > 0) {
    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall) => {
        try {
          const result = await mcpClient.callTool(
            {
              method: 'tools/call',
              name: toolCall.name,
              params: toolCall.params
            }
          );
          toolsUsed.push(toolCall.name);
          return `Tool ${toolCall.name} result: ${JSON.stringify(result)}`;
        } catch (error: String | any) {
          return `Tool ${toolCall.name} error: ${error.message}`;
        }
      })
    );

    // Step 6: Send tool results back to Ollama for final response
    const toolResultsText = toolResults.join('\n');
    const contextMessage = `Based on the following tool results, provide a comprehensive response as per the user request:\n\nTool Results - ${toolResultsText}`;
    finalResponse = await callOllama(contextMessage, message);
  }

  return {
    response: finalResponse,
    toolsUsed
  };
}

// Store active MCP clients (in production, use proper session management)
export async function POST(req: NextRequest, res: NextResponse) { 
  try {
    const body = await req.json();
    const { message, conversationId = 'default' } = ChatRequestSchema.parse(body);

    // Get or create MCP client
    let mcpClient = mcpClients.get(conversationId);
    if (!mcpClient) {
      mcpClient = await createMCPClient();
      mcpClients.set(conversationId, mcpClient);
    }

    // Process the user's message
    const result = await processMessage(mcpClient, message);

    return new Response(JSON.stringify({
      text: result.response,
      toolsUsed: result.toolsUsed,
      conversationId
    }));

  } catch (error: String | any) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: `Chat API error: ${error}` }));
  }
}