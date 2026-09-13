-- Consultation records
create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  mobile text not null,
  address text,
  medical_conditions text[] not null default '{}',
  treatment_name text not null,
  been_to_salon boolean not null default false,
  patch_test_status boolean not null default false,
  no_patch_consent boolean,
  recipient_name text not null,
  signed_date date not null,
  signature_path text not null
);

alter table consultations enable row level security;

-- The public intake form can create records but never read, update, or delete them.
create policy "anon can insert consultations"
  on consultations for insert
  to anon
  with check (true);

-- Only signed-in admins (Supabase Auth users) can view the vault.
create policy "authenticated can read consultations"
  on consultations for select
  to authenticated
  using (true);

-- Signature images, stored outside the database row.
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

create policy "anon can upload signatures"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'signatures');

create policy "authenticated can read signatures"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'signatures');
