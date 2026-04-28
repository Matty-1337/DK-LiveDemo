import http from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { McpTool } from './lib/tool.js';
import { zodToJsonSchema } from './lib/tool.js';
import { demoTools } from './tools/demos.js';
import { stepTools } from './tools/steps.js';
import { analyticsTools } from './tools/analytics.js';
import { catalogTools } from './tools/catalog.js';
import { statusTools } from './tools/status.js';
import { generateTools } from './tools/generate.js';

const ALL_TOOLS: McpTool[] = [
  // Strategy C primary surface — put these first so they show up first
  // in tools/list responses.
  ...generateTools,
  ...catalogTools,
  ...statusTools,
  // CRUD/analytics surface for direct manipulation + observability.
  ...demoTools,
  ...stepTools,
  ...analyticsTools,
];

const TOOL_BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

function buildMcpServer(): Server {
  const server = new Server(
    { name: 'dk-livedemo-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.schema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const tool = TOOL_BY_NAME.get(name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
    }
    try {
      const result = await tool.handler(args);
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool ${name} failed: ${message}` }],
      };
    }
  });

  return server;
}

const PORT = Number(process.env.PORT ?? 3100);
const API_URL = process.env.LIVEDEMO_API_URL ?? 'http://livedemo-backend.railway.internal:3005';

// Track active SSE transports by sessionId so POST /messages can route to them.
const transports = new Map<string, SSEServerTransport>();

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tools: ALL_TOOLS.length }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/sse') {
    const transport = new SSEServerTransport('/messages', res);
    transports.set(transport.sessionId, transport);
    res.on('close', () => {
      transports.delete(transport.sessionId);
    });
    const server = buildMcpServer();
    await server.connect(transport);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/messages') {
    const sessionId = url.searchParams.get('sessionId') ?? '';
    const transport = transports.get(sessionId);
    if (!transport) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown sessionId' }));
      return;
    }
    await transport.handlePostMessage(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, () => {
  console.log(`[livedemo-mcp] listening on :${PORT}`);
  console.log(`[livedemo-mcp] backend API: ${API_URL}`);
  console.log(`[livedemo-mcp] tools: ${ALL_TOOLS.length}`);
  console.log(`[livedemo-mcp] SSE endpoint: GET /sse  |  health: GET /health`);
  console.warn('[livedemo-mcp] auth: DISABLED — /sse and /messages are open to any caller.');
});

function shutdown(signal: string) {
  console.log(`[livedemo-mcp] received ${signal}, shutting down...`);
  for (const t of transports.values()) {
    void t.close().catch(() => undefined);
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
