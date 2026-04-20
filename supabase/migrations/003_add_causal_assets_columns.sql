alter table causal_assets
  add column if not exists last_run_at  timestamptz,
  add column if not exists last_score   numeric,
  add column if not exists last_signal  text check (last_signal in ('AUMENTAR', 'MANTENER', 'REDUCIR'));
