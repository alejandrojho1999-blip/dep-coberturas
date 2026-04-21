-- Ensure causal_results has created_at column (may be missing on older instances)
alter table causal_results
  add column if not exists created_at timestamptz default now();
