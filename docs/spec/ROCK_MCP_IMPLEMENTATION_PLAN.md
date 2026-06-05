# Rock RMS MCP Implementation Plan

**Project:** Rock RMS MCP Server and MCP Apps for Favor Church Manila  
**Target Rock version:** Rock RMS v17.7  
**Recommended repo:** `favorchurch/rock-mcp`  
**Recommended language:** TypeScript  
**Created:** Friday, June 5, 2026  
**Primary goal:** Build a full Rock RMS MCP server with a minimal, token-efficient tool surface, runtime Favor mapping discovery, OAuth-aware authorization, read/write scopes, and a basic v1 MCP App for visual reports.

---

## 1. Executive summary

Build a new TypeScript MCP server for Rock RMS v17.7 as the successor pattern to the existing Fluro MCP. The Rock MCP should expose a small set of action-router tools instead of one tool per Rock entity or endpoint. This keeps token cost low, preserves a clear mental model for the AI, and makes security much easier to control.

The MCP server should expose three HTTP MCP endpoints:

```txt
/mcp/readonly
/mcp/readwrite
/mcp
```

Endpoint behavior:

- `/mcp/readonly` always registers the server in read mode.
- `/mcp/readwrite` registers the server in readwrite mode when the OAuth user has the `write` scope. Each write action still runs as, or is authorized against, the OAuth user.
- `/mcp` auto-detects mode. If the OAuth user has the `write` scope and belongs to the Rock security role `RSR - Rock Administration`, the session becomes readwrite. Otherwise, it becomes readonly.

The OAuth user is the authorization subject. The Rock API key is a backend credential, not a permission bypass. The implementation must either call Rock as the user where possible, or enforce an impersonation authorization layer before using the API key.

Favor mapping should be auto-discovered at runtime rather than hardcoded. The MCP should infer Group Types, Attributes, Campuses, Saved Entity Searches, Reports, Connection Types, Workflow Types, and other Rock constructs. For Group Type discovery, use hints like `Connect Groups` and `Ministry Teams`, assign confidence scores, and expose discovery results through `rock_lookup`.

V1 should include a basic MCP App, focused on Rock reports and query datasets. The app should render a table, summary cards, simple filters, and export actions without dumping large result sets into chat.

---

## 2. Locked product decisions

These decisions are considered final for this plan.

| Area | Decision |
|---|---|
| File output | Create a detailed Markdown implementation plan. |
| Repo recommendation | New TypeScript repo, recommended name `favorchurch/rock-mcp`. Borrow the Fluro MCP gateway-tool pattern. |
| Transport | HTTP MCP endpoints are required. Optional stdio can be retained for local development only. |
| Auth | OAuth is the MCP user identity source. A Rock API key is available as a backend credential. |
| Admin role | `RSR - Rock Administration` is the default Rock security role for admins. Do not require an env var for its name. |
| Readwrite endpoint | `/mcp/readwrite` exposes readwrite tools for actions the OAuth user is authorized to perform. |
| Readonly endpoint | `/mcp/readonly` exposes read-only tools for actions the OAuth user is authorized to perform. |
| Scopes | Use OAuth scopes named exactly `read` and `write`. |
| Tool list | Use the minimal action-router tool list from the earlier plan, including `rock_usage`. |
| Write actions | Plan for all write action categories in v1, but gate them heavily. |
| Mapping | Auto-discover Favor Rock mapping at runtime. Do not hardcode IDs. |
| Discovery confidence | Include confidence scoring and signals. |
| Group Type hints | Use `Connect Groups` and `Ministry Teams` as primary hints. |
| Favor concepts | Treat Favor concepts as first-class runtime concepts, backed by discovery. |
| Privacy | Use safe person output by default. Reveal sensitive fields only when explicitly requested and authorized. |
| MCP Apps | Include basic v1 app support. Start with a Report Viewer app. |
| Caching | Use in-memory cache for dev and Redis for production. Include a configurable Redis prefix. |
| Rock API approach | Prefer Rock API v2 first. Fall back to older Rock REST endpoints only where v2 cannot support the workflow. |
| Raw search | Allow raw Dynamic LINQ only in controlled contexts. Prefer saved Entity Search keys. |
| Detail level | Provide enough context for an implementation agent to build the whole project. |

---

## 3. Goals

### 3.1 Product goals

- Let AI users safely interact with Rock RMS data for Favor Church Manila.
- Support real ministry workflows, not just raw database access.
- Preserve Favor-specific business logic currently encoded in the Fluro MCP guide.
- Make report and dashboard review visual through MCP Apps.
- Keep tool count and schema size low to reduce context and token cost.
- Avoid hardcoded Favor mapping IDs by discovering Rock structure at runtime.
- Respect the OAuth user’s permissions and Rock authorization model.

### 3.2 Engineering goals

- Implement in TypeScript with strict typing.
- Use Rock API v2 as the default integration surface.
- Support `/mcp`, `/mcp/readonly`, and `/mcp/readwrite` over HTTP.
- Register tools dynamically by effective mode and OAuth scopes.
- Support `read` and `write` scopes.
- Provide a reusable Rock API client with request shaping, retries, pagination, and error normalization.
- Provide a discovery service with confidence scoring and Redis caching.
- Provide a basic MCP App resource for reports.
- Add automated tests for auth, tool visibility, discovery, response shaping, and write guards.

---

## 4. Non-goals

- Do not expose every Rock API v2 model as its own MCP tool.
- Do not treat the Rock API key as an admin bypass for user actions.
- Do not dump large report rows into chat by default.
- Do not hardcode Rock entity IDs, Group Type IDs, campus IDs, or attribute IDs for Favor.
- Do not include a raw SQL MCP tool.
- Do not build a full custom Rock plugin as the first assumption.
- Do not embed MCP Apps directly inside Rock RMS in v1. Apps render in the MCP host.

---

## 5. Research anchors and assumptions

These are implementation anchors that should be rechecked during build if Rock or MCP packages change.

### 5.1 Rock v17.7

- Target the `17.7.0` Rock source tag.
- Rock v17 includes API v2 model controllers and Entity Search support.
- Rock API v2 generated model controllers follow route patterns like `api/v2/models/people`, `api/v2/models/reports`, and `api/v2/models/entitysearches`.
- Entity Search supports dynamic query properties such as `Where`, `GroupBy`, `Select`, `SelectMany`, `Sort`, `Offset`, `Limit`, and `IsCountOnly`.
- Rock supports API key auth through the `Authorization-Token` header. It also supports JWT through the `Authorization` header.

### 5.2 MCP Apps

- MCP Apps combine a tool and a `ui://` resource.
- Tool descriptions include `_meta.ui.resourceUri`.
- The app resource is served as HTML, often bundled by Vite into one file.
- The app runs in a sandboxed iframe inside the host.
- Apps communicate with the host through a postMessage-based MCP dialect.
- The `@modelcontextprotocol/ext-apps` package provides helpers such as `registerAppTool`, `registerAppResource`, and the client-side `App` class.

### 5.3 Existing Fluro MCP pattern

Borrow these patterns from the Fluro MCP:

- Small tool surface.
- Gateway tools with an `action` discriminator.
- Static usage guide loaded as server instructions and exposed as a usage tool.
- Modes that alter registered actions.
- Batch wrapper support where useful.
- Large-result handling outside of chat.

References:

- Fluro MCP repo: `https://github.com/favorchurch/fluro-mcp`
- MCP Apps overview: `https://modelcontextprotocol.io/extensions/apps/overview`
- MCP Apps build guide: `https://modelcontextprotocol.io/extensions/apps/build`
- Rock source: `https://github.com/SparkDevNetwork/Rock/tree/17.7.0`

---

## 6. Architecture overview

### 6.1 High-level architecture

