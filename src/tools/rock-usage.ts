import { z } from 'zod';
import { GatewayTool, McpToolResult } from './types.js';
import { McpMode, McpScope } from '../mcp/modes.js';
import { OAuthRockContext } from '../http/oauth.js';
import { getRockGuideText } from '../mcp/guide-text.js';
import { USAGE_NUDGE } from './usage-nudge.js';

export const rockUsageTool: GatewayTool = {
  name: 'rock_usage',
  title: 'Rock Usage Guide',
  schemaForMode(_mode: McpMode, _scopes: Set<McpScope>): z.ZodTypeAny | null {
    return z.object({});
  },
  descriptionForMode(mode: McpMode): string {
    return `${getRockGuideText(mode)}\n\n${USAGE_NUDGE}`;
  },
  async handle(_args: any, _extra: any, ctx: OAuthRockContext): Promise<McpToolResult> {
    const mode = ctx.mode ?? 'readonly';
    return {
      content: [
        {
          type: 'text',
          text: `${getRockGuideText(mode)}\n\n${describeWriteAccess(ctx)}`,
        },
      ],
    };
  },
};

/**
 * Explain why the current session is read-only or read-write. On the `/mcp`
 * auto endpoint, write access requires BOTH the `write` scope AND RSR-admin
 * status, so surface all three signals to make "why can't I write?" diagnosable.
 */
function describeWriteAccess(ctx: OAuthRockContext): string {
  const scopes = [...(ctx.scopes ?? [])];
  const hasWrite = ctx.scopes?.has('write') ?? false;
  const isAdmin = ctx.rockUser?.isRsrAdmin ?? false;
  const lines = [
    'Write access diagnostics:',
    `- endpoint: ${ctx.endpoint}`,
    `- mode: ${ctx.mode}`,
    `- scopes: ${scopes.length ? scopes.join(', ') : '(none)'}`,
    `- write scope: ${hasWrite ? 'yes' : 'no'}`,
    `- isRsrAdmin: ${isAdmin ? 'yes' : 'no'}`,
    `- resolved personId: ${ctx.rockUser?.personId ?? '(unresolved)'}`,
  ];
  if (ctx.mode !== 'readwrite') {
    if (ctx.endpoint === 'mcp') {
      lines.push(
        `Read-only because ${!hasWrite ? 'the token lacks the write scope' : 'the user is not an RSR admin'}. The /mcp endpoint upgrades to readwrite only with write scope AND RSR-admin membership.`
      );
    } else if (ctx.endpoint === 'readwrite') {
      lines.push('Read-only despite the readwrite endpoint — the token lacks the write scope.');
    } else {
      lines.push('This is the readonly endpoint; connect via /mcp or /mcp/readwrite for write access.');
    }
  }
  return lines.join('\n');
}
