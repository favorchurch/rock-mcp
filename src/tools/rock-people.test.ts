import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import { rockPeopleTool } from './rock-people.js';
// @ts-ignore
import { OAuthRockContext } from '../http/oauth.js';

describe('rock_people tool', () => {
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

  it('should return a privacy-safe profile by default', async () => {
    mockClient.post.mockResolvedValue([
      {
        Id: 123,
        Guid: 'g-123',
        FirstName: 'Alex',
        LastName: 'Santos',
        Email: 'alex@example.com',
        PrimaryAliasId: 1234,
      },
    ]);

    const result = await rockPeopleTool.handle(
      { action: 'profile', person: { search: 'Alex Santos' } },
      null,
      mockCtx
    );

    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(true);
    expect(response.result.person.name).toBe('Alex Santos');
    // Ensure email is hidden/redacted by default
    expect(response.result.person.email).toBeUndefined();
  });

  it('should reveal email if explicitly requested and user has read/write scope', async () => {
    mockCtx.mode = 'readwrite';
    mockCtx.scopes = new Set(['read', 'write']);

    mockClient.post.mockResolvedValue([
      {
        Id: 123,
        Guid: 'g-123',
        FirstName: 'Alex',
        LastName: 'Santos',
        Email: 'alex@example.com',
        PrimaryAliasId: 1234,
      },
    ]);

    const result = await rockPeopleTool.handle(
      { action: 'profile', person: { search: 'Alex Santos' }, includeSensitive: true },
      null,
      mockCtx
    );

    const response = JSON.parse(result.content[0].text!);
    expect(response.ok).toBe(true);
    expect(response.result.person.email).toBe('alex@example.com');
  });
});
