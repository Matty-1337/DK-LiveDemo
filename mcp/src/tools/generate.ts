// livedemo_generate_demo — end-to-end automated demo generation.
//
// Flow (Strategy C §3 Phase 6):
//   1. Resolve {product, module} from config/products.json
//   2. Call livedemo-browser POST /capture with the module's navigationPlan
//      → receives screens[]
//   3. POST /emptyStory with a personalized name
//      → receives storyId
//   4. For each captured screen:
//      a. POST /workspaces/:ws/stories/:sid/screens with
//         {name, content, imageData, width, height}
//      b. If narrative exists for screenIndex:
//         i.  POST .../screens/:scid/steps {viewType:'popup', index:0}
//         ii. PATCH .../steps/:stepid with rendered popup (personalizer)
//   5. POST /publish {isPublished:true}
//   6. POST /links → shareable link slug
//   7. Return { ok, url, shareUrl, storyId, screenCount, generatedAt }
//
// Error handling:
//   - Any failure past emptyStory creation → soft-delete the story to
//     avoid workspace clutter
//   - Return { ok: false, phase, message, storyId? }
//     phase ∈ 'catalog'|'capture'|'create-story'|'upload'|'steps'|'publish'|'link'

import { z } from 'zod';
import { defineTool, McpTool } from '../lib/tool.js';
import { getClient, LiveDemoApiError } from '../lib/client.js';
import { getBrowserClient, BrowserClientError } from '../lib/browser-client.js';
import { resolveModule } from './catalog.js';
import { resolveWorkspaceId } from './demos.js';
import { renderPopup, ProspectContext } from '../lib/personalizer.js';

const GenerateDemoInput = z.object({
  product: z.string().min(1),
  module: z.string().min(1),
  prospect: z.object({
    name: z.string().min(1, 'prospect.name required'),
    location: z.string().optional(),
    context: z.string().optional(),
  }),
  tier: z.string().optional(),
  workspace_id: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
});

type GenerateInput = z.infer<typeof GenerateDemoInput>;

type Phase = 'catalog' | 'capture' | 'create-story' | 'upload' | 'steps' | 'publish' | 'link';

interface GenerateError {
  ok: false;
  phase: Phase;
  message: string;
  storyId?: string;
  detail?: unknown;
}

interface GenerateSuccess {
  ok: true;
  storyId: string;
  name: string;
  url: string;
  shareUrl: string | null;
  screenCount: number;
  generatedAt: string;
  timings: {
    captureMs: number;
    uploadMs: number;
    stepsMs: number;
    publishMs: number;
    totalMs: number;
  };
}

export const generateTools: McpTool[] = [
  defineTool({
    name: 'livedemo_generate_demo',
    description:
      'Generate a complete published LiveDemo end-to-end: browser captures the product, screens+steps are uploaded, popups are personalized with prospect context, and the demo is published. Returns a public URL.',
    schema: GenerateDemoInput,
    handler: async (input): Promise<GenerateSuccess | GenerateError> => {
      return runGenerate(input);
    },
  }),
];

