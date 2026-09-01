-- Pulso público: atención medible y textos crudos que alimentan la alerta temprana.
--
-- El sistema de alertas de la migración 022 es reactivo: espera a que un medio
-- publique un titular. Esto añade la capa anterior, la que se puede medir antes
-- de que la noticia exista: qué se busca en Google, qué se consulta en
-- Wikipedia, qué se comenta en foros y redes, y con qué volumen. Es materia
-- prima numérica, no señales; nada de esto se envía al teléfono.
--
-- Igual que `alert_signals` y `options_chain_snapshots`, estas tablas no llevan
-- `user_id`: no son datos de una cuenta sino el registro de lo que el sistema
-- observó. La frontera es `is_admin()`. Las escribe el cron del servidor con la
-- clave de servicio, que no pasa por RLS.

-- ── Series numéricas de atención ────────────────────────────────────────────
-- Una fila por medición: "el término X valía N en la fuente F a las H".
--
-- `clave` existe porque conviven dos frecuencias. Las tendencias de búsqueda
-- cambian dentro del día y cada lectura es un dato nuevo: van con `clave` NULL.
-- Las visitas de Wikipedia son un cierre diario y el recolector las verá 48
-- veces al día: llevan `wikipedia:NATO:2026-08-31` y el segundo intento choca
-- contra el índice único y se descarta. En Postgres los NULL no colisionan
-- entre sí, así que una sola columna sirve para los dos casos.
CREATE TABLE IF NOT EXISTS pulse_observations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente       text NOT NULL CHECK (fuente IN ('trends', 'wikipedia', 'hn', 'mastodon', 'youtube', 'news')),
  geo          text,
  termino      text NOT NULL,
  valor        numeric NOT NULL,
  unidad       text NOT NULL,
  clave        text UNIQUE,
  metadatos    jsonb NOT NULL DEFAULT '{}',
  capturado_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pulse_observations_capturado_idx
  ON pulse_observations (capturado_at DESC);
CREATE INDEX IF NOT EXISTS pulse_observations_serie_idx
  ON pulse_observations (fuente, termino, capturado_at DESC);

-- ── Textos crudos ───────────────────────────────────────────────────────────
-- Los titulares y títulos de vídeo se guardan aparte porque su unidad no es un
-- número sino una frase: de aquí salen las palabras clave. La deduplicación es
-- por URL normalizada, la misma regla que usa `rss.ts`, para que la misma
-- noticia repetida por cinco agregadores cuente una vez.
CREATE TABLE IF NOT EXISTS pulse_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente       text NOT NULL CHECK (fuente IN ('trends', 'wikipedia', 'hn', 'mastodon', 'youtube', 'news')),
  tema         text,
  geo          text,
  titulo       text NOT NULL,
  url          text NOT NULL,
  url_norm     text NOT NULL UNIQUE,
  publicado_at timestamptz,
  capturado_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pulse_documents_capturado_idx
  ON pulse_documents (capturado_at DESC);
CREATE INDEX IF NOT EXISTS pulse_documents_tema_idx
  ON pulse_documents (tema, capturado_at DESC);

-- ── Palabras clave emergentes del día ───────────────────────────────────────
-- Lo que queda tras contar n-gramas y compararlos con su propia línea base.
-- `relevancia`, `tema` y `resumen` los rellena el juez LLM en un segundo paso;
-- son NULL mientras solo hay estadística.
CREATE TABLE IF NOT EXISTS pulse_keywords (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia         date NOT NULL,
  termino     text NOT NULL,
  fuentes     text[] NOT NULL DEFAULT '{}',
  menciones   integer NOT NULL,
  z_score     numeric NOT NULL,
  relevancia  smallint CHECK (relevancia BETWEEN 1 AND 5),
  tema        text,
  resumen     text,
  ejemplo_url text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dia, termino)
);

CREATE INDEX IF NOT EXISTS pulse_keywords_dia_idx ON pulse_keywords (dia DESC, z_score DESC);

