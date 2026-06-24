import { describe, it, expect } from 'vitest';
// @ts-ignore
import { rockUsageTool } from '../../src/tools/rock-usage.js';
// @ts-ignore
import { OAuthRockContext } from '../../src/http/oauth.js';
// @ts-ignore
import { USAGE_NUDGE } from '../../src/tools/usage-nudge.js';

describe('rock_usage tool', () => {
  it('should return real guide content in readonly mode', async () => {
    const ctx = {
      mode: 'readonly',
    } as unknown as OAuthRockContext;

    const result = await rockUsageTool.handle({}, null, ctx);
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text ?? '';
    expect(text).toContain('Favor Church');
    expect(text.length).toBeGreaterThan(1000);
    expect(text).not.toContain('Write & Mutation Safety');
  });

  it('should return real guide content in readwrite mode', async () => {
    const ctx = {
      mode: 'readwrite',
    } as unknown as OAuthRockContext;

    const result = await rockUsageTool.handle({}, null, ctx);
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text ?? '';
    expect(text).toContain('Favor Church');
    expect(text.length).toBeGreaterThan(1000);
    expect(text).toContain('Write & Mutation Safety');
  });

  it('should default to readonly when mode is missing', async () => {
    const ctx = {} as unknown as OAuthRockContext;

    const result = await rockUsageTool.handle({}, null, ctx);
    const text = result.content[0].text ?? '';
    expect(text).not.toContain('Write & Mutation Safety');
  });

  it('should embed USAGE_NUDGE in readonly description', () => {
    const desc = rockUsageTool.descriptionForMode('readonly');
    expect(desc).toContain(USAGE_NUDGE);
    expect(desc).toContain('Favor Church');
    expect(desc).not.toContain('Write & Mutation Safety');
  });

  it('should embed USAGE_NUDGE in readwrite description', () => {
    const desc = rockUsageTool.descriptionForMode('readwrite');
    expect(desc).toContain(USAGE_NUDGE);
    expect(desc).toContain('Favor Church');
    expect(desc).toContain('Write & Mutation Safety');
  });
});

describe('rock_usage wiki', () => {
  const ctx = { mode: 'readonly' } as unknown as OAuthRockContext;

  it('fetches a topic as markdown (no overlay context degrades gracefully)', async () => {
    const result = await rockUsageTool.handle({ topic: 'connection-status' }, null, ctx);
    const text = result.content[0].text ?? '';
    expect(result.isError).toBeFalsy();
    expect(text).toContain('# Connection Status & the Favor Lifecycle');
    expect(text).toContain('four-stage');
  });

  it('resolves a topic by alias', async () => {
    const result = await rockUsageTool.handle({ topic: 'lifecycle' }, null, ctx);
    const text = result.content[0].text ?? '';
    expect(text).toContain('Connection Status & the Favor Lifecycle');
  });

  it('returns TOPIC_NOT_FOUND for an unknown topic', async () => {
    const result = await rockUsageTool.handle({ topic: 'nope-not-real' }, null, ctx);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text ?? '{}');
    expect(parsed.error.code).toBe('TOPIC_NOT_FOUND');
  });

  it('lists topics as a JSON envelope', async () => {
    const result = await rockUsageTool.handle({ list: true }, null, ctx);
    const parsed = JSON.parse(result.content[0].text ?? '{}');
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe('list');
    expect(parsed.result.map((t: any) => t.id)).toContain('connection-status');
  });

  it('searches topics, ranking the obvious match first', async () => {
    const result = await rockUsageTool.handle({ query: 'connect group' }, null, ctx);
    const parsed = JSON.parse(result.content[0].text ?? '{}');
    expect(parsed.action).toBe('query');
    expect(parsed.result[0].id).toBe('connect-groups');
  });

  it('still returns the full guide with no args', async () => {
    const result = await rockUsageTool.handle({}, null, ctx);
    const text = result.content[0].text ?? '';
    expect(text).toContain('Favor Church');
    expect(text).toContain('Write access diagnostics');
    expect(text.length).toBeGreaterThan(1000);
  });
});
