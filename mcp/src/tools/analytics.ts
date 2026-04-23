import { z } from 'zod';
import { defineTool, McpTool } from '../lib/tool.js';
import { getClient } from '../lib/client.js';

const analyticsSchema = z.object({
  demo_id: z.string(),
  date_range: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .optional(),
});

const leadsSchema = z.object({
  demo_id: z.string(),
  limit: z.number().int().positive().max(500).optional(),
});

const allStatsSchema = z.object({
  limit: z.number().int().positive().max(500).optional(),
});

interface DemoSummary {
  id?: string;
  demo_id?: string;
  name?: string;
  views?: number;
  leads_captured?: number;
}

export const analyticsTools: McpTool[] = [
  defineTool({
    name: 'livedemo_get_analytics',
    description:
      'Get analytics for a single demo: views, unique viewers, completion rate, CTA clicks, leads, drop-off by step.',
    schema: analyticsSchema,
    handler: async ({ demo_id, date_range }) =>
      getClient().get(`/api/demos/${encodeURIComponent(demo_id)}/analytics`, {
        params: date_range ? { from: date_range.from, to: date_range.to } : undefined,
      }),
  }),
  defineTool({
    name: 'livedemo_get_leads',
    description: 'List leads captured by a demo.',
    schema: leadsSchema,
    handler: async ({ demo_id, limit }) =>
      getClient().get(`/api/demos/${encodeURIComponent(demo_id)}/leads`, {
        params: limit ? { limit } : undefined,
      }),
  }),
  defineTool({
    name: 'livedemo_get_all_demo_stats',
    description:
      'Aggregate stats across all demos — total views, top performing demo, total leads. Paginates through every demo.',
    schema: allStatsSchema,
    handler: async ({ limit }) => {
      const client = getClient();
      const pageSize = 100;
      const hardCap = limit ?? 10_000;
      const all: DemoSummary[] = [];
      for (let page = 1; all.length < hardCap; page++) {
        const res = await client.get<DemoSummary[] | { data: DemoSummary[] }>('/api/demos', {
          params: { page, limit: pageSize },
        });
        const chunk = Array.isArray(res) ? res : res.data ?? [];
        if (chunk.length === 0) break;
        all.push(...chunk);
        if (chunk.length < pageSize) break;
      }
      const list = all.slice(0, hardCap);

      let totalViews = 0;
      let totalLeads = 0;
      let top: DemoSummary | null = null;
      for (const d of list) {
        const v = d.views ?? 0;
        const l = d.leads_captured ?? 0;
        totalViews += v;
        totalLeads += l;
        if (!top || (top.views ?? 0) < v) top = d;
      }
      return {
        demo_count: list.length,
        total_views: totalViews,
        total_leads: totalLeads,
        top_performing_demo: top
          ? { id: top.demo_id ?? top.id, name: top.name, views: top.views }
          : null,
      };
    },
  }),
];
