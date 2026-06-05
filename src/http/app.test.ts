import { describe, it, expect } from 'vitest';
// @ts-ignore
import { createApp } from './app.js';

describe('HTTP MCP Endpoints', () => {
  it('should expose the expected MCP endpoints', async () => {
    const app = createApp();
    // We expect the app to have registered routers or paths
    const routes = app._router.stack
      .filter((r: any) => r.route)
      .map((r: any) => r.route.path);
    
    expect(routes).toContain('/mcp/readonly');
    expect(routes).toContain('/mcp/readwrite');
    expect(routes).toContain('/mcp');
  });
});
