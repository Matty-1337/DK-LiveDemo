// Status tool — checks generation state for a given storyId. Used by
// Claude on claude.ai to confirm a generate_demo call succeeded.

import { z } from 'zod';
import { defineTool, McpTool } from '../lib/tool.js';
import { getClient } from '../lib/client.js';
import { resolveWorkspaceId } from './demos.js';

const ObjectId = z.string().regex(/^[a-f0-9]{24}$/i, 'expected 24-hex ObjectId');

export const statusTools: McpTool[] = [
  defineTool({
    name: 'livedemo_get_demo_status',
    description:
      'Report the current state of a generated demo: publish state, screen count, and public URL (if published).',
    schema: z.object({
      story_id: ObjectId,
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, workspace_id }) => {
      const ws = resolveWorkspaceId(workspace_id);
      const story = await getClient().getStory(ws, story_id);
      const screens = Array.isArray(story.screens) ? story.screens : [];
      const publicHost = process.env.LIVEDEMO_PUBLIC_HOST ?? 'https://demo.deltakinetics.io';
      return {
        storyId: story._id,
        name: story.name,
        status: story.status,
        isPublished: story.isPublished,
        deletedAt: story.deletedAt,
        screenCount: screens.length,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
        publicUrl: story.isPublished ? `${publicHost}/livedemos/${story._id}` : null,
      };
    },
  }),
];
