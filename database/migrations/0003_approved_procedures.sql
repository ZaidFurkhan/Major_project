-- Approved repair procedures and ordered repair steps.

create table repair_procedures (
  id uuid primary key default gen_random_uuid(),
  fault_signature text not null check (fault_signature in ('vibration_elevated', 'overheating', 'abnormal_load', 'rpm_deviation')),
  title text not null,
  source_reference text not null,
  status text not null check (status in ('draft', 'approved')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'approved') = (approved_at is not null))
);

create table repair_steps (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references repair_procedures(id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  instruction text not null,
  source_location text not null,
  unique (procedure_id, step_order)
);

create index repair_procedures_signature_status_idx on repair_procedures (fault_signature, status);
