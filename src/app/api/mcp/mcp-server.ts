import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { predictMajorityIndustry } from '@/app/api/mcp/inferenceEngine';
import { z } from "zod";

const getIndustrySchema = z.object({
  companyNames: z.array(z.string())
});
// Convert Zod schema to JSON Schema
const getIndustryJsonSchema = {
  type: "object",
  properties: {
    companyNames: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },
  required: ["companyNames"]
};
const toolsListSchema = z.object({
  method: z.literal('tools/list')
});
const toolsCallSchema = z.object({
  method: z.literal('tools/call'),
  name: z.string(),
  params: z.object({
    companyNames: z.array(z.string())
  })
});
const resourcesListSchema = z.object({
  method: z.literal('resources/list')
});

// Initialize MCP Server
// export const mcpServer = new McpServer({
//   name: 'jobTrack-mcp-server',
//   version: '1.0.0',
// });

// Suggest similar companies tool
// mcpServer.registerTool("getIndustry",
//   {
//     title: "Get Industry",
//     description: "A tool that helps you get the industry based on the details of different companies provided. It uses a custom model to predict the majority industry based on the features of the companies.",
//     inputSchema: { features: getIndustrySchema },
//   },
//   async (input: { features: string[] }) => {
//     try {
//       const similarCompanies = await predictMajorityIndustry(input.features);
//       if (!similarCompanies) {
//         console.log("No common majority industry found");
//         return {
//           content: [
//             {
//               type: "text",
//               text: "No common majority industry found."
//             }
//           ]
//         };
//       }
//       else {
//         console.log("Found majority industry based on companies - ", JSON.stringify(similarCompanies));
//         return {
//           content: [
//             {
//               type: "text",
//               text: JSON.stringify(similarCompanies)
//             }
//           ]
//         };
//       }
//     } catch (error: string | any) {
//       console.error("Error finding majority industry for similar companies:", error);
//       return {
//         content: [
//           {
//             type: "text",
//             text: `Error finding majority industry for similar companies: ${error.message}`
//           }
//         ]
//       };
//     }
//   }
// );

export const server = new Server(
  {
    name: 'job-track-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      // resources: {},
      // prompts: {}
    },
  }
);

server.setRequestHandler(toolsListSchema, async () => {
  return {
    tools: [
      {
        name: 'get_industry',
        description: 'Get the majority industry based on the details of different companies provided.',
        inputSchema: getIndustryJsonSchema
      }
    ]
  };
});

server.setRequestHandler(toolsCallSchema, async (request) => {
  const { name, params } = request;
  
  try {
    switch (name) {
      case 'get_industry':
        const companies = getIndustrySchema.parse(params);
        const result = await predictMajorityIndustry(companies);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result)
          }],
          isError: false
        }
        
      default:
        return {
          content: [{
            type: "text",
            text: `Unknown tool: ${name}`
          }],
          isError: true
        };
    }
  } catch (error: String | any) {
    console.log("Error handling tool request:", error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${error}`
      }],
      isError: true
    };
  }
});

// async function runServer() {
const transport = new StdioServerTransport();
server.connect(transport);
// }

export default server;