# @ai-native-solutions/mesh-89-tracker-mcp

MCP server exposing the [mesh-89-tracker SDK](https://github.com/sjgant80-hub/mesh-89-tracker-sdk) as tools + resources for MCP clients (Claude Desktop, Claude Code, etc).

## Tools

| Tool | Input | Output |
|---|---|---|
| `mesh_generate_identity` | — | `{ did, pubkey, algo }` — fresh Ed25519 identity |
| `mesh_create_offer` | `{ peer_id? }` | `{ offer_bundle, peer_id }` — base64 offer to hand to a peer |
| `mesh_accept_offer` | `{ bundle }` | `{ answer, peer_id }` — base64 answer to send back |
| `mesh_get_peers` | — | `{ peers, latency, connected_count, next_milestone }` |

## Resources

- `mesh://milestones` — the 10 Fibonacci targets toward 89 with meanings.

## Install

```bash
npm install -g @ai-native-solutions/mesh-89-tracker-mcp
```

## Wire into Claude Desktop / Claude Code

`~/.claude/claude_desktop_config.json` or a project `.mcp.json`:

```json
{
  "mcpServers": {
    "mesh-89-tracker": {
      "command": "npx",
      "args": ["-y", "@ai-native-solutions/mesh-89-tracker-mcp"]
    }
  }
}
```

Restart the client and the four tools + milestones resource appear.

## Note on WebRTC

Full WebRTC ICE gathering needs a browser or a native binding (e.g. `@roamhq/wrtc`). This MCP server produces the signal-bundle shape from the SDK — hand the encoded `offer_bundle` / `answer` strings back to a browser peer (e.g. the [mesh-89-tracker](https://github.com/sjgant80-hub/mesh-89-tracker) app) to complete the handshake. Identity generation is fully in-Node via Web Crypto.

## License

MIT · AI-Native Solutions
