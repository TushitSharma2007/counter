-- Functions are private by default: every RPC the client may call is granted explicitly in its
-- own migration. Two defaults have to go: Postgres's built-in EXECUTE for PUBLIC (only a global
-- revoke removes it) and Supabase's per-schema grants to anon and authenticated.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Cheap liveness check for the keep-alive job (free projects pause after 7 days idle) and the app.
create function public.health()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('ok', true, 'at', now());
$$;

comment on function public.health() is 'Liveness check. Safe for anon: reads nothing.';

grant execute on function public.health() to anon, authenticated;
