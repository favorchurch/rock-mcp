import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import { rockEntityTool } from './rock-entity.js';
// @ts-ignore
import { OAuthRockContext } from '../http/oauth.js';

describe('rock_entity tool', () => {
  let mockClient: any;
  let mockCtx: any;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
    };

    mockCtx = {
      mode: 'readonly',
      rockClient: mockClient,
    } as unknown as OAuthRockContext;
  });

  it('should handle get action and return entity', async () => {
    mockClient.get.mockResolvedValue({ Id: 123, Name: 'Alex Santos' });

    const result = await rockEntityTool.handle(
      { action: 'get', model: 'people', id: 123 },
      null,
      mockCtx
    );

    expect(mockClient.get).toHaveBeenCalledWith(mockCtx, '/api/v2/models/people/123');
    const response = JSON.parse(result.content[0].text!);
    expect(response.result.Name).toBe('Alex Santos');
  });

  it('should handle search action', async () => {
    mockClient.post.mockResolvedValue([{ Id: 123, Name: 'Alex Santos' }]);

    const result = await rockEntityTool.handle(
      { action: 'search', model: 'people', where: 'Id == 123' },
      null,
      mockCtx
    );

    expect(mockClient.post).toHaveBeenCalledWith(
      mockCtx,
      '/api/v2/models/people/search',
      expect.objectContaining({ Where: 'Id == 123' })
    );
    const response = JSON.parse(result.content[0].text!);
    expect(response.result[0].Name).toBe('Alex Santos');
  });
});
