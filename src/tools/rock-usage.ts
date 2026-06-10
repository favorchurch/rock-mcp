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
          text: getRockGuideText(mode),
        },
      ],
    };
  },
};
