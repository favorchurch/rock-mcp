import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import { rockLookupTool } from './rock-lookup.js';
// @ts-ignore
import { OAuthRockContext } from '../http/oauth.js';
// @ts-ignore
import { DiscoveryService } from '../discovery/discovery-service.js';

describe('rock_lookup tool', () => {
  let mockDiscoveryService: any;
  let mockCtx: any;

  beforeEach(() => {
    mockDiscoveryService = {
      getMap: vi.fn().mockResolvedValue({
        campuses: [{ name: 'Manila', confidence: 1.0, signals: [] }],
        groupTypes: { connectGroups: [], ministryTeams: [], other: [] },
      }),
      refresh: vi.fn(),
    };

    mockCtx = {
      mode: 'readonly',
      discoveryService: mockDiscoveryService,
    } as unknown as OAuthRockContext;
  });

  it('should handle discovery action and return map', async () => {
    const result = await rockLookupTool.handle({ action: 'discovery' }, null, mockCtx);
    expect(result.content[0].type).toBe('text');
    const response = JSON.parse(result.content[0].text!);
    expect(response.result.campuses[0].name).toBe('Manila');
    expect(mockDiscoveryService.getMap).toHaveBeenCalled();
  });

  it('should handle refreshDiscovery action', async () => {
    const result = await rockLookupTool.handle({ action: 'refreshDiscovery', reason: 'manual refresh' }, null, mockCtx);
    expect(result.content[0].type).toBe('text');
    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(true);
    expect(mockDiscoveryService.refresh).toHaveBeenCalled();
  });
});
