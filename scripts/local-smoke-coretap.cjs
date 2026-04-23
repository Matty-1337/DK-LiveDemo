/**
 * Mirrors livedemo_apply_coretap_template for local GO/NO-GO (Phase A).
 * Run from repo root: node scripts/local-smoke-coretap.cjs
 */
process.env.LIVEDEMO_API_URL = process.env.LIVEDEMO_API_URL || 'http://localhost:3005';
process.env.LIVEDEMO_API_TOKEN = process.env.LIVEDEMO_API_TOKEN || 'local-dev-token-123';

const path = require('path');
const mcpDist = path.join(__dirname, '..', 'mcp', 'dist');
const { getTemplate, personalizeStep } = require(path.join(mcpDist, 'lib', 'coretap-templates.js'));
const { LiveDemoClient } = require(path.join(mcpDist, 'lib', 'client.js'));

const bar_name = 'The Rusty Nail';
const prospect_pain_point = 'We have no idea where revenue leaks after midnight';
const template_id = 'coretap-monitor-pitch';

async function main() {
  const tpl = getTemplate(template_id);
  if (!tpl) throw new Error('template missing');
  const client = new LiveDemoClient();

  const created = await client.post('/api/demos', {
    name: `${tpl.name} — ${bar_name}`,
    description: tpl.description,
    template_id: tpl.id,
  });
  const demoId = created.demo_id ?? created.id;
  if (!demoId) throw new Error('no demo id');

  const stepIds = [];
  try {
    for (let i = 0; i < tpl.steps.length; i++) {
      const personalized = personalizeStep(tpl.steps[i], {
        bar_name,
        tier: 'monitor',
        pain_point: prospect_pain_point,
      });
      const step = await client.post(`/api/demos/${encodeURIComponent(demoId)}/steps`, {
        title: personalized.title,
        annotation: personalized.annotation,
        type: personalized.type,
        order: i,
      });
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

    const published = await client.post(`/api/demos/${encodeURIComponent(demoId)}/publish`);

    console.log(
      JSON.stringify(
        {
          GO: true,
          demo_id: demoId,
          public_url: published.public_url,
          embed_code: published.embed_code ? '[present]' : null,
          step_count: stepIds.length,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.delete(`/api/demos/${encodeURIComponent(demoId)}`).catch(() => undefined);
    throw err;
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ GO: false, error: String(e.message || e) }));
  process.exit(1);
});
