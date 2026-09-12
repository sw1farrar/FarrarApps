-- Personal access tokens for MCP hosts that cannot complete the grok.com
-- OAuth browser flow (Grok Bot). grok.com continues to use OAuth JWTs.
-- Service role only — no client RLS policies.

create table if not exists public.mcp_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_mcp_access_tokens_user_active
  on public.mcp_access_tokens (user_id, created_at desc)
  where revoked_at is null;

alter table public.mcp_access_tokens enable row level security;

comment on table public.mcp_access_tokens is
  'Hashed personal access tokens for MCP bots. Grok.com OAuth tokens are separate.';

-- Replay protection for Grok MCP OAuth authorization codes and refresh tokens.
create table if not exists public.mcp_oauth_jtis (
  jti uuid primary key,
  kind text not null check (kind in ('auth_code', 'refresh_token')),
  user_id uuid not null references auth.users (id) on delete cascade,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_mcp_oauth_jtis_user
  on public.mcp_oauth_jtis (user_id);

create index if not exists idx_mcp_oauth_jtis_expires
  on public.mcp_oauth_jtis (expires_at);

create index if not exists idx_mcp_oauth_jtis_active
  on public.mcp_oauth_jtis (kind, consumed_at)
  where consumed_at is null;

alter table public.mcp_oauth_jtis enable row level security;

comment on table public.mcp_oauth_jtis is
  'Replay protection for Grok MCP OAuth authorization codes and refresh tokens. Service role only.';
