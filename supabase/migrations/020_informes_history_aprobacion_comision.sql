-- Decisión del CEO sobre cada recomendación y estado de cobro de la comisión.
--
-- `estado` (migración 011) es el estado OPERATIVO de la posición: 'Vender'
-- cierra la operación y fija `precio_venta`. La decisión del CEO —aprobar,
-- rechazar o dejar en observación— es otra cosa y necesita su propia columna;
-- meterla en `estado` cerraría posiciones al rechazar una recomendación.
--
-- El flujo real: el usuario genera el informe, escribe `precio_compra` y la
-- fila queda 'Revision' hasta que el CEO se pronuncia de palabra y el usuario
-- lo registra aquí. `aprobacion_at` guarda cuándo, que es lo que permite medir
-- el rendimiento de las rechazadas desde el día en que se dijo que no.
--
-- La comisión no se almacena: se deriva de la ganancia y del porcentaje que el
-- operador teclea en la interfaz. Pero SI se cobró, y por cuánto, es un hecho
-- contable: `comision_cobrada_monto` congela el importe del día del cobro para
-- que cambiar el porcentaje después no reescriba el pasado.
ALTER TABLE informes_history
  ADD COLUMN IF NOT EXISTS aprobacion text DEFAULT 'Revision'
    CHECK (aprobacion IN ('Revision','Aprobada','Rechazada','Observacion')),
  ADD COLUMN IF NOT EXISTS aprobacion_at timestamptz,
  ADD COLUMN IF NOT EXISTS comision_cobrada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comision_cobrada_at timestamptz,
  ADD COLUMN IF NOT EXISTS comision_cobrada_monto numeric;

-- Las filas anteriores a esta migración no tienen decisión registrada.
UPDATE informes_history SET aprobacion = 'Revision' WHERE aprobacion IS NULL;
