import { z } from 'zod';
import { defineTool, McpTool } from '../lib/tool.js';
import { getClient } from '../lib/client.js';
import {
  CORETAP_TEMPLATES,
  getTemplate,
  listTemplates,
  personalizeStep,
} from '../lib/coretap-templates.js';

const templateIdEnum = z.enum([
  'coretap-overview',
  'coretap-golden-hours',
  'coretap-void-detection',
  'coretap-employee-grading',
  'coretap-monitor-pitch',
  'coretap-command-full',
]);

const applySchema = z.object({
  template_id: templateIdEnum,
  bar_name: z.string(),
  tier: z.enum(['monitor', 'execute', 'command']).optional(),
  prospect_pain_point: z.string().optional(),
});

const listSchema = z.object({
  tier: z.enum(['monitor', 'execute', 'command']).optional(),
});

const previewSchema = z.object({
  template_id: z.string(),
});

interface CreateDemoResponse {
  id?: string;
  demo_id?: string;
  share_link?: string;
  edit_link?: string;
}

interface AddStepResponse {
  id?: string;
  step_id?: string;
}

interface PublishResponse {
  public_url?: string;
  embed_code?: string;
}

export const templateTools: McpTool[] = [
  defineTool({
    name: 'livedemo_apply_coretap_template',
    description:
      'Apply a CoreTAP template to create a personalized, published demo with lead capture. Returns the public URL and embed code.',
    schema: applySchema,
    handler: async ({ template_id, bar_name, tier, prospect_pain_point }) => {
      const tpl = getTemplate(template_id);
      if (!tpl) throw new Error(`Unknown template_id: ${template_id}`);

      const client = getClient();

      const created = await client.post<CreateDemoResponse>('/api/demos', {
        name: `${tpl.name} — ${bar_name}`,
        description: tpl.description,
        template_id: tpl.id,
      });
      const demoId = created.demo_id ?? created.id;
      if (!demoId) throw new Error('Backend did not return a demo id');

      try {
        const stepIds: string[] = [];
        for (let i = 0; i < tpl.steps.length; i++) {
          const personalized = personalizeStep(tpl.steps[i], {
            bar_name,
            tier,
            pain_point: prospect_pain_point,
          });
          const step = await client.post<AddStepResponse>(
            `/api/demos/${encodeURIComponent(demoId)}/steps`,
            {
              title: personalized.title,
              annotation: personalized.annotation,
              type: personalized.type,
              order: i,
            },
          );
          const sid = step.step_id ?? step.id;
          if (sid) stepIds.push(sid);
        }

        const lastStepId = stepIds[stepIds.length - 1];
        if (lastStepId) {
          await client.post(
            `/api/demos/${encodeURIComponent(demoId)}/steps/${encodeURIComponent(lastStepId)}/lead-form`,
            {
              fields: ['name', 'email', 'company'],
              redirect_url: 'https://coretap.ai/demo',
            },
          );
        }

        const published = await client.post<PublishResponse>(
          `/api/demos/${encodeURIComponent(demoId)}/publish`,
        );

        return {
          demo_id: demoId,
          public_url: published.public_url,
          embed_code: published.embed_code,
          estimated_completion_time: `${Math.max(60, tpl.steps.length * 25)}s`,
          step_count: stepIds.length,
          template: tpl.id,
        };
      } catch (err) {
        // Best-effort cleanup so we don't leave orphaned half-built demos.
        await client
          .delete(`/api/demos/${encodeURIComponent(demoId)}`)
          .catch(() => undefined);
        throw err;
      }
    },
  }),
  defineTool({
    name: 'livedemo_list_templates',
    description: 'List available CoreTAP templates, optionally filtered by tier.',
    schema: listSchema,
    handler: async ({ tier }) =>
      listTemplates(tier).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        tier: t.tier,
        feature_focus: t.feature_focus,
        step_count: t.steps.length,
      })),
  }),
  defineTool({
    name: 'livedemo_preview_template',
    description: 'Return the full definition of a CoreTAP template including all steps.',
    schema: previewSchema,
    handler: async ({ template_id }) => {
      const tpl = CORETAP_TEMPLATES.find((t) => t.id === template_id);
      if (!tpl) throw new Error(`Unknown template_id: ${template_id}`);
      return tpl;
    },
  }),
];