-- ── Vector diario de entrada al modelo ──────────────────────────────────────
-- `n_fuentes` se guarda a propósito: si un día se cayeron tres fuentes, la
-- probabilidad de ese día tiene que poder marcarse como floja en vez de
-- presentarse como si nada hubiera pasado.
CREATE TABLE IF NOT EXISTS risk_features (
  dia        date PRIMARY KEY,
  vector     jsonb NOT NULL,
  n_fuentes  smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Etiquetas de lo que de verdad ocurrió ───────────────────────────────────
-- `mercado` se calcula solo desde los cierres; `geopolitico` lo puntúa el LLM
-- sobre hechos ya publicados. `detalle` guarda con qué se decidió, porque una
-- etiqueta que no se puede auditar contamina el modelo en silencio.
CREATE TABLE IF NOT EXISTS risk_labels (
  dia        date NOT NULL,
  modelo     text NOT NULL CHECK (modelo IN ('mercado', 'geopolitico')),
  etiqueta   smallint NOT NULL CHECK (etiqueta IN (0, 1)),
  detalle    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia, modelo)
);

-- ── Modelos entrenados ──────────────────────────────────────────────────────
-- Cada entrenamiento deja una fila. Solo uno por modelo puede estar activo, y
-- solo se activa si mejora al vigente fuera de muestra.
CREATE TABLE IF NOT EXISTS risk_models (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo        text NOT NULL CHECK (modelo IN ('mercado', 'geopolitico')),
  entrenado_at  timestamptz NOT NULL DEFAULT now(),
  features      text[] NOT NULL,
  coeficientes  jsonb NOT NULL,
  metricas      jsonb NOT NULL DEFAULT '{}',
  activo        boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS risk_models_activo_idx
  ON risk_models (modelo) WHERE activo;

-- ── Predicciones ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_predictions (
  dia            date NOT NULL,
  modelo         text NOT NULL CHECK (modelo IN ('mercado', 'geopolitico')),
  probabilidad   numeric NOT NULL CHECK (probabilidad BETWEEN 0 AND 1),
  model_id       uuid REFERENCES risk_models (id) ON DELETE SET NULL,
  contribuciones jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia, modelo)
);

-- ── RLS: lectura solo del administrador, escritura solo del servicio ────────
-- Sin políticas de INSERT/UPDATE/DELETE: ningún rol con RLS puede escribir.
ALTER TABLE pulse_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_keywords     ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_features      ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_labels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_models        ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_predictions   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solo_el_admin_lee_el_pulso" ON pulse_observations;
CREATE POLICY "solo_el_admin_lee_el_pulso" ON pulse_observations
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "solo_el_admin_lee_los_documentos" ON pulse_documents;
CREATE POLICY "solo_el_admin_lee_los_documentos" ON pulse_documents
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "solo_el_admin_lee_las_claves" ON pulse_keywords;
CREATE POLICY "solo_el_admin_lee_las_claves" ON pulse_keywords
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "solo_el_admin_lee_las_features" ON risk_features;
CREATE POLICY "solo_el_admin_lee_las_features" ON risk_features
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "solo_el_admin_lee_las_etiquetas" ON risk_labels;
CREATE POLICY "solo_el_admin_lee_las_etiquetas" ON risk_labels
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "solo_el_admin_lee_los_modelos" ON risk_models;
CREATE POLICY "solo_el_admin_lee_los_modelos" ON risk_models
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "solo_el_admin_lee_las_predicciones" ON risk_predictions;
CREATE POLICY "solo_el_admin_lee_las_predicciones" ON risk_predictions
  FOR SELECT TO authenticated USING (public.is_admin());

-- El rol anónimo no tiene nada que hacer aquí. Revocar de PUBLIC no basta:
-- hay que revocar nominalmente de `anon`, igual que en las migraciones 021 y 022.
REVOKE ALL ON
  pulse_observations, pulse_documents, pulse_keywords,
  risk_features, risk_labels, risk_models, risk_predictions
FROM anon;
