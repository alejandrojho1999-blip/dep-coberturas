create table if not exists causal_variables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  variable text not null,
  type text check (type in ('confounder', 'collider')) not null,
  source text check (source in ('auto', 'manual')) not null,
  label text,
  rationale text,
  created_at timestamptz default now() not null,
  unique (user_id, ticker, variable, type)
);

alter table causal_variables enable row level security;

create policy "usuarios ven sus variables"
  on causal_variables for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
