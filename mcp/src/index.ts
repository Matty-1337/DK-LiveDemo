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
import { templateTools } from './tools/templates.js';
import { analyticsTools } from './tools/analytics.js';

const ALL_TOOLS: McpTool[] = [
  ...demoTools,
  ...stepTools,
  ...templateTools,
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
const API_URL = process.env.LIVEDEMO_API_URL ?? 'http://livedemo-backend:3005';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? '';

// Track active SSE transports by sessionId so POST /messages can route to them.
const transports = new Map<string, SSEServerTransport>();

function isAuthorized(req: http.IncomingMessage): boolean {
  if (!AUTH_TOKEN) return true; // auth disabled — log warning at startup
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] === AUTH_TOKEN;
}

function reject(res: http.ServerResponse, code: number, message: string) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tools: ALL_TOOLS.length }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/sse') {
    if (!isAuthorized(req)) return reject(res, 401, 'Unauthorized');
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
    if (!isAuthorized(req)) return reject(res, 401, 'Unauthorized');
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
  if (!AUTH_TOKEN) {
    console.warn('[livedemo-mcp] WARNING: MCP_AUTH_TOKEN is not set — /sse and /messages are open to any caller.');
  } else {
    console.log('[livedemo-mcp] auth: Bearer token required on /sse and /messages');
  }
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
