import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getMcpAuth } from "@/lib/mcp/context";
import { createAdminClient } from "@/lib/supabase/admin";

function mcpImpersonationClient() {
  const ctx = getMcpAuth();
  if (!ctx) return null;

  const admin = createAdminClient();
  const user = {
    id: ctx.userId,
    email: ctx.email ?? undefined,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "",
  };

  return new Proxy(admin, {
    get(target, prop, receiver) {
      if (prop === "auth") {
        return new Proxy(target.auth, {
          get(authTarget, authProp, authReceiver) {
            if (authProp === "getUser") {
              return async () => ({ data: { user }, error: null });
            }
            if (authProp === "getSession") {
              return async () => ({
                data: {
                  session: {
                    access_token: "mcp",
                    refresh_token: "",
                    expires_in: 3600,
                    token_type: "bearer" as const,
                    user,
                  },
                },
                error: null,
              });
            }
            return Reflect.get(authTarget, authProp, authReceiver);
          },
        });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export async function createClient() {
  const mcpClient = mcpImpersonationClient();
  if (mcpClient) {
    return mcpClient as unknown as ReturnType<typeof createServerClient>;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware will refresh sessions.
          }
        },
      },
    }
  );
}
