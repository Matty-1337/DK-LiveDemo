import { z } from 'zod';

export interface McpTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<unknown>;
}

export function defineTool<T extends z.ZodTypeAny>(opts: {
  name: string;
  description: string;
  schema: T;
  handler: (input: z.infer<T>) => Promise<unknown>;
}): McpTool {
  return {
    name: opts.name,
    description: opts.description,
    schema: opts.schema,
    handler: async (raw: unknown) => {
      const parsed = opts.schema.parse(raw ?? {});
      return opts.handler(parsed);
    },
  };
}

// Convert a Zod object schema into a minimal JSON Schema for MCP tool listing.
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Lightweight: handle ZodObject only, fall back to permissive object.
  if (schema instanceof z.ZodObject) {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodFieldToJson(value as z.ZodTypeAny);
      if (!(value as z.ZodTypeAny).isOptional()) required.push(key);
    }
    return {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    };
  }
  return { type: 'object', additionalProperties: true };
}

function zodFieldToJson(z0: z.ZodTypeAny): Record<string, unknown> {
  const def: any = (z0 as any)._def;
  const typeName: string = def?.typeName ?? '';
  const desc = (z0 as any).description as string | undefined;
  const base: Record<string, unknown> = {};
  if (desc) base.description = desc;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string', ...base };
    case 'ZodNumber':
      return { type: 'number', ...base };
    case 'ZodBoolean':
      return { type: 'boolean', ...base };
    case 'ZodArray':
      return { type: 'array', items: zodFieldToJson(def.type), ...base };
    case 'ZodEnum':
      return { type: 'string', enum: def.values, ...base };
    case 'ZodOptional':
    case 'ZodDefault':
    case 'ZodNullable':
      return zodFieldToJson(def.innerType);
    case 'ZodObject':
      return { ...zodToJsonSchema(z0), ...base };
    case 'ZodUnion':
      return { anyOf: def.options.map((o: z.ZodTypeAny) => zodFieldToJson(o)), ...base };
    case 'ZodLiteral':
      return { const: def.value, ...base };
    default:
      return { ...base };
  }
}
