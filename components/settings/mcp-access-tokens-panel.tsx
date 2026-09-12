"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import {
  MCP_PRODUCTION_BOT_URL,
  MCP_PRODUCTION_URL,
} from "@/lib/mcp/config";

type TokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function McpAccessTokensPanel({
  canManage,
  thisEnvironmentBotUrl,
}: {
  canManage: boolean;
  thisEnvironmentBotUrl: string;
}) {
  const confirm = useConfirm();
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Grok bot");
  const [plaintext, setPlaintext] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const res = await fetch("/api/mcp/tokens");
      const data = await res.json();
      if (res.ok) setTokens(data.tokens ?? []);
    } catch {
      // table may not exist yet
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not create token");
        return;
      }
      setPlaintext(data.token);
      setTokens((current) => [data.summary, ...current]);
      toast.success("Token created — copy it now. It will not be shown again.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: TokenSummary) => {
    const ok = await confirm({
      title: "Revoke MCP token?",
      description: `${token.name} will stop working immediately. Bots using it will need a new token.`,
      confirmLabel: "Revoke",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await fetch(`/api/mcp/tokens/${token.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not revoke token");
      return;
    }
    setTokens((current) => current.filter((row) => row.id !== token.id));
    toast.success("Token revoked");
  };

  const grokAddCommand = `grok mcp add --transport http farrarapps ${MCP_PRODUCTION_BOT_URL} --header "Authorization: Bearer ${plaintext || "fa_mcp_YOUR_TOKEN"}"`;

  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">Grok MCP</CardTitle>
        <CardDescription className="text-xs">
          Same setup as Badazz Tasks: grok.com uses a login card; Grok Bot uses a
          bearer token and does not log in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-0">
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-foreground">grok.com</p>
              <code className="block truncate">{MCP_PRODUCTION_URL}</code>
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Copy grok.com MCP URL"
              onClick={() => copy(MCP_PRODUCTION_URL, "grok.com URL")}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-foreground">Grok Bot</p>
              <code className="block truncate">{MCP_PRODUCTION_BOT_URL}</code>
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Copy Grok Bot MCP URL"
              onClick={() => copy(MCP_PRODUCTION_BOT_URL, "Grok Bot URL")}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
          {thisEnvironmentBotUrl !== MCP_PRODUCTION_BOT_URL ? (
            <p>
              This environment:{" "}
              <code className="text-foreground">{thisEnvironmentBotUrl}</code>
            </p>
          ) : null}
        </div>

        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Only owners can create Grok Bot tokens.
          </p>
        ) : (
          <>
            {plaintext ? (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                <p className="text-xs font-medium">Copy this token now</p>
                <p className="text-[11px] text-muted-foreground">
                  It will not be shown again. Treat it like a password.
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate text-xs">{plaintext}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(plaintext, "Token")}
                  >
                    <Copy className="size-3.5" />
                    Copy
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-auto px-0 text-[11px]"
                  onClick={() => copy(grokAddCommand, "Grok command")}
                >
                  Copy grok mcp add command
                </Button>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Grok bot"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={creating || tokens.length >= 5}
              >
                <Plus className="size-3.5" />
                Create token
              </Button>
            </div>

            {loading && tokens.length === 0 ? (
              <p className="text-xs text-muted-foreground">Loading tokens…</p>
            ) : tokens.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-2 py-3 text-xs text-muted-foreground">
                No bot tokens yet. Create one for Grok Bot, then add{" "}
                <code>{MCP_PRODUCTION_BOT_URL}</code> with{" "}
                <code>Authorization: Bearer fa_mcp_…</code>.
              </p>
            ) : (
              <ul className="space-y-1">
                {tokens.map((token) => (
                  <li
                    key={token.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-medium">
                        <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
                        {token.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {token.tokenPrefix}
                        {token.lastUsedAt
                          ? ` · last used ${formatDateTime(token.lastUsedAt)}`
                          : ` · created ${formatDateTime(token.createdAt)}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevoke(token)}
                      aria-label={`Revoke ${token.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
