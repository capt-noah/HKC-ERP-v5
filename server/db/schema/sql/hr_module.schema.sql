-- HR module schema patch for the JSONB-backed HKC ERP API.
-- Run this in the Supabase SQL editor if HR endpoints return PGRST205
-- for attendance_records, payroll_periods, or payroll_records.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_hkc_document_table(table_name text)
returns void
language plpgsql
as $$
begin
  execute format(
    'create table if not exists public.%I (
      id text primary key,
      payload jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )',
    table_name
  );

  execute format('alter table public.%I enable row level security', table_name);

  execute format('drop trigger if exists set_updated_at on public.%I', table_name);
  execute format(
    'create trigger set_updated_at
      before update on public.%I
      for each row execute function public.set_updated_at()',
    table_name
  );

  execute format('drop policy if exists "%s authenticated read" on public.%I', table_name, table_name);
  execute format('drop policy if exists "%s authenticated insert" on public.%I', table_name, table_name);
  execute format('drop policy if exists "%s authenticated update" on public.%I', table_name, table_name);
  execute format('drop policy if exists "%s authenticated delete" on public.%I', table_name, table_name);

  execute format('create policy "%s authenticated read" on public.%I for select to authenticated using (true)', table_name, table_name);
  execute format('create policy "%s authenticated insert" on public.%I for insert to authenticated with check (true)', table_name, table_name);
  execute format('create policy "%s authenticated update" on public.%I for update to authenticated using (true) with check (true)', table_name, table_name);
  execute format('create policy "%s authenticated delete" on public.%I for delete to authenticated using (true)', table_name, table_name);

  execute format('revoke all on public.%I from anon', table_name);
  execute 'grant usage on schema public to authenticated';
  execute 'grant usage on schema public to service_role';
  execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
end;
$$;

select public.create_hkc_document_table(table_name)
from (
  values
    ('employees'),
    ('attendance_records'),
    ('leave_requests'),
    ('payroll_periods'),
    ('payroll_records')
) as tables(table_name);

create unique index if not exists employees_employee_number_unique
  on public.employees ((payload->>'employee_number'))
  where payload ? 'employee_number';

create unique index if not exists employees_duplicate_details_unique
  on public.employees (
    lower(trim(payload->>'full_name')),
    lower(trim(coalesce(payload->>'phone', ''))),
    lower(trim(coalesce(payload->>'email', ''))),
    coalesce(payload->>'date_of_birth', ''),
    lower(trim(coalesce(payload->>'gender', ''))),
    lower(trim(coalesce(payload->>'warehouse_id', ''))),
    lower(trim(coalesce(payload->>'employment_type', ''))),
    coalesce(payload->>'start_date', ''),
    coalesce(payload->>'basic_salary', ''),
    lower(trim(coalesce(payload->>'bank_account', ''))),
    lower(trim(coalesce(payload->>'emergency_contact_name', ''))),
    lower(trim(coalesce(payload->>'emergency_contact_phone', '')))
  )
  where payload ? 'full_name' and payload ? 'phone' and payload ? 'date_of_birth';

create unique index if not exists attendance_employee_date_unique
  on public.attendance_records ((payload->>'employee_id'), (payload->>'attendance_date'))
  where payload ? 'employee_id' and payload ? 'attendance_date';

create unique index if not exists payroll_record_period_employee_unique
  on public.payroll_records ((payload->>'payroll_period_id'), (payload->>'employee_id'))
  where payload ? 'payroll_period_id' and payload ? 'employee_id';

create unique index if not exists payroll_period_month_year_unique
  on public.payroll_periods ((payload->>'month'), (payload->>'year'))
  where payload ? 'month' and payload ? 'year' and coalesce(payload->>'status', '') <> 'Cancelled';

create index if not exists leave_requests_employee_status_idx
  on public.leave_requests ((payload->>'employee_id'), (payload->>'status'));

create index if not exists payroll_records_period_status_idx
  on public.payroll_records ((payload->>'payroll_period_id'), (payload->>'payment_status'));

update public.employees
set payload = jsonb_set(payload, '{national_id_image}', '""'::jsonb, true)
where length(coalesce(payload->>'national_id_image', '')) > 250000;

drop function public.create_hkc_document_table(text);

notify pgrst, 'reload schema';
