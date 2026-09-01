-- Create hkc_doc_records table in public schema
create table if not exists public.hkc_doc_records (
  id text primary key,
  payload jsonb not null default '{}'::jsonb
);

-- Enable RLS and simple policies if needed
alter table public.hkc_doc_records enable row level security;
create policy "Allow all actions for authenticated users" on public.hkc_doc_records for all using (true);
