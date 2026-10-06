-- NOTE: UNUSED. This was an experiment to store the /console PIN in the
-- database. It was abandoned and is not wired into the app (the login still
-- uses the ADMIN_PIN env var). The table and function exist in the live
-- database only; they can be dropped with:
--   drop function console_pin_check(text); drop table console_pin;
--
-- Console PIN stored in the database as a bcrypt hash, so it can be set and
-- changed from the Supabase SQL editor instead of a Vercel environment
-- variable. The PIN itself is never committed (this repo is public); see the
-- README for the SQL that sets it.
--
-- Until a row exists here, the login falls back to the ADMIN_PIN env var.

create table if not exists console_pin (
  id boolean primary key default true check (id),
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table console_pin enable row level security;
revoke all on console_pin from anon, authenticated;

-- Returns {ok: true} for a correct PIN, otherwise {ok: false, error: ...}
-- where error is 'invalid', 'locked' or 'unset'. Never raises, so the
-- failed-attempt counter is committed rather than rolled back.
create or replace function console_pin_check(p_pin text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.console_pin;
begin
  select * into rec from public.console_pin where id for update;

  if not found then
    return json_build_object('ok', false, 'error', 'unset');
  end if;

  if rec.locked_until is not null and rec.locked_until > now() then
    return json_build_object('ok', false, 'error', 'locked');
  end if;

  if rec.pin_hash <> extensions.crypt(coalesce(p_pin, ''), rec.pin_hash) then
    update public.console_pin
    set failed_attempts = rec.failed_attempts + 1,
        locked_until = case when rec.failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
    where id;
    return json_build_object('ok', false, 'error', 'invalid');
  end if;

  update public.console_pin set failed_attempts = 0, locked_until = null where id;
  return json_build_object('ok', true);
end;
$$;

revoke all on function console_pin_check(text) from public, anon, authenticated;
grant execute on function console_pin_check(text) to anon;
