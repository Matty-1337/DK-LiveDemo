import { z } from 'zod';
import { defineTool, McpTool } from '../lib/tool.js';
import { getClient } from '../lib/client.js';

const createDemoSchema = z.object({
  name: z.string().describe('Demo name'),
  description: z.string().optional().describe('Optional description'),
  template_id: z.string().optional().describe('Optional template id to seed from'),
});

const listDemosSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
  search: z.string().optional(),
});

const idSchema = z.object({ demo_id: z.string() });

const duplicateSchema = z.object({
  demo_id: z.string(),
  new_name: z.string(),
});

export const demoTools: McpTool[] = [
  defineTool({
    name: 'livedemo_create_demo',
    description: 'Create a new LiveDemo. Returns demo_id, share_link, edit_link.',
    schema: createDemoSchema,
    handler: async (input) => getClient().post('/api/demos', input),
  }),
  defineTool({
    name: 'livedemo_list_demos',
    description: 'List demos with pagination and search.',
    schema: listDemosSchema,
    handler: async (input) => getClient().get('/api/demos', { params: input }),
  }),
  defineTool({
    name: 'livedemo_get_demo',
    description: 'Fetch a demo by id including its steps.',
    schema: idSchema,
    handler: async ({ demo_id }) => getClient().get(`/api/demos/${encodeURIComponent(demo_id)}`),
  }),
  defineTool({
    name: 'livedemo_delete_demo',
    description: 'Delete a demo by id.',
    schema: idSchema,
    handler: async ({ demo_id }) =>
      getClient().delete(`/api/demos/${encodeURIComponent(demo_id)}`),
  }),
  defineTool({
    name: 'livedemo_duplicate_demo',
    description: 'Duplicate an existing demo with a new name.',
    schema: duplicateSchema,
    handler: async ({ demo_id, new_name }) =>
      getClient().post(`/api/demos/${encodeURIComponent(demo_id)}/duplicate`, {
        new_name,
      }),
  }),
  defineTool({
    name: 'livedemo_publish_demo',
    description: 'Publish a demo. Returns public_url and embed_code (iframe snippet).',
    schema: idSchema,
    handler: async ({ demo_id }) =>
      getClient().post(`/api/demos/${encodeURIComponent(demo_id)}/publish`),
  }),
  defineTool({
    name: 'livedemo_unpublish_demo',
    description: 'Unpublish a demo so it is no longer publicly accessible.',
    schema: idSchema,
    handler: async ({ demo_id }) =>
      getClient().post(`/api/demos/${encodeURIComponent(demo_id)}/unpublish`),
  }),
];
