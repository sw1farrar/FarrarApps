/** Public origin used as OAuth issuer and MCP resource base. */
export function getMcpIssuer(): string {
  const explicit =
    process.env.MCP_RESOURCE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "").replace(/\/api\/mcp$/i, "");
  }
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (process.env.VERCEL_ENV === "production" && productionHost) {
    return `https://${productionHost.replace(/\/$/, "")}`;
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }
  if (process.env.NODE_ENV === "production") {
    return "https://farrarapps.com";
  }
  return "http://localhost:3000";
}

export function getMcpResourceUrl(): string {
  return `${getMcpIssuer()}/api/mcp`;
}

export function getMcpBotUrl(): string {
  return `${getMcpIssuer()}/api/mcp/bot`;
}

export const MCP_SCOPES = [
  "mcp:tools",
  "mcp:read",
  "mcp:write",
  "openid",
  "offline_access",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const MCP_DEFAULT_SCOPE = "mcp:tools mcp:read mcp:write offline_access";

export const GROK_CLIENT_ID = "grok";
export const GROK_REDIRECT_URI = "https://grok.com/connectors-oauth-exchange-code/";

export const AUTH_CODE_TTL_SECONDS = 5 * 60;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export const MCP_SERVER_NAME = "farrar-apps";
export const MCP_SERVER_VERSION = "0.1.0";
export const MCP_RESOURCE_NAME = "Farrar Apps";
export const MCP_PRODUCTION_URL = "https://farrarapps.com/api/mcp";
export const MCP_PRODUCTION_BOT_URL = "https://farrarapps.com/api/mcp/bot";
