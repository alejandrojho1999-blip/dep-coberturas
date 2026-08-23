-- Las recomendaciones de los agentes pasan a ser una cartera única y pública
-- entre los usuarios autenticados.
--
-- Antes cada usuario veía y escribía solo lo suyo ("own_data", migración 014),
-- lo que en la práctica dejaba a todo el mundo con una cartera vacía salvo al
-- que ejecutaba los agentes. Ahora hay una sola cartera —la del administrador—
-- que todos leen y solo él modifica.
--
-- La lista de administradores se repite en `src/lib/auth/admin.ts`, que decide
-- lo que enseña la interfaz. Esta es la que manda: sin ella, cualquiera podría
-- escribir llamando a Supabase directamente con la clave anónima.

-- Identificadores de los administradores.
--
-- Es SECURITY DEFINER porque `auth.users` no es legible por el rol
-- `authenticated`. STABLE permite al planificador evaluarla una vez por
-- consulta en vez de una vez por fila.
CREATE OR REPLACE FUNCTION public.admin_user_ids()
  RETURNS SETOF uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = auth, public
AS $$
  SELECT id FROM auth.users WHERE lower(email) IN ('lriofrio915@gmail.com')
$$;

REVOKE ALL ON FUNCTION public.admin_user_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_user_ids() TO authenticated;

-- ¿Es administrador quien hace esta petición?
--
-- Se resuelve con el correo del propio JWT, sin tocar `auth.users`: es el mismo
-- criterio que ya usaba la migración 016 para `informes_history`.
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN ('lriofrio915@gmail.com')
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- La política anterior daba a cada usuario acceso total a sus propias filas.
DROP POLICY IF EXISTS "own_data" ON agent_recommendations;

-- Lectura: cualquier usuario autenticado ve la cartera del administrador.
CREATE POLICY "todos_leen_la_cartera_del_admin"
  ON agent_recommendations FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT public.admin_user_ids()));

-- Escritura: solo el administrador, y solo sobre filas suyas. La segunda
-- condición evita que pudiera escribir en nombre de otro usuario.
CREATE POLICY "solo_el_admin_crea"
  ON agent_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND user_id = auth.uid());

CREATE POLICY "solo_el_admin_actualiza"
  ON agent_recommendations FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND user_id = auth.uid())
  WITH CHECK (public.is_admin() AND user_id = auth.uid());

CREATE POLICY "solo_el_admin_borra"
  ON agent_recommendations FOR DELETE
  TO authenticated
  USING (public.is_admin() AND user_id = auth.uid());
