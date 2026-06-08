import express, { Express } from 'express';
import cors from 'cors';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import {
  Auth0OAuthConfig,
  Auth0OAuthMetadata,
  Auth0OAuthTokenVerifier,
  createOAuthContextAdapterMiddleware,
  fetchAuth0OAuthMetadata,
  getOAuthProtectedResourceMetadataUrl,
  loadAuth0Config,
  mcpAuthMetadataRouter,
  OAuthEnv,
  OAuthRockContext,
  requireBearerAuth,
} from './oauth.js';
import { resolveMode, ScopeError } from '../mcp/modes.js';
import { RockClient, RockClientConfig, RockClientImpl } from '../rock/client.js';
import { ApiKeyStrategy, UserJwtStrategy } from '../rock/auth-strategy.js';
import { RockUserResolver } from '../auth/rock-user-resolver.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { allTools } from '../tools/index.js';
import { registerReportViewerApp } from '../mcp/apps.js';
import { DiscoveryService } from '../discovery/discovery-service.js';
import { InMemoryDatasetStore, RedisDatasetStore, DatasetStore } from '../tools/dataset-store.js';
import { getRockGuideText } from '../mcp/guide-text.js';
import { createRedisClient } from '../rock/redis.js';
import { getLandingPageHtml } from './landing-page.js';
import path from 'path';
import fs from 'fs';

export interface CreateAppOptions {
  env?: OAuthEnv;
  oauthConfig?: Auth0OAuthConfig;
  oauthMetadata?: Auth0OAuthMetadata;
  verifier?: OAuthTokenVerifier;
  fetchFn?: (url: URL) => Promise<Response>;
  rockClientFactory?: (config: RockClientConfig) => RockClient;
}

