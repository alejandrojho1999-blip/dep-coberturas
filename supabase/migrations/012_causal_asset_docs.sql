-- Migration 012: causal_asset_docs table + treatment variable type

-- Table for documents attached to causal assets
CREATE TABLE IF NOT EXISTS causal_asset_docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker        TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users NOT NULL,
  asset_id      UUID REFERENCES causal_assets(id) ON DELETE SET NULL,
  filename      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  doc_type      TEXT CHECK (doc_type IN ('excel', 'word', 'pdf', 'other')),
  extracted_data             JSONB DEFAULT '{}',
  treatment_recommendations  JSONB DEFAULT '[]',
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE causal_asset_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own causal docs"
  ON causal_asset_docs FOR ALL
  USING (auth.uid() = user_id);

-- Extend causal_variables type to include 'treatment'
ALTER TABLE causal_variables DROP CONSTRAINT IF EXISTS causal_variables_type_check;
ALTER TABLE causal_variables ADD CONSTRAINT causal_variables_type_check
  CHECK (type IN ('confounder', 'collider', 'treatment'));

-- Storage bucket causal-docs (run separately via Supabase dashboard or CLI if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('causal-docs', 'causal-docs', false)
-- ON CONFLICT DO NOTHING;
