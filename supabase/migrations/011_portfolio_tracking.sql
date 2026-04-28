ALTER TABLE informes_history
  ADD COLUMN IF NOT EXISTS precio_compra             decimal(18,4),
  ADD COLUMN IF NOT EXISTS cantidad_acciones         decimal(18,4),
  ADD COLUMN IF NOT EXISTS precio_objetivo_personal  decimal(18,4),
  ADD COLUMN IF NOT EXISTS estado                    text DEFAULT 'Observacion'
    CHECK (estado IN ('Comprar','Mantener','Vender','Observacion')),
  ADD COLUMN IF NOT EXISTS precio_venta              decimal(18,4);