export async function runGenerate(input: GenerateInput): Promise<GenerateSuccess | GenerateError> {
  const t0 = Date.now();
  const workspaceId = resolveWorkspaceId(input.workspace_id);
  const prospect: ProspectContext = input.prospect;
  let storyId: string | undefined;

  // --- 1. Catalog lookup ---
  let cat: ReturnType<typeof resolveModule>;
  try {
    cat = resolveModule(input.product, input.module);
  } catch (err) {
    return toErr('catalog', err);
  }
  const { module: mod, defaults } = cat;
  const baseUrl =
    (cat.product.baseUrl as string | undefined) ??
    (defaults.captureBaseUrl as string | undefined) ??
    'https://app.htxtap.com';

  // --- 2. Capture via livedemo-browser ---
  const captureStart = Date.now();
  let captured;
  try {
    captured = await getBrowserClient().capture({
      product: input.product,
      module: input.module,
      baseUrl,
      navigationPlan: mod.navigationPlan,
      timeoutSeconds: 90,
    } as unknown as Parameters<ReturnType<typeof getBrowserClient>['capture']>[0]);
  } catch (err) {
    return toErr('capture', err);
  }
  const captureMs = Date.now() - captureStart;
  if (!captured.screens?.length) {
    return { ok: false, phase: 'capture', message: 'browser returned zero screens' };
  }

  // --- 3. Create empty story ---
  const storyName = formatStoryName(input, mod.name);
  try {
    const created = await getClient().createEmptyStory({
      name: storyName,
      workspaceId,
      windowMeasures: { innerWidth: captured.screens[0].width, innerHeight: captured.screens[0].height },
      aspectRatio: captured.screens[0].width / captured.screens[0].height,
    });
    storyId = created._id;
  } catch (err) {
    return toErr('create-story', err);
  }

  // --- 4. Upload screens + 5. attach steps/popups ---
  const uploadStart = Date.now();
  const screenIds: string[] = [];
  const client = getClient();
  try {
    for (let i = 0; i < captured.screens.length; i++) {
      const s = captured.screens[i];
      const screen = await client.createScreen(workspaceId, storyId!, {
        name: s.pageTitle ? s.pageTitle.slice(0, 120) : `screen-${i + 1}`,
        content: s.html,
        imageData: s.pngBase64,
        width: s.width,
        height: s.height,
      });
      screenIds.push(screen._id);
    }
  } catch (err) {
    await softDeleteStory(workspaceId, storyId!);
    return toErr('upload', err, storyId);
  }
  const uploadMs = Date.now() - uploadStart;

  const stepsStart = Date.now();
  try {
    for (const entry of mod.narrative) {
      const screenId = screenIds[entry.screenIndex];
      if (!screenId) {
        // Narrative referenced a screen that wasn't captured; skip rather than fail.
        continue;
      }
      const nextScreenId = screenIds[entry.screenIndex + 1];
      const created = await client.createStep(workspaceId, storyId!, screenId, {
        index: 0,
        view: { viewType: 'popup' },
      });
      const rendered = renderPopup(entry, prospect, defaults, nextScreenId);
      await client.patchStep(workspaceId, storyId!, screenId, created._id, {
        view: {
          viewType: 'popup',
          popup: rendered as unknown as Record<string, unknown>,
        },
      } as unknown as Parameters<typeof client.patchStep>[4]);
    }
  } catch (err) {
    await softDeleteStory(workspaceId, storyId!);
    return toErr('steps', err, storyId);
  }
  const stepsMs = Date.now() - stepsStart;

  // --- 6. Publish ---
  const publishStart = Date.now();
  try {
    await client.publishStory(workspaceId, storyId!, { isPublished: true });
  } catch (err) {
    // Don't soft-delete on publish failure — screens are expensive to recreate.
    return toErr('publish', err, storyId);
  }
  const publishMs = Date.now() - publishStart;

  // --- 7. Story link ---
  let shareUrl: string | null = null;
  try {
    const link = await client.createStoryLink(workspaceId, storyId!, { name: prospect.name });
    const linkHost = process.env.LIVEDEMO_PUBLIC_HOST ?? 'https://demo.deltakinetics.io';
    shareUrl = `${linkHost}/l/${link._id}`;
  } catch (err) {
    // Link creation is convenience only — don't fail the whole pipeline.
    // Caller still gets the canonical /livedemos/:storyId URL.
  }

  const publicHost = process.env.LIVEDEMO_PUBLIC_HOST ?? 'https://demo.deltakinetics.io';
  return {
    ok: true,
    storyId: storyId!,
    name: storyName,
    url: `${publicHost}/livedemos/${storyId}`,
    shareUrl,
    screenCount: screenIds.length,
    generatedAt: new Date().toISOString(),
    timings: {
      captureMs,
      uploadMs,
      stepsMs,
      publishMs,
      totalMs: Date.now() - t0,
    },
  };
}

function formatStoryName(input: GenerateInput, moduleName: string): string {
  const prospectName = input.prospect.name;
  // Shorten module name if it contains an em-dash
  const modShort = moduleName.split('—')[0]?.trim() ?? moduleName;
  return `${modShort} — ${prospectName}`.slice(0, 200);
}

async function softDeleteStory(ws: string, storyId: string): Promise<void> {
  try {
    await getClient().deleteStory(ws, storyId);
  } catch {
    // Swallow — cleanup best-effort
  }
}

function toErr(phase: Phase, err: unknown, storyId?: string): GenerateError {
  if (err instanceof LiveDemoApiError) {
    return { ok: false, phase, message: err.message, storyId, detail: { status: err.status, data: err.data, route: err.route } };
  }
  if (err instanceof BrowserClientError) {
    return { ok: false, phase, message: err.message, storyId, detail: { phase: err.phase, status: err.status } };
  }
  if (err instanceof Error) return { ok: false, phase, message: err.message, storyId };
  return { ok: false, phase, message: String(err), storyId };
}
