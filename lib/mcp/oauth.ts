import { createHash, randomUUID } from "crypto";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  GROK_CLIENT_ID,
  GROK_REDIRECT_URI,
  MCP_DEFAULT_SCOPE,
  MCP_RESOURCE_NAME,
  MCP_SCOPES,
  REFRESH_TOKEN_TTL_SECONDS,
  getMcpIssuer,
  getMcpResourceUrl,
} from "@/lib/mcp/config";
import { signHs256Jwt, verifyHs256Jwt } from "@/lib/mcp/jwt";
import { getOAuthTicketStore } from "@/lib/mcp/ticketStore";

export { GROK_CLIENT_ID, GROK_REDIRECT_URI };

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

export type GrokClient = {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
};

const GROK_CLIENT: GrokClient = {
  client_id: GROK_CLIENT_ID,
  client_name: "Grok",
  redirect_uris: [GROK_REDIRECT_URI],
};

export type AuthorizationRequest = {
  client_id: string;
  redirect_uri: string;
  state: string;
  scope: string;
  code_challenge: string;
};

function getSigningSecret(): string {
  const explicit =
    process.env.MCP_OAUTH_SECRET?.trim() || process.env.OAUTH_SECRET?.trim();
  if (explicit && explicit.length >= 32) return explicit;

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole && serviceRole.length > 20) {
    return createHash("sha256").update(`mcp-oauth:${serviceRole}`).digest("hex");
  }

  if (process.env.NODE_ENV === "production") {
    throw new OAuthError("server_error", 500);
  }
  return "local-development-mcp-oauth-secret-change-me";
}

export function isMcpOAuthConfigured(): boolean {
  try {
    getSigningSecret();
    return true;
  } catch {
    return false;
  }
}

export function validateScope(raw: string | null | undefined): string {
  const requested = [
    ...new Set((raw?.trim() || MCP_DEFAULT_SCOPE).split(/\s+/).filter(Boolean)),
  ];
  if (
    !requested.length ||
    requested.some((item) => !(MCP_SCOPES as readonly string[]).includes(item))
  ) {
    throw new OAuthError("invalid_scope");
  }
  return requested.join(" ");
}

export function validateClient(clientId: string, redirectUri: string): GrokClient {
  if (clientId !== GROK_CLIENT.client_id || !GROK_CLIENT.redirect_uris.includes(redirectUri)) {
    throw new OAuthError("invalid_client");
  }
  return GROK_CLIENT;
}

export function validateClientId(clientId: string): void {
  if (clientId !== GROK_CLIENT.client_id) {
    throw new OAuthError("invalid_client");
  }
}

export function registerGrokClient(metadata: {
  redirect_uris?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  client_name?: unknown;
}) {
  if (
    !Array.isArray(metadata.redirect_uris) ||
    metadata.redirect_uris.length !== 1 ||
    metadata.redirect_uris[0] !== GROK_REDIRECT_URI
  ) {
    throw new OAuthError("invalid_redirect_uri");
  }
  if (
    metadata.token_endpoint_auth_method != null &&
    metadata.token_endpoint_auth_method !== "none"
  ) {
    throw new OAuthError("invalid_client_metadata");
  }
  if (
    metadata.grant_types != null &&
    (!Array.isArray(metadata.grant_types) ||
      metadata.grant_types.some(
        (value) => value !== "authorization_code" && value !== "refresh_token"
      ))
  ) {
    throw new OAuthError("invalid_client_metadata");
  }
  if (
    metadata.response_types != null &&
    (!Array.isArray(metadata.response_types) ||
      metadata.response_types.some((value) => value !== "code"))
  ) {
    throw new OAuthError("invalid_client_metadata");
  }
  return {
    client_id: GROK_CLIENT.client_id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name:
      typeof metadata.client_name === "string"
        ? metadata.client_name.slice(0, 100)
        : "Grok",
    redirect_uris: GROK_CLIENT.redirect_uris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}

export function parseAuthorizationRequest(values: URLSearchParams): AuthorizationRequest {
  const request = {
    client_id: values.get("client_id") || "",
    redirect_uri: values.get("redirect_uri") || "",
    state: values.get("state") || "",
    scope: validateScope(values.get("scope")),
    code_challenge: values.get("code_challenge") || "",
  };
  if (values.get("response_type") !== "code") {
    throw new OAuthError("unsupported_response_type");
  }
  if (values.get("code_challenge_method") !== "S256" || !request.code_challenge) {
    throw new OAuthError("invalid_request");
  }
  validateClient(request.client_id, request.redirect_uri);
  return request;
}

export async function verifyPkce(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) return false;
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}

type AuthCodeClaims = {
  typ: "auth_code";
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  sub: string;
  iss: string;
  jti: string;
  iat: number;
  exp: number;
};

type AccessTokenClaims = {
  typ: "access_token";
  client_id: string;
  scope: string;
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
};

type RefreshTokenClaims = {
  typ: "refresh_token";
  client_id: string;
  scope: string;
  sub: string;
  iss: string;
  aud: string;
  jti: string;
  iat: number;
  exp: number;
};

