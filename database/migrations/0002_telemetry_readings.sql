-- Telemetry readings table and index for machine sensor and simulated data.

create table telemetry_readings (
  id bigserial primary key,
  machine_id uuid not null references machines(id) on delete restrict,
  recorded_at timestamptz not null,
  source text not null check (source in ('simulated', 'sensor')),
  scenario text,
  temperature_c double precision not null,
  vibration_rms_g double precision not null,
  current_a double precision not null,
  rpm double precision not null,
  commanded_rpm double precision,
  data_window_samples integer,
  data_dropout_count integer,
  received_at timestamptz not null default now(),
  check ((source = 'simulated') = (scenario is not null)),
  unique (machine_id, source, recorded_at)
);

create index telemetry_readings_machine_recorded_idx on telemetry_readings (machine_id, recorded_at desc);
