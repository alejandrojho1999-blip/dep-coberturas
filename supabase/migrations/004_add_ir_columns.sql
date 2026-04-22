-- Add IR discovery columns and treatment info to causal_assets
alter table causal_assets
  add column if not exists ir_url     text,
  add column if not exists ir_content text,
  add column if not exists treatment  text,
  add column if not exists sector     text;
