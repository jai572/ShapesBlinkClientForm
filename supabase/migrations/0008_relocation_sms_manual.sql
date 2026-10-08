-- Tap-to-text: send the queued texts by hand from any phone, one person at a
-- time. No extra apps and no SMS permission: the portal opens the phone's own
-- Messages app with the text already written, and a person presses send.
--
-- Uses the same relocation_sms table as the phone-script route, with
-- manual = true. The phone-script gateway ignores manual rows (and vice
-- versa), so a text can never be sent twice by the two routes.
-- (Applied to the live database in two pieces plus the functions replaced
-- below; this file is the combined final state.)

alter table relocation_sms add column if not exists manual boolean not null default false;

-- Queue personalised texts for tap-to-text. Same rules as relocation_viewer_queue_sms:
-- the number comes from the contact, one text per number, already texted/queued skipped.
create or replace function relocation_viewer_queue_manual_sms(p_token text, p_messages jsonb)
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
  if v_total > 400 then
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
    insert into public.relocation_sms (contact_id, to_number, body, manual)
    select r.contact_id, r.to_number, r.body, true
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

-- The next person to text (oldest first), with progress. Reading it changes nothing,
-- so closing the page and coming back resumes exactly where you left off.
create or replace function relocation_viewer_manual_sms_next(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
begin
  perform public.relocation_viewer_check(p_token);
  select s.id, s.to_number, s.body, c.customer_name into v
  from public.relocation_sms s
  left join public.relocation_contacts c on c.id = s.contact_id
  where s.manual and s.status = 'queued'
  order by s.created_at, s.id
  limit 1;
  return json_build_object(
    'message', case when found then json_build_object('id', v.id, 'to', v.to_number, 'body', v.body, 'name', coalesce(v.customer_name, '')) else null end,
    'waiting', (select count(*) from public.relocation_sms s where s.manual and s.status = 'queued'),
    'done', (select count(*) from public.relocation_sms s where s.manual and s.status = 'sent')
  );
end;
$$;

-- "I sent it" (sent), "skip this person" (skip -> cancelled, can be queued again later),
-- or take back a mis-tap (undo: only a text marked sent in the last 5 minutes goes back
-- to the front of the waiting list).
create or replace function relocation_viewer_manual_sms_result(p_token text, p_id uuid, p_action text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.relocation_viewer_check(p_token);
  if p_action not in ('sent', 'skip', 'undo') then
    raise exception 'bad_action' using errcode = '22023';
  end if;

  if p_action = 'undo' then
    update public.relocation_sms
    set status = 'queued', claimed_at = null, sent_at = null
    where id = p_id and manual and status = 'sent' and sent_at > now() - interval '5 minutes';
  else
    update public.relocation_sms
    set status = case when p_action = 'sent' then 'sent' else 'cancelled' end,
        claimed_at = case when p_action = 'sent' then now() else claimed_at end,
        sent_at = case when p_action = 'sent' then now() else null end
    where id = p_id and manual and status = 'queued';
  end if;

  return json_build_object(
    'waiting', (select count(*) from public.relocation_sms s where s.manual and s.status = 'queued'),
    'done', (select count(*) from public.relocation_sms s where s.manual and s.status = 'sent')
  );
end;
$$;

-- relocation_viewer_sms_overview() gains 'manual_waiting' and its hourly figure
-- ignores manual rows; relocation_sms_gateway_next() skips manual rows. Both
-- were replaced in place; see 0007 for their full text with those two changes.
