-- El grupo de control del corpus de calibración.
--
-- El problema que resuelve: los 27 eventos del corpus se eligieron POR HABER
-- SIDO IMPORTANTES, así que casi todos movieron el precio. Con solo esa mitad
-- de la tabla, P(movimiento) sale entre el 50% y el 100% en todos los peldaños
-- y la curva de corrección acaba subiendo la severidad en vez de bajarla:
-- exactamente lo contrario de lo que se buscaba.
--
-- Falta el denominador. Si en un día cualquiera del mercado la probabilidad de
-- que algún activo se mueva es del 55%, entonces un peldaño con el 60% no
-- distingue nada, por muy alto que suene el número en solitario.
--
-- El tramo `placebo` guarda ese denominador: fechas de sesión elegidas al azar,
-- sin hecho detrás y sin que nadie las haya escogido por interesantes. Se
-- miden exactamente igual que los eventos reales, y la diferencia entre las dos
-- proporciones es lo único que se puede llamar señal.
--
-- Va en `severity_events` y no en una tabla aparte a propósito: las mediciones
-- ya cuelgan de `severity_events.id` por clave foránea, y un control que se
-- midiera por otro camino dejaría de ser comparable, que es su única razón de
-- existir.

alter table severity_events
  drop constraint if exists severity_events_tramo_check;

alter table severity_events
  add constraint severity_events_tramo_check
  check (tramo in ('principal', 'control_2014', 'control_shocks', 'placebo'));

comment on column severity_events.tramo is
  'Los tres primeros son hechos curados. `placebo` son fechas al azar sin hecho detrás: el denominador contra el que se mide si un peldaño distingue algo.';

-- La severidad de una fecha del placebo es siempre 1 y no significa «leve»:
-- significa que no hay hecho que puntuar. Se marca en la nota de cada fila.
