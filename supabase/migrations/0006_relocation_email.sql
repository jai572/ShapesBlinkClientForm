-- Emailing relocation sign-ups from the gated contacts page.
-- (Applied to the live database in several small pieces; this file is the
-- combined, final state.)
--
-- Sending is a two-step, database-enforced process so nobody is emailed twice:
--   1. relocation_viewer_claim_emails() atomically marks rows 'sending' and
--      returns one row per distinct email address that should be mailed.
--   2. relocation_viewer_mark_emails() records 'sent' or 'failed' afterwards.
-- Rows sharing an email address count as one recipient, EXCEPT addresses used
-- by 3+ different phone numbers: those are not one person's inbox (e.g. staff
-- typing in walk-ins), so they are never emailed and never marked as sent.

alter table relocation_contacts
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_status text check (email_status in ('sending', 'sent', 'failed')),
  add column if not exists email_error text,
  add column if not exists email_claimed_at timestamptz;

-- The public form may only supply the three fields it asks for; it must not
-- be able to pre-mark its own row as already emailed.
revoke insert on relocation_contacts from anon;
grant insert (customer_name, phone, email) on relocation_contacts to anon;

-- Internal: raises unless the token is a live viewer session. Not granted to
-- the API roles; the security-definer functions below call it.
create or replace function relocation_viewer_check(p_token text)
returns void
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
end;
$$;
revoke all on function relocation_viewer_check(text) from public, anon, authenticated;

create or replace function relocation_viewer_session_valid(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.relocation_viewer_sessions s
    where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and s.expires_at > now()
  );
$$;
revoke all on function relocation_viewer_session_valid(text) from public, anon, authenticated;
grant execute on function relocation_viewer_session_valid(text) to anon;

-- The list used by the contacts page. (Replaces relocation_viewer_contacts(),
-- which is left in place, unused, so nothing had to be dropped.) A row counts
-- as emailed if any row with the same address has been.
create or replace function relocation_viewer_contacts_v2(p_token text)
returns table (
  id uuid,
  created_at timestamptz,
  customer_name text,
  phone text,
  email text,
  email_sent_at timestamptz,
  email_status text,
  email_error text,
  dup_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.relocation_viewer_check(p_token);

  return query
  select
    c.id, c.created_at, c.customer_name, c.phone, c.email,
    max(c.email_sent_at) over w,
    c.email_status, c.email_error,
    (count(*) over w)::integer
  from public.relocation_contacts c
  window w as (partition by lower(btrim(c.email)))
  order by (max(c.email_sent_at) over w) is not null,
           coalesce(max(c.email_sent_at) over w, c.created_at) desc;
end;
$$;
grant execute on function relocation_viewer_contacts_v2(text) to anon;

-- Claims the addresses behind p_ids for sending. Skips addresses already
-- emailed or currently being sent (a claim older than 10 minutes counts as
-- abandoned and can be retried). p_resend overrides that and re-claims.
create or replace function relocation_viewer_claim_emails(p_token text, p_ids uuid[], p_resend boolean default false)
returns table (id uuid, customer_name text, email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.relocation_viewer_check(p_token);

  if coalesce(array_length(p_ids, 1), 0) = 0 then
    return;
  end if;
  if array_length(p_ids, 1) > 100 then
    raise exception 'too_many_ids' using errcode = '22023';
  end if;

  return query
  with picked as (
    select distinct lower(btrim(c.email)) as k
    from public.relocation_contacts c
    where c.id = any (p_ids)
  ),
  claimed as (
    update public.relocation_contacts c
    set email_status = 'sending', email_claimed_at = now(), email_error = null
    where lower(btrim(c.email)) in (select k from picked)
      -- An address shared by 3+ different phone numbers is not one person's
      -- inbox. Never email it or mark anyone as sent.
      and (
        select count(distinct s.phone)
        from public.relocation_contacts s
        where lower(btrim(s.email)) = lower(btrim(c.email))
      ) < 3
      and (
        p_resend
        or (
          c.email_sent_at is null
          and (
            c.email_status is null
            or c.email_status = 'failed'
            or (c.email_status = 'sending' and c.email_claimed_at < now() - interval '10 minutes')
          )
          and not exists (
            select 1 from public.relocation_contacts s
            where lower(btrim(s.email)) = lower(btrim(c.email)) and s.email_sent_at is not null
          )
        )
      )
    returning c.id, c.customer_name, c.email, c.created_at
  )
  select distinct on (lower(btrim(cl.email))) cl.id, cl.customer_name, cl.email
  from claimed cl
  order by lower(btrim(cl.email)), cl.created_at;
end;
$$;
revoke all on function relocation_viewer_claim_emails(text, uuid[], boolean) from public, anon, authenticated;
grant execute on function relocation_viewer_claim_emails(text, uuid[], boolean) to anon;

-- Records the outcome for one recipient (p_id as returned by the claim),
-- applying it to every row that shares the address.
create or replace function relocation_viewer_mark_emails(p_token text, p_id uuid, p_ok boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.relocation_viewer_check(p_token);

  update public.relocation_contacts c
  set email_status = case when p_ok then 'sent' else 'failed' end,
      email_sent_at = case when p_ok then now() else null end,
      email_error = case when p_ok then null else left(coalesce(p_error, 'Unknown error'), 300) end
  where c.email_status = 'sending'
    and lower(btrim(c.email)) = (
      select lower(btrim(r.email)) from public.relocation_contacts r where r.id = p_id
    );
end;
$$;
revoke all on function relocation_viewer_mark_emails(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function relocation_viewer_mark_emails(text, uuid, boolean, text) to anon;
