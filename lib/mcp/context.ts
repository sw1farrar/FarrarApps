import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export type McpAuthContext = {
  keyId: string;
  keyName: string;
  userId: string;
  email: string | null;
};

const store = new AsyncLocalStorage<McpAuthContext>();

export function getMcpAuth(): McpAuthContext | undefined {
  return store.getStore();
}

export function runWithMcpAuth<T>(ctx: McpAuthContext, fn: () => T): T {
  return store.run(ctx, fn);
}