```txt
MCP Host
  |
  | OAuth access token with read/write scopes
  v
Rock MCP Server
  |
  | validates OAuth token
  | resolves OAuth user to Rock user/person
  | chooses endpoint mode
  | checks read/write scope
  | checks Rock authorization or app-level impersonation policy
  v
Rock API Adapter
  |
  | Rock API v2 first
  | older REST fallback second
  v
Rock RMS v17.7
```

### 6.2 Server layers

```txt
src/
  index.ts
  http/
    app.ts
    routes.ts
    oauth.ts
    session.ts
  mcp/
    server.ts
    modes.ts
    scopes.ts
    guide-text.ts
    apps.ts
  auth/
    oauth-context.ts
    rock-user-resolver.ts
    authorization.ts
    impersonation.ts
  rock/
    client.ts
    endpoints.ts
    v2.ts
    legacy.ts
    pagination.ts
    errors.ts
  discovery/
    discovery-service.ts
    confidence.ts
    group-types.ts
    attributes.ts
    reports.ts
    entity-searches.ts
    cache.ts
  tools/
    index.ts
    router.ts
    rock-usage.ts
    rock-lookup.ts
    rock-entity.ts
    rock-people.ts
    rock-ministry.ts
    rock-report.ts
    rock-workflow.ts
    rock-write.ts
  apps/
    report-viewer/
      report-viewer.html
      report-viewer.ts
  static/
    mcp-guides/
      rock-usage-readonly.md
      rock-usage-readwrite.md
```

### 6.3 Data flow for a normal tool call

1. MCP host calls `/mcp`, `/mcp/readonly`, or `/mcp/readwrite`.
2. Server validates OAuth token.
3. Server extracts OAuth scopes.
4. Server resolves the OAuth user to a Rock user or person.
5. Server determines effective mode.
6. Server creates a request context.
7. MCP tool handler reads the context.
8. Tool handler calls discovery service if a mapping is needed.
9. Tool handler calls Rock through the Rock client.
10. Response shaper returns a compact result.
11. If the result is large, store the full dataset in Redis and return a `datasetId`.
12. If the tool supports an app, return a result linked to a `ui://` resource.

---

## 7. Endpoint and mode design

### 7.1 Endpoint matrix

| Endpoint | Effective mode | Required OAuth scope | Write tools registered | Auto-detects RSR | Intended use |
|---|---|---|---:|---:|---|
| `/mcp/readonly` | `readonly` | `read` | No | No | Safe default connector. |
| `/mcp/readwrite` | `readwrite` | `read` and `write` | Yes | No | Explicit write-capable connector. |
| `/mcp` | `readonly` or `readwrite` | `read`, plus `write` for auto readwrite | Conditional | Yes | Smart default connector. |

### 7.2 Mode rules

```ts
type McpScope = "read" | "write";
type McpMode = "readonly" | "readwrite";
```

Rules:

```ts
function resolveMode(endpoint: EndpointKind, ctx: OAuthRockContext): McpMode {
  if (endpoint === "readonly") {
    requireScope(ctx, "read");
    return "readonly";
  }

  if (endpoint === "readwrite") {
    requireScope(ctx, "read");
    requireScope(ctx, "write");
    return "readwrite";
  }

  requireScope(ctx, "read");

  if (ctx.scopes.has("write") && ctx.rockUser.isRsrAdmin) {
    return "readwrite";
  }

  return "readonly";
}
```

### 7.3 Important distinction

Tool registration is not the same as data authorization.

- `/mcp/readonly` registers read tools only, but Rock may still deny a specific read.
- `/mcp/readwrite` registers write tools, but each write must still be authorized for the OAuth user.
- `/mcp` picks a safe mode based on OAuth scope and `RSR - Rock Administration` membership.

### 7.4 RSR role detection

Use the exact Rock security role name:

```ts
const ROCK_ADMIN_ROLE_NAME = "RSR - Rock Administration";
```

Detection strategy:

1. Resolve OAuth user to Rock person or user login.
2. Discover the Rock group/security role named `RSR - Rock Administration`.
3. Check if the resolved Rock person is an active member of that role.
4. Cache the role ID and membership result briefly.
5. Fail closed. If the role cannot be found or membership cannot be checked, `/mcp` resolves to readonly.

No environment variable is needed for the RSR role name.

---

## 8. OAuth, Rock API key, and impersonation

### 8.1 Principle

The OAuth user is the actor. The Rock API key is only a transport credential unless the implementation can obtain a true Rock user token.

Never assume that possession of the Rock API key means the OAuth user can perform an action.

### 8.2 Credential strategies

Support two strategies behind a common interface.

```ts
interface RockCredentialStrategy {
  getHeaders(ctx: OAuthRockContext, request: RockRequestSpec): Promise<Record<string, string>>;
  authorize(ctx: OAuthRockContext, action: RockActionDescriptor): Promise<AuthzDecision>;
}
```

#### Strategy A: user token strategy, preferred when available

Use when OAuth can be exchanged for a Rock user JWT or when the host supplies a Rock user JWT.

Headers:

```txt
Authorization: Bearer <rock-user-jwt>
```

Properties:

- Rock enforces per-user permissions directly.
- MCP still performs allowlist and safety checks before calls.
- Best fit for true impersonation.

#### Strategy B: service API key plus application-level impersonation

Use when the only Rock credential available to the MCP server is a Rock API key.

Headers:

```txt
Authorization-Token: <rock-api-key>
```

Required safeguards:

- Resolve OAuth user to Rock person/user login.
- Check `read` or `write` OAuth scope.
- For `/mcp`, use RSR role membership for readwrite mode.
- For `/mcp/readwrite`, authorize each write through a policy check before calling Rock.
- Log every operation as performed by the OAuth user.
- Include `impersonatedRockPersonId`, `oauthSubject`, and `mcpSessionId` in audit metadata.
- Restrict write actions to allowlisted models, fields, and workflows.

Important caveat:

This is not true native Rock impersonation unless Rock provides a supported user-token path or a custom endpoint that executes as the user. The implementation should keep the strategy interface so a true user-token strategy can replace the service-key strategy later without rewriting tools.

### 8.3 OAuth context shape

```ts
interface OAuthRockContext {
  endpoint: "mcp" | "readonly" | "readwrite";
  mode: "readonly" | "readwrite";
  scopes: Set<"read" | "write">;
  oauth: {
    subject: string;
    email?: string;
    name?: string;
    accessTokenHash: string;
    issuer?: string;
  };
  rockUser: {
    personId?: number;
    personGuid?: string;
    personAliasId?: number;
    userLoginId?: number;
    userName?: string;
    isRsrAdmin: boolean;
  };
  request: {
    sessionId: string;
    requestId: string;
    ip?: string;
    userAgent?: string;
  };
}
```

### 8.4 OAuth user to Rock user resolution

Recommended matching order:

1. OAuth claim with explicit Rock person GUID, if available.
2. OAuth email to Rock `UserLogin` or `Person` email.
3. OAuth subject to a stored Rock attribute value, if Favor adds one later.
4. Manual link table stored in Redis or a small durable database, if needed.

Resolution result should be cached for a short TTL.

---

## 9. Minimal MCP tool surface

### 9.1 Tools to register

| Tool | Purpose | readonly | readwrite |
|---|---|---:|---:|
| `rock_usage` | Usage guide and Favor-specific rules. | Yes | Yes |
| `rock_lookup` | Runtime discovery and lightweight lookup. | Yes | Yes |
| `rock_entity` | Generic read access, saved Entity Search, counts, attributes. | Yes | Yes |
| `rock_people` | Person-centered workflows and shaped profiles. | Yes | Yes, plus updates |
| `rock_ministry` | Connect Groups, Ministry Teams, attendance, registrations, rosters. | Yes | Yes, plus updates |
| `rock_report` | Reports, summaries, datasets, and MCP App launcher. | Yes | Yes |
| `rock_workflow` | Workflows, connection requests, steps, follow-up processes. | Read-only workflow reads | Launch/update when authorized |
| `rock_write` | Explicit generic writes and bulk operations. | No | Yes |

