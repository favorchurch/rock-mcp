import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import { rockWriteTool } from './rock-write.js';
// @ts-ignore
import { OAuthRockContext } from '../http/oauth.js';

describe('rock_write tool', () => {
  let mockClient: any;
  let mockCtx: any;

  beforeEach(() => {
    mockClient = {
      patch: vi.fn(),
      delete: vi.fn(),
    };

    mockCtx = {
      mode: 'readwrite',
      scopes: new Set(['read', 'write']),
      rockClient: mockClient,
      oauth: {
        subject: 'user-123',
      },
      request: {
        requestId: 'req-123',
        sessionId: 'sess-123',
      },
      rockUser: {
        personId: 456,
      },
      endpoint: '/mcp/readwrite',
    } as unknown as OAuthRockContext;
  });

  it('should return null schema in readonly mode', () => {
    const schema = rockWriteTool.schemaForMode('readonly', new Set(['read']));
    expect(schema).toBeNull();
  });

  it('should fail if reason is missing', async () => {
    const result = await rockWriteTool.handle(
      { action: 'patch', model: 'people', id: 123, data: { NickName: 'Alex' }, commit: true },
      null,
      mockCtx
    );
    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(false);
    expect(response.error.message).toContain('reason');
  });

  it('should not mutate if dryRun is true', async () => {
    const result = await rockWriteTool.handle(
      { action: 'patch', model: 'people', id: 123, data: { NickName: 'Alex' }, dryRun: true, reason: 'Testing dryrun' },
      null,
      mockCtx
    );

    expect(mockClient.patch).not.toHaveBeenCalled();
    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(true);
    expect(response.result.dryRun).toBe(true);
  });

  it('should call client.patch if commit is true and reason is provided', async () => {
    mockClient.patch.mockResolvedValue({ Id: 123, NickName: 'Alex' });

    const result = await rockWriteTool.handle(
      { action: 'patch', model: 'people', id: 123, data: { NickName: 'Alex' }, commit: true, dryRun: false, reason: 'Change nickname' },
      null,
      mockCtx
    );

    expect(mockClient.patch).toHaveBeenCalledWith(
      mockCtx,
      '/api/v2/models/people/123',
      expect.objectContaining({ NickName: 'Alex' })
    );
    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(true);
  });
});
