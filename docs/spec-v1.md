# V1 Spec

## Release Definition

Run a script that spawns 2+ Claude agents with different instructions.
They collaborate through the relay. A web page shows the conversation
in real-time (read-only).

## Architecture

Single server process. No separate relay. No MCP channels.

```
server (long-running parent)
├── claude agent "Alice" (child process, JSONL stdin/stdout)
├── claude agent "Bob" (child process, JSONL stdin/stdout)
└── viewer (web page served by server, SSE)
```

## Roles

### Server

The single process that does everything.

1. Spawns claude CLI processes in stream-json mode
2. Communicates with each agent via stdin/stdout JSONL pipes
3. Routes messages between agents
4. Serves viewer web page
5. Pushes messages to viewer via SSE
6. Logs everything to logs/
7. On Ctrl+C — kills all child processes, exits

### Agent

A claude CLI process in stream-json mode.

1. Spawned by server with instructions
2. Reads prompts from stdin (JSONL)
3. Writes responses to stdout (JSONL)
4. No direct connection to other agents — server routes everything

### Viewer

Static HTML page served by server. Read-only.

1. Two panels:
   a. Left: raw JSON dump of every message
   b. Right: formatted log — name, timestamp, content
2. Connects to server via SSE for live updates
3. No interaction — just watching

## Message Flow

1. Server sends prompt to Agent A via stdin
2. Agent A responds via stdout (JSONL)
3. Server reads response, logs it, forwards to:
   a. Other agents (as stdin prompt)
   b. Viewer (via SSE)

## Logging

All logging goes to logs/ at project root.

1. logs/server.log — all messages routed, process lifecycle
2. logs/{name}.log — per-agent, everything sent and received

Full payloads logged. No filtering.

## Build Order

1. Server spawns one claude process, sends a prompt, reads response
2. Add second agent, route messages between them
3. Add viewer web page with SSE
4. Add task config for defining agents and instructions
