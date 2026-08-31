import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admin'
import { instanteUtc, proximoEvento } from '@/lib/alertas/calendario'
import { AlertasClient } from './_components/AlertasClient'

export const dynamic = 'force-dynamic'

/**
 * Registro del sistema de alerta temprana.
 *
 * El calendario se resuelve en el servidor porque es una constante del repo: no
 * tiene sentido descargarla al navegador para calcular una cuenta atrás.
 */
export default async function AlertasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdminEmail(user.email)) redirect('/dashboard')

  const proximo = proximoEvento('todos')

  return (
    <AlertasClient
      proximoEventoIso={proximo ? instanteUtc(proximo).toISOString() : null}
      proximoEventoEtiqueta={proximo?.etiqueta ?? null}
    />
  )
}
