-- Gated staff view of relocation_contacts.
--
-- This repo is public, so viewer credentials never live in code or config:
-- only a bcrypt hash is stored here, and accounts are created directly in
-- the database (see README). The Next.js server talks to these functions
-- with the anon key; the tables themselves are closed to every API role.

create table if not exists relocation_viewer_accounts (
  username text primary key,
  password_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz
);

create table if not exists relocation_viewer_sessions (
  token_hash text primary key,
  username text not null references relocation_viewer_accounts (username) on delete cascade,
  expires_at timestamptz not null
);

alter table relocation_viewer_accounts enable row level security;
alter table relocation_viewer_sessions enable row level security;
revoke all on relocation_viewer_accounts, relocation_viewer_sessions from anon, authenticated;

-- Returns a session token, or an error code. Never raises on bad input, so
-- the failed-attempt counter is committed rather than rolled back.
create or replace function relocation_viewer_login(p_username text, p_password text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct public.relocation_viewer_accounts;
  token text;
begin
  select * into acct
  from public.relocation_viewer_accounts
  where lower(username) = lower(btrim(p_username))
  for update;

  if not found then
    -- Spend the same hashing time as a real check so usernames can't be probed.
    perform extensions.crypt(coalesce(p_password, ''), extensions.gen_salt('bf'));
    return json_build_object('ok', false, 'error', 'invalid');
  end if;

  if acct.locked_until is not null and acct.locked_until > now() then
    return json_build_object('ok', false, 'error', 'locked');
  end if;

  if acct.password_hash <> extensions.crypt(coalesce(p_password, ''), acct.password_hash) then
    update public.relocation_viewer_accounts
    set failed_attempts = acct.failed_attempts + 1,
        locked_until = case when acct.failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
    where username = acct.username;
    return json_build_object('ok', false, 'error', 'invalid');
  end if;

  update public.relocation_viewer_accounts
  set failed_attempts = 0, locked_until = null
  where username = acct.username;

  delete from public.relocation_viewer_sessions where expires_at < now();

  token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.relocation_viewer_sessions (token_hash, username, expires_at)
  values (encode(extensions.digest(token, 'sha256'), 'hex'), acct.username, now() + interval '12 hours');

  return json_build_object('ok', true, 'token', token);
end;
$$;

create or replace function relocation_viewer_contacts(p_token text)
returns table (id uuid, created_at timestamptz, customer_name text, phone text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.relocation_viewer_sessions s
    where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and s.expires_at > now()
  ) then
    raise exception 'invalid_session' using errcode = '28000';
  end if;

  return query
  select c.id, c.created_at, c.customer_name, c.phone, c.email
  from public.relocation_contacts c
  order by c.created_at desc;
end;
$$;

create or replace function relocation_viewer_logout(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.relocation_viewer_sessions
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

revoke all on function relocation_viewer_login(text, text) from public, anon, authenticated;
revoke all on function relocation_viewer_contacts(text) from public, anon, authenticated;
revoke all on function relocation_viewer_logout(text) from public, anon, authenticated;
grant execute on function relocation_viewer_login(text, text) to anon;
grant execute on function relocation_viewer_contacts(text) to anon;
grant execute on function relocation_viewer_logout(text) to anon;