### 9.2 Tool design rules

- Use one tool per domain, not one tool per endpoint.
- Use an `action` field to route within each tool.
- Prefer discriminated unions in Zod.
- Every broad read must support `limit`, `select`, and `shape`.
- Every write must support `dryRun`.
- Destructive writes require `commit: true`.
- Return compact JSON by default.
- Return `datasetId` for large data.
- Never return full person records by default.

### 9.3 Common response envelope

```ts
interface ToolResponse<T> {
  ok: boolean;
  mode: "readonly" | "readwrite";
  action: string;
  result?: T;
  warning?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    rockVersion?: string;
    discoveryVersion?: string;
    datasetId?: string;
    appUri?: string;
    truncated?: boolean;
    cached?: boolean;
  };
}
```

---

## 10. `rock_usage` tool

### 10.1 Purpose

`rock_usage` is both a tool and a source of server instructions. It gives the model the Favor Church operating rules for Rock.

The actual tool can return a short stub because the full guide should be embedded in the MCP server instructions.

```json
{
  "text": "Guide is embedded in tool description and server instructions. Use rock_lookup when mapping is unknown."
}
```

### 10.2 Guide files

```txt
static/mcp-guides/
  rock-usage-readonly.md
  rock-usage-readwrite.md
```

### 10.3 Guide sections

The guide should include:

1. How to choose tools.
2. Rock v17.7 API assumptions.
3. Favor Church timezone: Asia/Manila.
4. Favor terms and business logic.
5. Runtime discovery rules.
6. Privacy and PII rules.
7. Contact lifecycle rules.
8. Age group rules.
9. Leader age-group derivation.
10. Connect Group and Ministry Team rules.
11. Attendance and consistency rules.
12. Report and app usage rules.
13. Large-result handling.
14. Write safety rules, in readwrite guide only.

### 10.4 Favor rules to preserve

#### Contact lifecycle

Favor concepts:

- `new`
- `crowd`
- `core`
- `leader`

Rock mapping must be discovered. These might live in one or more of:

- Person attributes
- Connection status
- Group membership
- Data Views
- Saved Entity Searches
- Tags
- Connection Requests
- Workflows

The MCP must not assume a fixed field.

#### Age groups

Use these default bands unless Rock discovery shows a stronger Favor-owned definition:

| Label | Age range |
|---|---:|
| Kids | 0 to 12 |
| Youth | 13 to 17 |
| Young Adults | 18 to 25 |
| Adults | 26 to 49 |
| Seasoned | 50 and above |

#### Leaders by age group

When a user asks for Youth leaders, Young Adult leaders, Adult leaders, or Seasoned leaders, they mean leaders for that age group, not leaders whose personal age falls in that band.

Derivation order:

1. Connect Group leadership assignment.
2. Group naming or group attribute age-group signal.
3. Ministry-specific role signal.
4. Favor-owned person attribute or saved search.
5. Personal age fallback only when no leadership assignment signal exists.

#### Connect Group membership

Discovered Rock Group Types should determine the exact source. Default hints are:

- `Connect Groups`
- `Ministry Teams`

The MCP should treat Connect Group membership separately from Ministry Team membership.

#### Consistency

Default attendance consistency window: last 8 to 12 weeks.

#### Event and attendance defaults

Default to recent events and attendance unless the user asks for history.

#### Large results

When a result is large, store it in Redis or file-backed development cache. Return a summary and `datasetId`.

---

## 11. `rock_lookup` tool

### 11.1 Purpose

Runtime discovery and lightweight lookup. This tool prevents broad, expensive queries and replaces hardcoded Favor mapping.

### 11.2 Actions

```ts
type RockLookupAction =
  | "quickSearch"
  | "model"
  | "entitySearches"
  | "attributes"
  | "definedValues"
  | "campuses"
  | "groupTypes"
  | "reports"
  | "discovery"
  | "refreshDiscovery";
```

### 11.3 Input schema sketch

```ts
const rockLookupSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("quickSearch"),
    query: z.string().min(1),
    kinds: z.array(z.enum([
      "person",
      "group",
      "groupType",
      "report",
      "entitySearch",
      "workflowType",
      "connectionType",
      "attribute",
      "definedValue"
    ])).optional(),
    limit: z.number().int().positive().max(50).default(10)
  }),
  z.object({
    action: z.literal("discovery"),
    includeRaw: z.boolean().default(false)
  }),
  z.object({
    action: z.literal("refreshDiscovery"),
    reason: z.string().optional()
  })
]);
```

### 11.4 Output shape

```ts
interface DiscoveryCandidate {
  kind: string;
  id?: number;
  guid?: string;
  idKey?: string;
  name: string;
  confidence: number;
  signals: string[];
  warnings?: string[];
}
```

### 11.5 Tool rules

- Always prefer this tool before raw entity queries when IDs or mappings are unknown.
- Return compact candidates.
- Include confidence and signals.
- Do not pretend low-confidence mapping is confirmed.
- `refreshDiscovery` must invalidate Redis and in-memory discovery caches.

---

## 12. Runtime discovery service

### 12.1 Purpose

The discovery service builds a runtime map of Favor concepts to Rock records.

It should discover:

- Rock version.
- Campuses.
- Group Types.
- Groups matching Connect Group and Ministry Team concepts.
- Person attributes related to lifecycle and age group.
- Group attributes related to age group, campus, locality, leader, and meeting day.
- Reports.
- Entity Searches.
- Data Views.
- Workflow Types.
- Connection Types.
- Registration Templates.
- Defined Types and Defined Values.

### 12.2 Recommended loading model

Use lazy discovery with cache and refresh support.

1. Server starts quickly.
2. First tool call requiring mapping calls `discoveryService.getMap()`.
3. If Redis has a fresh discovery map, use it.
4. If only stale discovery exists, return stale data and refresh asynchronously where safe.
5. If no discovery exists, run discovery synchronously with a timeout.
6. Expose `rock_lookup.refreshDiscovery` for manual refresh.

### 12.3 Cache TTLs

| Cache item | TTL | Notes |
|---|---:|---|
| Discovery map | 15 minutes | Refreshable with `rock_lookup.refreshDiscovery`. |
| RSR role ID | 1 hour | Role name should be stable. |
| User to Rock person resolution | 15 minutes | Short enough for account changes. |
| RSR membership | 5 minutes | Admin access changes should apply quickly. |
| Report datasets | 15 minutes | Configurable by report action. |
| App datasets | 15 minutes | Reuse report datasets. |

### 12.4 Redis prefix

Use a configurable Redis prefix.

```bash
ROCK_MCP_REDIS_PREFIX=rock-mcp:prod:
```

Recommended keys:

```txt
{prefix}discovery:v17.7:{rockBaseHash}
{prefix}discovery-lock:v17.7:{rockBaseHash}
{prefix}dataset:{datasetId}
{prefix}user-resolution:{oauthSubjectHash}
{prefix}rsr-role:{rockBaseHash}
{prefix}rsr-membership:{rockPersonId}
{prefix}audit:{date}:{requestId}
```

### 12.5 Discovery map shape

```ts
interface FavorDiscoveryMap {
  generatedAt: string;
  rockBaseUrlHash: string;
  rockVersion?: string;
  confidence: number;
  campuses: DiscoveryCandidate[];
  groupTypes: {
    connectGroups: DiscoveryCandidate[];
    ministryTeams: DiscoveryCandidate[];
    other: DiscoveryCandidate[];
  };
  attributes: {
    personLifecycle: DiscoveryCandidate[];
    personAgeGroup: DiscoveryCandidate[];
    groupAgeGroup: DiscoveryCandidate[];
    fluroId: DiscoveryCandidate[];
  };
  reports: DiscoveryCandidate[];
  entitySearches: DiscoveryCandidate[];
  workflows: DiscoveryCandidate[];
  connectionTypes: DiscoveryCandidate[];
  warnings: string[];
}
```

