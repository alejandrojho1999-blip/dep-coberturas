-- Fecha de cierre de una recomendación.
-- Sin ella no se puede reconstruir la curva de equity de los portafolios ni
-- ordenar el track record: `created_at` solo marca la entrada.
-- Las filas cerradas antes de esta migración quedan en NULL y su fecha se
-- infiere en `src/lib/portafolios/closed-date.ts` (nunca se escribe en BD).
ALTER TABLE agent_recommendations
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;
