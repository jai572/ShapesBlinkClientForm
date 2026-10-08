-- Texting relocation sign-ups through the salon's own Android phone.
--
-- The portal never talks to the phone. It puts messages in relocation_sms;
-- a small script on the phone (Termux) asks for the next one, sends it with
-- the phone's SIM, and reports back. The phone proves who it is with a long
-- secret key; only a SHA-256 hash of that key is stored here.
--
-- Safety for the salon's main number: the gateway hands out at most
-- relocation_sms_gateway.hourly_limit messages per rolling hour (default 60),
-- one at a time, and a message the phone took but never reported on is NOT
-- resent automatically (it is marked failed so a human checks the phone).
--
-- Tables have row level security on and no policies, so the API roles can't
-- read or write them directly; everything goes through the functions below,
-- each of which checks a viewer session token or the gateway key itself.

create table if not exists relocation_sms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contact_id uuid references relocation_contacts (id),
  kind text not null default 'client' check (kind in ('client', 'test')),
  to_number text not null check (to_number ~ '^\+447[1-57-9]\d{8}$'),
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  claimed_at timestamptz,
  sent_at timestamptz,
  error text
);
create index if not exists relocation_sms_status_idx on relocation_sms (status, created_at);
alter table relocation_sms enable row level security;

create table if not exists relocation_sms_gateway (
  id boolean primary key default true check (id),
  key_hash text not null,
  hourly_limit integer not null default 60 check (hourly_limit between 1 and 500),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table relocation_sms_gateway enable row level security;

-- UK mobile (07xxx, +447xxx, 00447xxx, 4407xxx) -> +447xxxxxxxxx, else null.
create or replace function relocation_to_e164(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d ~ '^07[1-57-9]\d{8}$' then return '+44' || substr(d, 2);
  elsif d ~ '^447[1-57-9]\d{8}$' then return '+' || d;
  elsif d ~ '^00447[1-57-9]\d{8}$' then return '+' || substr(d, 3);
  elsif d ~ '^4407[1-57-9]\d{8}$' then return '+44' || substr(d, 4);
  end if;
  return null;
end;
$$;

create or replace function relocation_sms_gateway_check(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.relocation_sms_gateway g
    where g.id and g.key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex')
  ) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
end;
$$;

-- Viewer: store the hash of a freshly generated gateway key (replaces any old one).
create or replace function relocation_viewer_set_gateway_key(p_token text, p_key_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.relocation_viewer_check(p_token);
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad_key_hash' using errcode = '22023';
  end if;
  insert into public.relocation_sms_gateway (id, key_hash) values (true, p_key_hash)
  on conflict (id) do update set key_hash = excluded.key_hash, updated_at = now(), last_seen_at = null;
end;
$$;

-- Viewer: queue personalised texts. p_messages = [{contact_id, body}, ...].
-- The number always comes from the contact row, never from the caller. One
-- text per phone number; numbers already queued/sent are skipped.
create or replace function relocation_viewer_queue_sms(p_token text, p_messages jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_queued integer;
  v_total integer;
begin
  perform public.relocation_viewer_check(p_token);
  if jsonb_typeof(p_messages) is distinct from 'array' then
    raise exception 'bad_messages' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_messages);
  if v_total = 0 then
    return json_build_object('queued', 0, 'skipped', 0);
  end if;
  if v_total > 300 then
    raise exception 'too_many_messages' using errcode = '22023';
  end if;

  with input as (
    select (e ->> 'contact_id')::uuid as contact_id, e ->> 'body' as body
    from jsonb_array_elements(p_messages) e
  ),
  resolved as (
    select distinct on (public.relocation_to_e164(c.phone))
      i.contact_id, i.body, public.relocation_to_e164(c.phone) as to_number
    from input i
    join public.relocation_contacts c on c.id = i.contact_id
    where public.relocation_to_e164(c.phone) is not null
      and char_length(btrim(i.body)) between 1 and 1000
    order by public.relocation_to_e164(c.phone), c.created_at
  ),
  ins as (
    insert into public.relocation_sms (contact_id, to_number, body)
    select r.contact_id, r.to_number, r.body
    from resolved r
    where not exists (
      select 1 from public.relocation_sms s
      where s.kind = 'client' and s.to_number = r.to_number and s.status in ('queued', 'sending', 'sent')
    )
    returning 1
  )
  select count(*) into v_queued from ins;

  return json_build_object('queued', v_queued, 'skipped', v_total - v_queued);
end;
$$;

-- Viewer: queue one test text to any UK mobile (jumps the queue).
create or replace function relocation_viewer_queue_test_sms(p_token text, p_to text, p_body text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to text := public.relocation_to_e164(p_to);
begin
  perform public.relocation_viewer_check(p_token);
  if v_to is null then
    return json_build_object('ok', false, 'error', 'invalid_number');
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    return json_build_object('ok', false, 'error', 'invalid_body');
  end if;
  insert into public.relocation_sms (kind, to_number, body) values ('test', v_to, p_body);
  return json_build_object('ok', true);
end;
$$;

-- Viewer: stop everything still waiting (already-sent texts are unaffected).
create or replace function relocation_viewer_cancel_sms(p_token text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public.relocation_viewer_check(p_token);
  update public.relocation_sms set status = 'cancelled' where status = 'queued';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Viewer: gateway status, queue counts, the latest test, and the latest text
-- per phone number (so every sign-up using that number shows the same state).
create or replace function relocation_viewer_sms_overview(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.relocation_viewer_check(p_token);
  return json_build_object(
    'gateway_set', exists (select 1 from public.relocation_sms_gateway g where g.id),
    'gateway_last_seen', (select g.last_seen_at from public.relocation_sms_gateway g where g.id),
    'hourly_limit', coalesce((select g.hourly_limit from public.relocation_sms_gateway g where g.id), 60),
    'sent_last_hour', (select count(*) from public.relocation_sms s where s.status in ('sending', 'sent') and s.claimed_at > now() - interval '1 hour'),
    'counts', (
      select json_build_object(
        'queued', count(*) filter (where s.status = 'queued'),
        'sending', count(*) filter (where s.status = 'sending'),
        'sent', count(*) filter (where s.status = 'sent'),
        'failed', count(*) filter (where s.status = 'failed')
      )
      from public.relocation_sms s where s.kind = 'client'
    ),
    'test', (
      select json_build_object('status', s.status, 'error', s.error, 'created_at', s.created_at)
      from public.relocation_sms s where s.kind = 'test' order by s.created_at desc limit 1
    ),
    'items', coalesce((
      select json_agg(json_build_object('to_number', x.to_number, 'status', x.status, 'sent_at', x.sent_at, 'error', x.error))
      from (
        select distinct on (s.to_number) s.to_number, s.status, s.sent_at, s.error
        from public.relocation_sms s
        where s.kind = 'client' and s.status <> 'cancelled'
        order by s.to_number, s.created_at desc
      ) x
    ), '[]'::json)
  );
end;
$$;

-- Gateway (the phone): next message to send, or null. Also records "last seen".
create or replace function relocation_sms_gateway_next(p_key text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.relocation_sms;
  v_limit integer;
  v_recent integer;
begin
  perform public.relocation_sms_gateway_check(p_key);
  update public.relocation_sms_gateway set last_seen_at = now() where id;

  -- Taken by the phone but never reported: do not resend; make a human check.
  update public.relocation_sms
  set status = 'failed', error = 'No result came back from the phone. Check its Sent messages before retrying.'
  where status = 'sending' and claimed_at < now() - interval '10 minutes';

  select g.hourly_limit into v_limit from public.relocation_sms_gateway g where g.id;
  select count(*) into v_recent from public.relocation_sms
  where status in ('sending', 'sent') and claimed_at > now() - interval '1 hour';
  if v_recent >= v_limit then
    return json_build_object('message', null, 'wait', 'hourly_limit');
  end if;

  select * into m from public.relocation_sms
  where status = 'queued'
  order by (kind = 'test') desc, created_at, id
  limit 1
  for update skip locked;
  if not found then
    return json_build_object('message', null);
  end if;

  update public.relocation_sms set status = 'sending', claimed_at = now() where id = m.id;
  return json_build_object('message', json_build_object('id', m.id, 'to', m.to_number, 'body', m.body));
end;
$$;

-- Gateway (the phone): outcome for a message it was given.
create or replace function relocation_sms_gateway_result(p_key text, p_id uuid, p_ok boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.relocation_sms_gateway_check(p_key);
  update public.relocation_sms
  set status = case when p_ok then 'sent' else 'failed' end,
      sent_at = case when p_ok then now() else null end,
      error = case when p_ok then null else left(coalesce(p_error, 'Unknown error'), 300) end
  where id = p_id and status = 'sending';
end;
$$;
