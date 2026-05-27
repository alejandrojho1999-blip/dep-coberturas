-- Lock down broad policies introduced for multi-user informes.
-- Owners keep access to their own rows. Listed admin emails keep operational access.

DROP POLICY IF EXISTS "Authenticated users see all history" ON informes_history;
DROP POLICY IF EXISTS "Users update informes" ON informes_history;
DROP POLICY IF EXISTS "Users see own history" ON informes_history;
DROP POLICY IF EXISTS "Users delete own history" ON informes_history;

CREATE POLICY "Users see own history or admin"
  ON informes_history FOR SELECT
  USING (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'email') IN ('lriofrio915@gmail.com', 'walletserick123@gmail.com')
  );

CREATE POLICY "Users update own history or admin"
  ON informes_history FOR UPDATE
  USING (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'email') IN ('lriofrio915@gmail.com', 'walletserick123@gmail.com')
  )
  WITH CHECK (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'email') IN ('lriofrio915@gmail.com', 'walletserick123@gmail.com')
  );

CREATE POLICY "Users delete own history or admin"
  ON informes_history FOR DELETE
  USING (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'email') IN ('lriofrio915@gmail.com', 'walletserick123@gmail.com')
  );