---

## 13. Discovery confidence scoring

### 13.1 Score model

Use a 0 to 1 confidence score.

| Score | Meaning |
|---:|---|
| 0.90 to 1.00 | Strong match. Safe to use automatically. |
| 0.70 to 0.89 | Likely match. Use with a warning or confirmation in high-impact actions. |
| 0.40 to 0.69 | Possible match. Show candidates and ask for clarification when needed. |
| 0.00 to 0.39 | Weak match. Do not use automatically. |

### 13.2 Group Type scoring

Primary hints:

```txt
Connect Groups
Ministry Teams
```

#### Connect Group scoring signals

| Signal | Score impact |
|---|---:|
| Exact name `Connect Groups` | +0.60 |
| Name contains `Connect` and `Group` | +0.35 |
| Groups under type have members | +0.10 |
| Groups under type have attendance | +0.10 |
| Groups under type have schedules or meeting location attributes | +0.05 |
| Group names include age group terms | +0.05 |
| Group attributes include age group or locality | +0.05 |
| Type name includes `Archived`, `Old`, or `Deprecated` | -0.30 |

#### Ministry Team scoring signals

| Signal | Score impact |
|---|---:|
| Exact name `Ministry Teams` | +0.60 |
| Name contains `Ministry` and `Team` | +0.35 |
| Name contains `Serving`, `Service`, or `Volunteer` | +0.20 |
| Groups have serving-related schedules or rosters | +0.10 |
| Groups include known ministry terms like Favor Kids, Favor Youth, Favor Men, Favor Girl, Favor Movement | +0.05 |
| Type name includes `Archived`, `Old`, or `Deprecated` | -0.30 |

### 13.3 Attribute scoring

#### Lifecycle attribute candidates

Signals:

- Name or key includes `lifecycle`, `connection status`, `new`, `crowd`, `core`, or `leader`.
- Defined values include multiple Favor lifecycle terms.
- Attribute applies to `Person`.
- Attribute is active.

#### Fluro ID candidates

Signals:

- Name or key includes `Fluro`, `Fluro ID`, `legacy id`, or `external id`.
- Attribute applies to `Person`, `Group`, or migration-related entity.

#### Age group candidates

Signals:

- Name or key includes `age group`.
- Values include `Kids`, `Youth`, `Young Adults`, `Adults`, `Seasoned`.
- Applies to `Group` or `Person`.

### 13.4 Candidate output example

```json
{
  "kind": "groupType.connectGroups",
  "id": 42,
  "guid": "...",
  "name": "Connect Groups",
  "confidence": 0.96,
  "signals": [
    "exact name match: Connect Groups",
    "groups under type have active members",
    "groups under type have attendance records",
    "group names include age group terms"
  ]
}
```

---

## 14. Favor concepts as first-class runtime concepts

### 14.1 Concepts to support

- Connect Group
- Ministry Team
- Favor Kids
- Favor Youth
- Favor Girl
- Favor Men
- Favor Movement
- New
- Crowd
- Core
- Leader
- Kids
- Youth
- Young Adults
- Adults
- Seasoned
- Serving
- Campus
- Attendance consistency

### 14.2 Concept resolver

Implement a concept resolver over discovery.

```ts
interface FavorConceptResolver {
  resolveGroupType(concept: "connectGroup" | "ministryTeam"): Promise<ResolvedConcept>;
  resolveLifecycleSource(): Promise<ResolvedConcept[]>;
  resolveAgeGroupSource(entity: "person" | "group"): Promise<ResolvedConcept[]>;
  resolveCampus(name?: string): Promise<ResolvedConcept[]>;
  resolveReport(conceptOrSearch: string): Promise<ResolvedConcept[]>;
}
```

### 14.3 Resolved concept shape

```ts
interface ResolvedConcept {
  concept: string;
  candidate: DiscoveryCandidate;
  confidence: number;
  useAutomatically: boolean;
  requiresClarification: boolean;
}
```

### 14.4 Use rules

- Use candidates with confidence at or above 0.90 automatically.
- For 0.70 to 0.89, proceed for read-only summaries with a warning.
- For write actions, require confidence at or above 0.90 unless the user supplied a specific ID or exact name.
- For low confidence, return candidates and ask for more detail.

---

## 15. `rock_entity` tool

### 15.1 Purpose

Generic read access through Rock API v2 and Entity Search. This is the escape hatch for reads that do not fit a domain tool.

### 15.2 Actions

```ts
type RockEntityAction =
  | "get"
  | "search"
  | "searchByKey"
  | "count"
  | "attributeValues"
  | "batch";
```

### 15.3 Schema sketch

```ts
const rockEntitySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("get"),
    model: z.string().min(1),
    id: z.union([z.string(), z.number()]),
    includeAttributes: z.boolean().default(false),
    shape: z.enum(["summary", "full"]).default("summary")
  }),
  z.object({
    action: z.literal("search"),
    model: z.string().min(1),
    where: z.string().min(1).optional(),
    select: z.string().min(1).optional(),
    sort: z.string().min(1).optional(),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().positive().max(500).default(50),
    shape: z.enum(["count", "summary", "table", "full"]).default("summary")
  }),
  z.object({
    action: z.literal("searchByKey"),
    model: z.string().min(1).optional(),
    searchKey: z.string().min(1),
    refinements: z.record(z.unknown()).default({}),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().positive().max(1000).default(100),
    shape: z.enum(["count", "summary", "table", "full"]).default("table")
  }),
  z.object({
    action: z.literal("count"),
    model: z.string().min(1),
    where: z.string().min(1).optional(),
    searchKey: z.string().min(1).optional()
  }),
  z.object({
    action: z.literal("attributeValues"),
    model: z.string().min(1),
    id: z.union([z.string(), z.number()])
  })
]);
```

### 15.4 Raw Dynamic LINQ policy

- Prefer `searchByKey` over raw `search`.
- `/mcp/readonly`: raw `search` is allowed only on allowlisted models and must include `limit`. `select` is strongly encouraged and may be required by config.
- `/mcp/readwrite`: raw `search` is allowed for authorized users, but still requires model allowlist and `limit`.
- `/mcp`: follows effective mode.
- Broad person searches must default to safe projection.
- Count-only should use `IsCountOnly` where available.

### 15.5 Default output shaping

For `people`, return:

```json
{
  "id": 123,
  "guid": "...",
  "idKey": "...",
  "name": "Alex Santos",
  "campus": "Manila",
  "connectionStatus": "Core"
}
```

Do not include email, phone, address, birthdate, notes, or financial data by default.

---

## 16. `rock_people` tool

### 16.1 Purpose

Person-centered workflows with privacy-safe output and Favor-specific logic.

### 16.2 Actions

```ts
type RockPeopleAction =
  | "find"
  | "profile"
  | "family"
  | "groups"
  | "connectionStatus"
  | "attendanceSummary"
  | "servingSummary"
  | "updateContactInfo"
  | "patchAttributes"
  | "createNote"
  | "createFollowUpTask";
```

Readwrite-only actions:

- `updateContactInfo`
- `patchAttributes`
- `createNote`
- `createFollowUpTask`

### 16.3 Safe default profile

Default visible fields:

- Name
- Rock person ID, GUID, or IdKey
- Campus
- Connection status or lifecycle summary
- Connect Group summary
- Ministry Team summary
- Serving summary
- Attendance summary
- Public or ministry-relevant notes summary only when allowed

Hidden unless explicitly requested and authorized:

- Email
- Phone
- Birthdate
- Full address
- Full family detail
- Sensitive notes
- Giving and financial data
- Background check data
- Legal or safety-related fields

