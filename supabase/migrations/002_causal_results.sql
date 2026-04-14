create table if not exists causal_results (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references causal_assets(id) on delete cascade not null,
  result jsonb not null,
  created_at timestamptz default now() not null
);

alter table causal_results enable row level security;

create policy "users own their results"
  on causal_results
  for all
  using (
    exists (
      select 1 from causal_assets
      where id = causal_results.asset_id
        and user_id = auth.uid()
    )
  );
