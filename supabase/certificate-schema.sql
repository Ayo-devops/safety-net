-- Run once in the new project's SQL Editor. Contains no certificate records.
begin;
create schema if not exists safetynet_private;
revoke all on schema safetynet_private from public, anon, authenticated;

create table safetynet_private.certificates (
  number text primary key check (length(number) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 200),
  course text not null check (length(trim(course)) between 1 and 200),
  completion_date date not null,
  status text not null default 'draft' check (status in ('draft', 'valid', 'revoked')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
alter table safetynet_private.certificates enable row level security;
create table safetynet_private.lookup_limits (
  client_hash text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table safetynet_private.lookup_limits enable row level security;
revoke all on all tables in schema safetynet_private from public, anon, authenticated;

-- Only a server credential can call this; tables are outside the public schema.
create function public.verify_safetynet_certificate(p_token_hash text, p_client_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  record safetynet_private.certificates%rowtype;
  hit_count integer;
begin
  if p_token_hash is null or p_client_hash is null or
    p_token_hash !~ '^[a-f0-9]{64}$' or p_client_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid lookup';
  end if;
  delete from safetynet_private.lookup_limits where window_start < now() - interval '1 day';
  insert into safetynet_private.lookup_limits as limits (client_hash, window_start, hits)
    values (p_client_hash, now(), 1)
    on conflict (client_hash) do update set
      hits = case when limits.window_start <= now() - interval '1 minute' then 1 else least(limits.hits + 1, 31) end,
      window_start = case when limits.window_start <= now() - interval '1 minute' then now() else limits.window_start end
    returning hits into hit_count;
  if hit_count > 30 then return jsonb_build_object('status', 'rate_limited'); end if;
  select * into record from safetynet_private.certificates where token_hash = p_token_hash;
  if not found or record.status = 'draft' then return jsonb_build_object('status', 'not_found'); end if;
  if record.status = 'revoked' then return jsonb_build_object('status', 'revoked'); end if;
  if record.status <> 'valid' then raise exception 'Invalid status'; end if;
  return jsonb_build_object('status', 'valid', 'certificate', jsonb_build_object(
    'number', record.number, 'name', record.name, 'course', record.course,
    'date', to_char(record.completion_date, 'YYYY-MM-DD')));
end;
$$;
revoke all on function public.verify_safetynet_certificate(text, text) from public, anon, authenticated;
grant execute on function public.verify_safetynet_certificate(text, text) to service_role;
commit;
