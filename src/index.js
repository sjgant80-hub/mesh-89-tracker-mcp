#!/usr/bin/env node
// mesh-89-tracker-mcp · MCP server exposing the mesh-89-tracker SDK as tools.
// Tools: mesh_generate_identity, mesh_create_offer, mesh_accept_offer, mesh_get_peers
// Resource: mesh://milestones

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import {
  generateIdentity,
  exportIdentity,
  importIdentity,
  encodeSignal,
  decodeSignal,
  FIB,
  MILE_MEANINGS,
  nextFib
} from '@ai-native-solutions/mesh-89-tracker-sdk';

// In-memory session state (identities + peer records).
const session = {
  identity: null, // { id, publicKeyB64, privateKeyJwk, algo }
  peers: new Map() // peerId -> { peerId, state, latency, remotePub, addedAt }
};

async function ensureIdentity() {
  if (session.identity) return session.identity;
  const ident = await generateIdentity();
  const record = await exportIdentity(ident);
  session.identity = record;
  return record;
}

const server = new Server(
  { name: 'mesh-89-tracker-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'mesh_generate_identity',
      description: 'Generate a fresh Ed25519 identity (ECDSA P-256 fallback). Returns did (peer id) and pubkey.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'mesh_create_offer',
      description: 'Create a WebRTC offer bundle for a new peer. Returns an encoded offer_bundle string to hand to the peer. NOTE: WebRTC handshake requires a browser or wrtc runtime; this tool returns the SDK signal shape only.',
      inputSchema: {
        type: 'object',
        properties: {
          peer_id: { type: 'string', description: 'Local identifier for this pending peer' }
        }
      }
    },
    {
      name: 'mesh_accept_offer',
      description: 'Accept a peer offer bundle. Returns an encoded answer bundle to send back.',
      inputSchema: {
        type: 'object',
        properties: {
          bundle: { type: 'string', description: 'The base64 offer bundle from a peer' }
        },
        required: ['bundle']
      }
    },
    {
      name: 'mesh_get_peers',
      description: 'List current peers with their latency and connection state.',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = req.params.arguments || {};

  if (name === 'mesh_generate_identity') {
    const ident = await generateIdentity();
    const record = await exportIdentity(ident);
    session.identity = record;
    return { content: [{ type: 'text', text: JSON.stringify({ did: record.id, pubkey: record.publicKeyB64, algo: record.algo }, null, 2) }] };
  }

  if (name === 'mesh_create_offer') {
    const ident = await ensureIdentity();
    const peerId = args.peer_id || 'peer-' + Math.random().toString(36).slice(2, 10);
    // Build a signal bundle whose SDP is a placeholder in Node contexts; browser
    // clients hydrate it via createOfferBundle(). Shape matches the SDK.
    const payload = {
      type: 'offer',
      from: ident.id,
      pub: ident.publicKeyB64,
      sdp: { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=-\r\n' }
    };
    const bundle = encodeSignal(payload);
    session.peers.set(peerId, { peerId, state: 'connecting', latency: null, addedAt: Date.now(), remotePub: null });
    return { content: [{ type: 'text', text: JSON.stringify({ offer_bundle: bundle, peer_id: peerId }, null, 2) }] };
  }

  if (name === 'mesh_accept_offer') {
    if (!args.bundle) throw new Error('missing bundle');
    const ident = await ensureIdentity();
    const decoded = decodeSignal(args.bundle);
    if (decoded.type !== 'offer') throw new Error('bundle is not an offer');
    const peerId = decoded.from || ('peer-' + Math.random().toString(36).slice(2, 10));
    const answer = {
      type: 'answer',
      from: ident.id,
      pub: ident.publicKeyB64,
      sdp: { type: 'answer', sdp: 'v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=-\r\n' }
    };
    session.peers.set(peerId, { peerId, state: 'connecting', latency: null, addedAt: Date.now(), remotePub: decoded.pub });
    return { content: [{ type: 'text', text: JSON.stringify({ answer: encodeSignal(answer), peer_id: peerId }, null, 2) }] };
  }

  if (name === 'mesh_get_peers') {
    const peers = Array.from(session.peers.values()).map((p) => ({
      peer_id: p.peerId,
      state: p.state,
      latency_ms: p.latency,
      added_at: new Date(p.addedAt).toISOString()
    }));
    const connected = peers.filter((p) => p.state === 'connected').length + (session.identity ? 1 : 0);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          peers,
          latency: peers.reduce((acc, p) => { if (p.latency_ms != null) acc[p.peer_id] = p.latency_ms; return acc; }, {}),
          connected_count: connected,
          next_milestone: nextFib(connected)
        }, null, 2)
      }]
    };
  }

  throw new Error('unknown tool: ' + name);
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: 'mesh://milestones', name: 'Fibonacci milestones', description: 'The 10 Fibonacci milestone targets toward 89 with their meanings.', mimeType: 'application/json' }
  ]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri === 'mesh://milestones') {
    const list = FIB.map((n) => ({ n, meaning: MILE_MEANINGS[n] }));
    return {
      contents: [{
        uri: 'mesh://milestones',
        mimeType: 'application/json',
        text: JSON.stringify({ target: 89, milestones: list }, null, 2)
      }]
    };
  }
  throw new Error('unknown resource: ' + req.params.uri);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mesh-89-tracker-mcp] stdio server ready');
}

main().catch((e) => { console.error('[mesh-89-tracker-mcp] fatal:', e); process.exit(1); });
