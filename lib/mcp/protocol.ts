import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "@/lib/mcp/config";
import { callMcpTool, listMcpToolDescriptors } from "@/lib/mcp/tools";

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  };
}

function jsonResult(value: unknown, isError = false) {
  return textResult(JSON.stringify(value, null, 2), isError);
}

export function isJsonRpcNotification(message: JsonRpcRequest): boolean {
  return message.id === undefined;
}

export async function handleMcpMessage(
  message: JsonRpcRequest,
  userId: string | null
): Promise<JsonRpcResponse | null> {
  const id = (message.id ?? null) as JsonRpcId;
  const method = typeof message.method === "string" ? message.method : "";

  if (message.jsonrpc !== "2.0" || !method) {
    if (isJsonRpcNotification(message)) return null;
    return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } };
  }

  if (isJsonRpcNotification(message)) {
    return null;
  }

  try {
    if (method === "initialize") {
      const params = isObject(message.params) ? message.params : {};
      const requested =
        typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-03-26";
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : "2025-03-26";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
          instructions:
            "You are connected to the signed-in user's Farrar Apps workspace. Use tools to manage customers, projects, invoices, transactions, accounts, categories, reconciliations, company settings, staff, portal invites, and project messages. Amounts are USD dollars (not cents). Prefer list_* or get_* to resolve IDs before mutating. Invoice edits only work on drafts.",
        },
      };
    }

    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: listMcpToolDescriptors() } };
    }

    if (method === "tools/call") {
      const params = isObject(message.params) ? message.params : {};
      const name = typeof params.name === "string" ? params.name : "";
      const args = isObject(params.arguments) ? params.arguments : {};
      if (!name) {
        return {
          jsonrpc: "2.0",
          id,
          result: textResult("Tool name is required.", true),
        };
      }
      if (!userId) {
        return {
          jsonrpc: "2.0",
          id,
          result: textResult(
            "Authentication required. Send Authorization: Bearer fa_mcp_… from Farrar Apps → Settings → Security → Grok bot token.",
            true
          ),
        };
      }
      const outcome = await callMcpTool(userId, name, args);
      if (!outcome.ok) {
        return { jsonrpc: "2.0", id, result: textResult(outcome.error, true) };
      }
      return { jsonrpc: "2.0", id, result: jsonResult(outcome.result) };
    }

    if (method === "resources/list") {
      return { jsonrpc: "2.0", id, result: { resources: [] } };
    }

    if (method === "prompts/list") {
      return { jsonrpc: "2.0", id, result: { prompts: [] } };
    }

    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Internal error";
    return { jsonrpc: "2.0", id, error: { code: -32603, message: messageText } };
  }
}

export async function handleMcpPayload(
  payload: unknown,
  userId: string | null
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(payload)) {
    const responses: JsonRpcResponse[] = [];
    for (const item of payload) {
      const response = await handleMcpMessage(item as JsonRpcRequest, userId);
      if (response) responses.push(response);
    }
    return responses.length ? responses : null;
  }
  return handleMcpMessage(payload as JsonRpcRequest, userId);
}
