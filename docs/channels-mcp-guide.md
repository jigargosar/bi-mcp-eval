# Claude Code Channels (MCP Push Messages)

Research preview feature (v2.1.80+) that lets MCP servers push messages into a running Claude Code session. Unlike normal MCP where Claude queries servers on-demand, channels are event-driven.

## Usage

```bash
claude --channels plugin:telegram@claude-plugins-official
claude --channels plugin:discord@claude-plugins-official
claude --channels server:webhook    # custom server during development
```

## How an MCP Server Becomes a Channel

1. Declare the capability in the MCP Server constructor:
   ```
   capabilities: { experimental: { 'claude/channel': {} } }
   ```

2. Emit notifications when events arrive:
   ```
   mcp.notification({
     method: 'notifications/claude/channel',
     params: { content: body, meta: { ... } }
   })
   ```

## Minimal Custom Channel Example (webhook receiver)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const mcp = new Server(
  { name: 'webhook', version: '0.0.1' },
  {
    capabilities: { experimental: { 'claude/channel': {} } },
    instructions: 'Events from the webhook channel arrive as <channel source="webhook">.',
  },
)

await mcp.connect(new StdioServerTransport())

Bun.serve({
  port: 8788,
  hostname: '127.0.0.1',
  async fetch(req) {
    const body = await req.text()
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: body,
        meta: { path: new URL(req.url).pathname, method: req.method },
      },
    })
    return new Response('ok')
  },
})
```

## Built-in Channel Plugins

1. **Telegram**
   a. `/plugin install telegram@claude-plugins-official`
   b. `/telegram:configure <bot-token>`
   c. `claude --channels plugin:telegram@claude-plugins-official`
   d. `/telegram:access pair <code>`
   e. `/telegram:access policy allowlist`

2. **Discord** -- same pattern with `discord@claude-plugins-official`

3. **Fakechat** -- localhost demo with a web UI, good for testing

## Permission Relay (v2.1.81)

Channel servers can optionally declare a permission capability to relay tool approval prompts. When Claude needs permission to run a tool and you're away from the terminal, the channel (e.g. Telegram) can send the approval request to your phone and you approve remotely.

## Security Model

1. Sender allowlist -- only approved senders can push messages
2. Pairing flow -- send a message to the bot, get a code, approve in Claude Code
3. Session-level -- `--channels` flag controls which servers are active per session
4. Org-level -- Team/Enterprise control via `channelsEnabled` managed setting
5. Custom channels during research preview require `--dangerously-load-development-channels`

## Requirements

1. Claude Code v2.1.80+
2. claude.ai login (API key auth not supported)
3. Team/Enterprise orgs need `channelsEnabled: true` in managed settings
4. Bun, Node.js, or Deno runtime for channel servers

## Documentation

1. User guide: https://code.claude.com/docs/en/channels
2. Technical reference: https://code.claude.com/docs/en/channels-reference
3. MCP docs (channels section): https://code.claude.com/docs/en/mcp
4. Official plugin source: https://github.com/anthropics/claude-plugins-official
