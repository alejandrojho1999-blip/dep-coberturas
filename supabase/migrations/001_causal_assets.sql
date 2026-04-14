create table if not exists causal_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  config jsonb not null,
  created_at timestamptz default now() not null,
  last_run_at timestamptz,
  last_score numeric,
  last_signal text check (last_signal in ('AUMENTAR', 'MANTENER', 'REDUCIR'))
);

alter table causal_assets enable row level security;

create policy "users own their assets"
  on causal_assets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
