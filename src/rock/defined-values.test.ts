import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import { getDefinedValueMap, clearDefinedValueCache } from './defined-values.js';
// @ts-ignore
import { OAuthRockContext } from '../http/oauth.js';

describe('defined-values module', () => {
  let mockClient: any;
  let mockCtx: any;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    };

    mockCtx = {
      oauth: { subject: 'test-user' },
      rockUser: { personId: 123 },
      request: { sessionId: 'session-123' },
    } as unknown as OAuthRockContext;

    clearDefinedValueCache();
  });

  it('returns a map of DefinedValue IDs to names', async () => {
    mockClient.get.mockResolvedValue([
      { Id: 67, Value: 'Member', DefinedTypeId: 1 },
      { Id: 68, Value: 'Visitor', DefinedTypeId: 1 },
    ]);

    const map = await getDefinedValueMap(mockClient, mockCtx, 'Connection Status');

    expect(map.get(67)).toBe('Member');
    expect(map.get(68)).toBe('Visitor');
    expect(map.size).toBe(2);
  });

  it('caches results and does not refetch on second call', async () => {
    mockClient.get.mockResolvedValue([
      { Id: 67, Value: 'Member', DefinedTypeId: 1 },
    ]);

    const map1 = await getDefinedValueMap(mockClient, mockCtx, 'Connection Status');
    const map2 = await getDefinedValueMap(mockClient, mockCtx, 'Connection Status');

    expect(map1.get(67)).toBe('Member');
    expect(map2.get(67)).toBe('Member');
    // Mock should only be called once
    expect(mockClient.get).toHaveBeenCalledTimes(1);
  });

  it('returns empty map on fetch error and does not cache the error', async () => {
    mockClient.get.mockRejectedValue(new Error('API error'));

    const map1 = await getDefinedValueMap(mockClient, mockCtx, 'Connection Status');
    expect(map1.size).toBe(0);

    // Reset the mock to succeed on next call
    mockClient.get.mockResolvedValue([
      { Id: 67, Value: 'Member', DefinedTypeId: 1 },
    ]);

    const map2 = await getDefinedValueMap(mockClient, mockCtx, 'Connection Status');
    expect(map2.get(67)).toBe('Member');
    // Should have called twice (error was not cached)
    expect(mockClient.get).toHaveBeenCalledTimes(2);
  });

  it('handles null/undefined values in results gracefully', async () => {
    mockClient.get.mockResolvedValue([
      { Id: 67, Value: 'Member', DefinedTypeId: 1 },
      { Id: null, Value: 'Bad', DefinedTypeId: 1 }, // Invalid entry
      { Id: 69, Value: null, DefinedTypeId: 1 },    // Invalid entry
      { Id: 70, Value: 'Active', DefinedTypeId: 2 },
    ]);

    const map = await getDefinedValueMap(mockClient, mockCtx, 'Connection Status');

    expect(map.size).toBe(2);
    expect(map.get(67)).toBe('Member');
    expect(map.get(70)).toBe('Active');
  });

  it('clears the cache when clearDefinedValueCache is called', async () => {
    mockClient.get.mockResolvedValue([
      { Id: 67, Value: 'Member', DefinedTypeId: 1 },
    ]);

    const map1 = await getDefinedValueMap(mockClient, mockCtx, 'Connection Status');
    expect(map1.get(67)).toBe('Member');

    clearDefinedValueCache();

    // Reset mock to track calls
    mockClient.get.mockClear();
    mockClient.get.mockResolvedValue([
      { Id: 67, Value: 'Member', DefinedTypeId: 1 },
    ]);

    const map2 = await getDefinedValueMap(mockClient, mockCtx, 'Connection Status');
    expect(map2.get(67)).toBe('Member');
    // Should have called once after cache clear
    expect(mockClient.get).toHaveBeenCalledTimes(1);
  });
});
