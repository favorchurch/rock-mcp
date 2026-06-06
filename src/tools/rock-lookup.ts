import { z } from 'zod';
import { GatewayTool, McpToolResult } from './types.js';
import { McpMode, McpScope } from '../mcp/modes.js';
import { OAuthRockContext } from '../http/oauth.js';
import { formatResponse } from './formatter.js';
import { quoteLinqString } from '../rock/query.js';

const rockLookupSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('quickSearch'),
    query: z.string().min(1),
    kinds: z.array(z.enum([
      'person',
      'group',
      'groupType',
      'report',
      'entitySearch',
      'workflowType',
      'connectionType',
      'attribute',
      'definedValue'
    ])).optional(),
    limit: z.number().int().positive().max(50).default(10)
  }),
  z.object({
    action: z.literal('discovery'),
    includeRaw: z.boolean().default(false)
  }),
  z.object({
    action: z.literal('refreshDiscovery'),
    reason: z.string().optional()
  })
]);

export const rockLookupTool: GatewayTool = {
  name: 'rock_lookup',
  title: 'Rock Runtime Discovery & Lookup',
  schemaForMode(_mode: McpMode, _scopes: Set<McpScope>): z.ZodTypeAny | null {
    return rockLookupSchema;
  },
  descriptionForMode(_mode: McpMode): string {
    return 'Enables runtime discovery of Favor concepts and dynamic searches across Rock entities without exposing IDs.';
  },
  async handle(args: any, _extra: any, ctx: OAuthRockContext): Promise<McpToolResult> {
    const parsed = rockLookupSchema.parse(args);

    // Ensure discoveryService is attached to ctx
    const discoveryService = (ctx as any).discoveryService;
    if (!discoveryService) {
      return formatResponse(parsed.action, ctx, null, {
        code: 'MISSING_SERVICE',
        message: 'Discovery service is not initialized in the request context.',
      });
    }

    if (parsed.action === 'discovery') {
      try {
        const map = await discoveryService.getMap(ctx);
        return formatResponse(parsed.action, ctx, map);
      } catch (err: any) {
        return formatResponse(parsed.action, ctx, null, {
          code: 'DISCOVERY_ERROR',
          message: err.message || 'Failed to fetch discovery map.',
        });
      }
    }

    if (parsed.action === 'refreshDiscovery') {
      try {
        await discoveryService.refresh(ctx);
        return formatResponse(parsed.action, ctx, { success: true });
      } catch (err: any) {
        return formatResponse(parsed.action, ctx, null, {
          code: 'REFRESH_ERROR',
          message: err.message || 'Failed to refresh discovery map.',
        });
      }
    }

    if (parsed.action === 'quickSearch') {
      // Mock or call Rock API search
      const rockClient = (ctx as any).rockClient;
      if (!rockClient) {
        return formatResponse(parsed.action, ctx, null, {
          code: 'MISSING_CLIENT',
          message: 'Rock client is not initialized in the request context.',
        });
      }

      try {
        const results: any[] = [];
        const kinds = parsed.kinds || ['person'];

        if (kinds.includes('person')) {
          const quoted = quoteLinqString(parsed.query);
          const people = await rockClient.post(ctx, '/api/v2/models/people/search', {
            Where: `NickName.Contains(${quoted}) || LastName.Contains(${quoted})`,
          });
          results.push(...(people || []).map((p: any) => ({
            kind: 'person',
            id: p.Id,
            guid: p.Guid,
            name: `${p.NickName || p.FirstName} ${p.LastName}`,
          })));
        }

        return formatResponse(parsed.action, ctx, results.slice(0, parsed.limit));
      } catch (err: any) {
        return formatResponse(parsed.action, ctx, null, {
          code: 'SEARCH_ERROR',
          message: err.message || 'Failed to execute quick search.',
        });
      }
    }

    return formatResponse((parsed as any).action, ctx, null, {
      code: 'INVALID_ACTION',
      message: `Action not implemented: ${(parsed as any).action}`,
    });
  },
};
