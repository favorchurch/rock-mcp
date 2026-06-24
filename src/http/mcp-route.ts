import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { resolveMode, ScopeError, PersonResolutionError, EndpointKind } from '../mcp/modes.js';
import { registerGatewayTools } from '../mcp/register-tools.js';
import { registerReportViewerApp } from '../mcp/apps.js';
import { getRockGuideText } from '../mcp/guide-text.js';
import { getAppContext, CreateAppContextOptions } from './app-context.js';
import { validateOAuthContext, jsonCors, withCors } from './oauth-validate.js';
import { resolveServerOverride } from './server-override.js';
import type { OAuthRockContext } from './oauth.js';
import { RockApiError } from '../rock/client.js';
import { AuditLogger } from '../auth/audit.js';

const auditLogger = new AuditLogger();

/**
 * Framework-agnostic MCP POST handler. Validates the OAuth bearer token, builds
 * a per-request McpServer with the tools allowed for the resolved mode, and
 * delegates to the Web-Standard Streamable HTTP transport (Fetch Request →
 * Response). Used by the Next.js App Router route handlers.
 *
 * @param options test-only dependency overrides (passed through to getAppContext)
 */
export async function handleMcpPost(
  request: Request,
  endpointKind: EndpointKind,
  options?: CreateAppContextOptions
): Promise<Response> {
  const app = await getAppContext(options);
  const requestOrigin = request.headers.get('origin') ?? undefined;

  const validation = await validateOAuthContext(request, {
    verifier: app.verifier,
    requiredScopes: ['read'],
    resourceMetadataUrl: app.resourceMetadataUrl,
  });
  if (validation.response) {
    return validation.response;
  }
  const ctx: OAuthRockContext = validation.ctx;

  ctx.endpoint = endpointKind;

  let activeRockClient = app.rockClient;
  let activeUserResolver = app.rockUserResolver;
  let activeDiscoveryService = app.discoveryService;

  // Optional per-request Rock server override: /mcp?url=<host> or /mcp?server=<host>.
  // Allowlisted hosts only (see server-override.ts).
  const { searchParams } = new URL(request.url);
  const serverParam = searchParams.get('url') || searchParams.get('server');
  if (serverParam) {
    const override = resolveServerOverride(serverParam, app.rockBaseUrl, process.env.ROCK_ALLOWED_SERVERS);
    if (!override.ok) {
      return jsonCors({ error: override.error }, { status: 400 }, requestOrigin);
    }
    activeRockClient = app.rockClientForBase(override.baseUrl);
    activeUserResolver = app.rockUserResolverForBase(override.baseUrl);
    activeDiscoveryService = app.discoveryServiceForBase(override.baseUrl);
  }

  (ctx as { rockClient?: unknown }).rockClient = activeRockClient;
  (ctx as { discoveryService?: unknown }).discoveryService = activeDiscoveryService;
  (ctx as { datasetStore?: unknown }).datasetStore = app.datasetStore;

  try {
    // Resolve Rock person for this OAuth subject
    const resolvedUser = await activeUserResolver.resolve(ctx, {
      subject: ctx.oauth.subject,
      email: ctx.oauth.email,
    });
    ctx.rockUser = resolvedUser;

    // Defense-in-depth: MCP access requires the OAuth identity to map to a
    // real Rock person, regardless of token scopes.
    if (!resolvedUser.personId) {
      const email = ctx.oauth.email || ctx.oauth.subject;
      throw new PersonResolutionError(
        `Your account (${email}) is not linked to a Rock person record. Ask a Rock admin to add this email to your person record.`,
        email
      );
    }

    // Resolve mode (throws ScopeError on insufficient scope)
    const mode = resolveMode(endpointKind, ctx);
    ctx.mode = mode;

    const server = new McpServer(
      {
        name: 'rock-mcp',
        version: '1.0.0',
      },
      {
        instructions: getRockGuideText(mode),
      }
    );

    // Register tools dynamically based on resolved mode & scopes
    registerGatewayTools(server, mode, ctx);

    // Register App resources
    registerReportViewerApp(server);

    // Stateless HTTP POST mode — Fetch-native transport
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCors(response, requestOrigin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (err instanceof PersonResolutionError) {
      auditLogger.log(ctx, {
        tool: 'mcp',
        action: 'resolveUser',
        outcome: 'denied',
        errorCode: 'PERSON_NOT_RESOLVED',
        reason: `Person not resolved for email: ${err.email || 'unknown'}`,
      });
      return jsonCors({ error: message }, { status: 403 }, requestOrigin);
    }
    if (err instanceof ScopeError) {
      return jsonCors({ error: message }, { status: 403 }, requestOrigin);
    }
    // `message` for a RockApiError is already generic (status + statusText
    // only); the full upstream body is logged inside the Rock client and is
    // never attached here, so it cannot leak to the client.
    if (err instanceof RockApiError) {
      console.error('[mcp route] Rock API error surfaced to client:', {
        status: err.status,
        statusText: err.statusText,
      });
      return jsonCors({ error: err.message }, { status: 502 }, requestOrigin);
    }
    return jsonCors({ error: message }, { status: 500 }, requestOrigin);
  }
}
