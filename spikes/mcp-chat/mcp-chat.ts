const VERSION = "0.0.5";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { appendFileSync } from "fs";

const LOG_FILE = `C:/Users/jigar/projects/bi-mcp-eval/spikes/mcp-chat/mcp-chat-${Date.now()}.log`;
const RELAY_PORT = 3099;
const SESSION_ID = process.env.SESSION_ID || crypto.randomUUID();
let peerIndex: number | null = null;

function dump(label: string, data: unknown) {
  const line = `[${new Date().toISOString()}] ${label}: ${JSON.stringify(data, null, 2)}\n`;
  appendFileSync(LOG_FILE, line);
  console.error(line.trim());
}

dump("STARTUP", { VERSION, SESSION_ID, logFile: LOG_FILE });
dump("ALL_ENV_VARS", process.env);

// Connect to relay SSE stream and push channel notifications
function connectToRelay() {
  const url = `http://127.0.0.1:${RELAY_PORT}/events?id=${SESSION_ID}`;

  async function connect() {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) {
        throw new Error(`Relay responded ${res.status}`);
      }
      dump("RELAY_CONNECTED", { SESSION_ID, url });

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
            const msg = JSON.parse(match[1]);
            dump("SSE_MESSAGE", msg);
            if (msg.type === "role") {
              peerIndex = msg.peerIndex;
              continue;
            }
            const { from, text } = msg;
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
    } catch (err) {
      dump("RELAY_ERROR", { error: String(err) });
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
      'Messages from other Claude sessions arrive as <channel source="chat">. On connect you receive a peerIndex (0=leader, 1+=follower). Leader initiates, followers defer.',
  }
);

mcp.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
  dump("LIST_TOOLS_REQUEST", request);
  dump("LIST_TOOLS_EXTRA", extra);
  return {
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
      {
        name: "get_role",
        description: "Get this session's role (peerIndex 0=leader, 1+=follower) and session ID",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
    ],
  };
});

mcp.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  dump("CALL_TOOL_REQUEST", request);
  dump("CALL_TOOL_EXTRA", extra);
  if (request.params.name === "get_role") {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ sessionId: SESSION_ID, peerIndex, role: peerIndex === 0 ? "leader" : "follower" }),
        },
      ],
    };
  }
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

const transport = new StdioServerTransport();
transport.onmessage = (msg: unknown) => {
  dump("RAW_INCOMING_MESSAGE", msg);
};
await mcp.connect(transport);

connectToRelay();

dump("MCP_SERVER_READY", { SESSION_ID });
