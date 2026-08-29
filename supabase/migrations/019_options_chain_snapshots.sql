-- Archivo diario de cadenas de opciones.
--
-- El backtest de Gamma y Theta tuvo que reconstruir las primas con
-- Black-Scholes porque no existe histórico gratuito de cadenas: el endpoint de
-- Yahoo solo devuelve la viva. Eso obligó a modelar la volatilidad implícita, y
-- ese supuesto es justo la capa que decide si los agentes ganan — con lo cual el
-- estudio no puede responder si la selección de volatilidad aporta algo.
--
-- Esta tabla es la salida de ese callejón: grabando la cadena cada día, dentro
-- de doce a dieciocho meses habrá un histórico REAL, sin proxies y sin sesgo de
-- reconstrucción. No sirve de nada hoy y por eso conviene empezar cuanto antes.
--
-- Un snapshot es una fila por ticker y día de mercado, con los contratos en un
-- array JSONB. Se guarda así y no una fila por contrato porque son ~600
-- contratos por ticker y día: en filas serían decenas de millones al año, con un
-- índice enorme, para un dato que siempre se lee entero y por ticker.

CREATE TABLE IF NOT EXISTS options_chain_snapshots (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Fecha de mercado en Nueva York, no la del servidor. Un cron que corre a las
  -- 21:05 UTC está en el día siguiente en Europa y archivaría la sesión con
  -- fecha equivocada.
  fecha         date        NOT NULL,
  ticker        text        NOT NULL,
  -- Precio del subyacente en el momento de la captura: sin él los contratos no
  -- se pueden situar en moneyness ni recalcular griegas.
  spot          numeric     NOT NULL,
  -- Contratos en formato compacto. Cada uno es una tupla posicional:
  --   [tipo, strike, vencimiento, bid, ask, iv, delta, openInterest, volume]
  -- El orden lo fija `CAMPOS_CONTRATO` en `src/lib/options/chain-archive.ts`, y
  -- hay un test que impide cambiarlo sin darse cuenta: las filas ya guardadas no
  -- se pueden reinterpretar.
  --
  -- Guardar tuplas y no objetos reduce el tamaño un 94 % (647 kB → 40 kB en
  -- SPY), porque el nombre de cada campo se repetía en cada contrato.
  contratos     jsonb       NOT NULL,
  n_contratos   integer     NOT NULL,
  -- Qué se descartó al filtrar, para que dentro de un año se sepa qué hay y qué
  -- no sin tener que leer el código de entonces.
  filtro        jsonb       NOT NULL,
  capturado_en  timestamptz NOT NULL DEFAULT now(),

  -- Un solo snapshot por ticker y sesión: repetir la captura debe sobrescribir,
  -- no acumular duplicados que falsearían cualquier recuento.
  CONSTRAINT options_chain_snapshots_unicos UNIQUE (fecha, ticker)
);

-- El acceso natural es "dame la serie de este ticker" y "dame todo lo de este
-- día". La clave única ya cubre el primero por su prefijo; este índice cubre el
-- segundo.
CREATE INDEX IF NOT EXISTS options_chain_snapshots_fecha_idx
  ON options_chain_snapshots (fecha DESC);

ALTER TABLE options_chain_snapshots ENABLE ROW LEVEL SECURITY;

-- Mismo criterio que `agent_recommendations` tras la migración 018: lo lee
-- cualquier usuario autenticado, lo escribe solo el administrador. El cron no
-- pasa por aquí —usa la clave de servicio, que salta RLS—, así que estas
-- políticas gobiernan únicamente lo que llega desde el navegador.
CREATE POLICY "todos_leen_las_cadenas"
  ON options_chain_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "solo_el_admin_escribe_cadenas"
  ON options_chain_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "solo_el_admin_actualiza_cadenas"
  ON options_chain_snapshots FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "solo_el_admin_borra_cadenas"
  ON options_chain_snapshots FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE options_chain_snapshots IS
  'Archivo diario de cadenas de opciones. Alimenta el backtest futuro de Gamma y '
  'Theta con datos reales en vez de primas reconstruidas con Black-Scholes.';
