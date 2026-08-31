-- Sistema de alerta temprana: señales de noticias y foto macro.
--
-- Estas tablas las escribe el motor de alertas, que corre como tarea del
-- servidor con la clave de servicio y por tanto se salta RLS. Nadie más
-- escribe: desde la aplicación solo se leen, y solo el administrador.
--
-- No llevan `user_id` —igual que `options_chain_snapshots` de la migración
-- 019— porque no son datos de una cuenta sino el registro de lo que el sistema
-- observó y envió. La frontera aquí no es el usuario, es `is_admin()`.

-- ── Señales enviadas (o descartadas) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_signals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           text NOT NULL CHECK (tipo IN ('guerra', 'fed_tesoro', 'tasas', 'debasement')),
  severidad      smallint NOT NULL CHECK (severidad BETWEEN 1 AND 5),
  evento_key     text NOT NULL,
  titular        text NOT NULL,
  url            text,
  fuente         text,
  resumen        text,
  published_at   timestamptz,
  -- Niveles del activo principal de la señal. Los demás activos citados en el
  -- mensaje viajan en `payload.niveles`, que es donde el panel los lee.
  simbolo        text,
  precio_ref     numeric,
  direccion      text CHECK (direccion IN ('buy', 'sell')),
  nivel_stop     numeric,
  atr            numeric,
  mercado_abierto boolean,
  mensaje        text NOT NULL,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  enviado_at     timestamptz,
  error_envio    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_signals_created_idx ON alert_signals (created_at DESC);
CREATE INDEX IF NOT EXISTS alert_signals_evento_idx  ON alert_signals (evento_key);

-- ── Estado de deduplicación ────────────────────────────────────────────────
-- Una fila por suceso, no por titular: es lo que impide que veinte medios
-- contando lo mismo generen veinte mensajes.
CREATE TABLE IF NOT EXISTS alert_dedupe (
  evento_key     text PRIMARY KEY,
  primera_vez    timestamptz NOT NULL DEFAULT now(),
  ultima_vez     timestamptz NOT NULL DEFAULT now(),
  max_severidad  smallint NOT NULL DEFAULT 1,
  veces          integer NOT NULL DEFAULT 1
);

-- ── Foto macro periódica ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS macro_snapshots (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tomado_at          timestamptz NOT NULL DEFAULT now(),
  reunion_ref        date,
  contrato           text,
  precio_contrato    numeric,
  tasa_actual        numeric,
  tasa_implicita     numeric,
  prob_subida        numeric,
  prob_mantener      numeric,
  prob_bajada        numeric,
  aproximado         boolean NOT NULL DEFAULT false,
  debasement         jsonb NOT NULL DEFAULT '{}'::jsonb,
  nota               text
);

CREATE INDEX IF NOT EXISTS macro_snapshots_tomado_idx ON macro_snapshots (tomado_at DESC);

-- ── RLS: lectura solo del administrador, escritura solo del servicio ───────
-- Sin políticas de INSERT/UPDATE/DELETE: ningún rol con RLS puede escribir.
-- La clave de servicio del cron no pasa por aquí.
ALTER TABLE alert_signals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_dedupe    ENABLE ROW LEVEL SECURITY;
ALTER TABLE macro_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solo_el_admin_lee_las_senales" ON alert_signals;
CREATE POLICY "solo_el_admin_lee_las_senales" ON alert_signals
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "solo_el_admin_lee_el_dedupe" ON alert_dedupe;
CREATE POLICY "solo_el_admin_lee_el_dedupe" ON alert_dedupe
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "solo_el_admin_lee_la_foto_macro" ON macro_snapshots;
CREATE POLICY "solo_el_admin_lee_la_foto_macro" ON macro_snapshots
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- El rol anónimo no tiene nada que hacer aquí. Igual que en la migración 021,
-- revocar de PUBLIC no basta: hay que revocar nominalmente de `anon`.
REVOKE ALL ON alert_signals, alert_dedupe, macro_snapshots FROM anon;