### 16.4 Admin visibility

For users with `write` scope and readwrite mode, email and phone may be returned when:

- The user explicitly requests contact details.
- The OAuth user is authorized to view those details.
- The response is needed for the task.
- The tool logs the reason in audit metadata.

### 16.5 Example input

```json
{
  "action": "profile",
  "person": {
    "search": "Alex Santos"
  },
  "include": ["groups", "attendanceSummary", "servingSummary"],
  "shape": "summary"
}
```

### 16.6 Example compact output

```json
{
  "person": {
    "id": 123,
    "guid": "...",
    "name": "Alex Santos",
    "campus": "Manila",
    "connectionStatus": "Core"
  },
  "connectGroup": {
    "name": "Young Adults // BGC Friday",
    "role": "Member"
  },
  "serving": [
    { "team": "Host Team", "role": "Volunteer" }
  ],
  "attendanceSummary": {
    "windowWeeks": 12,
    "attendedCount": 7,
    "consistency": "Regular"
  }
}
```

---

## 17. `rock_ministry` tool

### 17.1 Purpose

Connect Groups, Ministry Teams, attendance, registrations, rosters, and group health.

### 17.2 Actions

```ts
type RockMinistryAction =
  | "groups"
  | "groupMembers"
  | "connectGroupHealth"
  | "meetings"
  | "attendance"
  | "headcount"
  | "registrations"
  | "servingRoster"
  | "consistency"
  | "addOrUpdateGroupMember"
  | "removeGroupMember"
  | "addAttendance"
  | "updateServingRoster";
```

Readwrite-only actions:

- `addOrUpdateGroupMember`
- `removeGroupMember`
- `addAttendance`
- `updateServingRoster`

### 17.3 Discovery dependencies

- Connect Group Group Type candidate.
- Ministry Team Group Type candidate.
- Campus mapping.
- Group age-group signal.
- Attendance occurrence pattern.
- Registration model pattern.

### 17.4 Default date behavior

- Attendance consistency: last 8 to 12 weeks.
- Events and meetings: recent period unless the user asks for historical data.
- Reports: default to current or recent ministry context.

### 17.5 Connect Group Health basic metrics

V1 should calculate:

- Group count.
- Active group count.
- Total members.
- Average members per group.
- Groups without leaders.
- Groups with low recent attendance.
- Attendance consistency over 8 to 12 weeks.
- Age group distribution.
- Campus distribution.

### 17.6 Example input

```json
{
  "action": "connectGroupHealth",
  "campus": "Manila",
  "ageGroup": "Youth",
  "windowWeeks": 12,
  "shape": "summary"
}
```

### 17.7 Example output

```json
{
  "summary": {
    "campus": "Manila",
    "ageGroup": "Youth",
    "windowWeeks": 12,
    "groupCount": 18,
    "activeGroupCount": 17,
    "totalMembers": 164,
    "groupsWithoutLeaders": 1,
    "lowAttendanceGroups": 3
  },
  "discovery": {
    "connectGroupType": {
      "name": "Connect Groups",
      "confidence": 0.96
    }
  },
  "datasetId": "cghealth_..."
}
```

---

## 18. `rock_report` tool

### 18.1 Purpose

Reports, analytics, large datasets, and MCP App launching.

### 18.2 Actions

```ts
type RockReportAction =
  | "list"
  | "run"
  | "summary"
  | "export"
  | "app";
```

### 18.3 Behavior

- `list`: returns matching reports and saved Entity Searches.
- `run`: executes a report, saved Entity Search, or report-like query and returns summary plus preview.
- `summary`: summarizes a stored dataset or report result.
- `export`: produces CSV or JSON export for authorized users.
- `app`: launches the Report Viewer MCP App for a dataset.

### 18.4 Dataset response pattern

```json
{
  "title": "Connect Group Health",
  "rowCount": 142,
  "columns": ["Group", "Age Group", "Leader", "Members", "Attendance"],
  "summary": "Most groups are healthy. Three groups have low attendance over the last 12 weeks.",
  "previewRows": [
    { "Group": "Youth // Makati", "Members": 11, "Attendance": 8 }
  ],
  "datasetId": "rpt_01HX...",
  "app": {
    "resourceUri": "ui://rock/report-viewer.html"
  }
}
```

### 18.5 Token-saving rule

Never return all rows by default. Return:

- `rowCount`
- `columns`
- `summary`
- `previewRows`, default max 10
- `datasetId`
- `appUri`, when available

---

## 19. `rock_workflow` tool

### 19.1 Purpose

Connection requests, workflows, steps, and follow-up processes.

### 19.2 Actions

```ts
type RockWorkflowAction =
  | "connectionRequests"
  | "workflowTypes"
  | "workflowStatus"
  | "launchWorkflow"
  | "updateWorkflow"
  | "completeAction"
  | "steps"
  | "updateConnectionRequest";
```

Readwrite-only actions:

- `launchWorkflow`
- `updateWorkflow`
- `completeAction`
- `updateConnectionRequest`

### 19.3 Rules

- Prefer discovered Workflow Types and Connection Types.
- Use exact workflow type IDs only when discovery confidence is high or user supplied exact data.
- For launching workflows, require `dryRun` unless `commit: true` is supplied.
- Include audit metadata for every workflow mutation.

---

## 20. `rock_write` tool

### 20.1 Purpose

Explicit generic writes for operations that do not fit domain tools.

This tool is registered only in readwrite mode.

### 20.2 Actions

```ts
type RockWriteAction =
  | "create"
  | "patch"
  | "patchAttributes"
  | "delete"
  | "bulkPatch"
  | "dryRun";
```

### 20.3 Rules

- Registered only when mode is readwrite.
- Requires OAuth `write` scope.
- Requires operation-specific authorization.
- Defaults to `dryRun: true`.
- `delete` requires `commit: true` and a human-readable reason.
- Bulk actions must be bounded.
- Every generic write must be allowlisted by model and field.

### 20.4 Schema sketch

```ts
const rockWriteSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("patch"),
    model: z.string().min(1),
    id: z.union([z.string(), z.number()]),
    data: z.record(z.unknown()),
    dryRun: z.boolean().default(true),
    commit: z.boolean().default(false),
    reason: z.string().min(1)
  }),
  z.object({
    action: z.literal("delete"),
    model: z.string().min(1),
    id: z.union([z.string(), z.number()]),
    dryRun: z.boolean().default(true),
    commit: z.boolean().default(false),
    reason: z.string().min(1)
  })
]);
```

---

## 21. MCP Apps v1

### 21.1 V1 app scope

Build a basic Report Viewer app in v1.

Resource URI:

```txt
ui://rock/report-viewer.html
```

Tool integration:

- `rock_report.run` can return a dataset and app URI.
- `rock_report.app` explicitly launches the app for a dataset.
- The app can call `rock_report.summary`, `rock_report.export`, and possibly `rock_report.run` for filter changes.

### 21.2 App features for v1

Basic v1 features:

- Title and summary cards.
- Table view.
- Column list.
- Search within loaded dataset.
- Basic filter display.
- CSV export button that calls `rock_report.export`.
- Refresh button that calls the relevant report action again.
- Empty state.
- Error state.
- No sensitive fields unless already authorized and included in the dataset.

Not required in v1:

- Complex charting.
- Realtime updates.
- Inline editing.
- Multi-report dashboards.
- Embedding inside Rock itself.

### 21.3 Server app registration sketch

Use the MCP Apps helper APIs.

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";

const REPORT_VIEWER_URI = "ui://rock/report-viewer.html";

