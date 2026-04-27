-- columna para path del Word personalizado subido por el usuario
ALTER TABLE informes_history ADD COLUMN IF NOT EXISTS custom_docx_path text;

-- bucket de Storage para Word personalizados (privado, 5 MB máx)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'informes-docx',
  'informes-docx',
  false,
  5242880,
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: cada usuario solo accede a su carpeta {user_id}/...
DROP POLICY IF EXISTS "Users upload own informes" ON storage.objects;
CREATE POLICY "Users upload own informes" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'informes-docx' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users read own informes" ON storage.objects;
CREATE POLICY "Users read own informes" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'informes-docx' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own informes" ON storage.objects;
CREATE POLICY "Users update own informes" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'informes-docx' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own informes" ON storage.objects;
CREATE POLICY "Users delete own informes" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'informes-docx' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- profiles table: crear si no existe, asegurar políticas de lectura y escritura
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users upsert own profile" ON profiles;
CREATE POLICY "Users upsert own profile" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
