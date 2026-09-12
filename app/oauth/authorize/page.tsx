import Link from "next/link";
import { redirect } from "next/navigation";
import { GROK_CLIENT_ID, MCP_PRODUCTION_URL } from "@/lib/mcp/config";
import { OAuthError, parseAuthorizationRequest } from "@/lib/mcp/oauth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Grok connector
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <Link
          href="/settings/security"
          className="mt-4 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Security settings
        </Link>
      </div>
    </main>
  );
}

export default async function AuthorizeGrokPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") values.set(key, value);
    else if (Array.isArray(value) && value[0]) values.set(key, value[0]);
  }

  let request;
  try {
    request = parseAuthorizationRequest(values);
  } catch (error) {
    const code = error instanceof OAuthError ? error.message : "invalid_request";
    return (
      <ErrorCard
        title="This Grok login request is invalid"
        message={`OAuth error: ${code}. Remove the connector on grok.com/connectors and add it again using ${MCP_PRODUCTION_URL}.`}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authorizePath = `/oauth/authorize?${values.toString()}`;
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(authorizePath)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", user!.id)
    .maybeSingle();

  if (profile?.role !== "owner" && profile?.role !== "staff") {
    return (
      <ErrorCard
        title="This account cannot authorize Grok"
        message="MCP access is limited to owners and staff."
      />
    );
  }

  const email = profile?.email || user!.email || "your account";
  const name = profile?.full_name;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <form
        method="post"
        action="/oauth/authorize/complete"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Grok connector
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Allow Grok to use Farrar Apps?
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {name ? `${name} (${email})` : email} — Grok will be able to list, create,
          update, and delete customers, projects, invoices, transactions, and
          settings the same way you can in the app.
        </p>
        <div className="mt-4 space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Client</span>
            <span className="font-medium">{GROK_CLIENT_ID}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Access</span>
            <span className="text-right font-medium">Read and write workspace data</span>
          </div>
        </div>
        <input type="hidden" name="client_id" value={request.client_id} />
        <input type="hidden" name="redirect_uri" value={request.redirect_uri} />
        <input type="hidden" name="response_type" value="code" />
        <input type="hidden" name="scope" value={request.scope} />
        <input type="hidden" name="state" value={request.state} />
        <input type="hidden" name="code_challenge" value={request.code_challenge} />
        <input type="hidden" name="code_challenge_method" value="S256" />
        <div className="mt-5 grid gap-2">
          <button
            type="submit"
            name="decision"
            value="allow"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Authorize Grok
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium"
          >
            Deny
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          You can remove this connector later at grok.com/connectors. For Grok Bot,
          use a token from Settings → Security instead.
        </p>
      </form>
    </main>
  );
}
