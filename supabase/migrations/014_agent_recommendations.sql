CREATE TABLE IF NOT EXISTS agent_recommendations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker            text        NOT NULL,
  empresa           text,
  category          text        NOT NULL,
  precio_entrada    numeric,
  precio_objetivo   numeric,
  stop_loss         numeric,
  precio_venta      numeric,
  cantidad_acciones numeric,
  direction         text        DEFAULT 'COMPRA',
  riesgo            text,
  timeframe         text,
  resumen           text,
  ai_report         jsonb,
  score             numeric,
  market_cap_m      numeric,
  estado            text        DEFAULT 'Comprar',
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE agent_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_data" ON agent_recommendations
  FOR ALL
  USING (auth.uid() = user_id);
