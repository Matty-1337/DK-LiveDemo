// Analytics tools — sessions (demo views) and leads.

import { z } from 'zod';
import { defineTool, McpTool } from '../lib/tool.js';
import { getClient } from '../lib/client.js';
import { resolveWorkspaceId } from './demos.js';

const ObjectId = z.string().regex(/^[a-f0-9]{24}$/i, 'expected 24-hex ObjectId');
const ViewType = z.enum(['48H', '7D', '30D']);

export const analyticsTools: McpTool[] = [
  defineTool({
    name: 'livedemo_get_sessions',
    description:
      'Get session/view analytics for the workspace grouped by story. Paginated; default 10 per page, 30-day window.',
    schema: z.object({
      view_type: ViewType.default('30D'),
      limit: z.number().int().positive().max(100).default(10),
      page: z.number().int().positive().default(1),
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ view_type, limit, page, workspace_id }) => {
      return getClient().getWorkspaceSessions(resolveWorkspaceId(workspace_id), {
        viewType: view_type,
        limit,
        page,
      });
    },
  }),

  defineTool({
    name: 'livedemo_get_leads',
    description: 'List leads captured across the workspace in a rolling window. Sorted newest first.',
    schema: z.object({
      view_type: ViewType.default('30D'),
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ view_type, workspace_id }) => {
      const leads = await getClient().getWorkspaceLeads(resolveWorkspaceId(workspace_id), view_type);
      return leads.map((l) => ({
        id: l._id,
        formId: l.formId,
        storyId: typeof l.storyId === 'object' ? l.storyId?._id : l.storyId,
        storyName: typeof l.storyId === 'object' ? l.storyId?.name : undefined,
        sessionId: typeof l.sessionId === 'object' ? l.sessionId?._id : l.sessionId,
        country:
          typeof l.sessionId === 'object' && l.sessionId?.clientIpData?.country
            ? l.sessionId.clientIpData.country
            : undefined,
        data: l.data,
        createdAt: l.createdAt,
      }));
    },
  }),
];
