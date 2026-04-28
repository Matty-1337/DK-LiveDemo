// Catalog tool — surfaces config/products.json to callers so Claude can
// answer "what demos can you make?" without me parsing the JSON manually.

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineTool, McpTool } from '../lib/tool.js';

interface Defaults {
  ctaUrl: string;
  ctaText: string;
  captureBaseUrl?: string;
  captureWaitStrategy?: string;
  captureTimeoutMs?: number;
  hideSelectors?: string[];
}

interface ModuleDef {
  name: string;
  tier: string;
  description: string;
  estimatedDurationMinutes: number;
  navigationPlan: Array<{ path: string; waitFor?: string; note?: string; hideSelectors?: string[] }>;
  narrative: Array<{
    screenIndex: number;
    popup: {
      title: string;
      body: string;
      alignment?: 'center' | 'left' | 'right';
      showOverlay?: boolean;
      cta?: { text: string; url: string };
    };
  }>;
}

interface ProductDef {
  name?: string;
  productId?: string;
  baseUrl?: string;
  authFn?: string;
  status?: string; // 'pending' etc
  note?: string;
  tiers?: Record<string, { price: number; priceDisplay: string }>;
  modules: Record<string, ModuleDef>;
}

interface Catalog {
  defaults: Defaults;
  [productId: string]: ProductDef | Defaults | undefined;
}

let _catalog: Catalog | null = null;

export function getCatalog(): Catalog {
  if (_catalog) return _catalog;
  const override = process.env.LIVEDEMO_PRODUCTS_JSON;
  let path: string;
  if (override) {
    path = override;
  } else {
    // repo-root config/products.json, relative to compiled dist/tools/catalog.js
    // In dev (tsx), __dirname resolves to src/tools — adjust either way by
    // walking up to a directory that contains config/products.json.
    path = resolveConfigPath();
  }
  const raw = readFileSync(path, 'utf8');
  _catalog = JSON.parse(raw) as Catalog;
  return _catalog;
}

export function __resetCatalog(): void {
  _catalog = null;
}

function resolveConfigPath(): string {
  // Walk up from __dirname (compiled file location) OR process.cwd() to
  // find config/products.json. Cap at 8 levels.
  // __dirname is available in CJS output; declare it via any-cast for TS.
  const startDirs: string[] = [];
  const maybeDirname = (globalThis as unknown as { __dirname?: string }).__dirname;
  if (typeof maybeDirname === 'string') startDirs.push(maybeDirname);
  startDirs.push(process.cwd());
  for (const start of startDirs) {
    let cur = resolve(start);
    for (let i = 0; i < 8; i++) {
      const candidate = join(cur, 'config', 'products.json');
      try {
        readFileSync(candidate, 'utf8');
        return candidate;
      } catch {
        // try parent
      }
      const parent = dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }
  throw new Error(
    'Could not locate config/products.json. Set LIVEDEMO_PRODUCTS_JSON to override.',
  );
}

export const catalogTools: McpTool[] = [
  defineTool({
    name: 'livedemo_list_products',
    description:
      'List every product and module available for demo generation, including the tier, duration, and a brief description of each module.',
    schema: z.object({}),
    handler: async () => {
      const cat = getCatalog();
      const products: Array<{
        id: string;
        name: string;
        status: string;
        moduleCount: number;
        modules: Array<{ id: string; name: string; tier: string; description: string; estimatedDurationMinutes: number; screens: number }>;
      }> = [];
      for (const [key, value] of Object.entries(cat)) {
        if (key === 'defaults' || key.startsWith('$') || !value || typeof value !== 'object') continue;
        const prod = value as ProductDef;
        const modsEntries = Object.entries(prod.modules ?? {});
        products.push({
          id: key,
          name: prod.name ?? key,
          status: prod.status ?? 'active',
          moduleCount: modsEntries.length,
          modules: modsEntries.map(([mid, m]) => ({
            id: mid,
            name: m.name,
            tier: m.tier,
            description: m.description,
            estimatedDurationMinutes: m.estimatedDurationMinutes,
            screens: m.navigationPlan.length,
          })),
        });
      }
      return {
        defaults: cat.defaults,
        products,
      };
    },
  }),
];

// Helper for generate.ts — resolve a {product, module} pair to its full definition.
export function resolveModule(productId: string, moduleId: string): {
  product: ProductDef;
  module: ModuleDef;
  defaults: Defaults;
} {
  const cat = getCatalog();
  const product = cat[productId];
  if (!product || typeof product !== 'object' || !('modules' in product)) {
    throw new Error(`Unknown product: ${productId}`);
  }
  const prod = product as ProductDef;
  if (prod.status === 'pending') {
    throw new Error(`Product ${productId} is pending provisioning; no modules available`);
  }
  const mod = prod.modules?.[moduleId];
  if (!mod) throw new Error(`Unknown module: ${productId}/${moduleId}`);
  return { product: prod, module: mod, defaults: cat.defaults };
}
