# V1 Roadmap

Run a script that spawns 2+ Claude agents with different instructions.
They collaborate through the relay. A web page shows the conversation
in real-time (read-only).

## Features

- [ ] Message protocol — add `name` field to messages
- [ ] Orchestrator — script that starts relay, spawns claude processes with per-agent instructions
- [ ] Viewer — read-only web page with two panels: raw dump (all JSON) and formatted log (human-readable)
- [ ] Demo — example config that runs a multi-agent debate