export function registerReportViewerApp(server: McpServer) {
  registerAppResource(
    server,
    REPORT_VIEWER_URI,
    REPORT_VIEWER_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: REPORT_VIEWER_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await readBuiltAppHtml("report-viewer.html")
        }
      ]
    })
  );
}
```

For the `rock_report` tool, either register through the regular MCP SDK and include app metadata, or use `registerAppTool` for the app-specific action.

```ts
registerAppTool(
  server,
  "rock_report_app",
  {
    title: "Rock Report Viewer",
    description: "Open a Rock report dataset in an interactive viewer.",
    inputSchema: reportAppInputSchema,
    _meta: {
      ui: {
        resourceUri: REPORT_VIEWER_URI
      }
    }
  },
  async (args, extra) => runRockReportApp(args, extra)
);
```

Preferred public tool naming:

- Keep `rock_report` as the main public domain tool.
- Optionally register `rock_report_app` as a hidden or app-specific helper only if the MCP Apps SDK requires a separate app tool.
- Avoid exposing too many app helper tools to the model.

### 21.4 UI implementation sketch

```ts
import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "Rock Report Viewer", version: "1.0.0" });

app.connect();

app.ontoolresult = (result) => {
  const datasetId = extractDatasetId(result);
  renderInitialState(result);
  if (datasetId) {
    loadDataset(datasetId);
  }
};

async function loadDataset(datasetId: string) {
  const result = await app.callServerTool({
    name: "rock_report",
    arguments: {
      action: "summary",
      datasetId,
      includeRows: true
    }
  });

  renderDataset(result);
}
```

### 21.5 App security

- Render only the dataset returned to the authorized session.
- Dataset IDs must be scoped to session or user.
- Dataset access must check OAuth user and scopes.
- Do not allow arbitrary dataset ID access across users.
- Use a deny-by-default content security policy.
- Prefer Vite single-file bundling for v1 to simplify CSP.

---

## 22. Dataset and large-result handling

### 22.1 Dataset storage interface

```ts
interface DatasetStore {
  put(dataset: StoredDataset, ttlSeconds?: number): Promise<string>;
  get(datasetId: string, ctx: OAuthRockContext): Promise<StoredDataset | null>;
  delete(datasetId: string, ctx: OAuthRockContext): Promise<void>;
}
```

### 22.2 Stored dataset shape

```ts
interface StoredDataset {
  id: string;
  owner: {
    oauthSubjectHash: string;
    rockPersonId?: number;
    sessionId?: string;
  };
  title: string;
  createdAt: string;
  expiresAt: string;
  source: {
    tool: string;
    action: string;
    model?: string;
    reportId?: number;
    searchKey?: string;
  };
  columns: string[];
  rows: Record<string, unknown>[];
  summary?: string;
  sensitivity: "low" | "person" | "sensitive" | "financial";
}
```

### 22.3 Storage options

- Development: in-memory LRU cache.
- Production: Redis through Upstash or equivalent.
- Prefix: `ROCK_MCP_REDIS_PREFIX`.

### 22.4 Dataset ID format

Use opaque IDs.

```txt
rpt_01HZX6Z0M5K9R5Z5TN1Y7J4A3P
```

Do not encode report IDs, person IDs, or query strings in the dataset ID.

---

## 23. Rock API client design

### 23.1 Client responsibilities

- Normalize base URL.
- Attach auth headers from credential strategy.
- Support API v2 endpoints.
- Support older REST fallback endpoints.
- Enforce timeouts.
- Normalize errors.
- Support pagination.
- Support JSON request and response.
- Log request metadata without secrets.

### 23.2 Interface sketch

```ts
interface RockClient {
  get<T>(ctx: OAuthRockContext, path: string, options?: RockRequestOptions): Promise<T>;
  post<T>(ctx: OAuthRockContext, path: string, body?: unknown, options?: RockRequestOptions): Promise<T>;
  put<T>(ctx: OAuthRockContext, path: string, body?: unknown, options?: RockRequestOptions): Promise<T>;
  patch<T>(ctx: OAuthRockContext, path: string, body?: unknown, options?: RockRequestOptions): Promise<T>;
  delete<T>(ctx: OAuthRockContext, path: string, options?: RockRequestOptions): Promise<T>;
}
```

### 23.3 API v2 helpers

```ts
class RockV2Api {
  constructor(private client: RockClient) {}

  getModel(ctx: OAuthRockContext, model: string, id: string | number) {
    return this.client.get(ctx, `/api/v2/models/${model}/${id}`);
  }

  searchModel(ctx: OAuthRockContext, model: string, query: EntitySearchQueryBag) {
    return this.client.post(ctx, `/api/v2/models/${model}/search`, query);
  }

  searchModelByKey(ctx: OAuthRockContext, model: string, key: string, query?: EntitySearchQueryBag) {
    return this.client.post(ctx, `/api/v2/models/${model}/search/${key}`, query ?? {});
  }

  getAttributeValues(ctx: OAuthRockContext, model: string, id: string | number) {
    return this.client.get(ctx, `/api/v2/models/${model}/${id}/attributevalues`);
  }

  patchAttributeValues(ctx: OAuthRockContext, model: string, id: string | number, values: Record<string, string>) {
    return this.client.patch(ctx, `/api/v2/models/${model}/${id}/attributevalues`, values);
  }
}
```

### 23.4 Fallback policy

Use v2 first. Use older REST only when:

- v2 does not expose the needed workflow.
- v2 endpoint exists but lacks required behavior.
- v2 has a bug or missing model in v17.7.
- The fallback is explicitly documented in the tool handler.

Each fallback must include a code comment explaining why v2 was not enough.

---

## 24. Authorization and safety guardrails

### 24.1 Guard levels

Use layered authorization.

1. OAuth token validation.
2. OAuth scope check: `read` or `write`.
3. Endpoint mode check.
4. Tool action availability check.
5. Model and field allowlist check.
6. Rock permission check or app-level impersonation policy.
7. Write safety check: `dryRun`, `commit`, and reason.
8. Audit log.

### 24.2 Write categories planned for v1

Include all categories, but with strict policy.

- Update person contact info.
- Patch person attributes.
- Add or update group membership.
- Remove group membership.
- Add attendance.
- Launch workflow.
- Update workflow status.
- Update connection request.
- Update serving roster.
- Create notes.
- Create follow-up tasks.
- Generic model patch through `rock_write`.

### 24.3 Write defaults

- `dryRun: true` by default.
- `commit: false` by default.
- `reason` required for every write.
- `delete` requires explicit `commit: true` and elevated authorization.
- Bulk write maximum should default to 25 items.
- Attendance and group membership writes should require exact IDs or high-confidence discovery.

### 24.4 PII and sensitive data

Default hidden fields:

- Email.
- Phone.
- Birthdate.
- Address.
- Notes.
- Family details.
- Giving and financial data.
- Background checks.
- Legal or care-sensitive fields.

Default visible fields:

- Name.
- Rock ID, GUID, or IdKey.
- Campus.
- Lifecycle or connection summary.
- Group membership summary.
- Serving summary.
- Attendance summary.

### 24.5 Audit log fields

```ts
interface AuditEvent {
  timestamp: string;
  requestId: string;
  sessionId: string;
  oauthSubjectHash: string;
  rockPersonId?: number;
  endpoint: string;
  mode: "readonly" | "readwrite";
  scopeUsed: "read" | "write";
  tool: string;
  action: string;
  target?: {
    model?: string;
    id?: string | number;
    guid?: string;
  };
  dryRun?: boolean;
  commit?: boolean;
  reason?: string;
  outcome: "allowed" | "denied" | "success" | "error";
  errorCode?: string;
}
```

Do not log OAuth tokens, Rock API keys, full PII payloads, or raw notes.

---

## 25. Tool registration implementation

### 25.1 Server factory

```ts
export function createMcpServer(options: {
  mode: McpMode;
  scopes: Set<McpScope>;
  getContext: () => OAuthRockContext;
}) {
  const server = new McpServer(
    { name: "rock-mcp", version: pkg.version },
    { instructions: getRockGuideText(options.mode) }
  );

  registerTools(server, options);
  registerReportViewerApp(server);

  return server;
}
```

### 25.2 Tool registry

```ts
const tools: GatewayTool[] = [
  rockUsageTool,
  rockLookupTool,
  rockEntityTool,
  rockPeopleTool,
  rockMinistryTool,
  rockReportTool,
  rockWorkflowTool,
  rockWriteTool
];

