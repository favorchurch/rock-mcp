import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import { DiscoveryService } from './discovery-service.js';
// @ts-ignore
import { RockClient } from '../rock/client.js';
// @ts-ignore
import { OAuthRockContext } from '../http/oauth.js';

describe('DiscoveryService', () => {
  let mockClient: RockClient;
  let service: DiscoveryService;
  const mockCtx = {} as OAuthRockContext;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };
    // Initialize service with mock client and null redis to trigger in-memory fallback
    service = new DiscoveryService(mockClient, null);
  });

  it('should lazy load and cache the discovery map', async () => {
    // Stub client calls for discovery elements
    mockClient.get = vi.fn().mockImplementation(async (_ctx, path) => {
      if (path.includes('/SystemInfos') || path.includes('/System')) {
        return { Version: '17.7' };
      }
      return [];
    });

    mockClient.post = vi.fn().mockImplementation(async (_ctx, path, _body) => {
      if (path.includes('/campuses/search')) {
        return [{ Id: 1, Name: 'Manila', Guid: 'g-manila' }];
      }
      if (path.includes('/grouptypes/search')) {
        return [
          { Id: 10, Name: 'Connect Groups', Guid: 'g-cg' },
          { Id: 11, Name: 'Ministry Teams', Guid: 'g-mt' },
        ];
      }
      return [];
    });

    // First call: runs mock client search queries
    const map1 = await service.getMap(mockCtx);
    expect(map1.campuses).toHaveLength(1);
    expect(map1.campuses[0].name).toBe('Manila');
    expect(mockClient.post).toHaveBeenCalled();

    // Reset post spy to verify it's not called on second read
    vi.mocked(mockClient.post).mockClear();

    // Second call: should hit cache
    const map2 = await service.getMap(mockCtx);
    expect(map2.campuses).toHaveLength(1);
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it('should refresh discovery and query Rock again', async () => {
    mockClient.get = vi.fn().mockResolvedValue({ Version: '17.7' } as any);
    mockClient.post = vi.fn().mockResolvedValue([]);

    await service.getMap(mockCtx);
    expect(mockClient.post).toHaveBeenCalled();

    // Reset post spy
    vi.mocked(mockClient.post).mockClear();

    // Call refresh
    await service.refresh(mockCtx);

    // Should fetch again
    await service.getMap(mockCtx);
    expect(mockClient.post).toHaveBeenCalled();
  });
});
