import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const RELAY_PORT = 3099;
const SESSION_ID = process.env.SESSION_ID || crypto.randomUUID();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to spawn relay in detached mode — if port is taken, relay is already running
function ensureRelay() {
  const child = spawn("bun", ["run", join(__dirname, "relay.ts")], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

// Connect to relay SSE stream and push channel notifications
function connectToRelay() {
  const url = `http://127.0.0.1:${RELAY_PORT}/events?id=${SESSION_ID}`;

  async function connect() {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) {
        throw new Error(`Relay responded ${res.status}`);
      }
      console.error(`Connected to relay as ${SESSION_ID}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (match) {
            const { from, text } = JSON.parse(match[1]);
            await mcp.notification({
              method: "notifications/claude/channel",
              params: {
                content: text,
                meta: { from },
              },
            });
          }
        }
      }
    } catch {
      // Relay not ready yet, retry
    }

    setTimeout(connect, 2000);
  }

  connect();
}

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
      description: "Send a message to all other connected Claude sessions",
      inputSchema: {
        type: "object" as const,
        properties: {
          text: { type: "string", description: "Message to send" },
        },
        required: ["text"],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "send_message") {
    const { text } = request.params.arguments as { text: string };
    const res = await fetch(`http://127.0.0.1:${RELAY_PORT}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: SESSION_ID, text }),
    });
    const { sent } = (await res.json()) as { sent: number };
    return {
      content: [
        {
          type: "text" as const,
          text: `Sent to ${sent} peer${sent === 1 ? "" : "s"}`,
        },
      ],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

await mcp.connect(new StdioServerTransport());

ensureRelay();
setTimeout(connectToRelay, 1000);

console.error(`MCP chat server started (session: ${SESSION_ID})`);