export function registerTools(server: McpServer, options: RegisterOptions) {
  for (const tool of tools) {
    const schema = tool.schemaForMode(options.mode, options.scopes);

    if (!schema) {
      continue;
    }

    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.descriptionForMode(options.mode),
        inputSchema: schema,
        annotations: tool.annotationsForMode(options.mode)
      },
      async (args, extra) => {
        const ctx = options.getContext();
        return runWithContext(ctx, () => tool.handle(args, extra, ctx));
      }
    );
  }
}
```

### 25.3 Gateway tool pattern

```ts
interface GatewayTool {
  name: string;
  title: string;
  schemaForMode(mode: McpMode, scopes: Set<McpScope>): z.ZodTypeAny | null;
  descriptionForMode(mode: McpMode): string;
  annotationsForMode(mode: McpMode): ToolAnnotations;
  handle(args: unknown, extra: unknown, ctx: OAuthRockContext): Promise<McpToolResult>;
}
```

---

## 26. HTTP transport implementation

### 26.1 Express route sketch

```ts
const app = express();
app.use(express.json());

app.post("/mcp/readonly", handleMcpRequest("readonly"));
app.post("/mcp/readwrite", handleMcpRequest("readwrite"));
app.post("/mcp", handleMcpRequest("auto"));
```

### 26.2 Handler sketch

```ts
function handleMcpRequest(endpointKind: "readonly" | "readwrite" | "auto") {
  return async (req: Request, res: Response) => {
    const oauth = await validateOAuth(req);
    const scopes = parseScopes(oauth);
    const rockUser = await resolveRockUser(oauth);

    const preliminaryCtx = createContext(req, oauth, scopes, rockUser, endpointKind);
    const mode = await resolveModeForEndpoint(endpointKind, preliminaryCtx);
    const ctx = { ...preliminaryCtx, mode };

    const server = createMcpServer({
      mode,
      scopes,
      getContext: () => ctx
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };
}
```

### 26.3 Server reuse note

The sketch creates a server per request for clarity. For production, prefer server instances per effective mode plus context injection that is request-safe. Use AsyncLocalStorage or explicit context passing.

Recommended production approach:

- Create one readonly server instance.
- Create one readwrite server instance.
- Use AsyncLocalStorage for per-request context.
- Ensure context cannot leak across requests.

---

## 27. Package and scripts

### 27.1 Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "@modelcontextprotocol/ext-apps": "latest",
    "@upstash/redis": "latest",
    "cors": "latest",
    "express": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/cors": "latest",
    "@types/express": "latest",
    "@types/node": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vite-plugin-singlefile": "latest",
    "vitest": "latest"
  }
}
```

### 27.2 Scripts

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "dev:stdio": "tsx src/index.ts --stdio",
    "build": "tsc && npm run build:apps",
    "build:apps": "INPUT=src/apps/report-viewer/report-viewer.html vite build",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 28. Environment variables

```bash
# Server
PORT=8787
NODE_ENV=production
PUBLIC_BASE_URL=https://rock-mcp.example.com

# Rock
ROCK_BASE_URL=https://rock.example.com
ROCK_API_KEY=...
ROCK_API_VERSION=17.7
ROCK_TIMEZONE=Asia/Manila

# OAuth
OAUTH_ISSUER=...
OAUTH_AUDIENCE=...
OAUTH_JWKS_URL=...
OAUTH_REQUIRED_READ_SCOPE=read
OAUTH_REQUIRED_WRITE_SCOPE=write

# Redis
ROCK_MCP_REDIS_PREFIX=rock-mcp:prod:
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Limits
ROCK_MCP_DEFAULT_LIMIT=50
ROCK_MCP_MAX_LIMIT=500
ROCK_MCP_DATASET_TTL_SECONDS=900
ROCK_MCP_DISCOVERY_TTL_SECONDS=900
ROCK_MCP_BULK_WRITE_MAX=25
```

Do not add an env var for the RSR role name. Use the exact constant `RSR - Rock Administration`.

---

## 29. Implementation phases

### Phase 1: Repo and transport foundation

Tasks:

- Create `favorchurch/rock-mcp` repo.
- Add TypeScript, strict TS config, linting, and test runner.
- Add HTTP MCP transport with three endpoints.
- Add optional stdio transport for local dev.
- Add OAuth validation middleware.
- Add request context and AsyncLocalStorage.
- Add mode resolution for `/mcp`, `/mcp/readonly`, and `/mcp/readwrite`.
- Add basic `rock_usage` tool.

Acceptance criteria:

- `/mcp/readonly` registers readonly tools.
- `/mcp/readwrite` requires `write` scope.
- `/mcp` resolves readonly by default.
- OAuth errors return clear 401 or 403 responses.
- Tests cover endpoint mode resolution.

### Phase 2: Rock client and auth context

Tasks:

- Implement Rock API client.
- Add API key header strategy.
- Add optional user JWT strategy interface.
- Implement OAuth user to Rock user resolution.
- Implement RSR role discovery and membership check.
- Implement audit event writer.

Acceptance criteria:

- Server can call Rock API v2 with API key.
- OAuth user resolves to Rock person or fails with a clear error.
- RSR membership is cached and fail-closed.
- Audit events are written for tool calls and denied writes.

### Phase 3: Runtime discovery

Tasks:

- Implement discovery service.
- Discover Group Types.
- Discover attributes.
- Discover campuses.
- Discover reports.
- Discover Entity Searches.
- Discover workflows and connection types.
- Add confidence scoring.
- Add Redis cache and in-memory fallback.
- Add `rock_lookup.discovery` and `rock_lookup.refreshDiscovery`.

Acceptance criteria:

- `rock_lookup.discovery` returns a Favor discovery map.
- Connect Groups and Ministry Teams candidates include confidence and signals.
- Discovery cache uses `ROCK_MCP_REDIS_PREFIX`.
- Refresh invalidates cached data.

### Phase 4: Read tools

Tasks:

- Implement `rock_lookup`.
- Implement `rock_entity` get, search, searchByKey, count, and attributeValues.
- Implement `rock_people` read actions.
- Implement `rock_ministry` read actions.
- Implement `rock_report` list, run, summary, and export.
- Implement `rock_workflow` read actions.
- Add response shaping and PII defaults.

Acceptance criteria:

- Common person, group, report, and attendance questions work.
- Broad results return summaries and previews.
- Large results return `datasetId`.
- PII is hidden by default.
- Raw search requires limit and model allowlist.

### Phase 5: Basic MCP App

Tasks:

- Add `@modelcontextprotocol/ext-apps`.
- Add Report Viewer app resource.
- Bundle app with Vite single-file output.
- Register app resource with `ui://rock/report-viewer.html`.
- Connect `rock_report.app` to dataset store.
- Add basic table, summary, filter display, refresh, and export.

Acceptance criteria:

- Calling `rock_report.app` opens the app in an MCP Apps-capable host.
- App can load a dataset by `datasetId`.
- App can request summary and export through MCP tool calls.
- Dataset access is scoped to the OAuth user or session.

### Phase 6: Write tools

Tasks:

- Implement `rock_people.updateContactInfo`.
- Implement `rock_people.patchAttributes`.
- Implement `rock_people.createNote`.
- Implement `rock_people.createFollowUpTask`.
- Implement `rock_ministry.addOrUpdateGroupMember`.
- Implement `rock_ministry.removeGroupMember`.
- Implement `rock_ministry.addAttendance`.
- Implement `rock_ministry.updateServingRoster`.
- Implement `rock_workflow.launchWorkflow`.
- Implement `rock_workflow.updateWorkflow`.
- Implement `rock_workflow.completeAction`.
- Implement `rock_workflow.updateConnectionRequest`.
- Implement `rock_write` generic writes.
- Add dry-run diff output.
- Add commit checks.

Acceptance criteria:

- Write tools are absent from `/mcp/readonly`.
- Write tools require OAuth `write` scope.
- Writes default to dry-run.
- Destructive writes require `commit: true` and reason.
- Unauthorized writes fail before Rock mutation.
- Audit logs include target, reason, and outcome.

### Phase 7: Hardening and docs

Tasks:

- Expand `rock_usage` guide.
- Add more test fixtures.
- Add load tests for reports and discovery.
- Add deployment docs.
- Add runbook for OAuth and Rock API key rotation.
- Add troubleshooting docs for discovery confidence.

Acceptance criteria:

- New dev or agent can run the project locally.
- All key workflows have tests.
- Security review items are documented.
- Deployment variables are documented.

---

## 30. Testing plan

### 30.1 Unit tests

- Mode resolution.
- Scope checks.
- OAuth token parsing.
- RSR role detection logic.
- Discovery confidence scoring.
- Group Type hint matching.
- Response shaping.
- PII redaction.
- Write guard logic.
- Dataset store ownership checks.

### 30.2 Integration tests with mocked Rock

- API v2 get model.
- API v2 search model.
- Attribute value reads and patches.
- Discovery service with sample Rock metadata.
- Report run and dataset storage.
- MCP tool registration by mode.
- MCP App resource registration.

### 30.3 End-to-end tests against sandbox Rock

- OAuth user with read scope only.
- OAuth user with write scope but no RSR role.
- OAuth user with write scope and RSR role.
- `/mcp/readonly` as admin.
- `/mcp/readwrite` as admin.
- `/mcp` as admin.
- `/mcp` as non-admin.
- Report Viewer app launch.
- Dry-run write.
- Committed write in sandbox.

### 30.4 Security tests

- Missing OAuth token.
- Invalid OAuth token.
- Missing `read` scope.
- Missing `write` scope on `/mcp/readwrite`.
- Attempt to access another user’s dataset.
- Attempt to write hidden fields.
- Attempt to delete without `commit: true`.
- Attempt raw search on non-allowlisted model.
- Attempt to retrieve sensitive person data without explicit request.

---

## 31. Acceptance criteria for v1

V1 is complete when:

1. The server runs over HTTP and exposes `/mcp`, `/mcp/readonly`, and `/mcp/readwrite`.
2. OAuth scopes `read` and `write` are enforced.
3. `/mcp` auto-detects readwrite only for users with `write` scope and `RSR - Rock Administration` membership.
4. `rock_usage` is registered and guide text is loaded as server instructions.
5. The minimal tool list is implemented.
6. Runtime discovery works and returns confidence-scored mapping candidates.
7. Connect Groups and Ministry Teams are auto-discovered using hints.
8. Read tools return compact, privacy-safe data.
9. Report results return summary, preview rows, and `datasetId`.
10. Basic Report Viewer MCP App renders report datasets.
11. Write tools are present only in readwrite mode.
12. Writes default to dry-run and require authorization, reason, and commit for mutation.
13. Redis cache supports prefixing.
14. Tests cover auth, discovery, tool modes, PII shaping, and write guards.

---

## 32. Implementation notes for an agent

### 32.1 Start here

1. Scaffold TypeScript project.
2. Implement endpoint mode resolution first.
3. Implement `rock_usage` next.
4. Implement Rock client with mocked tests.
5. Implement discovery service before domain tools.
6. Implement read tools before write tools.
7. Implement basic Report Viewer app after `rock_report.run` works.

### 32.2 Do not skip these

- Use strict TypeScript.
- Use Zod for all tool inputs.
- Make every tool mode-aware.
- Add safe response shaping before connecting to live data.
- Add audit logging before enabling writes.
- Add dataset ownership checks before enabling MCP Apps.

### 32.3 Recommended first PRs

1. `chore: scaffold rock-mcp TypeScript project`
2. `feat: add HTTP MCP endpoints and OAuth context`
3. `feat: add mode-aware tool registry and rock_usage`
4. `feat: add Rock API client and RSR detection`
5. `feat: add discovery service with confidence scoring`
6. `feat: add rock_lookup and rock_entity read actions`
7. `feat: add people, ministry, and report read actions`
8. `feat: add report viewer MCP app`
9. `feat: add readwrite tools with dry-run guards`
10. `test: add auth, discovery, and write safety coverage`

---

## 33. Example `rock_usage` guide starter

```md
# Favor Church Rock MCP Guide

You are connected to Favor Church Manila's Rock RMS instance. The timezone is Asia/Manila.

Use these rules before calling tools:

- Use `rock_lookup` when you do not know a Rock ID, Group Type, attribute key, report, or Entity Search key.
- Use `rock_people` for person-centered questions.
- Use `rock_ministry` for Connect Groups, Ministry Teams, attendance, rosters, registrations, and consistency.
- Use `rock_report` for report-like outputs, dashboards, and large tables.
- Use `rock_entity` only when the domain tools do not fit.
- Use `rock_write` only for explicit write tasks in readwrite mode.

Favor-specific rules:

- Connect Group and Ministry Team mappings are discovered at runtime.
- The primary Group Type hints are `Connect Groups` and `Ministry Teams`.
- New, Crowd, Core, and Leader are Favor lifecycle concepts. Discover where these live in Rock before using them.
- Youth leaders means leaders for Youth, not leaders whose personal age is 13 to 17.
- Use the last 8 to 12 weeks for consistency unless the user asks for a different window.
- Default person output must be privacy-safe. Do not include email, phone, birthdate, address, notes, family details, or financial data unless explicitly requested and authorized.
- Large results should return summary, preview rows, and dataset ID rather than all rows.
```

---

## 34. Open implementation risks

### 34.1 True user impersonation

Rock API key calls authenticate as the API key’s user. If the MCP must truly execute as the OAuth user inside Rock, confirm whether Favor’s OAuth setup can provide a Rock JWT or whether a small Rock-side endpoint is needed later.

Recommended v1 path:

- Use OAuth as the user identity.
- Use Rock API key for transport.
- Enforce app-level authorization and RSR auto-detection.
- Keep credential strategy pluggable so a Rock user JWT can be added later.

### 34.2 Raw Dynamic LINQ safety

Entity Search is powerful. Keep raw query access allowlisted and bounded. Prefer saved Entity Searches for repeated Favor workflows.

### 34.3 Discovery ambiguity

If the Rock instance has multiple Group Types named similarly, discovery may produce multiple candidates. Tool handlers must use confidence thresholds and return clarification prompts when needed.

### 34.4 Sensitive data leakage

Person, family, notes, and financial data require strict output shaping. Add tests that intentionally try to pull sensitive fields through generic tools.

---

## 35. Final recommended v1 build target

The best v1 is:

- New TypeScript repo: `favorchurch/rock-mcp`.
- HTTP MCP server with three endpoints.
- OAuth scopes: `read`, `write`.
- RSR auto-detect for `/mcp`.
- Rock API v2 first, older REST fallback second.
- Runtime discovery with confidence scoring.
- Tools: `rock_usage`, `rock_lookup`, `rock_entity`, `rock_people`, `rock_ministry`, `rock_report`, `rock_workflow`, `rock_write`.
- Basic Report Viewer MCP App.
- Redis-backed discovery and dataset caching with prefix.
- Strict write safety with dry-run, commit, reason, allowlists, and audit logs.

This gives Favor Church a full Rock MCP foundation while keeping the model-facing tool list small, safe, and practical.
