import { describe, it, expect, vi } from 'vitest';
// @ts-ignore
import { registerReportViewerApp } from './apps.js';
// @ts-ignore
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('MCP App Registration', () => {
  it('should attempt to register the report viewer resource with the McpServer', () => {
    const mockServer = {
      registerResource: vi.fn(),
    };

    registerReportViewerApp(mockServer as any);

    expect(mockServer.registerResource).toHaveBeenCalledWith(
      expect.stringContaining('report-viewer'),
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });
});
