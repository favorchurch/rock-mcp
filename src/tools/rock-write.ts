import { z } from 'zod';
import { GatewayTool, McpToolResult } from './types.js';
import { McpMode, McpScope } from '../mcp/modes.js';
import { OAuthRockContext } from '../http/oauth.js';
import { formatResponse } from './formatter.js';
import { RockClient } from '../rock/client.js';
import { AuditLogger } from '../auth/audit.js';

const rockWriteSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('patch'),
    model: z.string().min(1),
    id: z.union([z.string(), z.number()]),
    data: z.record(z.unknown()),
    dryRun: z.boolean().default(true),
    commit: z.boolean().default(false),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('delete'),
    model: z.string().min(1),
    id: z.union([z.string(), z.number()]),
    dryRun: z.boolean().default(true),
    commit: z.boolean().default(false),
    reason: z.string().optional(),
  }),
]);

function getRestV1Path(model: string): string {
  const lower = model.toLowerCase();
  if (lower === 'people' || lower === 'person') return 'People';
  if (lower === 'grouptypes' || lower === 'grouptype') return 'GroupTypes';
  if (lower === 'groups' || lower === 'group') return 'Groups';
  if (lower === 'campuses' || lower === 'campus') return 'Campuses';
  if (lower === 'userlogins' || lower === 'userlogin') return 'UserLogins';
  if (lower === 'groupmembers' || lower === 'groupmember') return 'GroupMembers';
  return model.charAt(0).toUpperCase() + model.slice(1);
}

const auditLogger = new AuditLogger();

export const rockWriteTool: GatewayTool = {
  name: 'rock_write',
  title: 'Rock Mutation Client',
  schemaForMode(mode: McpMode, scopes: Set<McpScope>): z.ZodTypeAny | null {
    if (mode !== 'readwrite' || !scopes.has('write')) {
      return null; // Register only in readwrite mode
    }
    return rockWriteSchema;
  },
  descriptionForMode(_mode: McpMode): string {
    return 'Generic write and update operations on Rock entities.';
  },
  async handle(args: any, _extra: any, ctx: OAuthRockContext): Promise<McpToolResult> {
    // Check mode double-security
    if (ctx.mode !== 'readwrite') {
      return formatResponse('write', ctx, null, {
        code: 'UNAUTHORIZED_MODE',
        message: 'Write operations are disallowed in readonly mode.',
      });
    }

    const parsed = rockWriteSchema.parse(args);
    const { action, model, id, dryRun, commit, reason } = parsed;

    if (!reason || reason.trim().length === 0) {
      return formatResponse(action, ctx, null, {
        code: 'VALIDATION_ERROR',
        message: 'A human-readable reason is required for all write operations.',
      });
    }

    const rockClient = (ctx as any).rockClient as RockClient;
    if (!rockClient) {
      return formatResponse(action, ctx, null, {
        code: 'MISSING_CLIENT',
        message: 'Rock client is not initialized in request context.',
      });
    }

    const shouldMutate = commit && !dryRun;

    if (!shouldMutate) {
      // Log audit dry-run
      auditLogger.log(ctx, {
        tool: 'rock_write',
        action,
        target: { model, id },
        dryRun: true,
        commit: false,
        reason,
        outcome: 'allowed',
      });

      return formatResponse(action, ctx, {
        dryRun: true,
        committed: false,
        message: 'Dry run output. No mutations were applied.',
        target: { model, id },
        data: action === 'patch' ? (parsed as any).data : undefined,
      });
    }

    if (action === 'patch') {
      const { data } = parsed as any;
      try {
        const result = await rockClient.patch(ctx, `/api/v2/models/${model}/${id}`, data);
        
        auditLogger.log(ctx, {
          tool: 'rock_write',
          action,
          target: { model, id },
          dryRun: false,
          commit: true,
          reason,
          outcome: 'success',
        });

        return formatResponse(action, ctx, { committed: true, result });
      } catch (_err) {
        // Fall back to REST v1 PATCH
        try {
          const v1Path = getRestV1Path(model);
          const result = await rockClient.patch(ctx, `/api/${v1Path}/${id}`, data);
          
          auditLogger.log(ctx, {
            tool: 'rock_write',
            action,
            target: { model, id },
            dryRun: false,
            commit: true,
            reason: `${reason} (via REST v1 fallback)`,
            outcome: 'success',
          });

          return formatResponse(action, ctx, { committed: true, result }, undefined, 'Fell back to REST v1');
        } catch (v1Err: any) {
          auditLogger.log(ctx, {
            tool: 'rock_write',
            action,
            target: { model, id },
            dryRun: false,
            commit: true,
            reason,
            outcome: 'error',
            errorCode: 'PATCH_ERROR',
          });

          return formatResponse(action, ctx, null, {
            code: 'PATCH_ERROR',
            message: `PATCH failed on v2 and v1: ${v1Err.message}`,
          });
        }
      }
    }

    if (action === 'delete') {
      try {
        const result = await rockClient.delete(ctx, `/api/v2/models/${model}/${id}`);

        auditLogger.log(ctx, {
          tool: 'rock_write',
          action,
          target: { model, id },
          dryRun: false,
          commit: true,
          reason,
          outcome: 'success',
        });

        return formatResponse(action, ctx, { committed: true, result });
      } catch (_err) {
        // Fall back to REST v1 DELETE
        try {
          const v1Path = getRestV1Path(model);
          const result = await rockClient.delete(ctx, `/api/${v1Path}/${id}`);

          auditLogger.log(ctx, {
            tool: 'rock_write',
            action,
            target: { model, id },
            dryRun: false,
            commit: true,
            reason: `${reason} (via REST v1 fallback)`,
            outcome: 'success',
          });

          return formatResponse(action, ctx, { committed: true, result }, undefined, 'Fell back to REST v1');
        } catch (v1Err: any) {
          auditLogger.log(ctx, {
            tool: 'rock_write',
            action,
            target: { model, id },
            dryRun: false,
            commit: true,
            reason,
            outcome: 'error',
            errorCode: 'DELETE_ERROR',
          });

          return formatResponse(action, ctx, null, {
            code: 'DELETE_ERROR',
            message: `DELETE failed on v2 and v1: ${v1Err.message}`,
          });
        }
      }
    }

    return formatResponse(action, ctx, null, {
      code: 'NOT_IMPLEMENTED',
      message: `Action ${action} is not yet implemented.`,
    });
  },
};
