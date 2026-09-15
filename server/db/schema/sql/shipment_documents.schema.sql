-- SQL DDL schema for Shipment Documents
-- Run this in the Supabase SQL editor to create the required tables.

-- 1. Create shipment_documents table
create table if not exists public.shipment_documents (
  id text primary key,
  record_id text not null,
  record_type text not null,
  document_type text not null,
  file_name text not null,
  file_size numeric not null default 1024,
  file_url text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS and setup permissive authenticated policies
alter table public.shipment_documents enable row level security;

drop policy if exists "shipment_documents authenticated read" on public.shipment_documents;
drop policy if exists "shipment_documents authenticated insert" on public.shipment_documents;
drop policy if exists "shipment_documents authenticated update" on public.shipment_documents;
drop policy if exists "shipment_documents authenticated delete" on public.shipment_documents;

create policy "shipment_documents authenticated read" on public.shipment_documents for select to authenticated using (true);
create policy "shipment_documents authenticated insert" on public.shipment_documents for insert to authenticated with check (true);
create policy "shipment_documents authenticated update" on public.shipment_documents for update to authenticated using (true) with check (true);
create policy "shipment_documents authenticated delete" on public.shipment_documents for delete to authenticated using (true);

-- Grant privileges
grant select, insert, update, delete on public.shipment_documents to authenticated;
grant select, insert, update, delete on public.shipment_documents to service_role;


-- 2. Create shipment_document_officers table (optional, for persistent officer assignment)
create table if not exists public.shipment_document_officers (
  record_id text primary key,
  assigned_employee_id text,
  assigned_employee_name text not null,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipment_document_officers enable row level security;

drop policy if exists "shipment_document_officers authenticated read" on public.shipment_document_officers;
drop policy if exists "shipment_document_officers authenticated insert" on public.shipment_document_officers;
drop policy if exists "shipment_document_officers authenticated update" on public.shipment_document_officers;
drop policy if exists "shipment_document_officers authenticated delete" on public.shipment_document_officers;

create policy "shipment_document_officers authenticated read" on public.shipment_document_officers for select to authenticated using (true);
create policy "shipment_document_officers authenticated insert" on public.shipment_document_officers for insert to authenticated with check (true);
create policy "shipment_document_officers authenticated update" on public.shipment_document_officers for update to authenticated using (true) with check (true);
create policy "shipment_document_officers authenticated delete" on public.shipment_document_officers for delete to authenticated using (true);

grant select, insert, update, delete on public.shipment_document_officers to authenticated;
grant select, insert, update, delete on public.shipment_document_officers to service_role;
