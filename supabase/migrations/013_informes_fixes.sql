-- Migration 013: UPDATE RLS policy for informes_history
-- Needed so saveField() (via PATCH API) can update records

CREATE POLICY "Users update informes"
  ON informes_history FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
