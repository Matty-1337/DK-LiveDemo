import { z } from 'zod';
import { defineTool, McpTool } from '../lib/tool.js';
import { getClient } from '../lib/client.js';

const stepTypeEnum = z.enum(['tooltip', 'callout', 'popup', 'zoom', 'voiceover']);

const addStepSchema = z.object({
  demo_id: z.string(),
  title: z.string(),
  annotation: z.string(),
  type: stepTypeEnum,
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  order: z.number().int().nonnegative().optional(),
});

const updateStepSchema = z.object({
  demo_id: z.string(),
  step_id: z.string(),
  title: z.string().optional(),
  annotation: z.string().optional(),
  type: stepTypeEnum.optional(),
});

const deleteStepSchema = z.object({
  demo_id: z.string(),
  step_id: z.string(),
});

const reorderSchema = z.object({
  demo_id: z.string(),
  step_order: z.array(z.string()),
});

const ctaSchema = z.object({
  demo_id: z.string(),
  step_id: z.string(),
  label: z.string(),
  url: z.string(),
  style: z.enum(['primary', 'secondary']).optional(),
});

const leadFormSchema = z.object({
  demo_id: z.string(),
  step_id: z.string(),
  fields: z.array(z.string()),
  redirect_url: z.string().optional(),
});

const voiceoverSchema = z.object({
  demo_id: z.string(),
  step_id: z.string(),
  script: z.string(),
  voice: z.string().optional(),
});

export const stepTools: McpTool[] = [
  defineTool({
    name: 'livedemo_add_step',
    description: 'Add a step (annotation/tooltip/callout/popup/zoom/voiceover) to a demo.',
    schema: addStepSchema,
    handler: async ({ demo_id, ...body }) =>
      getClient().post(`/api/demos/${encodeURIComponent(demo_id)}/steps`, body),
  }),
  defineTool({
    name: 'livedemo_update_step',
    description: 'Update a step on a demo.',
    schema: updateStepSchema,
    handler: async ({ demo_id, step_id, ...body }) =>
      getClient().put(
        `/api/demos/${encodeURIComponent(demo_id)}/steps/${encodeURIComponent(step_id)}`,
        body,
      ),
  }),
  defineTool({
    name: 'livedemo_delete_step',
    description: 'Delete a step from a demo.',
    schema: deleteStepSchema,
    handler: async ({ demo_id, step_id }) =>
      getClient().delete(
        `/api/demos/${encodeURIComponent(demo_id)}/steps/${encodeURIComponent(step_id)}`,
      ),
  }),
  defineTool({
    name: 'livedemo_reorder_steps',
    description: 'Reorder all steps in a demo. Pass the new ordered list of step ids.',
    schema: reorderSchema,
    handler: async ({ demo_id, step_order }) =>
      getClient().put(`/api/demos/${encodeURIComponent(demo_id)}/steps/reorder`, {
        step_order,
      }),
  }),
  defineTool({
    name: 'livedemo_add_cta',
    description: 'Attach a call-to-action button to a step.',
    schema: ctaSchema,
    handler: async ({ demo_id, step_id, ...body }) =>
      getClient().post(
        `/api/demos/${encodeURIComponent(demo_id)}/steps/${encodeURIComponent(step_id)}/cta`,
        body,
      ),
  }),
  defineTool({
    name: 'livedemo_add_lead_form',
    description: 'Attach a lead capture form to a step.',
    schema: leadFormSchema,
    handler: async ({ demo_id, step_id, ...body }) =>
      getClient().post(
        `/api/demos/${encodeURIComponent(demo_id)}/steps/${encodeURIComponent(step_id)}/lead-form`,
        body,
      ),
  }),
  defineTool({
    name: 'livedemo_generate_voiceover',
    description: 'Generate an AI voiceover for a step from a script.',
    schema: voiceoverSchema,
    handler: async ({ demo_id, step_id, ...body }) =>
      getClient().post(
        `/api/demos/${encodeURIComponent(demo_id)}/steps/${encodeURIComponent(step_id)}/voiceover`,
        body,
      ),
  }),
];
