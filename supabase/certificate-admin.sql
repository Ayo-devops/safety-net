-- Run once after certificate-schema.sql. Adds server-only admin operations.
begin;

create or replace function public.admin_create_safetynet_certificate(
  p_number text,
  p_name text,
  p_course text,
  p_completion_date date,
  p_token_hash text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_number !~ '^SN-[0-9]{4}-[0-9]{6}$'
    or length(trim(p_name)) not between 1 and 200
    or length(trim(p_course)) not between 1 and 200
    or p_completion_date is null
    or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid certificate record';
  end if;

  insert into safetynet_private.certificates
    (number, name, course, completion_date, status, token_hash)
  values
    (p_number, trim(p_name), trim(p_course), p_completion_date, 'valid', p_token_hash)
  on conflict do nothing;

  if not found then
    return jsonb_build_object('status', 'duplicate');
  end if;
  return jsonb_build_object('status', 'created');
end;
$$;

create or replace function public.admin_list_safetynet_certificates()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'number', c.number,
    'name', c.name,
    'course', c.course,
    'date', to_char(c.completion_date, 'YYYY-MM-DD'),
    'status', c.status,
    'created_at', c.created_at
  ) order by c.created_at desc), '[]'::jsonb)
  from (select * from safetynet_private.certificates order by created_at desc limit 100) c;
$$;

create or replace function public.admin_revoke_safetynet_certificate(p_number text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update safetynet_private.certificates
    set status = 'revoked'
    where number = p_number;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  return jsonb_build_object('status', 'revoked');
end;
$$;

revoke all on function public.admin_create_safetynet_certificate(text, text, text, date, text) from public, anon, authenticated;
revoke all on function public.admin_list_safetynet_certificates() from public, anon, authenticated;
revoke all on function public.admin_revoke_safetynet_certificate(text) from public, anon, authenticated;
grant execute on function public.admin_create_safetynet_certificate(text, text, text, date, text) to service_role;
grant execute on function public.admin_list_safetynet_certificates() to service_role;
grant execute on function public.admin_revoke_safetynet_certificate(text) to service_role;

commit;
