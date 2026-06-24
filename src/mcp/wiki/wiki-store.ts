import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseFrontMatter } from './frontmatter.js';
import { frontMatterSchema, WikiArticle } from './wiki-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TopicSummary {
  id: string;
  title: string;
  tags: string[];
}

export interface SearchHit extends TopicSummary {
  score: number;
  snippet: string;
}

let cache: WikiArticle[] | null = null;

/** Clear the process-lifetime wiki cache. Used by tests. */
export function clearWikiCache(): void {
  cache = null;
}

function resolveWikiDir(): string | null {
  // Mirror getRockGuideText's dual-candidate strategy. This module lives one
  // directory deeper than guide-text.ts (src/mcp/wiki vs src/mcp), so the
  // source-relative path needs an extra `..`.
  const candidates = [
    path.resolve(__dirname, '../../../static/mcp-guides/wiki'),
    path.join(process.cwd(), 'static/mcp-guides/wiki'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function loadArticles(): WikiArticle[] {
  if (cache) return cache;

  const dir = resolveWikiDir();
  if (!dir) {
    cache = [];
    return cache;
  }

  const articles: WikiArticle[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const sourcePath = path.join(dir, file);
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const { data, body } = parseFrontMatter(raw);
    const parsed = frontMatterSchema.safeParse(data);
    if (!parsed.success) {
      // Fail loudly with the offending file so authors can fix it; never
      // silently drop a topic.
      throw new Error(
        `Invalid wiki front-matter in ${sourcePath}: ${parsed.error.issues
          .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
          .join('; ')}`
      );
    }
    const expectedId = path.basename(file, '.md');
    if (parsed.data.id !== expectedId) {
      throw new Error(
        `Wiki front-matter id "${parsed.data.id}" does not match filename "${expectedId}" (${sourcePath}).`
      );
    }
    articles.push({ frontMatter: parsed.data, body: body.trim(), sourcePath });
  }

  articles.sort((a, b) => a.frontMatter.id.localeCompare(b.frontMatter.id));
  cache = articles;
  return cache;
}

export function listTopics(): TopicSummary[] {
  return loadArticles().map((a) => ({
    id: a.frontMatter.id,
    title: a.frontMatter.title,
    tags: a.frontMatter.tags,
  }));
}

export function getTopic(idOrAlias: string): WikiArticle | null {
  const needle = idOrAlias.trim().toLowerCase();
  const articles = loadArticles();
  // Prefer an exact id match, then an alias match (case-insensitive).
  const byId = articles.find((a) => a.frontMatter.id.toLowerCase() === needle);
  if (byId) return byId;
  return (
    articles.find((a) => a.frontMatter.aliases.some((al) => al.toLowerCase() === needle)) ?? null
  );
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function searchTopics(query: string, limit = 8): SearchHit[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const q = query.trim().toLowerCase();

  const hits: SearchHit[] = [];
  for (const a of loadArticles()) {
    const id = a.frontMatter.id.toLowerCase();
    const title = a.frontMatter.title.toLowerCase();
    const aliases = a.frontMatter.aliases.map((x) => x.toLowerCase());
    const tags = a.frontMatter.tags.map((x) => x.toLowerCase());
    const bodyLower = a.body.toLowerCase();

    let score = 0;
    if (q === id || q === title) score += 100;

    for (const t of tokens) {
      if (title.includes(t)) score += 25;
      if (aliases.some((al) => al.includes(t))) score += 20;
      if (tags.some((tg) => tg.includes(t))) score += 12;
      const occurrences = bodyLower.split(t).length - 1;
      if (occurrences > 0) score += Math.min(occurrences, 5) * 3;
    }

    if (score <= 0) continue;

    // Snippet: first body line containing any query token, else the title.
    const bodyLines = a.body.split('\n').map((l) => l.trim());
    const snippetLine =
      bodyLines.find((l) => l && tokens.some((t) => l.toLowerCase().includes(t))) ??
      a.frontMatter.title;

    hits.push({
      id: a.frontMatter.id,
      title: a.frontMatter.title,
      tags: a.frontMatter.tags,
      score,
      snippet: snippetLine.slice(0, 240),
    });
  }

  hits.sort((x, y) => (y.score !== x.score ? y.score - x.score : x.id.localeCompare(y.id)));
  return hits.slice(0, limit);
}
