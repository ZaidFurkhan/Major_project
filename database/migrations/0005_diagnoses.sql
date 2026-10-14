-- Diagnosis records stored against service cases.

create table diagnoses (
  id uuid primary key default gen_random_uuid(),
  service_case_id uuid not null references service_cases(id) on delete cascade,
  status text not null check (status in ('diagnosed', 'inconclusive')),
  signatures text[] not null default '{}',
  candidates jsonb not null,
  data_sources text[] not null default '{}',
  uncertainty text not null,
  created_at timestamptz not null default now()
);

create index diagnoses_case_idx on diagnoses (service_case_id, created_at, id);
