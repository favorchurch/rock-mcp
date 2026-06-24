/**
 * Minimal front-matter parser — intentionally NOT a full YAML implementation.
 *
 * Wiki files are authored in-repo, so the grammar is deliberately constrained
 * (and documented here) to avoid taking on a YAML dependency. Supported:
 *
 *   ---
 *   key: scalar                # string | number | boolean (true/false) | "quoted"
 *   key: [a, b, c]             # inline string array
 *   key:                       # block string array
 *     - item one
 *     - item two
 *   nested:                    # ONE level of nested map (e.g. liveBinding)
 *     childKey: value
 *     childFlag: true
 *   ---
 *
 * Anything outside this grammar should be avoided in wiki front-matter; callers
 * validate the parsed object with a Zod schema and fail loudly on mismatch.
 */

function coerceScalar(raw: string): string | number | boolean {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  // Strip a single layer of matching quotes.
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseInlineArray(raw: string): Array<string | number | boolean> {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((item) => coerceScalar(item));
}

function indentOf(line: string): number {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

export interface ParsedFrontMatter {
  data: Record<string, unknown>;
  body: string;
}

/**
 * Split a file into front-matter data and the markdown body. If the file does
 * not begin with a `---` fence, returns empty data and the whole content as body.
 */
export function parseFrontMatter(raw: string): ParsedFrontMatter {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { data: {}, body: normalized };
  }

  const endIdx = normalized.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { data: {}, body: normalized };
  }

  const block = normalized.slice(4, endIdx);
  // Body starts after the closing fence line.
  const afterFence = normalized.indexOf('\n', endIdx + 1);
  const body = afterFence === -1 ? '' : normalized.slice(afterFence + 1);

  const lines = block.split('\n');
  const data: Record<string, unknown> = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || indentOf(line) > 0) {
      i++;
      continue;
    }

    const m = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (!m) {
      i++;
      continue;
    }

    const key = m[1];
    const rest = m[2].trim();

    if (rest) {
      if (rest.startsWith('[') && rest.endsWith(']')) {
        data[key] = parseInlineArray(rest);
      } else {
        data[key] = coerceScalar(rest);
      }
      i++;
      continue;
    }

    // No inline value: gather indented child lines (list or nested map).
    const childLines: string[] = [];
    let j = i + 1;
    while (j < lines.length && (indentOf(lines[j]) > 0 || !lines[j].trim())) {
      if (lines[j].trim()) childLines.push(lines[j]);
      j++;
    }

    if (childLines.length && childLines[0].trim().startsWith('- ')) {
      data[key] = childLines.map((c) => coerceScalar(c.trim().slice(2)));
    } else if (childLines.length) {
      const nested: Record<string, unknown> = {};
      for (const c of childLines) {
        const cm = c.trim().match(/^([A-Za-z_][\w-]*):(.*)$/);
        if (cm) nested[cm[1]] = coerceScalar(cm[2]);
      }
      data[key] = nested;
    } else {
      data[key] = '';
    }

    i = j;
  }

  return { data, body };
}
