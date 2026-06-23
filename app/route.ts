import { getLandingPageHtml } from '@/src/http/landing-page';
import { createRedisClient } from '@/src/rock/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const redisConfigured = !!createRedisClient();
  const { searchParams } = new URL(request.url);
  const queryUrl = searchParams.get('url') || searchParams.get('server');
  
  let rockUrl = process.env.ROCK_PUBLIC_URL || process.env.ROCK_API_URL || '';
  if (queryUrl) {
    const trimmed = queryUrl.trim();
    rockUrl = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  }

  const html = getLandingPageHtml({ redisConfigured, rockUrl, version: '1.0.0' });
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
