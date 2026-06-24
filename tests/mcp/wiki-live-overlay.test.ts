import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the live data sources the overlay reuses.
vi.mock('../../src/rock/defined-values.js', () => ({
  getDefinedValueMap: vi.fn(),
}));
vi.mock('../../src/tools/rock-people.js', () => ({
  countByConnectionStatus: vi.fn(),
}));

// @ts-ignore
import { renderLiveOverlay } from '../../src/mcp/wiki/live-overlay.js';
// @ts-ignore
import { getDefinedValueMap } from '../../src/rock/defined-values.js';
// @ts-ignore
import { countByConnectionStatus } from '../../src/tools/rock-people.js';

describe('renderLiveOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a definedType table with live counts', async () => {
    (getDefinedValueMap as any).mockResolvedValue(
      new Map([
        [67, 'New'],
        [65, 'Leader'],
      ])
    );
    (countByConnectionStatus as any).mockImplementation(async (_ctx: any, name: string) =>
      name === 'New' ? 1765 : 770
    );

    const ctx = { rockClient: {} } as any;
    const out = await renderLiveOverlay(
      { kind: 'definedType', definedTypeName: 'Connection Status', countsByStatus: true },
      ctx
    );
    expect(out).toContain('People (live)');
    expect(out).toContain('| New | 67 | 1765 |');
    expect(out).toContain('| Leader | 65 | 770 |');
  });

  it('renders a discovery-backed groupType list', async () => {
    const ctx = {
      discoveryService: {
        getMap: vi.fn().mockResolvedValue({
          generatedAt: '2026-06-24T00:00:00Z',
          groupTypes: {
            connectGroups: [{ id: 25, name: 'Connect Group', confidence: 0.6 }],
          },
        }),
      },
    } as any;
    const out = await renderLiveOverlay({ kind: 'groupType', match: 'connectGroups' }, ctx);
    expect(out).toContain('Connect Group');
    expect(out).toContain('id 25');
  });

  it('degrades gracefully when discovery is unavailable', async () => {
    const out = await renderLiveOverlay({ kind: 'campuses' }, {} as any);
    expect(out).toContain('Live overlay unavailable');
  });

  it('degrades when a definedType has no rock client', async () => {
    const out = await renderLiveOverlay(
      { kind: 'definedType', definedTypeName: 'Connection Status', countsByStatus: false },
      {} as any
    );
    expect(out).toContain('Live overlay unavailable');
  });
});
