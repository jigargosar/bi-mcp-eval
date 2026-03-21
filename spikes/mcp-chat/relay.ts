const PORT = 3099;

type Peer = {
  id: string;
  controller: ReadableStreamDefaultController;
};

const peers: Map<string, Peer> = new Map();

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/events") {
      const id = url.searchParams.get("id");
      if (!id) return new Response("missing id", { status: 400 });

      const stream = new ReadableStream({
        start(controller) {
          peers.set(id, { id, controller });
          console.log(`Peer connected: ${id} (total: ${peers.size})`);
        },
        cancel() {
          peers.delete(id);
          console.log(`Peer disconnected: ${id} (total: ${peers.size})`);
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
        const body = await req.json();
        const { id: senderId, text } = body as { id: string; text: string };
        const data = JSON.stringify({ from: senderId, text });
        let sent = 0;

        for (const [peerId, peer] of peers) {
          if (peerId === senderId) continue;
          peer.controller.enqueue(`data: ${data}\n\n`);
          sent++;
        }

        console.log(`Broadcast from ${senderId}: "${text}" → ${sent} peers`);
        return new Response(JSON.stringify({ sent }), {
          headers: { "Content-Type": "application/json" },
        });
      })();
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`Relay listening on http://127.0.0.1:${PORT}`);
