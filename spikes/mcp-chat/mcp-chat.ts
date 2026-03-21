import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = parseInt(process.env.PORT || "3001");

const mcp = new Server(
  { name: "chat", version: "0.0.1" },
  {
    capabilities: {
      tools: {},
      experimental: { "claude/channel": {} },
    },
    instructions:
      'Messages from other Claude sessions arrive as <channel source="chat">.',
  }
);

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "send_message",
      description: "Send a message to another Claude session",
      inputSchema: {
        type: "object" as const,
        properties: {
          text: { type: "string", description: "Message to send" },
          target_port: {
            type: "number",
            description: "Port of the target session",
          },
        },
        required: ["text", "target_port"],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "send_message") {
    const { text, target_port } = request.params.arguments as {
      text: string;
      target_port: number;
    };
    const res = await fetch(`http://127.0.0.1:${target_port}/message`, {
      method: "POST",
      body: text,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: res.ok
            ? `Sent to port ${target_port}`
            : `Failed: ${res.status}`,
        },
      ],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

await mcp.connect(new StdioServerTransport());

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const text = await req.text();
    await mcp.notification({
      method: "notifications/claude/channel",
      params: { content: text, meta: { port: PORT } },
    });
    return new Response("ok");
  },
});

console.error(`Chat listener on port ${PORT}`);
