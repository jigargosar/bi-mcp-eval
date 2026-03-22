# V1 Spec

## Release Definition

Run a script that spawns 2+ Claude agents with different instructions.
They collaborate through the relay. A web page shows the conversation
in real-time (read-only).

## Roles

### Orchestrator

Long-running parent process. The entry point.

1. Starts relay as a child process
2. Connects to relay as a peer (name: "orchestrator")
3. Reads a task config — list of agents with names and instructions
4. Spawns N claude CLI processes as child processes
5. Holds all process handles — keeps everything alive
6. On Ctrl+C — kills all child processes, exits

### Relay

SSE message broker. Stateless broadcast.

1. Accepts SSE connections at /events?id=X&name=Y
2. Assigns peer index on connect (0, 1, 2, ...)
3. Sends role message on connect: { from, name, peerIndex }
4. Broadcasts messages to all peers except sender
5. Serves viewer HTML at /

### Agent

A claude CLI process managed by the orchestrator.

1. Receives SESSION_ID and NAME via env vars from orchestrator
2. MCP chat server connects to relay using those env vars
3. Receives instructions from orchestrator via relay message
4. Communicates with other agents via relay
5. All sends and receives logged to logs/{name}.log

### Viewer

Static HTML page served by relay. Read-only.

1. Connects to relay SSE stream as a peer
2. Two panels:
   a. Left: raw JSON dump of every message
   b. Right: formatted log — name, timestamp, content
3. No interaction — just watching

## Message Format

Every message carries all fields everywhere. No stripping.

```json
{
  "from": "session-id",
  "name": "Alice",
  "text": "the actual content"
}
```

On SSE connect, relay sends:

```json
{
  "from": "session-id",
  "name": "Alice",
  "peerIndex": 0
}
```

## Process Tree

```
orchestrator (parent)
├── relay (child process)
├── claude agent "Alice" (child process)
├── claude agent "Bob" (child process)
└── ... more agents
```

Viewer is not a process — it's a web page served by relay.

## Task Config

The orchestrator reads a config to know what to spawn:

```json
{
  "task": "Debate whether tabs or spaces are better",
  "agents": [
    { "name": "Alice", "instructions": "Argue for tabs" },
    { "name": "Bob", "instructions": "Argue for spaces" }
  ]
}
```

Format TBD — could be JSON, could be CLI args.

## Logging

All logging goes to logs/ at project root.

1. logs/relay.log — everything relay sends and receives
2. logs/{name}.log — per-agent, everything sent and received
3. logs/orchestrator.log — process lifecycle events

Full payloads logged. No filtering.

## Open Questions

1. How to spawn claude CLI with per-agent instructions — need to verify
   available flags (--system-prompt? --print? MCP instructions field?)
2. How to configure MCP chat server per-agent — single shared .mcp.json
   with env var substitution, or generated per-agent configs?
3. Task config format — JSON file, CLI args, or something else?
