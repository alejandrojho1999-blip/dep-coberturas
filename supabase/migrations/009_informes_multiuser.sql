ALTER TABLE informes_history ADD COLUMN IF NOT EXISTS user_email text;

DROP POLICY IF EXISTS "Users see own history" ON informes_history;

CREATE POLICY "Authenticated users see all history"
  ON informes_history FOR SELECT
  USING (auth.uid() IS NOT NULL);
