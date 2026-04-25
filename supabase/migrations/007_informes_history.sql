CREATE TABLE informes_history (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker           text        NOT NULL,
  empresa          text,
  bolsa            text,
  solicitante      text,
  filename         text        NOT NULL,
  informe_numero   integer     NOT NULL DEFAULT 1,
  fecha_generacion timestamptz DEFAULT now() NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE informes_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own history"
  ON informes_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own history"
  ON informes_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own history"
  ON informes_history FOR DELETE
  USING (auth.uid() = user_id);