export async function createApp(options: CreateAppOptions = {}): Promise<Express> {
  const env = options.env || process.env;
  const oauthConfig = options.oauthConfig || loadAuth0Config(env);
  const oauthMetadata = options.oauthMetadata || await fetchAuth0OAuthMetadata({
    config: oauthConfig,
    fetchFn: options.fetchFn,
  });
  const verifier = options.verifier || new Auth0OAuthTokenVerifier(oauthConfig, {
    jwksUri: oauthMetadata.jwks_uri,
  });
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(oauthConfig.resourceServerUrl);
  const createRockClient = options.rockClientFactory || ((config: RockClientConfig) => new RockClientImpl(config));

  const app = express();
  app.use(cors({
    allowedHeaders: ['Authorization', 'Content-Type', 'mcp-protocol-version', 'Mcp-Session-Id'],
    exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
  }));
  app.use(express.json());
  app.use(mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: oauthConfig.resourceServerUrl,
    scopesSupported: ['read', 'write'],
    resourceName: 'Rock MCP',
  }));

  // Configure Rock Client and discovery service
  const rockBaseUrl = env.ROCK_PUBLIC_URL || env.ROCK_API_URL || '';
  const rockClient = createRockClient({
    baseUrl: rockBaseUrl,
    credentialStrategy: new UserJwtStrategy(),
  });

  const adminApiKey = env.ROCK_API_KEY?.trim();
  const adminClient = adminApiKey
    ? createRockClient({
        baseUrl: rockBaseUrl,
        credentialStrategy: new ApiKeyStrategy(adminApiKey),
      })
    : undefined;

  // Initialize Redis and select appropriate stores
  const redis = createRedisClient();
  const discoveryService = new DiscoveryService(rockClient, redis);
  const rockUserResolver = new RockUserResolver(rockClient, adminClient);
  const datasetStore: DatasetStore = redis
    ? new RedisDatasetStore(redis)
    : new InMemoryDatasetStore();

  // Log which caching mode is active
  if (redis) {
    console.log('[Rock MCP] Using Redis cache for discovery and datasets');
  } else {
    console.log('[Rock MCP] Using in-memory cache (Redis not configured)');
  }

  const authMiddleware = [
    requireBearerAuth({
      verifier,
      requiredScopes: ['read'],
      resourceMetadataUrl,
    }),
    createOAuthContextAdapterMiddleware(),
  ];

  const handleMcpRequest = (endpointKind: 'readonly' | 'readwrite' | 'mcp') => {
    return async (req: any, res: any) => {
      const ctx = req.oauthContext as OAuthRockContext | undefined;
      if (!ctx) {
        res.status(500).json({ error: 'OAuth context not initialized' });
        return;
      }

      ctx.endpoint = endpointKind;
      (ctx as any).rockClient = rockClient;
      (ctx as any).discoveryService = discoveryService;
      (ctx as any).datasetStore = datasetStore;

      try {
        // Resolve Rock person
        const resolvedUser = await rockUserResolver.resolve(ctx, {
          subject: ctx.oauth.subject,
          email: ctx.oauth.email,
        });
        ctx.rockUser = resolvedUser;

        // Resolve mode
        const mode = resolveMode(endpointKind, ctx);
        ctx.mode = mode;

        // Create McpServer for this request/session
        const server = new McpServer(
          {
            name: 'rock-mcp',
            version: '1.0.0',
          },
          {
            instructions: getRockGuideText(mode),
          }
        );

        // Register tools dynamically based on Resolved Mode & Scopes
        for (const tool of allTools) {
          const schema = tool.schemaForMode(mode, ctx.scopes);
          if (schema) {
            // Per MCP Apps spec (ext-apps v0.3.0), tools that open an MCP App
            // must advertise the app resource URI via _meta.ui.resourceUri.
            // This tells the host which UI resource to open when the tool completes.
            const baseConfig = {
              title: tool.title,
              description: tool.descriptionForMode(mode),
              inputSchema: schema,
            };
            const config = tool.appResourceUri
              ? {
                  ...baseConfig,
                  _meta: {
                    ui: {
                      resourceUri: tool.appResourceUri,
                    },
                  },
                }
              : baseConfig;

            server.registerTool(
              tool.name,
              config,
              async (args: any, extra: any) => {
                return await tool.handle(args, extra, ctx) as any;
              }
            );
          }
        }

        // Register App resources
        registerReportViewerApp(server);

        // Run StreamableHTTPServerTransport
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless HTTP POST mode
        });

        res.on('close', () => {
          transport.close().catch(() => {});
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err: any) {
        if (err instanceof ScopeError) {
          res.status(403).json({ error: err.message });
        } else {
          res.status(500).json({ error: err.message || 'Internal server error' });
        }
      }
    };
  };

  app.post('/mcp/readonly', ...authMiddleware, handleMcpRequest('readonly'));
  app.post('/mcp/readwrite', ...authMiddleware, handleMcpRequest('readwrite'));
  app.post('/mcp', ...authMiddleware, handleMcpRequest('mcp'));

  app.get('/', (_req: any, res: any) => {
    const redisConfigured = !!redis;
    const rockUrl = process.env.ROCK_PUBLIC_URL || process.env.ROCK_API_URL || '';
    const version = '1.0.0';
    res.setHeader('Content-Type', 'text/html');
    res.send(getLandingPageHtml({ redisConfigured, rockUrl, version }));
  });

  app.get('/static/icon.png', (_req: any, res: any) => {
    const iconPath = path.join(process.cwd(), 'static/icon.png');
    if (fs.existsSync(iconPath)) {
      res.setHeader('Content-Type', 'image/png');
      res.sendFile(iconPath);
    } else {
      res.status(404).send('Not Found');
    }
  });

  app.get('/favicon.ico', (_req: any, res: any) => {
    const iconPath = path.join(process.cwd(), 'static/icon.png');
    if (fs.existsSync(iconPath)) {
      res.setHeader('Content-Type', 'image/png');
      res.sendFile(iconPath);
    } else {
      res.status(404).send('Not Found');
    }
  });

  return app;
}
