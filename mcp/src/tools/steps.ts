// Screen + step tools. In the backend, steps are embedded in screens.steps[]
// — not a standalone collection (see docs/upstream-data-model.md).

import { z } from 'zod';
import { defineTool, McpTool } from '../lib/tool.js';
import { getClient } from '../lib/client.js';
import { resolveWorkspaceId } from './demos.js';

const ObjectId = z.string().regex(/^[a-f0-9]{24}$/i, 'expected 24-hex ObjectId');

const StepViewType = z.enum(['hotspot', 'pointer', 'popup', 'none']);

const PopupSpec = z
  .object({
    type: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    alignment: z.enum(['center', 'left', 'right']).optional(),
    showOverlay: z.boolean().optional(),
    buttons: z
      .array(
        z.object({
          index: z.number().optional(),
          text: z.string().optional(),
          gotoType: z.enum(['screen', 'website', 'next', 'none']).optional(),
          gotoWebsite: z.string().optional(),
          gotoScreen: ObjectId.optional(),
          textColor: z.string().optional(),
          backgroundColor: z.string().optional(),
        }),
      )
      .optional(),
  })
  .strict();

export const stepTools: McpTool[] = [
  defineTool({
    name: 'livedemo_add_step',
    description:
      'Add a step to a screen. Steps are embedded in screens.steps[]; the returned step has an _id but lives inside the screen doc.',
    schema: z.object({
      story_id: ObjectId,
      screen_id: ObjectId,
      view_type: StepViewType.default('popup'),
      index: z.number().int().nonnegative().default(0),
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, screen_id, view_type, index, workspace_id }) => {
      return getClient().createStep(resolveWorkspaceId(workspace_id), story_id, screen_id, {
        index,
        view: { viewType: view_type },
      });
    },
  }),

  defineTool({
    name: 'livedemo_update_step',
    description:
      'Patch an embedded step. Pass only the fields you want to change; the handler uses Mongo positional operators so unspecified fields are preserved.',
    schema: z.object({
      story_id: ObjectId,
      screen_id: ObjectId,
      step_id: ObjectId,
      view_type: StepViewType.optional(),
      content: z.string().optional().describe('HTML body for the step, free-form'),
      popup: PopupSpec.optional(),
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, screen_id, step_id, view_type, content, popup, workspace_id }) => {
      const body: Record<string, unknown> = {};
      const view: Record<string, unknown> = {};
      if (view_type) view.viewType = view_type;
      if (content !== undefined) view.content = content;
      if (popup) view.popup = popup;
      if (Object.keys(view).length) body.view = view;
      return getClient().patchStep(
        resolveWorkspaceId(workspace_id),
        story_id,
        screen_id,
        step_id,
        body,
      );
    },
  }),

  defineTool({
    name: 'livedemo_delete_step',
    description: 'Remove a step from a screen (Mongo $pull from screens.steps[]).',
    schema: z.object({
      story_id: ObjectId,
      screen_id: ObjectId,
      step_id: ObjectId,
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, screen_id, step_id, workspace_id }) => {
      return getClient().deleteStep(
        resolveWorkspaceId(workspace_id),
        story_id,
        screen_id,
        step_id,
      );
    },
  }),

  defineTool({
    name: 'livedemo_add_lead_form',
    description:
      'Create a Form and attach it to a step as a popup form. Default fields are Name + Email. Returns the created form doc.',
    schema: z.object({
      story_id: ObjectId,
      screen_id: ObjectId,
      step_id: ObjectId,
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ story_id, screen_id, step_id, workspace_id }) => {
      return getClient().createForm(resolveWorkspaceId(workspace_id), {
        type: 'step',
        storyId: story_id,
        screenId: screen_id,
        stepId: step_id,
      });
    },
  }),

  defineTool({
    name: 'livedemo_update_form',
    description: 'Rename a form or convert it to/from HubSpot.',
    schema: z.object({
      form_id: ObjectId,
      title: z.string().optional(),
      type: z.enum(['step', 'hubspot']).optional(),
      hubspot: z
        .object({
          formId: z.string().optional(),
          portalId: z.string().optional(),
          embedVersion: z.number().optional(),
        })
        .optional(),
      workspace_id: ObjectId.optional(),
    }),
    handler: async ({ form_id, title, type, hubspot, workspace_id }) => {
      return getClient().patchForm(resolveWorkspaceId(workspace_id), form_id, {
        title,
        type,
        hubspot,
      });
    },
  }),
];
