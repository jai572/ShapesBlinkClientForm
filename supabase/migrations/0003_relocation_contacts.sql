-- Contact details collected from the standalone relocation page, so the salon
-- can message customers the new address.
create table if not exists relocation_contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 200),
  phone text not null check (char_length(btrim(phone)) between 5 and 40),
  email text not null check (char_length(email) <= 320 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

alter table relocation_contacts enable row level security;

-- The public page can submit details but never read, update, or delete them.
-- No read policy yet: the staff view will add one scoped to the admin.
create policy "anon can insert relocation contacts"
  on relocation_contacts for insert
  to anon
  with check (true);
