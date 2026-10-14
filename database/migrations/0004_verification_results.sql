-- Verification results stored against service cases.

create table verification_results (
  id uuid primary key default gen_random_uuid(),
  service_case_id uuid not null references service_cases(id) on delete cascade,
  target_signature text not null check (target_signature in ('vibration_elevated', 'overheating', 'abnormal_load', 'rpm_deviation')),
  status text not null check (status in ('PASS', 'FAIL', 'INCONCLUSIVE')),
  reason text not null,
  detected_signatures text[] not null default '{}',
  evidence jsonb not null,
  uncertainty text not null,
  created_at timestamptz not null default now()
);

create index verification_results_case_idx on verification_results (service_case_id, created_at, id);
