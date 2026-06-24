import { describe, it, expect, beforeEach } from 'vitest';
// @ts-ignore
import { parseFrontMatter } from '../../src/mcp/wiki/frontmatter.js';
// @ts-ignore
import { frontMatterSchema } from '../../src/mcp/wiki/wiki-types.js';
// @ts-ignore
import { listTopics, getTopic, searchTopics, clearWikiCache } from '../../src/mcp/wiki/wiki-store.js';

describe('front-matter parser', () => {
  it('parses scalars, inline arrays, block lists, and a nested map', () => {
    const raw = [
      '---',
      'id: connection-status',
      'title: Connection Status',
      'aliases: [lifecycle, connection status, stages]',
      'tags:',
      '  - people',
      '  - lifecycle',
      'liveBinding:',
      '  kind: definedType',
      '  definedTypeName: Connection Status',
      '  definedTypeId: 4',
      '  countsByStatus: true',
      '---',
      '',
      'Body line one.',
      'Body line two.',
    ].join('\n');

    const { data, body } = parseFrontMatter(raw);
    expect(data.id).toBe('connection-status');
    expect(data.title).toBe('Connection Status');
    expect(data.aliases).toEqual(['lifecycle', 'connection status', 'stages']);
    expect(data.tags).toEqual(['people', 'lifecycle']);
    expect(data.liveBinding).toEqual({
      kind: 'definedType',
      definedTypeName: 'Connection Status',
      definedTypeId: 4,
      countsByStatus: true,
    });
    expect(body).toContain('Body line one.');
    expect(body).toContain('Body line two.');
  });

  it('returns whole content as body when there is no front-matter fence', () => {
    const { data, body } = parseFrontMatter('# Just markdown\n\nhello');
    expect(data).toEqual({});
    expect(body).toContain('Just markdown');
  });

  it('validates parsed front-matter with the schema', () => {
    const { data } = parseFrontMatter(
      ['---', 'id: connect-groups', 'title: Connect Groups', '---', 'body'].join('\n')
    );
    const parsed = frontMatterSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it('rejects a bad id slug', () => {
    const parsed = frontMatterSchema.safeParse({ id: 'Not A Slug', title: 'X' });
    expect(parsed.success).toBe(false);
  });
});

describe('wiki store (real seed files)', () => {
  beforeEach(() => clearWikiCache());

  it('lists seeded topics including connection-status', () => {
    const topics = listTopics();
    expect(topics.length).toBeGreaterThanOrEqual(10);
    expect(topics.map((t) => t.id)).toContain('connection-status');
  });

  it('gets a topic by id', () => {
    const a = getTopic('connection-status');
    expect(a).not.toBeNull();
    expect(a!.frontMatter.title).toContain('Connection Status');
    expect(a!.body.length).toBeGreaterThan(50);
  });

  it('gets a topic by alias, case-insensitively', () => {
    const a = getTopic('Lifecycle');
    expect(a).not.toBeNull();
    expect(a!.frontMatter.id).toBe('connection-status');
  });

  it('returns null for an unknown topic', () => {
    expect(getTopic('does-not-exist')).toBeNull();
  });

  it('ranks search results deterministically', () => {
    const hits = searchTopics('connect group');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe('connect-groups');
    // scores are non-increasing
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
  });

  it('finds volunteer onboarding by query', () => {
    const hits = searchTopics('volunteer');
    expect(hits.map((h) => h.id)).toContain('volunteer-onboarding');
  });

  it('returns no hits for an empty query', () => {
    expect(searchTopics('   ')).toEqual([]);
  });
});
