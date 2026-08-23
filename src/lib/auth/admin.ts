/**
 * Quién puede operar los agentes.
 *
 * El producto tiene una sola cartera: la que genera el administrador con los
 * agentes. El resto de usuarios la ve, pero no la modifica ni genera
 * recomendaciones propias.
 *
 * La lista se repite en la política RLS de `agent_recommendations`
 * (migración 018). Esta constante decide qué enseña la interfaz y qué acepta
 * cada endpoint; la de la base de datos es la que manda de verdad, porque una
 * comprobación en el servidor de la app se puede saltar llamando a Supabase
 * directamente con la clave anónima. Si se cambia una, hay que cambiar la otra.
 */
export const ADMIN_EMAILS = ['lriofrio915@gmail.com'] as const

/** ¿Este correo puede ejecutar agentes y escribir recomendaciones? */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return (ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase())
}
