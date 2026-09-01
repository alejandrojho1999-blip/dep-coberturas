import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/auth/admin'
import { MINIMO_DIAS } from '@/lib/pulso/modelo'
import { TIPOS } from '@/lib/pulso/ciclos'
import {
  featuresDesde,
  keywordsDesde,
  modeloActivo,
  prediccionesDesde,
  ultimaCapturaPorFuente,
} from '@/lib/pulso/persistencia'
import type { EstadoModelo, RespuestaPulso } from '@/lib/pulso/tipos-ui'

export const dynamic = 'force-dynamic'

/** Días de historia que se pintan en las curvas. */
const VENTANA_CURVAS = 90

/**
 * Lectura del pulso público: curvas de riesgo, palabras clave y estado de las
 * fuentes.
 *
 * Misma guarda que `/api/alertas`: sesión de Supabase más `isAdminEmail`. La
 * lectura se hace con el cliente de servicio porque estas tablas las escribe el
 * cron y a la aplicación solo le corresponde enseñarlas; la política RLS de la
 * migración 024 sigue siendo la puerta que de verdad las protege frente a un
 * cliente que hable con Supabase por su cuenta.
 */
export async function GET(): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return Response.json({ error: 'Solo el administrador ve el pulso' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()
    const desdeFeatures = new Date(Date.now() - VENTANA_CURVAS * 24 * 3_600_000)
      .toISOString()
      .slice(0, 10)

    const [predicciones, keywords, features, capturas, ...modelos] = await Promise.all([
      prediccionesDesde(admin, VENTANA_CURVAS),
      // Relevancia 3 o más: por debajo es ruido de consumo y espectáculo, y la
      // pantalla tiene que enseñar lo que merece una mirada, no todo lo que se
      // midió.
      keywordsDesde(admin, 14, 3),
      featuresDesde(admin, desdeFeatures),
      ultimaCapturaPorFuente(admin),
      ...TIPOS.map((tipo) => modeloActivo(admin, tipo)),
    ])

    const diasConVector = features.length

    const estado: EstadoModelo[] = TIPOS.map((tipo, i) => {
      const fila = modelos[i]
      return {
        tipo,
        activo: fila !== null,
        auc: fila ? Number(fila.metricas.auc ?? 0) : null,
        brier: fila ? Number(fila.metricas.brier ?? 0) : null,
        tasaBase: fila ? Number(fila.metricas.tasaBase ?? 0) : null,
        entrenadoAt: fila?.entrenadoAt ?? null,
        diasConVector,
        // Lo que le falta para poder entrenar, que es lo que el operador
        // necesita saber mientras no haya curva.
        faltanDias: Math.max(0, MINIMO_DIAS - diasConVector),
      }
    })

    return Response.json({
      predicciones,
      keywords,
      fuentes: Object.entries(capturas).map(([fuente, ultimaAt]) => ({ fuente, ultimaAt })),
      modelos: estado,
    } satisfies RespuestaPulso)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
