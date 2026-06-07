import http from 'node:http';
import { afterEach, describe, it, expect, vi } from 'vitest';
import type { Express } from 'express';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { createApp } from './app.js';
import type { Auth0OAuthConfig, Auth0OAuthMetadata } from './oauth.js';
import type { RockClient, RockClientConfig } from '../rock/client.js';
import { ApiKeyStrategy, UserJwtStrategy } from '../rock/auth-strategy.js';

const oauthConfig: Auth0OAuthConfig = {
  issuer: 'https://auth.example.com/',
  audience: 'https://rock.example.com/api',
  resourceServerUrl: new URL('https://mcp.example.com/'),
  discoveryUrl: new URL('https://auth.example.com/.well-known/openid-configuration'),
};

const oauthMetadata: Auth0OAuthMetadata = {
  issuer: 'https://auth.example.com/',
  authorization_endpoint: 'https://auth.example.com/authorize',
  token_endpoint: 'https://auth.example.com/oauth/token',
  registration_endpoint: 'https://auth.example.com/oauth/register',
  jwks_uri: 'https://auth.example.com/.well-known/jwks.json',
  response_types_supported: ['code'],
  token_endpoint_auth_methods_supported: ['none'],
};

const verifier: OAuthTokenVerifier = {
  verifyAccessToken: async (token) => ({
    token,
    clientId: 'test-client',
    scopes: ['read', 'write'],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: {
      sub: 'auth0|123',
      email: 'person@example.com',
      iss: oauthConfig.issuer,
    },
  }),
};

class FakeRockClient implements RockClient {
  async get<T>(): Promise<T> {
    return [] as T;
  }

  async post<T>(): Promise<T> {
    return [] as T;
  }

  async put<T>(): Promise<T> {
    return {} as T;
  }

  async patch<T>(): Promise<T> {
    return {} as T;
  }

  async delete<T>(): Promise<T> {
    return {} as T;
  }
}

function makeClientFactory() {
  const configs: RockClientConfig[] = [];
  return {
    configs,
    factory: (config: RockClientConfig): RockClient => {
      configs.push(config);
      return new FakeRockClient();
    },
  };
}

async function fetchFromApp(app: Express, path: string, init?: RequestInit): Promise<Response> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind to a TCP port');
  }

  try {
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve());
    });
  }
}

function createInjectedAppOptions(overrides: Record<string, string | undefined> = {}) {
  const clientFactory = makeClientFactory();
  return {
    oauthConfig,
    oauthMetadata,
    verifier,
    env: {
      ROCK_PUBLIC_URL: 'https://rock.example.com',
      ...overrides,
    },
    rockClientFactory: clientFactory.factory,
    clientFactory,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('HTTP MCP Endpoints', () => {
  it('should expose the expected MCP endpoints', async () => {
    const options = createInjectedAppOptions();
    const app = await createApp(options);
    // We expect the app to have registered routers or paths
    const routes = app._router.stack
      .filter((r: any) => r.route)
      .map((r: any) => r.route.path);

    expect(routes).toContain('/mcp/readonly');
    expect(routes).toContain('/mcp/readwrite');
    expect(routes).toContain('/mcp');
    expect(routes).toContain('/');
    expect(routes).toContain('/static/icon.png');
    expect(routes).toContain('/favicon.ico');
  });

  it('can be created without ROCK_API_KEY when OAuth config and metadata are injected', async () => {
    const options = createInjectedAppOptions({ ROCK_API_KEY: undefined });

    const app = await createApp(options);

    expect(app).toBeDefined();
    expect(options.clientFactory.configs).toHaveLength(1);
    expect(options.clientFactory.configs[0].credentialStrategy).toBeInstanceOf(UserJwtStrategy);
    expect(options.clientFactory.configs[0].apiKey).toBeUndefined();
  });

  it('serves OAuth protected-resource metadata with authorization server and scopes', async () => {
    const options = createInjectedAppOptions();
    const app = await createApp(options);

    const response = await fetchFromApp(app, '/.well-known/oauth-protected-resource');
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.resource).toBe('https://mcp.example.com/');
    expect(body.authorization_servers).toEqual(['https://auth.example.com/']);
    expect(body.scopes_supported).toEqual(['read', 'write']);
    expect(body.resource_name).toBe('Rock MCP');
  });

  it('challenges unauthenticated MCP requests with resource metadata', async () => {
    const options = createInjectedAppOptions();
    const app = await createApp(options);

    const response = await fetchFromApp(app, '/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain(
      'resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"'
    );
  });

  it('allows OAuth MCP CORS headers and exposes auth/session response headers', async () => {
    const options = createInjectedAppOptions();
    const app = await createApp(options);

    const response = await fetchFromApp(app, '/mcp', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://client.example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization,mcp-protocol-version',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toContain('Authorization');
    expect(response.headers.get('access-control-allow-headers')).toContain('mcp-protocol-version');
    expect(response.headers.get('access-control-expose-headers')).toContain('WWW-Authenticate');
    expect(response.headers.get('access-control-expose-headers')).toContain('Mcp-Session-Id');
  });

  it('creates a separate admin lookup client only when ROCK_API_KEY is configured', async () => {
    const options = createInjectedAppOptions({ ROCK_API_KEY: 'admin-key' });

    await createApp(options);

    expect(options.clientFactory.configs).toHaveLength(2);
    expect(options.clientFactory.configs[0].credentialStrategy).toBeInstanceOf(UserJwtStrategy);
    expect(options.clientFactory.configs[1].credentialStrategy).toBeInstanceOf(ApiKeyStrategy);
    expect(options.clientFactory.configs[1].apiKey).toBeUndefined();
  });
});
