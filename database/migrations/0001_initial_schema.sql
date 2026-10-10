-- Initial schema for machines and service cases.

create table machines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  location text,
  created_at timestamptz not null default now()
);

create table service_cases (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id) on delete restrict,
  status text not null check (status in ('open', 'diagnosing', 'repairing', 'verifying', 'closed')),
  detected_symptom text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((status = 'closed') = (closed_at is not null))
);

create index service_cases_machine_id_idx on service_cases (machine_id);
