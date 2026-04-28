// Demo/story CRUD tools. "Demo" in MCP-speak == "Story" in the backend
// (see docs/upstream-api.md).

import { z } from 'zod';
import { defineTool, McpTool } from '../lib/tool.js';
import { getClient, LiveDemoApiError } from '../lib/client.js';

const ObjectId = z.string().regex(/^[a-f0-9]{24}$/i, 'expected 24-hex ObjectId');

function workspaceId(input?: string): string {
  const ws = input ?? process.env.LIVEDEMO_WORKSPACE_ID;
  if (!ws) throw new Error('workspace_id not provided and LIVEDEMO_WORKSPACE_ID not set');
  return ws;
}

export const demoTools: McpTool[] = [
  defineTool({
    name: 'livedemo_list_demos',
    description:
      'List all stories (demos) in the configured workspace. Returns summary docs — id, name, publish state, screen count, createdAt.',
    schema: z.object({
      workspace_id: ObjectId.optional().describe('Workspace id; defaults to LIVEDEMO_WORKSPACE_ID env'),
    }),
    handler: async ({ workspace_id }) => {
      const stories = await getClient().listStories(workspaceId(workspace_id));
      return stories
        .filter((s) => !s.deletedAt)
        .map((s) => ({
          id: s._id,
          name: s.name,
          isPublished: s.isPublished,
          status: s.status,
          screenCount: Array.isArray(s.screens) ? s.screens.length : 0,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }));
    },
  }),

  defineTool({
    name: 'livedemo_get_demo',
    description: 'Fetch a full story document including populated screens and steps.',
    schema: z.object({
      story_id: ObjectId,
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, workspace_id }) => {
      return getClient().getStory(workspaceId(workspace_id), story_id);
    },
  }),

  defineTool({
    name: 'livedemo_delete_demo',
    description: 'Soft-delete a story (sets deletedAt; invisible to reads).',
    schema: z.object({
      story_id: ObjectId,
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, workspace_id }) => {
      return getClient().deleteStory(workspaceId(workspace_id), story_id);
    },
  }),

  defineTool({
    name: 'livedemo_publish_demo',
    description:
      'Publish or unpublish a story. Publishing exposes it at demo.deltakinetics.io/livedemos/<storyId>.',
    schema: z.object({
      story_id: ObjectId,
      is_published: z.boolean().default(true),
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, is_published, workspace_id }) => {
      return getClient().publishStory(workspaceId(workspace_id), story_id, {
        isPublished: is_published,
      });
    },
  }),

  defineTool({
    name: 'livedemo_unpublish_demo',
    description: 'Shortcut for publish_demo with isPublished=false.',
    schema: z.object({
      story_id: ObjectId,
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, workspace_id }) => {
      return getClient().publishStory(workspaceId(workspace_id), story_id, { isPublished: false });
    },
  }),

  defineTool({
    name: 'livedemo_create_story_link',
    description:
      'Create a shareable link slug for a story. Link id is a short-uuid, not a Mongo ObjectId.',
    schema: z.object({
      story_id: ObjectId,
      name: z.string().optional(),
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, name, workspace_id }) => {
      return getClient().createStoryLink(workspaceId(workspace_id), story_id, { name: name ?? '' });
    },
  }),

  defineTool({
    name: 'livedemo_list_story_links',
    description: 'List all shareable links for a story.',
    schema: z.object({
      story_id: ObjectId,
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, workspace_id }) => {
      return getClient().listStoryLinks(workspaceId(workspace_id), story_id);
    },
  }),
];

// Shared helpers for other tool modules
export function resolveWorkspaceId(input?: string): string {
  return workspaceId(input);
}

export function toolError(
  err: unknown,
): { isError: true; message: string; status?: number; data?: unknown } {
  if (err instanceof LiveDemoApiError) {
    return { isError: true, message: err.message, status: err.status, data: err.data };
  }
  if (err instanceof Error) return { isError: true, message: err.message };
  return { isError: true, message: String(err) };
}
