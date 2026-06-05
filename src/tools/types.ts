import { z } from 'zod';
import { McpMode, McpScope } from '../mcp/modes.js';
import { OAuthRockContext } from '../http/oauth.js';

export interface McpToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    [key: string]: any;
  }>;
  isError?: boolean;
}

export interface GatewayTool {
  name: string;
  title: string;
  schemaForMode(mode: McpMode, scopes: Set<McpScope>): z.ZodTypeAny | null;
  descriptionForMode(mode: McpMode): string;
  handle(args: any, extra: any, ctx: OAuthRockContext): Promise<McpToolResult>;
}
