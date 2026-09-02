-- Calibración de la severidad del clasificador de alertas.
--
-- El clasificador repartía 4 y 5 al 60,9% de las señales porque el prompt
-- puntuaba gravedad humana en vez de efecto en el precio. Estas tablas guardan
-- el patrón oro con el que se corrige: qué eventos históricos se eligieron, qué
-- hizo de verdad el mercado después de cada uno, y qué curva traduce el peldaño
-- del LLM en un peldaño creíble.
--
-- Nada de esto lo escribe el cron: son tablas de trabajo del proceso de
-- calibración, se cargan desde `scripts/calibracion/` y se leen a mano.

-- ── Corpus de eventos ────────────────────────────────────────────────────────
-- El espejo en base de datos de `scripts/calibracion/eventos.ts`. Existe para
-- poder cruzar el corpus con las señales reales sin volver a ejecutar el script.
create table if not exists severity_events (
  id            bigserial primary key,
  fecha         date        not null,
  tramo         text        not null check (tramo in ('principal', 'control_2014', 'control_shocks')),
  tema          text        not null check (tema in ('guerra', 'fed_tesoro')),
  clase         text        not null,
  titulo        text        not null,
  -- Severidad que merecía por efecto de precio, asignada por un analista.
  severidad     smallint    not null check (severidad between 1 and 5),
  nota          text,
  -- Falso mientras la fecha no se haya comprobado contra una fuente. Una fecha
  -- mal puesta corrompe toda la medición y es el error más fácil de cometer.
  verificado    boolean     not null default false,
  created_at    timestamptz not null default now(),
  unique (fecha, titulo)
);

comment on table severity_events is
  'Corpus curado de eventos históricos con la severidad que merecían por efecto de precio, no por gravedad humana.';

create index if not exists severity_events_tramo_idx on severity_events (tramo, tema);

-- ── Movimiento medido tras cada evento ───────────────────────────────────────
create table if not exists severity_event_moves (
  id            bigserial primary key,
  evento_id     bigint      not null references severity_events (id) on delete cascade,
  ticker        text        not null,
  -- Sesiones bursátiles transcurridas desde el cierre previo al hecho.
  ventana       smallint    not null check (ventana > 0),
  -- Retorno de cierre a cierre, en tanto por uno.
  retorno       numeric,
  -- Mayor desplazamiento absoluto alcanzado dentro de la ventana: lo que
  -- importa es si hubo susto en algún momento, no si el viernes ya se deshizo.
  extremo       numeric,
  -- Cierre desde el que se mide. Es el anterior al hecho, no el del día.
  sesion_base   date,
  created_at    timestamptz not null default now(),
  unique (evento_id, ticker, ventana)
);

comment on column severity_event_moves.retorno is
  'Nulo cuando el activo no cotizaba en esa fecha (BTC-USD antes de 2014). Nulo es "no se sabe", nunca cero.';

create index if not exists severity_event_moves_evento_idx on severity_event_moves (evento_id);

-- ── Curva de calibración ─────────────────────────────────────────────────────
-- Traduce el peldaño que sale del LLM al peldaño que se publica, pasando por la
-- probabilidad observada de que el precio se moviera de verdad.
create table if not exists severity_calibration (
  id                bigserial primary key,
  tema              text        not null check (tema in ('guerra', 'fed_tesoro')),
  severidad_llm     smallint    not null check (severidad_llm between 1 and 5),
  -- Frecuencia con la que un evento de este peldaño movió el activo por encima
  -- del umbral material, en tanto por uno.
  p_movimiento      numeric     not null check (p_movimiento between 0 and 1),
  -- Peldaño publicado tras la corrección. La curva debe ser monótona: un
  -- peldaño más alto del LLM nunca puede dar un peldaño final más bajo.
  severidad_final   smallint    not null check (severidad_final between 1 and 5),
  n_eventos         integer     not null default 0,
  ajustada_at       timestamptz not null default now(),
  unique (tema, severidad_llm)
);

comment on table severity_calibration is
  'Curva monótona severidad_llm -> P(movimiento material) -> severidad_final. Se reajusta cuando el corpus crece.';

-- ── Reejecución del clasificador sobre el corpus ─────────────────────────────
-- Guarda qué habría dicho el prompt de hoy sobre los titulares de ayer. Es la
-- única forma de saber si un cambio de prompt mejora o solo mueve el problema.
create table if not exists severity_llm_replay (
  id                bigserial primary key,
  evento_id         bigint      references severity_events (id) on delete cascade,
  -- Etiqueta de la versión del prompt, para poder comparar dos revisiones.
  prompt_version    text        not null,
  modelo            text        not null,
  titular           text        not null,
  severidad_llm     smallint    check (severidad_llm between 1 and 5),
  evento_key        text,
  motivo            text,
  created_at        timestamptz not null default now()
);

create index if not exists severity_llm_replay_version_idx on severity_llm_replay (prompt_version, evento_id);

-- ── Acceso ───────────────────────────────────────────────────────────────────
-- Tablas de trabajo interno: sin RLS abierta, solo la clave de servicio las toca.
alter table severity_events        enable row level security;
alter table severity_event_moves   enable row level security;
alter table severity_calibration   enable row level security;
alter table severity_llm_replay    enable row level security;
