import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import { rockMinistryTool } from './rock-ministry.js';
// @ts-ignore
import { OAuthRockContext } from '../http/oauth.js';

describe('rock_ministry tool', () => {
  let mockClient: any;
  let mockDiscoveryService: any;
  let mockCtx: any;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
    };

    mockDiscoveryService = {
      getMap: vi.fn().mockResolvedValue({
        groupTypes: {
          connectGroups: [{ id: 10, name: 'Connect Groups', confidence: 1.0 }],
          ministryTeams: [{ id: 11, name: 'Ministry Teams', confidence: 1.0 }],
        },
      }),
    };

    mockCtx = {
      mode: 'readonly',
      rockClient: mockClient,
      discoveryService: mockDiscoveryService,
    } as unknown as OAuthRockContext;
  });

  it('should handle groups action and return list of groups under group type', async () => {
    mockClient.post.mockResolvedValue([
      { Id: 50, Name: 'Young Adults Friday BGC', GroupTypeId: 10 },
    ]);

    const result = await rockMinistryTool.handle(
      { action: 'groups', kind: 'connectGroup' },
      null,
      mockCtx
    );

    expect(mockClient.post).toHaveBeenCalledWith(
      mockCtx,
      '/api/v2/models/groups/search',
      expect.objectContaining({ Where: 'GroupTypeId == 10 && IsActive == true' })
    );

    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(true);
    expect(response.result[0].name).toBe('Young Adults Friday BGC');
  });

  it('should handle groupMembers action and return members', async () => {
    mockClient.post.mockResolvedValue([
      {
        Id: 1001,
        Person: { FirstName: 'Alex', LastName: 'Santos' },
        GroupRole: { Name: 'Member' },
      },
    ]);

    const result = await rockMinistryTool.handle(
      { action: 'groupMembers', groupId: 50 },
      null,
      mockCtx
    );

    expect(mockClient.post).toHaveBeenCalledWith(
      mockCtx,
      '/api/v2/models/groupmembers/search',
      expect.objectContaining({ Where: 'GroupId == 50' })
    );

    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(true);
    expect(response.result[0].personName).toBe('Alex Santos');
  });
});
