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
        accessTokenHash: 'hash-123',
      },
      request: {
        requestId: 'req-123',
        sessionId: 'sess-123',
      },
      rockUser: {
        personId: 456,
        isRsrAdmin: false,
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

  it('should deny patch on disallowed models', async () => {
    const result = await rockWriteTool.handle(
      { action: 'patch', model: 'secretModel', id: 123, data: { field: 'value' }, dryRun: true, reason: 'Test' },
      null,
      mockCtx
    );

    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(false);
    expect(response.error.code).toBe('MODEL_NOT_ALLOWED');
  });

  it('should deny delete to non-admins', async () => {
    mockCtx.rockUser.isRsrAdmin = false;
    const result = await rockWriteTool.handle(
      { action: 'delete', model: 'groupmembers', id: 123, dryRun: true, reason: 'Test' },
      null,
      mockCtx
    );

    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(false);
    expect(response.error.code).toBe('DELETE_REQUIRES_ADMIN');
  });

  it('should allow delete to admins', async () => {
    mockClient.delete.mockResolvedValue({});
    mockCtx.rockUser.isRsrAdmin = true;
    const result = await rockWriteTool.handle(
      { action: 'delete', model: 'groupmembers', id: 123, commit: true, dryRun: false, reason: 'Delete member' },
      null,
      mockCtx
    );

    expect(mockClient.delete).toHaveBeenCalled();
    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(true);
  });

  it('should deny patch with disallowed fields', async () => {
    const result = await rockWriteTool.handle(
      { action: 'patch', model: 'people', id: 123, data: { Email: 'test@example.com', SecretField: 'bad' }, dryRun: true, reason: 'Test' },
      null,
      mockCtx
    );

    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(false);
    expect(response.error.code).toBe('FIELD_NOT_ALLOWED');
  });
});
