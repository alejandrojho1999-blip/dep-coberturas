-- `admin_user_ids()` y `is_admin()` quedaron ejecutables por usuarios anónimos.
--
-- La migración 018 las protegía con `REVOKE ALL ... FROM public`, y eso no basta:
-- Supabase tiene privilegios por defecto que conceden EXECUTE de forma NOMINAL a
-- los roles `anon` y `authenticated` sobre cada función nueva del esquema
-- `public`. Revocar del pseudo-rol PUBLIC no toca esas concesiones nominales, así
-- que la revocación de la 018 no surtió efecto sobre `anon`.
--
-- Comprobado el 2026-08-31 llamando al endpoint REST con la clave anónima —la que
-- viaja en el JavaScript que descarga cualquier visitante—: `admin_user_ids()`
-- respondía 200 con el uuid de la cuenta de administrador.
--
-- No es escalable a acceso: RLS compara contra `auth.uid()`, que sale de un JWT
-- firmado, y conocer el uuid no permite suplantarlo. Pero es un identificador
-- interno que no tiene por qué ser público, y ninguna de las dos funciones tiene
-- nada que hacer en manos de un visitante sin sesión: las políticas que las usan
-- se evalúan siempre con un usuario autenticado.
REVOKE EXECUTE ON FUNCTION public.admin_user_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin()       FROM anon;
