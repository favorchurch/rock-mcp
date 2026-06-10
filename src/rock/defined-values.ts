import { RockClient } from './client.js';
import { OAuthRockContext } from '../http/oauth.js';
import { quoteODataString } from './query.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Module-level TTL cache (15 minutes) for DefinedValue lookups, keyed by DefinedType name.
 */
const definedValueCache = new Map<string, CacheEntry<Map<number, string>>>();

const TTL_MS = 900000; // 15 minutes

/**
 * Get a cached DefinedValue map if still valid; return null if expired or missing.
 */
function getCached(key: string): Map<number, string> | null {
  const entry = definedValueCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    definedValueCache.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Set a DefinedValue map in the cache with TTL.
 */
function setCached(key: string, value: Map<number, string>): void {
  definedValueCache.set(key, {
    value,
    expiresAt: Date.now() + TTL_MS,
  });
}

/**
 * Clear the module-level cache. Useful for testing.
 */
export function clearDefinedValueCache(): void {
  definedValueCache.clear();
}

/**
 * Fetch and cache a map of DefinedValue IDs to names for a given DefinedType.
 * Returns an empty Map on fetch failure (never throws) and does NOT cache failures.
 *
 * @param client Rock API client
 * @param ctx OAuth context
 * @param definedTypeName DefinedType.Value (e.g. 'Connection Status', 'Record Status')
 * @returns Map<Id, Value> or empty map if unavailable
 */
export async function getDefinedValueMap(
  client: RockClient,
  ctx: OAuthRockContext,
  definedTypeName: string
): Promise<Map<number, string>> {
  const cached = getCached(definedTypeName);
  if (cached) return cached;

  try {
    const results = await client.get<any[]>(
      ctx,
      `/api/DefinedValues?$filter=DefinedType/Value eq ${quoteODataString(definedTypeName)}`
    );

    const map = new Map<number, string>();
    if (results && Array.isArray(results)) {
      for (const item of results) {
        if (item.Id && item.Value) {
          map.set(item.Id, item.Value);
        }
      }
    }

    setCached(definedTypeName, map);
    return map;
  } catch {
    // Return empty map on error; do not cache failures
    return new Map();
  }
}
