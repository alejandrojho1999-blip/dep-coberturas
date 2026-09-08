-- Memoria de titulares ya clasificados, relevantes o no.
--
-- El problema que resuelve: `cicloGuerra` y `cicloMacro` filtraban los
-- titulares nuevos contra `urlsRecientes`, que leía de `alert_signals`. Pero a
-- `alert_signals` solo llegan los titulares que el modelo marcó `relevante`:
-- los descartados no dejaban rastro en ninguna parte, así que cada dos minutos
-- volvían a pasar por el modelo con el mismo prompt de sistema de ~3.240
-- tokens y la misma respuesta.
--
-- Medido el 2026-09-07 sobre `/var/log/dep-alertas.log`: 1.990 clasificaciones
-- de guerra en un día para unas pocas decenas de titulares distintos. El 94%
-- del gasto en tokens del proyecto era ese bucle.
--
-- Va en tabla aparte y no como fila de `alert_signals` a propósito: una señal
-- es algo que se decidió publicar o silenciar, y tiene severidad, evento y
-- mensaje. Un titular descartado no es nada de eso, y meterlo allí ensuciaría
-- el conteo de `enviadosUltimaHora` y la tabla que lee el panel.
CREATE TABLE IF NOT EXISTS alert_seen_urls (
  url        text PRIMARY KEY,
  tipo       text NOT NULL CHECK (tipo IN ('guerra', 'fed_tesoro')),
  titular    text,
  fuente     text,
  -- Lo que dictaminó el modelo. No se usa para filtrar —da igual el veredicto,
  -- lo ya pagado no se vuelve a pagar— pero permite medir después qué
  -- proporción de la cuota se va en titulares que no eran nada.
  relevante  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- `urlsRecientes` filtra por ventana de 24 h (guerra) o 48 h (macro).
CREATE INDEX IF NOT EXISTS alert_seen_urls_created_idx ON alert_seen_urls (created_at DESC);

-- ── RLS: mismo criterio que la migración 022 ───────────────────────────────
-- Sin políticas de INSERT/UPDATE/DELETE: ningún rol con RLS puede escribir.
-- La clave de servicio del cron no pasa por aquí.
ALTER TABLE alert_seen_urls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solo_el_admin_lee_las_urls_vistas" ON alert_seen_urls;
CREATE POLICY "solo_el_admin_lee_las_urls_vistas" ON alert_seen_urls
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Igual que en las migraciones 021 y 022: revocar de PUBLIC no basta.
REVOKE ALL ON alert_seen_urls FROM anon;

COMMENT ON TABLE alert_seen_urls IS
  'Titulares ya pasados por el clasificador, con veredicto o sin él. Existe para no pagar dos veces la misma clasificación.';
