-- Archivos que el usuario aporta como fuente de verdad de una tesis de
-- inversión: Excel, Word o PDF con las cifras del emisor.
--
-- El problema que resuelve `lote_id`: los adjuntos se suben ANTES de que exista
-- la fila en `informes_history` —hay que leerlos para poder generar el
-- documento—, así que ni el path ni la fila pueden colgar del id del informe.
-- El cliente genera un lote al abrir el formulario, sube contra él, y al
-- terminar la generación se sella `informe_id`. Dos tesis del mismo ticker el
-- mismo día no colisionan porque el lote es distinto.

CREATE TABLE IF NOT EXISTS informe_adjuntos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lote_id         uuid NOT NULL,
  ticker          text NOT NULL,
  -- Se rellena tras generar. Nulo mientras el lote está en curso, y también en
  -- los lotes que el usuario subió y nunca llegó a usar.
  informe_id      uuid REFERENCES informes_history(id) ON DELETE SET NULL,
  filename        text NOT NULL,
  storage_path    text NOT NULL,
  doc_type        text NOT NULL CHECK (doc_type IN ('excel', 'word', 'pdf', 'csv', 'other')),
  size_bytes      integer NOT NULL DEFAULT 0,
  -- El texto extraído se guarda para poder comprobar después que cada cifra de
  -- la tesis está de verdad en el archivo que dice citarla.
  texto_extraido  text,
  chars_extraidos integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS informe_adjuntos_lote_idx    ON informe_adjuntos (user_id, lote_id);
CREATE INDEX IF NOT EXISTS informe_adjuntos_informe_idx ON informe_adjuntos (informe_id);

ALTER TABLE informe_adjuntos ENABLE ROW LEVEL SECURITY;

-- Con WITH CHECK, para que nadie pueda insertar filas a nombre de otro.
DROP POLICY IF EXISTS "Users own informe adjuntos" ON informe_adjuntos;
CREATE POLICY "Users own informe adjuntos" ON informe_adjuntos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bucket privado, 10 MB por archivo. No se reutiliza `informes-docx`: aquel
-- solo admite el MIME de .docx y esa restricción es justo la garantía de que
-- ahí dentro no entra otra cosa.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'informe-adjuntos',
  'informe-adjuntos',
  false,
  10485760,
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  -- xlsx
    'application/vnd.ms-excel',                                          -- xls
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- docx
    'application/msword',                                                -- doc
    'application/pdf',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Cada usuario solo accede a su carpeta {user_id}/{lote_id}/...
DROP POLICY IF EXISTS "Users upload own adjuntos" ON storage.objects;
CREATE POLICY "Users upload own adjuntos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'informe-adjuntos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users read own adjuntos" ON storage.objects;
CREATE POLICY "Users read own adjuntos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'informe-adjuntos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own adjuntos" ON storage.objects;
CREATE POLICY "Users update own adjuntos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'informe-adjuntos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own adjuntos" ON storage.objects;
CREATE POLICY "Users delete own adjuntos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'informe-adjuntos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
