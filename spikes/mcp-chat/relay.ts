const VERSION = "0.0.5";
import { appendFileSync } from "fs";

const PORT = 3099;
const LOG_FILE = `C:/Users/jigar/projects/bi-mcp-eval/spikes/mcp-chat/relay-${Date.now()}.log`;

function log(label: string, data: unknown) {
  const line = `[${new Date().toISOString()}] ${label}: ${JSON.stringify(data, null, 2)}\n`;
  appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

type Peer = {
  id: string;
  controller: ReadableStreamDefaultController;
  heartbeat: ReturnType<typeof setInterval>;
};

const encoder = new TextEncoder();
const peers: Map<string, Peer> = new Map();
let nextPeerIndex = 0;

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 255,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/events") {
      const id = url.searchParams.get("id");
      if (!id) return new Response("missing id", { status: 400 });

      log("SSE_CONNECT", {
        id,
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries()),
      });

      const stream = new ReadableStream({
        start(controller) {
          const heartbeat = setInterval(() => {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }, 15000);
          const peerIndex = nextPeerIndex++;
          peers.set(id, { id, controller, heartbeat });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "role", peerIndex, peerId: id })}\n\n`));
          log("PEER_CONNECTED", { id, peerIndex, totalPeers: peers.size });
        },
        cancel() {
          const peer = peers.get(id);
          if (peer) clearInterval(peer.heartbeat);
          peers.delete(id);
          log("PEER_DISCONNECTED", { id, totalPeers: peers.size });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    if (url.pathname === "/send" && req.method === "POST") {
      return (async () => {
        const rawBody = await req.text();
        log("SEND_REQUEST", {
          method: req.method,
          url: req.url,
          headers: Object.fromEntries(req.headers.entries()),
          rawBody,
        });

        const body = JSON.parse(rawBody);
        const { id: senderId, text } = body as { id: string; text: string };
        const data = JSON.stringify({ from: senderId, text });
        let sent = 0;

        for (const [peerId, peer] of peers) {
          if (peerId === senderId) continue;
          peer.controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          sent++;
        }

        log("BROADCAST", { senderId, text, sent });
        return new Response(JSON.stringify({ sent }), {
          headers: { "Content-Type": "application/json" },
        });
      })();
    }

    log("UNKNOWN_REQUEST", {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
    });
    return new Response("not found", { status: 404 });
  },
});

log("RELAY_START", { VERSION, port: PORT, logFile: LOG_FILE });