function asString(value: unknown, error = "invalid_grant"): string {
  if (typeof value !== "string" || !value) throw new OAuthError(error);
  return value;
}

export async function createAuthCode(
  input: AuthorizationRequest & { userId: string }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jti = randomUUID();
  const issuer = getMcpIssuer();
  const payload: AuthCodeClaims = {
    typ: "auth_code",
    client_id: input.client_id,
    redirect_uri: input.redirect_uri,
    code_challenge: input.code_challenge,
    scope: input.scope,
    sub: input.userId,
    iss: issuer,
    jti,
    iat: now,
    exp: now + AUTH_CODE_TTL_SECONDS,
  };
  await getOAuthTicketStore().issue(
    jti,
    "auth_code",
    input.userId,
    new Date((now + AUTH_CODE_TTL_SECONDS) * 1000)
  );
  return signHs256Jwt(payload, getSigningSecret());
}

export async function verifyAuthCode(code: string): Promise<AuthCodeClaims> {
  const payload = verifyHs256Jwt(code, getSigningSecret());
  if (payload.typ !== "auth_code" || payload.iss !== getMcpIssuer()) {
    throw new OAuthError("invalid_grant");
  }
  return {
    typ: "auth_code",
    client_id: asString(payload.client_id),
    redirect_uri: asString(payload.redirect_uri),
    code_challenge: asString(payload.code_challenge),
    scope: asString(payload.scope),
    sub: asString(payload.sub),
    iss: asString(payload.iss),
    jti: asString(payload.jti),
    iat: typeof payload.iat === "number" ? payload.iat : 0,
    exp: typeof payload.exp === "number" ? payload.exp : 0,
  };
}

export async function consumeAuthCode(jti: string): Promise<void> {
  const ok = await getOAuthTicketStore().consume(jti, "auth_code");
  if (!ok) throw new OAuthError("invalid_grant");
}

export async function createTokenPair(opts: {
  clientId: string;
  scope: string;
  userId: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const issuer = getMcpIssuer();
  const audience = getMcpResourceUrl();
  const secret = getSigningSecret();
  const accessPayload: AccessTokenClaims = {
    typ: "access_token",
    client_id: opts.clientId,
    scope: opts.scope,
    sub: opts.userId,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  const jti = randomUUID();
  const refreshPayload: RefreshTokenClaims = {
    typ: "refresh_token",
    client_id: opts.clientId,
    scope: opts.scope,
    sub: opts.userId,
    iss: issuer,
    aud: audience,
    jti,
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_SECONDS,
  };
  await getOAuthTicketStore().issue(
    jti,
    "refresh_token",
    opts.userId,
    new Date((now + REFRESH_TOKEN_TTL_SECONDS) * 1000)
  );
  return {
    access_token: signHs256Jwt(accessPayload, secret),
    refresh_token: signHs256Jwt(refreshPayload, secret),
    token_type: "Bearer" as const,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope: opts.scope,
  };
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  const payload = verifyHs256Jwt(token, getSigningSecret());
  if (
    payload.typ !== "refresh_token" ||
    payload.iss !== getMcpIssuer() ||
    payload.aud !== getMcpResourceUrl()
  ) {
    throw new OAuthError("invalid_grant");
  }
  return {
    typ: "refresh_token",
    client_id: asString(payload.client_id),
    scope: asString(payload.scope),
    sub: asString(payload.sub),
    iss: asString(payload.iss),
    aud: asString(payload.aud),
    jti: asString(payload.jti),
    iat: typeof payload.iat === "number" ? payload.iat : 0,
    exp: typeof payload.exp === "number" ? payload.exp : 0,
  };
}

export async function consumeRefreshToken(jti: string): Promise<void> {
  const ok = await getOAuthTicketStore().consume(jti, "refresh_token");
  if (!ok) throw new OAuthError("invalid_grant");
}

export type McpOAuthAccessToken = {
  userId: string;
  clientId: string;
  scopes: string[];
};

export function verifyAccessToken(token: string): McpOAuthAccessToken {
  const payload = verifyHs256Jwt(token, getSigningSecret());
  if (
    payload.typ !== "access_token" ||
    payload.iss !== getMcpIssuer() ||
    payload.aud !== getMcpResourceUrl()
  ) {
    throw new OAuthError("invalid_token", 401);
  }
  const scope = asString(payload.scope, "invalid_token");
  const scopes = scope.split(/\s+/).filter(Boolean);
  if (!scopes.includes("mcp:tools")) {
    throw new OAuthError("insufficient_scope", 403);
  }
  return {
    userId: asString(payload.sub, "invalid_token"),
    clientId: asString(payload.client_id, "invalid_token"),
    scopes,
  };
}

export function authorizationServerMetadata() {
  const issuer = getMcpIssuer();
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...MCP_SCOPES],
    subject_types_supported: ["public"],
  };
}

export function protectedResourceMetadata() {
  return {
    resource: getMcpResourceUrl(),
    authorization_servers: [getMcpIssuer()],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: MCP_RESOURCE_NAME,
  };
}
